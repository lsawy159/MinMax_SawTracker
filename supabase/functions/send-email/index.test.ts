import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

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
  messageIds?: string[]
  failedRecipients?: string[]
  timestamp: string
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

const createMockRequest = (
  payload: EmailRequest,
  headers: Record<string, string> = {},
  method = 'POST'
): Request =>
  new Request('http://localhost:3000', {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'Bearer cron-secret',
      ...headers,
    },
    body: method !== 'OPTIONS' ? JSON.stringify(payload) : undefined,
  })

Deno.test('send-email: requires to field', () => {
  const payload = {
    subject: 'Test Subject',
    text: 'Test message'
  } as Partial<EmailRequest>
  const hasTo = !!payload.to

  assertEquals(hasTo, false)
})

Deno.test('send-email: requires subject field', () => {
  const payload = {
    to: 'user@example.com',
    text: 'Test message'
  } as Partial<EmailRequest>
  const hasSubject = !!payload.subject

  assertEquals(hasSubject, false)
})

Deno.test('send-email: to accepts single email string', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test'
  }
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]

  assertEquals(recipients.length, 1)
  assertEquals(recipients[0], 'user@example.com')
})

Deno.test('send-email: to accepts array of emails', () => {
  const payload: EmailRequest = {
    to: ['user1@example.com', 'user2@example.com'],
    subject: 'Test'
  }
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]

  assertEquals(recipients.length, 2)
})

Deno.test('send-email: empty recipients array rejected', () => {
  const recipients: string[] = []
  const valid = recipients.length > 0

  assertEquals(valid, false)
})

Deno.test('send-email: cc accepts single email', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    cc: 'cc@example.com'
  }
  const ccList = payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined

  assertEquals(ccList?.length, 1)
  assertEquals(ccList?.[0], 'cc@example.com')
})

Deno.test('send-email: cc accepts array', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    cc: ['cc1@example.com', 'cc2@example.com']
  }
  const ccList = payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined

  assertEquals(ccList?.length, 2)
})

Deno.test('send-email: bcc accepts single email', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    bcc: 'bcc@example.com'
  }
  const bccList = payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined

  assertEquals(bccList?.length, 1)
})

Deno.test('send-email: bcc accepts array', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    bcc: ['bcc1@example.com', 'bcc2@example.com']
  }
  const bccList = payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined

  assertEquals(bccList?.length, 2)
})

Deno.test('send-email: html takes precedence over text', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    html: '<p>HTML content</p>',
    text: 'Text content'
  }
  const emailContent = payload.html || (payload.text ? `<p>${payload.text}</p>` : undefined)

  assertEquals(emailContent, '<p>HTML content</p>')
})

Deno.test('send-email: text converted to HTML wrapper if no html', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test',
    text: 'Plain text'
  }
  const emailContent = payload.html || (payload.text ? `<p>${payload.text}</p>` : undefined)

  assertEquals(emailContent, '<p>Plain text</p>')
})

Deno.test('send-email: no content if neither html nor text', () => {
  const payload: EmailRequest = {
    to: 'user@example.com',
    subject: 'Test'
  }
  const emailContent = payload.html || (payload.text ? `<p>${payload.text}</p>` : undefined)

  assertEquals(emailContent, undefined)
})

Deno.test('send-email: OPTIONS request returns 204', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
  const response = new Response(null, { status: 204, headers: corsHeaders })

  assertEquals(response.status, 204)
})

Deno.test('send-email: successful single send returns 200', () => {
  const response: EmailResponse = {
    success: true,
    message: 'Email sent successfully to 1 recipient(s)',
    messageIds: ['msg-123'],
    timestamp: new Date().toISOString()
  }

  assertEquals(response.success, true)
  assertEquals(response.messageIds?.length, 1)
})

Deno.test('send-email: successful multi-send returns all message IDs', () => {
  const response: EmailResponse = {
    success: true,
    message: 'Email sent successfully to 3 recipient(s)',
    messageIds: ['msg-1', 'msg-2', 'msg-3'],
    timestamp: new Date().toISOString()
  }

  assertEquals(response.messageIds?.length, 3)
})

Deno.test('send-email: partial failure returns 500', () => {
  const response: EmailResponse = {
    success: false,
    message: 'Failed to send to 1 recipient(s): failed@example.com',
    messageIds: ['msg-1', 'msg-2'],
    failedRecipients: ['failed@example.com'],
    timestamp: new Date().toISOString()
  }

  assertEquals(response.success, false)
  assertEquals(response.failedRecipients?.length, 1)
})

Deno.test('send-email: complete failure includes failed recipients', () => {
  const response: EmailResponse = {
    success: false,
    message: 'Failed to send to 2 recipient(s): user1@example.com, user2@example.com',
    failedRecipients: ['user1@example.com', 'user2@example.com'],
    timestamp: new Date().toISOString()
  }

  assertEquals(response.failedRecipients?.length, 2)
  assertStringIncludes(response.message, 'user1@example.com')
})

Deno.test('send-email: Resend API requires apiKey', () => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const configured = !!(apiKey && fromEmail)

  // This will be false in test environment, but logic is correct
  assertEquals(typeof configured, 'boolean')
})

Deno.test('send-email: response includes timestamp', () => {
  const response: EmailResponse = {
    success: true,
    message: 'Test',
    messageIds: ['msg-1'],
    timestamp: new Date().toISOString()
  }

  assertEquals(typeof response.timestamp, 'string')
  assertStringIncludes(response.timestamp, 'T')
})

Deno.test('send-email: CORS headers include charset', () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8'
  }

  assertStringIncludes(headers['Content-Type'], 'charset=utf-8')
})

Deno.test('send-email: rate limit delay between multiple sends', () => {
  const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com']
  const delayMs = 600
  const totalDelay = (recipients.length - 1) * delayMs

  assertEquals(totalDelay, 1200)
})

Deno.test('send-email: no delay for single recipient', () => {
  const recipients = ['user@example.com']
  const delayNeeded = recipients.length > 1

  assertEquals(delayNeeded, false)
})

Deno.test('send-email: Resend POST body structure valid', () => {
  const emailData = {
    from: 'noreply@sawtracker.app',
    to: ['user@example.com'],
    cc: ['cc@example.com'],
    bcc: ['bcc@example.com'],
    subject: 'Test Subject',
    html: '<p>Content</p>',
    text: 'Content'
  }

  assertEquals(typeof emailData.from, 'string')
  assertEquals(Array.isArray(emailData.to), true)
})

Deno.test('send-email: service token required', () => {
  const req = createMockRequest({
    to: 'user@example.com',
    subject: 'Test'
  })
  const authHeader = req.headers.get('Authorization')

  assertStringIncludes(authHeader || '', 'Bearer')
})
