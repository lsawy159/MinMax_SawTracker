import { supabase } from './supabase'

interface EnqueueEmailOptions {
  toEmails: string[]
  subject: string
  htmlContent?: string
  textContent?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  category?: 'general' | 'alert-digest' | 'backup'
  ccEmails?: string[]
  bccEmails?: string[]
  scheduledAt?: Date
}

interface EnqueueEmailResult {
  success: boolean
  id?: string
  error?: string
}

// Basic email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Maximum recipients per email
const MAX_RECIPIENTS = 100

const DIGEST_ADMIN_EMAIL = 'ahmad.alsawy159@gmail.com'

function resolveQueueMode(): 'normal' | 'digest-only' {
  const viteMode = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_EMAIL_QUEUE_MODE
  const processMode =
    typeof process !== 'undefined' && process.env
      ? process.env.VITE_EMAIL_QUEUE_MODE
      : undefined

  const mode = (processMode || viteMode || 'normal').trim().toLowerCase()
  return mode === 'digest-only' ? 'digest-only' : 'normal'
}

// Check if email is allowed by current queue mode constraint
function validateQueueModeConstraint(options: EnqueueEmailOptions): {
  allowed: boolean
  error?: string
} {
  const mode = resolveQueueMode()

  if (mode === 'digest-only') {
    const normalizedCategory = (options.category || 'general').toLowerCase()

    // Backup notifications are operationally critical and should not be blocked by digest mode.
    if (normalizedCategory === 'backup') {
      return { allowed: true }
    }

    const isDigest =
      typeof options.subject === 'string' && options.subject.toLowerCase().includes('daily digest')

    const isLegacyBackupSubject =
      typeof options.subject === 'string' && options.subject.toLowerCase().includes('backup')

    if (isLegacyBackupSubject) {
      return { allowed: true }
    }

    const adminOnly = options.toEmails.length === 1 && options.toEmails[0] === DIGEST_ADMIN_EMAIL

    if (!isDigest || !adminOnly) {
      return {
        allowed: false,
        error:
          `Email queue is in digest-only mode. Only a single Daily Digest to ${DIGEST_ADMIN_EMAIL} is allowed.`,
      }
    }
  }

  return { allowed: true }
}

export async function enqueueEmail(options: EnqueueEmailOptions): Promise<EnqueueEmailResult> {
  const {
    toEmails,
    subject,
    htmlContent,
    textContent,
    priority = 'medium',
    ccEmails,
    bccEmails,
    scheduledAt,
  } = options

  // Validate queue mode constraint (digest-only or normal)
  const modeCheck = validateQueueModeConstraint(options)
  if (!modeCheck.allowed) {
    return { success: false, error: modeCheck.error }
  }

  // 1. Email validation
  const allRecipients = [...toEmails, ...(ccEmails || []), ...(bccEmails || [])]
  for (const email of allRecipients) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Invalid email address: ${email}` }
    }
  }

  // 2. Max recipients check
  if (allRecipients.length === 0) {
    return { success: false, error: 'No recipients provided.' }
  }
  if (allRecipients.length > MAX_RECIPIENTS) {
    return { success: false, error: `Too many recipients. Maximum allowed is ${MAX_RECIPIENTS}.` }
  }

  try {
    const { data, error } = await supabase
      .from('email_queue')
      .insert({
        to_emails: toEmails,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        subject,
        html_content: htmlContent,
        text_content: textContent,
        priority,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        status: 'pending', // Always pending on insertion
      })
      .select('id')
      .single()

    if (error) {
      // Error logged to activity_log asynchronously
      // Non-blocking activity log: failure case
      void Promise.resolve(
        supabase.from('activity_log').insert({
          entity_type: 'email_queue',
          action: 'create_failed',
          details: error.message,
        })
      ).catch(() => {
        // Silently ignore activity_log failures — email queue operation must succeed
      })
      return { success: false, error: 'Failed to enqueue email.' }
    }

    // Non-blocking activity log: success case
    void Promise.resolve(
      supabase.from('activity_log').insert({
        entity_type: 'email_queue',
        action: 'create_success',
        entity_id: data.id as unknown as string,
      })
    ).catch(() => {
      // Silently ignore activity_log failures — email queue operation must succeed
    })

    return { success: true, id: data.id }
  } catch (err) {
    // Non-blocking activity log: exception case
    void Promise.resolve(
      supabase.from('activity_log').insert({
        entity_type: 'email_queue',
        action: 'create_exception',
        details: (err as Error).message,
      })
    ).catch(() => {
      // Silently ignore activity_log failures — email queue operation must succeed
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
