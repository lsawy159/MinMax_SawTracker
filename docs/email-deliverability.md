# Email Deliverability — SawTracker

**Status**: Ready for configuration  
**Service**: Resend  
**Target Score**: 9/10+ on mail-tester.com

---

## DNS Records Configuration

### 1. SPF (Sender Policy Framework)

**Purpose**: Authorize mail servers to send emails from your domain

**Add to DNS**:

```
TXT record: sawtracker.com
Value: v=spf1 include:mail.resend.io ~all
```

**Verification**:

```bash
dig sawtracker.com TXT | grep spf1
# Should return: v=spf1 include:mail.resend.io ~all
```

---

### 2. DKIM (DomainKeys Identified Mail)

**Purpose**: Digital signature to prove email authenticity

**From Resend Dashboard**:

1. Go to [https://resend.com/api-keys](https://resend.com/api-keys) → Domain Configuration
2. Add domain: `sawtracker.com`
3. Copy DKIM record

**Add to DNS**:

```
CNAME record: default._domainkey.sawtracker.com
Value: [resend-provided-value].dkim.resend.domains
```

**Verification**:

```bash
dig default._domainkey.sawtracker.com CNAME
# Should return Resend's DKIM server
```

---

### 3. DMARC (Domain-based Message Authentication, Reporting and Conformance)

**Purpose**: Policy for handling authentication failures

**Add to DNS**:

```
TXT record: _dmarc.sawtracker.com
Value: v=DMARC1; p=reject; rua=mailto:dmarc@sawtracker.com; ruf=mailto:forensics@sawtracker.com; fo=1
```

**Explanation**:

- `p=reject`: Reject emails that fail DKIM/SPF
- `rua`: Aggregate reports (weekly) to this email
- `ruf`: Forensics reports for failures
- `fo=1`: Report all alignment failures

**Verification**:

```bash
dig _dmarc.sawtracker.com TXT
# Should return DMARC policy
```

---

## Resend Configuration

### 1. API Setup

```typescript
// src/utils/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(to: string, subject: string, html: string) {
  const result = await resend.emails.send({
    from: 'noreply@sawtracker.com',
    to,
    subject,
    html,
  })

  return result
}
```

### 2. Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@sawtracker.com
DMARC_REPORT_EMAIL=dmarc@sawtracker.com
```

### 3. Email Templates

**Template Structure**:

```html
<!-- src/email-templates/base.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      a {
        color: #1e40af;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>{{title}}</h1>
      <p>{{content}}</p>
      <footer style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
        <p>© 2026 SawTracker. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  </body>
</html>
```

---

## Testing & Validation

### Test 1: Basic Send

```bash
npm run test:email
```

**Expected**:

- Email arrives in inbox
- No spam folder
- Subject/content intact
- Links clickable

### Test 2: Mail-Tester Validation

1. Go to [https://www.mail-tester.com](https://www.mail-tester.com)
2. Get unique test email
3. Send sample email to test address
4. Check score

**Target**: 9/10+

**Common Issues**:

| Issue | Fix |
|-------|-----|
| SPF fail | Verify SPF record in DNS |
| DKIM fail | Check CNAME record and Resend setup |
| Missing Reply-To | Add `replyTo` in email send |
| HTML issues | Validate with Stripo or MJML |
| No domain auth | Add Domain authentication in Resend |

---

### Test 3: Spam Score Check

```bash
# Using swaks (mail testing tool)
swaks --to test@mail-tester.com \
  --from noreply@sawtracker.com \
  --h-Subject "SawTracker Test" \
  --body "Test email"
```

---

## DMARC Reporting

### Monitoring Reports

**Weekly Aggregate Reports** (`rua`):

- Shows all emails sent from domain
- Alignment status (DKIM/SPF pass/fail)
- Source IPs

**Example Report Analysis**:

```
From: dmarc@sawtracker.com
Subject: DMARC Report for sawtracker.com

Summary:
- Total messages: 1,250
- Aligned DKIM: 1,240 (99.2%)
- Aligned SPF: 1,245 (99.6%)
- Failed: 5 (0.4%)

Failed sources: 192.168.1.100 (relay misconfiguration)
```

**Action**: Fix misaligned sources (check mail relay settings)

---

## Bounce & Complaint Handling

### Bounce Types

**Hard Bounces** (permanent failures):

- Invalid email address
- Domain doesn't exist
- Action: Remove from mailing list

**Soft Bounces** (temporary failures):

- Mailbox full
- Server temporarily unavailable
- Action: Retry later

### Configuration

```typescript
// src/functions/handle-bounce.ts
export async function handleEmailBounce(email: string, type: 'hard' | 'soft') {
  if (type === 'hard') {
    // Unsubscribe from all mailing lists
    await db.delete('email_subscriptions').where({ email })
  } else {
    // Retry soft bounces after 24h
    await db.update('email_queue').set({ retry_count: retry_count + 1 })
  }
}
```

---

## Production Checklist

Before going live:

- [ ] SPF record added and verified
- [ ] DKIM record added and verified
- [ ] DMARC policy configured
- [ ] Resend domain verified
- [ ] Test email scores 9/10+
- [ ] DMARC reports configured
- [ ] Bounce handling implemented
- [ ] Email templates reviewed
- [ ] Reply-To address configured
- [ ] Unsubscribe links in all emails

---

## Monitoring & Alerts

### Metrics to Track

```typescript
// Resend webhook for bounces/complaints
export async function handleResendWebhook(event: any) {
  if (event.type === 'email.bounced') {
    // Log bounce
    await db.insert('email_events').values({
      type: 'bounce',
      email: event.email,
      reason: event.reason,
    })
  }

  if (event.type === 'email.complained') {
    // Unsubscribe from all
    await db.delete('email_subscriptions').where({ email: event.email })
  }
}
```

### Dashboard Metrics

- **Delivery Rate**: % emails successfully delivered
- **Bounce Rate**: % hard bounces (target < 0.5%)
- **Complaint Rate**: % spam complaints (target < 0.1%)
- **Open Rate**: % emails opened
- **Click Rate**: % links clicked

---

## Emergency: Email Unavailable

If Resend is down:

1. **Fallback Option**: Queue emails in DB, retry manually
2. **Notification**: Post in #ops-alerts with ETA
3. **Communication**: Send in-app notification to users
4. **Recovery**: Resend emails once service restored

```typescript
// src/functions/send-email-fallback.ts
export async function sendEmailWithFallback(email: EmailPayload) {
  try {
    await resend.emails.send(email)
  } catch (error) {
    // Queue for manual retry
    await db.insert('email_queue').values({
      ...email,
      status: 'pending',
      scheduled_at: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    })
  }
}
```

---

**Last Updated**: May 2026  
**Next Review**: August 2026  
