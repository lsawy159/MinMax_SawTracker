// Edge Function: معالجة قائمة انتظار البريد الإلكتروني
// تعمل بشكل مجدول. تمت إضافة حارس سياسات لتجنب الإرسال الجماعي
// ودعم وضع "الملخص اليومي" فقط.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EmailQueueItem {
  id: string
  to_emails: string[]
  subject: string
  html_content: string
  text_content: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: any[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  retry_count: number
  max_retries: number
  error_message: string | null
  created_at: string
  processed_at: string | null
  completed_at: string | null
}

// دالة مساعدة: إضافة timeout للعمليات
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise])
}

// دالة مساعدة: قراءة سطر كامل من SMTP (حتى \r\n)
async function readSMTPLine(conn: Deno.Conn, decoder: TextDecoder, timeoutMs: number = 10000): Promise<string> {
  let buffer = new Uint8Array(0)
  const chunkSize = 256
  
  while (true) {
    const chunk = new Uint8Array(chunkSize)
    const readPromise = conn.read(chunk)
    const n = await withTimeout(readPromise, timeoutMs, `SMTP read timeout after ${timeoutMs}ms`)
    
    if (n === null || n === 0) {
      if (buffer.length > 0) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      continue
    }
    
    const newBuffer = new Uint8Array(buffer.length + n)
    newBuffer.set(buffer)
    newBuffer.set(chunk.subarray(0, n), buffer.length)
    buffer = newBuffer
    
    const text = decoder.decode(buffer, { stream: true })
    if (text.includes('\r\n')) {
      return text
    }
    
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
    
    const lines = response.trim().split('\r\n')
    const lastLine = lines[lines.length - 1]
    
    if (lastLine && /^\d{3} [^\d]/.test(lastLine.trim())) {
      break
    }
    
    if (lines.length > 100) {
      break
    }
  }
  
  return response
}

