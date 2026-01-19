// Supabase Edge Function: Send Email via Resend API
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "noreply@sawtracker.com",
        to,
        cc: cc && cc.length > 0 ? cc : undefined,
        bcc: bcc && bcc.length > 0 ? bcc : undefined,
        subject,
        html: html || `<p>${text || subject}</p>`,
        text: text || subject,
      }),
    });

    const data = await response.json();

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
