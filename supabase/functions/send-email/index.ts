/**
 * send-email Edge Function
 * Sends emails via Resend API with support for multiple recipients
 * Each recipient gets a separate email to ensure delivery tracking
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireServiceToken } from '../_shared/auth.ts';

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
  messageIds?: string[];
  failedRecipients?: string[];
  timestamp: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function sendToRecipient(
  recipient: string,
  subject: string,
  html?: string,
  text?: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

  if (!apiKey || !fromEmail) {
    return { success: false, error: "Missing Resend configuration" };
  }

  try {
    console.log(`[send-email] Sending to: ${recipient}`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        cc: cc,
        bcc: bcc,
        subject: subject,
        html: html || (text ? `<p>${text}</p>` : undefined),
        text: text,
      }),
    });

    const data = await response.json();

    if (response.ok && data?.id) {
      console.log(`[send-email] ✅ Sent successfully to ${recipient}, id: ${data.id}`);
      return { success: true, messageId: data.id };
    } else {
      console.error(`[send-email] ❌ Failed to send to ${recipient}:`, data?.message || response.status);
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error(`[send-email] ❌ Exception for ${recipient}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" }
    });
  }

  try {
    requireServiceToken(req)

    // Parse request body
    const body = await req.json() as EmailRequest;
    const { to, subject, html, text, cc, bcc } = body;

    // Validate required fields
    if (!to || !subject) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: to, subject" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Convert to array
    const recipients = Array.isArray(to) ? to : [to];
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No valid email recipients" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    console.log(`[send-email] Processing ${recipients.length} recipient(s)`);

    // Send to each recipient separately
    const messageIds: string[] = [];
    const failedRecipients: string[] = [];

    for (const recipient of recipients) {
      const result = await sendToRecipient(recipient, subject, html, text, ccList, bccList);

      if (result.success && result.messageId) {
        messageIds.push(result.messageId);
      } else {
        failedRecipients.push(recipient);
      }

      // Rate limit protection: 600ms delay between sends
      if (recipients.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    // Return result
    if (failedRecipients.length > 0) {
      const response: EmailResponse = {
        success: false,
        message: `Failed to send to ${failedRecipients.length} recipient(s): ${failedRecipients.join(', ')}`,
        messageIds: messageIds.length > 0 ? messageIds : undefined,
        failedRecipients,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const response: EmailResponse = {
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient(s)`,
      messageIds,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });

  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
});
