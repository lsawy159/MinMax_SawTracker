// Edge Function: نسخة مبسطة وفعالة لإرسال البريد عبر Gmail
// تستخدم واجهة REST بدلاً من SMTP المباشر

interface EmailRequest {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  cc?: string | string[]
  bcc?: string | string[]
}

interface EmailResponse {
  success: boolean
  message: string
  timestamp: string
}

// Helper to format email addresses
function formatEmailArray(email: string | string[]): string[] {
  if (Array.isArray(email)) {
    return email.filter(e => typeof e === 'string' && e.trim().length > 0)
  }
  return email && typeof email === 'string' ? [email.trim()] : []
}

// Helper to send email via external API
async function sendEmailViaAPI(
  to: string[],
  subject: string,
  html: string,
  text: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Option 1: Using SendGrid API (if configured)
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY')
  if (sendgridKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: to.map(email => ({ email })),
            cc: cc?.map(email => ({ email })) || [],
            bcc: bcc?.map(email => ({ email })) || [],
            subject
          }],
          from: { email: Deno.env.get('SENDGRID_FROM_EMAIL') },
          content: [
            { type: 'text/plain', value: text || subject },
            { type: 'text/html', value: html || `<p>${text || subject}</p>` }
          ]
        })
      })

      if (response.ok) {
        return { success: true, messageId: response.headers.get('X-Message-Id') || 'sent' }
      }
      return { success: false, error: `SendGrid error: ${response.status}` }
    } catch (error) {
      console.error('SendGrid error:', error)
      return { success: false, error: `SendGrid error: ${error.message}` }
    }
  }

  // Option 2: Using Resend API (simpler alternative)
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL'),
          to,
          cc,
          bcc,
          subject,
          html: html || `<p>${text || subject}</p>`,
          text: text || subject
        })
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, messageId: data.id }
      }
      return { success: false, error: `Resend error: ${response.status}` }
    } catch (error) {
      console.error('Resend error:', error)
      return { success: false, error: `Resend error: ${error.message}` }
    }
  }

  // Option 3: Using Mailgun API
  const mailgunKey = Deno.env.get('MAILGUN_API_KEY')
  if (mailgunKey) {
    try {
      const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'mail.sawtracker.com'
      const formData = new FormData()
      formData.append('from', Deno.env.get('MAILGUN_FROM_EMAIL') || 'Ahmad.alsawy159@gmail.com')
      to.forEach(email => formData.append('to', email))
      if (cc) cc.forEach(email => formData.append('cc', email))
      if (bcc) bcc.forEach(email => formData.append('bcc', email))
      formData.append('subject', subject)
      formData.append('text', text || subject)
      formData.append('html', html || `<p>${text || subject}</p>`)

      const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${mailgunKey}`)}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, messageId: data.id }
      }
      return { success: false, error: `Mailgun error: ${response.status}` }
    } catch (error) {
      console.error('Mailgun error:', error)
      return { success: false, error: `Mailgun error: ${error.message}` }
    }
  }

  // Fallback: Log to console and return error
  console.warn('No email service configured (SENDGRID_API_KEY, RESEND_API_KEY, or MAILGUN_API_KEY)')
  return { 
    success: false, 
    error: 'No email service configured. Please set up SendGrid, Resend, or Mailgun API keys in Supabase Secrets.' 
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing Authorization header' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.substring(7)
    if (token !== serviceKey && token !== anonKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid token' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Parse request body
    const body = await req.json()
    const { to, subject, html, text, cc, bcc } = body as EmailRequest

    console.log('📧 Email request received:', {
      to: Array.isArray(to) ? to.length : 1,
      subject: subject.substring(0, 50),
      hasHtml: !!html,
      hasText: !!text
    })

    // Validate required fields
    if (!to || !subject) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields: to, subject' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Format email addresses
    const recipients = formatEmailArray(to)
    const ccRecipients = cc ? formatEmailArray(cc) : undefined
    const bccRecipients = bcc ? formatEmailArray(bcc) : undefined

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No valid email recipients' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📤 Sending email to:', recipients)

    // Send email
    const result = await sendEmailViaAPI(
      recipients,
      subject,
      html || '',
      text || subject,
      ccRecipients,
      bccRecipients
    )

    if (!result.success) {
      console.error('❌ Email send failed:', result.error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: result.error || 'Failed to send email'
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Email sent successfully:', result.messageId)

    const response: EmailResponse = {
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`,
      timestamp: new Date().toISOString()
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ Error in send-email function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        message: `Error: ${error.message || 'Unknown error occurred'}`
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
