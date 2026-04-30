/**
 * 🧪 Test Resend API Directly
 * 
 * This function tests sending a single email via Resend API
 * to check if the API is working correctly
 * 
 * Call with:
 * POST https://[your-project].supabase.co/functions/v1/test-resend-direct
 * 
 * Body:
 * {
 *   "to": "a.g16591@gmail.com",
 *   "subject": "Test from Resend API"
 * }
 */

import { requireAdmin } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    await requireAdmin(req)
    const body = await req.json() as { to?: string; subject?: string }
    const toEmail = body.to || 'a.g16591@gmail.com'
    const subject = body.subject || 'Test Email from Resend'

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')

    console.log(`[Test Resend] Sending test email to: ${toEmail}`)
    console.log(`[Test Resend] From: ${resendFrom}`)
    console.log(`[Test Resend] API Key exists: ${!!resendKey}`)

    if (!resendKey || !resendFrom) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Resend configuration',
          has_key: !!resendKey,
          has_from: !!resendFrom
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send test email
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: resendFrom,
        to: toEmail,
        subject: subject,
        html: `<h1>Test Email</h1><p>This is a test email from SawTracker at ${new Date().toISOString()}</p>`
      })
    })

    const responseData = await resp.json() as any
    console.log(`[Test Resend] Response status: ${resp.status}`)
    console.log(`[Test Resend] Response:`, JSON.stringify(responseData))

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: resp.status,
          error: responseData.message || 'Failed to send email',
          details: responseData
        }),
        { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test email sent successfully',
        to: toEmail,
        from: resendFrom,
        resend_id: responseData.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Test Resend] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
