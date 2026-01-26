// Clean file rewrite: Resend-based email sender with UTF-8 everywhere
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRequest {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

interface EmailResponse {
  success: boolean;
  message: string;
  messageId?: string;
  timestamp: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function toArray(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

function formatEmailArray(email: string | string[] | undefined): string[] | undefined {
  const arr = toArray(email);
  if (!arr) return undefined;
  const cleaned = arr.map(e => `${e}`.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

async function sendViaResend(payload: {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { success: false, error: "RESEND_API_KEY missing" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL"),
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.html ?? (payload.text ? `<p>${payload.text}</p>` : undefined),
      text: payload.text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.id) return { success: true, messageId: data.id };
  return { success: false, error: data?.message || `Resend error ${res.status}` };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, message: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const { to, subject, html, text, cc, bcc } = (await req.json()) as EmailRequest;

    if (!to || !subject) {
      return new Response(JSON.stringify({ success: false, message: "Missing required fields: to, subject" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const toList = formatEmailArray(to);
    if (!toList?.length) {
      return new Response(JSON.stringify({ success: false, message: "No valid email recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const result = await sendViaResend({
      to: toList,
      subject,
      html,
      text,
      cc: formatEmailArray(cc),
      bcc: formatEmailArray(bcc),
    });

    if (!result.success) {
      return new Response(JSON.stringify({ success: false, message: result.error || "Failed to send" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const response: EmailResponse = {
      success: true,
      message: `Email sent successfully to ${toList.length} recipient(s)`,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err: unknown) {
    const error = err as Record<string, unknown>
    return new Response(JSON.stringify({ success: false, message: `Error: ${error?.message || "unknown"}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
// البسيط والفعال - يستخدم Resend بدلاً من Gmail SMTP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRequest {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

interface EmailResponse {
  success: boolean;
  message: string;
  messageId?: string;
  timestamp: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper: Format email addresses
function formatEmailArray(email: string | string[]): string[] {
  if (Array.isArray(email)) {
    return email.filter((e) => typeof e === "string" && e.trim().length > 0);
  }
  return email && typeof email === "string" ? [email.trim()] : [];
}

// Main send function using Resend
async function sendEmailViaResend(
  to: string[],
  subject: string,
  html: string,
  text: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY not configured");
    return {
      success: false,
      error: "Email service not configured. Please set RESEND_API_KEY in Supabase Secrets.",
    };
  }

  try {
    console.log("📤 Sending via Resend to:", to);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL"),
        to,
        cc: cc && cc.length > 0 ? cc : undefined,
        bcc: bcc && bcc.length > 0 ? bcc : undefined,
        subject,
        html: html || `<p>${text || subject}</p>`,
        text: text || subject,
      }),
    });

    const data = (await response.json()) as Record<string, unknown>

    if (response.ok && data.id) {
      console.log("✅ Email sent successfully:", data.id);
      return { success: true, messageId: data.id };
    }

    console.error("❌ Resend API error:", data);
    return {
      success: false,
      error: data.message || `Resend error: ${response.status}`,
    };
  } catch (error) {
    console.error("❌ Error sending via Resend:", error);
    return { success: false, error: `Error: ${error.message}` };
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing or invalid Authorization header",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // Parse request
    const body = (await req.json()) as EmailRequest;
    const { to, subject, html, text, cc, bcc } = body;

    console.log("📧 Email request:", {
      to: Array.isArray(to) ? to.length : 1,
      subject: subject?.substring(0, 50),
    });

    // Validate
    if (!to || !subject) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: to, subject",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Format recipients
    const recipients = formatEmailArray(to);
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No valid email recipients",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Send email
    const result = await sendEmailViaResend(
      recipients,
      subject,
      html || "",
      text || subject,
      cc ? formatEmailArray(cc) : undefined,
      bcc ? formatEmailArray(bcc) : undefined
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: result.error || "Failed to send email",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const response: EmailResponse = {
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Error: ${error.message}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
});

interface EmailRequest {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: Array<{
    filename: string
    content?: string // base64 encoded content
    encoding?: string
  }>
}

interface EmailResponse {
  success: boolean
  message?: string
  error?: string
  messageId?: string
}

// دالة مساعدة: قراءة سطر كامل من SMTP (حتى \r\n)
async function readSMTPLine(conn: Deno.Conn, decoder: TextDecoder, timeoutMs: number = 10000): Promise<string> {
  let buffer = new Uint8Array(0)
  const chunkSize = 256 // حجم أصغر للقراءة التدريجية
  
  while (true) {
    const chunk = new Uint8Array(chunkSize)
    const readPromise = conn.read(chunk)
    const n = await withTimeout(readPromise, timeoutMs, `SMTP read timeout after ${timeoutMs}ms`)
    
    if (n === null || n === 0) {
      // لا توجد بيانات إضافية - إرجاع ما تم قراءته
      if (buffer.length > 0) {
        break
      }
      // انتظار قصير ثم المحاولة مرة أخرى
      await new Promise(resolve => setTimeout(resolve, 100))
      continue
    }
    
    // دمج البيانات
    const newBuffer = new Uint8Array(buffer.length + n)
    newBuffer.set(buffer)
    newBuffer.set(chunk.subarray(0, n), buffer.length)
    buffer = newBuffer
    
    // التحقق من وجود \r\n (نهاية السطر)
    const text = decoder.decode(buffer, { stream: true })
    if (text.includes('\r\n')) {
      return text
    }
    
    // حماية من overflow
    if (buffer.length > 8192) {
      return decoder.decode(buffer)
    }
  }
  
  return decoder.decode(buffer)
}

// دالة مساعدة: قراءة استجابة SMTP (قد تكون متعددة الأسطر)
async function readSMTPResponse(conn: Deno.Conn, decoder: TextDecoder, timeoutMs: number = 10000): Promise<string> {
  let response = ''
  
  while (true) {
    const line = await readSMTPLine(conn, decoder, timeoutMs)
    response += line
    
    // التحقق من نهاية الاستجابة (السطر الأخير يبدأ بـ "XXX " وليس "XXX-")
    const lines = response.trim().split('\r\n')
    const lastLine = lines[lines.length - 1]
    
    if (lastLine && /^\d{3} [^\d]/.test(lastLine.trim())) {
      break
    }
    
    // حماية من loops لا نهائية
    if (lines.length > 100) {
      break
    }
  }
  
  return response
}

// دالة لإرسال بريد عبر SMTP مباشرة مع تحسينات
async function sendEmailViaSMTP(
  hostname: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Array<{ filename: string; content: Uint8Array; contentType: string }> = []
): Promise<void> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const operationTimeout = 15000 // 15 ثانية لكل عملية (مخفضة لتسريع العملية)
  
  let conn: Deno.Conn | null = null
  
  try {
    console.log(`الاتصال بـ ${hostname}:${port}`)
    
    // الاتصال بالخادم مع timeout
    const connectPromise = Deno.connect({ hostname, port })
    conn = await withTimeout(connectPromise, operationTimeout, 'Connection timeout')
    
    // قراءة رسالة الترحيب
    const greeting = await readSMTPResponse(conn, decoder, operationTimeout)
    console.log('رسالة الترحيب:', greeting.trim())
    
    if (!greeting.startsWith('220')) {
      throw new Error(`SMTP server error: ${greeting}`)
    }
    
    // EHLO
    console.log('إرسال EHLO...')
    await conn.write(encoder.encode(`EHLO ${hostname}\r\n`))
    const ehloResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    console.log('استجابة EHLO:', ehloResponse.substring(0, 100))
    
    if (!ehloResponse.startsWith('250')) {
      throw new Error(`EHLO failed: ${ehloResponse}`)
    }
    
    // STARTTLS (للـ port 587)
    if (port === 587) {
      console.log('بدء STARTTLS...')
      await conn.write(encoder.encode('STARTTLS\r\n'))
      const starttlsResponse = await readSMTPResponse(conn, decoder, operationTimeout)
      console.log('استجابة STARTTLS:', starttlsResponse.trim())
      
      if (!starttlsResponse.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${starttlsResponse}`)
      }
      
      // ترقية الاتصال إلى TLS
      conn = await withTimeout(
        Deno.startTls(conn, { hostname }),
        operationTimeout,
        'TLS handshake timeout'
      )
      console.log('تم ترقية الاتصال إلى TLS')
      
      // EHLO مرة أخرى بعد TLS
      await conn.write(encoder.encode(`EHLO ${hostname}\r\n`))
      const ehloTlsResponse = await readSMTPResponse(conn, decoder, operationTimeout)
      console.log('استجابة EHLO بعد TLS:', ehloTlsResponse.substring(0, 100))
    }
    
    // AUTH LOGIN
    console.log('بدء المصادقة...')
    await conn.write(encoder.encode('AUTH LOGIN\r\n'))
    const authResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!authResponse.startsWith('334')) {
      throw new Error(`AUTH LOGIN failed: ${authResponse}`)
    }
    
    await conn.write(encoder.encode(`${btoa(username)}\r\n`))
    const userResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!userResponse.startsWith('334')) {
      throw new Error(`Username authentication failed: ${userResponse}`)
    }
    
    await conn.write(encoder.encode(`${btoa(password)}\r\n`))
    const passResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!passResponse.startsWith('235')) {
      throw new Error(`Password authentication failed: ${passResponse}`)
    }
    console.log('تمت المصادقة بنجاح')
    
    // MAIL FROM
    console.log(`إرسال MAIL FROM: ${from}`)
    await conn.write(encoder.encode(`MAIL FROM:<${from}>\r\n`))
    const mailFromResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!mailFromResponse.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${mailFromResponse}`)
    }
    
    // RCPT TO
    console.log(`إرسال RCPT TO: ${to}`)
    await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`))
    const rcptResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!rcptResponse.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${rcptResponse}`)
    }
    
    // DATA
    console.log('إرسال DATA command...')
    await conn.write(encoder.encode('DATA\r\n'))
    const dataResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!dataResponse.startsWith('354')) {
      throw new Error(`DATA command failed: ${dataResponse}`)
    }
    
    // بناء محتوى البريد
    console.log('بناء محتوى البريد...')
    let emailContent: string[]
    
    if (attachments.length > 0) {
      console.log(`إضافة ${attachments.length} مرفق(ات)`)
      // إذا كان هناك مرفقات - استخدم multipart/mixed
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`
      emailContent = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 8bit`,
        '',
        html,
        ''
      ]
      
      // إضافة المرفقات
      for (const attachment of attachments) {
        console.log(`معالجة مرفق: ${attachment.filename} (${attachment.content.length} بايت)`)
        // تحويل Uint8Array إلى base64 بشكل فعال
        let base64 = ''
        const chunkSize = 8192
        for (let i = 0; i < attachment.content.length; i += chunkSize) {
          const chunk = attachment.content.subarray(i, Math.min(i + chunkSize, attachment.content.length))
          // تحويل chunk إلى binary string بطريقة آمنة
          let binaryString = ''
          for (let j = 0; j < chunk.length; j++) {
            binaryString += String.fromCharCode(chunk[j])
          }
          base64 += btoa(binaryString)
        }
        
        // تقسيم base64 إلى أسطر 76 حرف
        const base64Lines = base64.match(/.{1,76}/g) || [base64]
        
        emailContent.push(
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          `Content-Transfer-Encoding: base64`,
          '',
          ...base64Lines,
          ''
        )
      }
      
      emailContent.push(`--${boundary}--`, '')
    } else {
      // بدون مرفقات - HTML بسيط
      emailContent = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset="UTF-8"`,
        '',
        html,
        ''
      ]
    }
    
    // إرسال محتوى البريد
    console.log(`إرسال محتوى البريد (${emailContent.join('\r\n').length} حرف)...`)
    const emailContentStr = emailContent.join('\r\n')
    await conn.write(encoder.encode(emailContentStr))
    await conn.write(encoder.encode('\r\n.\r\n'))
    
    const endDataResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    console.log('استجابة بعد إرسال البيانات:', endDataResponse.trim())
    
    if (!endDataResponse.startsWith('250')) {
      throw new Error(`Email send failed: ${endDataResponse}`)
    }
    
    // QUIT
    console.log('إرسال QUIT...')
    await conn.write(encoder.encode('QUIT\r\n'))
    await readSMTPResponse(conn, decoder, 5000) // timeout أقصر للـ QUIT
    
    console.log('تم إرسال البريد بنجاح')
    
  } catch (error) {
    console.error('خطأ في إرسال البريد عبر SMTP:', error)
    throw error
  } finally {
    if (conn) {
      try {
        conn.close()
      } catch {
        // تجاهل أخطاء الإغلاق
      }
    }
  }
}

// دالة مساعدة: إرجاع استجابة خطأ مع CORS
function errorResponse(message: string, status: number = 500, corsHeaders: Record<string, string>): Response {
  const errorResponse: EmailResponse = {
    success: false,
    error: message
  }
  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders)
  }

  // Security: Authentication & Authorization
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Unauthorized request: Missing or invalid Authorization header')
    return errorResponse('Unauthorized', 401, corsHeaders)
  }

  const token = authHeader.substring(7) // Remove "Bearer "
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  
  // Accept either service role key or anon key
  if (token !== serviceRoleKey && token !== anonKey) {
    console.warn('Unauthorized request: Invalid token')
    // TODO: Log to security_events table
    return errorResponse('Unauthorized', 401, corsHeaders)
  }

  // Security: Rate Limiting (10 emails per minute per IP)
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  
  // Simple in-memory rate limiting (for production, use Redis or database)
  // Note: This is a basic implementation. For production, use a proper rate limiter
  const now = Date.now()
  
  // TODO: Implement persistent rate limiting with database or KV store
  // For now, log the attempt for monitoring
  console.log(`Rate limit check for IP ${clientIP} at ${new Date(now).toISOString()}`)

  // إضافة timeout عام للدالة بأكملها (50 ثانية - أقل من حد Supabase البالغ 60 ثانية)
  const functionTimeout = 50000
  const functionStartTime = Date.now()

  try {
    console.log('بدء معالجة طلب إرسال بريد')
    
    // قراءة إعدادات Gmail من Environment Variables
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    // التحقق من وجود الإعدادات
    if (!gmailUser || !gmailPassword) {
      console.error('Email configuration missing. GMAIL_USER:', !!gmailUser, 'GMAIL_APP_PASSWORD:', !!gmailPassword)
      return errorResponse(
        'Email configuration not found. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables in Supabase Dashboard → Settings → Edge Functions → Secrets.',
        500,
        corsHeaders
      )
    }

    // قراءة بيانات الطلب
    const emailData: EmailRequest = await req.json()
    console.log('تم قراءة بيانات الطلب:', { 
      to: emailData.to, 
      subject: emailData.subject, 
      hasAttachments: !!emailData.attachments,
      attachmentsCount: emailData.attachments?.length || 0
    })

    // التحقق من البيانات المطلوبة
    if (!emailData.to || !emailData.subject) {
      return errorResponse('Missing required fields: to, subject', 400, corsHeaders)
    }

    // Security: Validate attachment size (max 10MB total)
    const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10MB
    if (emailData.attachments && Array.isArray(emailData.attachments)) {
      let totalSize = 0
      for (const attachment of emailData.attachments) {
        if (attachment?.content) {
          // Estimate size from base64 string
          const estimatedSize = (attachment.content.length * 3) / 4 // base64 to bytes
          totalSize += estimatedSize
        }
      }
      if (totalSize > MAX_ATTACHMENT_SIZE) {
        console.warn(`Attachment size exceeds limit: ${totalSize} bytes`)
        return errorResponse('Attachments too large. Maximum total size is 10MB.', 413, corsHeaders)
      }
    }

    // التحقق من الوقت المتبقي
    const elapsedTime = Date.now() - functionStartTime
    if (elapsedTime > functionTimeout - 10000) {
      console.warn('Function timeout approaching, aborting early')
      return errorResponse('Request timeout - please try again', 504, corsHeaders)
    }

    // تحويل to إلى array إذا كان string
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to]
    const html = emailData.html || emailData.text?.replace(/\n/g, '<br>') || emailData.text || ''
    const text = emailData.text || ''

    // إعداد المرفقات (إن وجدت)
    const emailAttachments: Array<{ filename: string; content: Uint8Array; contentType: string }> = []
    if (emailData.attachments && Array.isArray(emailData.attachments) && emailData.attachments.length > 0) {
      console.log(`معالجة ${emailData.attachments.length} مرفق(ات)`)
      for (const attachment of emailData.attachments) {
        if (attachment && attachment.content && attachment.filename) {
          try {
            if (typeof attachment.content === 'string' && attachment.content.trim().length > 0) {
              // تحويل base64 إلى Uint8Array
              const binaryString = atob(attachment.content)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              
              emailAttachments.push({
                filename: attachment.filename,
                content: bytes,
                contentType: attachment.filename.endsWith('.sql') ? 'application/sql' : 'application/octet-stream'
              })
              console.log(`تمت إضافة مرفق: ${attachment.filename} (${bytes.length} بايت)`)
            }
          } catch (attachError) {
            console.warn(`فشل في معالجة المرفق ${attachment.filename}:`, attachError)
          }
        }
      }
    } else {
      console.log('لا توجد مرفقات في الطلب')
    }

    // إرسال البريد إلى جميع المستلمين مع timeout لكل عملية
    const sendPromises = recipients.map(async (recipient) => {
      console.log(`إرسال بريد إلى: ${recipient}`)
      
      // التحقق من الوقت المتبقي قبل كل عملية
      const elapsedTime = Date.now() - functionStartTime
      if (elapsedTime > functionTimeout - 15000) {
        console.warn(`Timeout approaching, skipping ${recipient}`)
        return { recipient, success: false, error: 'Function timeout approaching' }
      }
      
      try {
        // إضافة timeout لكل عملية إرسال
        const sendPromise = sendEmailViaSMTP(
          'smtp.gmail.com',
          587,
          gmailUser,
          gmailPassword,
          gmailUser,
          recipient,
          emailData.subject,
          html,
          text,
          emailAttachments
        )
        
        // timeout لكل عملية إرسال (40 ثانية)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('SMTP operation timeout')), 40000)
        })
        
        await Promise.race([sendPromise, timeoutPromise])
        console.log(`تم إرسال البريد بنجاح إلى: ${recipient}`)
        return { recipient, success: true }
      } catch (error) {
        console.error(`فشل إرسال البريد إلى ${recipient}:`, error)
        return { recipient, success: false, error: error?.message }
      }
    })

    // انتظار إتمام جميع محاولات الإرسال مع timeout عام
    // استخدام Promise.allSettled للحصول على جميع النتائج حتى في حالة الفشل
    const remainingTime = functionTimeout - (Date.now() - functionStartTime) - 5000
    const timeoutMs = Math.max(10000, remainingTime) // على الأقل 10 ثوانٍ
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Overall send timeout')), timeoutMs)
    })
    
    let results
    try {
      // استخدام Promise.allSettled للحصول على جميع النتائج
      const allSettled = await Promise.race([
        Promise.allSettled(sendPromises),
        timeoutPromise.then(() => Promise.reject(new Error('Timeout')))
      ])
      
      // تحويل النتائج إلى التنسيق المطلوب
      results = allSettled.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return { recipient: recipients[index], success: false, error: result.reason?.message || 'Failed' }
        }
      })
    } catch {
      // إذا انتهت مهلة الوقت، نعيد نتائج جزئية
      console.warn('Overall timeout reached, some emails may not have been sent')
      // محاولة الحصول على النتائج الجزئية
      try {
        const partialResults = await Promise.allSettled(sendPromises)
        results = partialResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            return { recipient: recipients[index], success: false, error: 'Timeout' }
          }
        })
      } catch {
        results = recipients.map(r => ({ recipient: r, success: false, error: 'Timeout' }))
      }
    }
    
    // التحقق من النتائج
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      throw new Error(`Failed to send to ${failed.length} recipient(s): ${failed.map(f => f.recipient).join(', ')}`)
    }

    const response: EmailResponse = {
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('خطأ في إرسال البريد الإلكتروني:', error)
    console.error('تفاصيل الخطأ:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    
    // التحقق من نوع الخطأ
    const isTimeout = error?.message?.includes('timeout') || error?.message?.includes('Timeout')
    const status = isTimeout ? 504 : 500
    const message = isTimeout 
      ? 'Request timeout - email may have been sent. Please check your inbox.'
      : (error?.message || 'Failed to send email. Check Edge Function logs for details.')
    
    return errorResponse(message, status, corsHeaders)
  }
})
