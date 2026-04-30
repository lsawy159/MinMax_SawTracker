/**
 * T-110: Simple IP-based rate limiting using Supabase (no external Redis).
 * Strategy: count rows in `rate_limit_log` per (identifier, window).
 * The table must exist — see migration note below.
 *
 * Migration (run once in Supabase):
 * CREATE TABLE IF NOT EXISTS rate_limit_log (
 *   id bigserial PRIMARY KEY,
 *   identifier text NOT NULL,
 *   window_start timestamptz NOT NULL DEFAULT now(),
 *   hit_count int NOT NULL DEFAULT 1
 * );
 * CREATE INDEX IF NOT EXISTS rate_limit_log_lookup
 *   ON rate_limit_log (identifier, window_start);
 *
 * RLS: disabled on this table (service role only).
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface RateLimitOptions {
  /** Unique key for this caller, e.g. IP + route */
  identifier: string
  /** Maximum allowed requests per window */
  maxRequests: number
  /** Window size in seconds (default 60) */
  windowSecs?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSecs: number
}

/**
 * Check and increment the rate limit counter.
 * Returns `allowed: false` when the limit is exceeded.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { identifier, maxRequests, windowSecs = 60 } = options
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowSecs * 1000).toISOString()

  try {
    // Count hits in the current window
    const { count, error: countError } = await supabase
      .from('rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('window_start', windowStart)

    if (countError) {
      // Fail open — don't block users if rate limit table is unavailable
      console.warn('[RateLimit] DB error, failing open:', countError.message)
      return { allowed: true, remaining: maxRequests, retryAfterSecs: 0 }
    }

    const hits = count ?? 0

    if (hits >= maxRequests) {
      return { allowed: false, remaining: 0, retryAfterSecs: windowSecs }
    }

    // Record this hit (fire-and-forget)
    supabase
      .from('rate_limit_log')
      .insert({ identifier, window_start: now.toISOString() })
      .then(({ error }) => {
        if (error) console.warn('[RateLimit] Insert error:', error.message)
      })

    return { allowed: true, remaining: maxRequests - hits - 1, retryAfterSecs: 0 }
  } catch (err) {
    // Fail open on any unexpected error
    console.warn('[RateLimit] Unexpected error, failing open:', err)
    return { allowed: true, remaining: maxRequests, retryAfterSecs: 0 }
  }
}

/** Build 429 response headers */
export function rateLimitHeaders(retryAfterSecs: number): Record<string, string> {
  return {
    'Retry-After': String(retryAfterSecs),
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '0',
  }
}

/** Extract caller identifier: prefers CF-Connecting-IP, falls back to X-Forwarded-For */
export function getIdentifier(req: Request, suffix = ''): string {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  return suffix ? `${ip}:${suffix}` : ip
}