// دالة SMTP الموروثة - معطلة ولا تُستخدم (استخدم Resend بدلاً منها)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const operationTimeout = 15000
  
  let conn: Deno.Conn | null = null
  
  try {
    console.log(`الاتصال بـ ${hostname}:${port}`)
    
    const connectPromise = Deno.connect({ hostname, port })
    conn = await withTimeout(connectPromise, operationTimeout, 'Connection timeout')
    
    const greeting = await readSMTPResponse(conn, decoder, operationTimeout)
    console.log('رسالة الترحيب:', greeting.trim())
    
    if (!greeting.startsWith('220')) {
      throw new Error(`SMTP server error: ${greeting}`)
    }
    
    console.log('إرسال EHLO...')
    await conn.write(encoder.encode(`EHLO ${hostname}\r\n`))
    const ehloResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!ehloResponse.startsWith('250')) {
      throw new Error(`EHLO failed: ${ehloResponse}`)
    }
    
    if (port === 587) {
      console.log('بدء STARTTLS...')
      await conn.write(encoder.encode('STARTTLS\r\n'))
      const starttlsResponse = await readSMTPResponse(conn, decoder, operationTimeout)
      
      if (!starttlsResponse.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${starttlsResponse}`)
      }
      
      conn = await withTimeout(
        Deno.startTls(conn, { hostname }),
        operationTimeout,
        'TLS handshake timeout'
      )
      console.log('تم ترقية الاتصال إلى TLS')
      
      await conn.write(encoder.encode(`EHLO ${hostname}\r\n`))
      await readSMTPResponse(conn, decoder, operationTimeout)
    }
    
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
    
    console.log(`إرسال MAIL FROM: ${from}`)
    await conn.write(encoder.encode(`MAIL FROM:<${from}>\r\n`))
    const mailFromResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!mailFromResponse.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${mailFromResponse}`)
    }
    
    console.log(`إرسال RCPT TO: ${to}`)
    await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`))
    const rcptResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!rcptResponse.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${rcptResponse}`)
    }
    
    console.log('إرسال DATA command...')
    await conn.write(encoder.encode('DATA\r\n'))
    const dataResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    
    if (!dataResponse.startsWith('354')) {
      throw new Error(`DATA command failed: ${dataResponse}`)
    }
    
    console.log('بناء محتوى البريد...')
    let emailContent: string[]
    
    if (attachments.length > 0) {
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
      
      for (const attachment of attachments) {
        let base64 = ''
        const chunkSize = 8192
        for (let i = 0; i < attachment.content.length; i += chunkSize) {
          const chunk = attachment.content.subarray(i, Math.min(i + chunkSize, attachment.content.length))
          let binaryString = ''
          for (let j = 0; j < chunk.length; j++) {
            binaryString += String.fromCharCode(chunk[j])
          }
          base64 += btoa(binaryString)
        }
        
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
    
    console.log(`إرسال محتوى البريد (${emailContent.join('\r\n').length} حرف)...`)
    const emailContentStr = emailContent.join('\r\n')
    await conn.write(encoder.encode(emailContentStr))
    await conn.write(encoder.encode('\r\n.\r\n'))
    
    const endDataResponse = await readSMTPResponse(conn, decoder, operationTimeout)
    console.log('استجابة بعد إرسال البيانات:', endDataResponse.trim())
    
    if (!endDataResponse.startsWith('250')) {
      throw new Error(`Email send failed: ${endDataResponse}`)
    }
    
    console.log('إرسال QUIT...')
    await conn.write(encoder.encode('QUIT\r\n'))
    await readSMTPResponse(conn, decoder, 5000)
    
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

  try {
    console.log('[Email Queue] Starting queue processing...')
    
    // قراءة إعدادات Resend من Environment Variables
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')

    if (!resendKey || !resendFrom) {
      console.error('[Email Queue] Resend configuration missing: تأكد من ضبط RESEND_API_KEY و RESEND_FROM_EMAIL (موثّق)')
      return new Response(
        JSON.stringify({ success: false, error: 'Resend configuration not found or from email missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // إنشاء Supabase client مع service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Email Queue] Supabase configuration missing')
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // قراءة سياسات المعالجة من system_settings
    const { data: settingsRows } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'email_queue_processing_enabled',
        'email_queue_mode',
        'email_queue_max_age_hours'
      ])
    
    // خريطة الإعدادات مع الحفاظ على النوع الأصلي (JSON/boolean/number/string)
    const settingsMap = new Map<string, unknown>()
    for (const row of (settingsRows || [])) {
      settingsMap.set(row.setting_key as string, row.setting_value as unknown)
    }

    const getSetting = <T>(key: string, def: T): T => {
      const v = settingsMap.get(key)
      if (v === undefined || v === null) return def
      return v as T
    }

    const processingEnabled = getSetting<boolean>('email_queue_processing_enabled', true)
    if (!processingEnabled) {
      console.warn('[Email Queue] Processing disabled by policy (email_queue_processing_enabled=false)')
      return new Response(
        JSON.stringify({ success: true, message: 'Processing disabled by policy', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }
    
    const mode = getSetting<string>('email_queue_mode', 'digest-only') // 'digest-only' | 'all'
    const maxAgeHours = getSetting<number>('email_queue_max_age_hours', 24)
    const now = new Date()
    const minCreatedAt = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000).toISOString()

    // بناء الاستعلام وفق السياسة
    let query = supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', minCreatedAt)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    // في وضع الملخص اليومي: عالج الرسائل التي عنوانها يحتوي Daily Digest فقط
    if (mode === 'digest-only') {
      query = query.ilike('subject', '%Daily Digest%')
    }

    // الملخص اليومي يجب أن يُرسل مرة واحدة: أعالج عنصر واحد فقط
    const { data: queueItems, error: fetchError } = await query.limit(mode === 'digest-only' ? 1 : 10)

    if (fetchError) {
      console.error('[Email Queue] Error fetching queue items:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[Email Queue] No pending emails to process')
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    console.log(`[Email Queue] Found ${queueItems.length} pending emails to process (mode=${mode}, maxAgeHours=${maxAgeHours})`)

    let processedCount = 0
    let successCount = 0
    let failedCount = 0

    // معالجة كل سجل
    for (const item of queueItems) {
      try {
        // تحديث الحالة إلى processing
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (updateError) {
          console.error(`[Email Queue] Error updating status for ${item.id}:`, updateError)
          continue
        }

        console.log(`[Email Queue] Processing email ${item.id} to ${item.to_emails.join(', ')}`)

        // إرسال البريد عبر Resend API لكل مستلم بشكل متسلسل مع تأخير 600ms لتجنب Rate Limit
        const results: Array<PromiseSettledResult<{ recipient: string; success: boolean; error?: string }>> = []
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        for (const recipient of item.to_emails) {
          // سجل أي بريد وهمي قبل الإصلاح
          if (recipient === 'admin@sawtracker.com') {
            console.warn(`[Email Queue] LOG: Found mock recipient 'admin@sawtracker.com' for item ${item.id}`)
          }

          try {
            const resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: JSON.stringify({
                from: resendFrom,
                to: recipient,
                subject: item.subject,
                html: item.html_content,
                text: item.text_content || undefined
              })
            })

            if (!resp.ok) {
              const errorText = await resp.text()
              results.push(Promise.resolve({ status: 'fulfilled', value: { recipient, success: false, error: `Resend failed (${resp.status}): ${errorText}` } }) as unknown as PromiseSettledResult<{ recipient: string; success: boolean; error?: string }>)
            } else {
              results.push(Promise.resolve({ status: 'fulfilled', value: { recipient, success: true } }) as unknown as PromiseSettledResult<{ recipient: string; success: boolean; error?: string }>)
            }
          } catch (error) {
            console.error(`[Email Queue] Failed to send to ${recipient}:`, error)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = (error as any)?.message ?? 'Unknown error'
            results.push(Promise.resolve({ status: 'fulfilled', value: { recipient, success: false, error: msg } }) as unknown as PromiseSettledResult<{ recipient: string; success: boolean; error?: string }>)
          }

          // تأخير إلزامي 600ms بين كل محاولة إرسال
          await sleep(600)
        }

        // تقييم النتائج بعد الإرسال المتسلسل
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))

        if (failed.length > 0) {
          throw new Error(`Failed to send to ${failed.length} recipient(s)`)
        }

        // تحديث الحالة إلى completed
        await supabase
          .from('email_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', item.id)

        successCount++
        console.log(`[Email Queue] Successfully processed email ${item.id}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error(`[Email Queue] Error processing email ${item.id}:`, error)
        
        const newRetryCount = item.retry_count + 1
        const shouldRetry = newRetryCount < item.max_retries

        // تحديث الحالة
        await supabase
          .from('email_queue')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            retry_count: newRetryCount,
            error_message: error?.message || 'Unknown error'
          })
          .eq('id', item.id)

        if (shouldRetry) {
          console.log(`[Email Queue] Email ${item.id} will be retried (attempt ${newRetryCount}/${item.max_retries})`)
        } else {
          failedCount++
          console.log(`[Email Queue] Email ${item.id} failed after ${item.max_retries} attempts`)
        }
      }

      processedCount++
    }

    console.log(`[Email Queue] Processing complete: ${processedCount} processed, ${successCount} succeeded, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} emails`,
        processed: processedCount,
        succeeded: successCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[Email Queue] Critical error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to process email queue'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
})

