import { supabase } from './supabase';

interface EnqueueEmailOptions {
  toEmails: string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  ccEmails?: string[];
  bccEmails?: string[];
  scheduledAt?: Date;
}

interface EnqueueEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Basic email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Maximum recipients per email
const MAX_RECIPIENTS = 100;

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
  } = options;

  // Safety mode: restrict queue to Daily Digest only when enabled
  const mode = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_EMAIL_QUEUE_MODE || 'digest-only'
  if (mode === 'digest-only') {
    const isDigest = typeof subject === 'string' && subject.toLowerCase().includes('daily digest')
    const adminOnly = toEmails.length === 1 && toEmails[0] === 'ahmad.alsawy159@gmail.com'
    if (!isDigest || !adminOnly) {
      return { success: false, error: 'Email queue is in digest-only mode. Only a single Daily Digest to ahmad.alsawy159@gmail.com is allowed.' }
    }
  }

  // 1. Email validation
  const allRecipients = [...toEmails, ...(ccEmails || []), ...(bccEmails || [])];
  for (const email of allRecipients) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Invalid email address: ${email}` };
    }
  }

  // 2. Max recipients check
  if (allRecipients.length === 0) {
    return { success: false, error: 'No recipients provided.' };
  }
  if (allRecipients.length > MAX_RECIPIENTS) {
    return { success: false, error: `Too many recipients. Maximum allowed is ${MAX_RECIPIENTS}.` };
  }

  try {
    const { data, error } = await supabase.from('email_queue').insert({
      to_emails: toEmails,
      cc_emails: ccEmails,
      bcc_emails: bccEmails,
      subject,
      html_content: htmlContent,
      text_content: textContent,
      priority,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      status: 'pending', // Always pending on insertion
    }).select('id').single();

    if (error) {
      // Log the detailed error internally, but return a generic one to the client
      console.error('Error enqueuing email:', error);
      // TODO: Log to activity_log table for review (Step 2.1 Security Action)
      // await supabase.from('activity_log').insert({ entity_type: 'email_queue', action: 'create_failed', details: error.message });
      return { success: false, error: 'Failed to enqueue email.' };
    }

    // TODO: Log successful enqueue to activity_log (Step 2.1 Security Action)
    // await supabase.from('activity_log').insert({ entity_type: 'email_queue', action: 'create_success', resource_id: data.id });

    return { success: true, id: data.id };
  } catch (err) {
    console.error('Unexpected error enqueuing email:', err);
    // TODO: Log to activity_log table for review (Step 2.1 Security Action)
    // await supabase.from('activity_log').insert({ entity_type: 'email_queue', action: 'create_exception', details: (err as Error).message });
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
