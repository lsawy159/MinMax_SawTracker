/**
 * Shared CORS helper for Edge Functions.
 * Uses ALLOWED_ORIGINS env var (comma-separated) instead of wildcard.
 * Falls back to an empty string (blocks all) if ALLOWED_ORIGINS is not set.
 */

const ALLOWED: string[] = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)

/**
 * Returns CORS headers for a given origin.
 * If the origin is in the allow-list, reflects it back.
 * Otherwise returns an empty string for Allow-Origin (effectively blocked by browser).
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED.includes(origin) ? origin : (ALLOWED[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Returns CORS headers that also allow GET (for scheduler/cron endpoints).
 */
export function corsHeadersWithGet(origin: string | null): Record<string, string> {
  return {
    ...corsHeaders(origin),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }
}
