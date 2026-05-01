# Status Page Setup — Better Stack

**Purpose**: Public status page for SawTracker uptime monitoring  
**URL**: https://status.sawtracker.com  
**Service**: Better Stack (Uptime, Incident Management)

---

## 1. Create Better Stack Account

1. Go to https://www.betterstack.com/
2. Sign up with:
   - Email: engineering@sawtracker.com
   - Organization: SawTracker
3. Create workspace: "SawTracker-Production"
4. Save API key in vault: `BETTER_STACK_API_KEY`

---

## 2. Configure Status Page

### 2.1 Public Status Page

1. Go to **Status Pages** → **Create New**
2. Fill in:
   - **Page Name**: SawTracker
   - **Subdomain**: sawtracker (creates status.sawtracker.com)
   - **Description**: نظام إدارة منشرات خشبية
   - **Language**: Arabic + English
3. Enable:
   - [x] Display incident history
   - [x] Show last 30 days
   - [x] Allow incident subscriptions

### 2.2 Add Services

Add monitors for:

1. **Website**: https://sawtracker.com
   - Type: HTTPS
   - Interval: Every 5 minutes
   - Timeout: 30 seconds

2. **API**: https://api.sawtracker.com/health
   - Type: HTTP Status
   - Expected: 200 OK
   - Interval: 2 minutes

3. **Database**: Database connectivity check
   - Type: TCP
   - Host: supabase.co
   - Port: 5432
   - Interval: 5 minutes

4. **Email Service**: Email sending test
   - Type: HTTP
   - URL: [your-email-monitor-endpoint]
   - Interval: 15 minutes

---

## 3. Configure Incident Management

### 3.1 Create Incident

When service goes down:

```bash
# Using Better Stack API
curl -X POST "https://uptime.betterstack.com/api/v2/incidents" \
  -H "Authorization: Bearer ${BETTER_STACK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Service Unavailable",
    "description": "Database connection failing",
    "status": "investigating",
    "monitors": [2],
    "severity": "major"
  }'
```

### 3.2 Incident Statuses

- **Investigating**: Currently looking at issue
- **Identified**: Root cause found
- **Monitoring**: Fix in progress
- **Resolved**: Service restored

### 3.3 Notifications

Configure notifications:

1. Go to **Incident Rules** → **Create**
2. Set:
   - **Trigger**: Incident created
   - **Send to**:
     - Email: engineering@sawtracker.com
     - Slack: #incidents
     - SMS: +20 1001234567 (on-call engineer)

---

## 4. Automation Setup

### 4.1 GitHub Actions Trigger

Add to `.github/workflows/status-update.yml`:

```yaml
name: Update Status Page

on:
  workflow_dispatch:
  schedule:
    - cron: '*/2 * * * *'  # Every 2 minutes

jobs:
  update-status:
    runs-on: ubuntu-latest
    steps:
      - name: Check API Health
        run: |
          curl -X GET https://sawtracker.com/health
          if [ $? -ne 0 ]; then
            echo "API Down - Creating incident"
            curl -X POST "https://uptime.betterstack.com/api/v2/incidents" \
              -H "Authorization: Bearer ${{ secrets.BETTER_STACK_API_KEY }}" \
              -d '{"title": "Automatic Incident: API Down"}'
          fi
```

### 4.2 Database Monitoring

Check database replication:

```sql
-- Query to run every 5 minutes
SELECT 
  EXTRACT(EPOCH FROM (now() - xact_start))::int as replication_lag_sec
FROM pg_stat_replication
WHERE client_addr = '192.168.1.100';

-- Alert if lag > 60 seconds
```

---

## 5. Custom Status Components

Add components to show status of:

- **API Server**: Green/Yellow/Red
- **Database**: Green/Yellow/Red
- **Email Service**: Green/Yellow/Red
- **Storage**: Green/Yellow/Red

Each component shows:

- Current status
- Last incident
- Uptime percentage (this month)
- Response time (average)

---

## 6. Status Page Customization

### 6.1 Branding

1. Upload logo (SawTracker)
2. Set theme colors:
   - Primary: #1e40af (blue)
   - Success: #15803d (green)
   - Warning: #f59e0b (amber)
   - Danger: #dc2626 (red)

### 6.2 Localization

Configure both Arabic and English:

- **English**: Default status page
- **العربية**: Arabic translation

Add translations for:
- Service names
- Status descriptions
- Incident messages

### 6.3 Maintenance Windows

Schedule maintenance:

```
1st Sunday of month, 2:00 AM - 3:00 AM (UTC+2)
Duration: 1 hour
Services affected: API, Database

Message: تصيانة مجدولة - نتوقع فترة انقطاع 1 ساعة
```

---

## 7. Monitoring Integration

### 7.1 Slack Notifications

Connect Slack:

1. Go to **Settings** → **Integrations** → **Slack**
2. Add workspace: sawtracker-workspace
3. Configure:
   - Send to: #status-updates
   - Include: Incident alerts, status changes
   - Format: Brief (title + status only)

### 7.2 PagerDuty Integration (Optional)

For on-call rotation:

1. Install PagerDuty app on Better Stack
2. Map incidents:
   - Critical (P1) → Page on-call engineer
   - Major (P2) → Slack notification
   - Minor (P3) → Email only

---

## 8. Public Status Page URL

Share with customers:

```
https://status.sawtracker.com
```

Add to:

- Email signatures
- Support documentation
- Footer of website
- Support portal

---

## 9. Monitoring Checks

### Daily Checks

- [ ] All monitors showing green
- [ ] No pending incidents
- [ ] Response times normal (< 500ms)
- [ ] Uptime % > 99%

### Weekly Review

- [ ] Review incident history
- [ ] Check alert logs
- [ ] Validate SLA targets
- [ ] Update status page message if needed

### Monthly Review

1. Generate uptime report
2. Check SLA compliance
3. Review false positive alerts
4. Adjust monitor sensitivity if needed

---

## 10. Incident Response Protocol

When status page shows outage:

1. **Immediate** (0-5 min):
   - Check Better Stack dashboard
   - Verify actual outage (not false positive)
   - Post message: "🔴 We're investigating"

2. **Investigation** (5-30 min):
   - Check application logs
   - Check database health
   - Assess impact
   - Post update: "🟡 Root cause identified"

3. **Resolution** (30+ min):
   - Apply fix
   - Verify service restoration
   - Post: "🟢 Service restored"

4. **Post-Incident** (next 24h):
   - Document root cause
   - Post incident report
   - Schedule retrospective

---

## 11. Configuration Checklist

Pre-launch:

- [ ] Better Stack account created
- [ ] Status page configured
- [ ] Monitors added (API, Database, Email)
- [ ] Incident rules configured
- [ ] Slack integration active
- [ ] Uptime SLA targets set (99.9%)
- [ ] Team trained on incident response
- [ ] Status page publicly accessible
- [ ] DNS configured (status.sawtracker.com)
- [ ] Backup monitoring method configured

---

**Status Page URL**: https://status.sawtracker.com  
**API Key Location**: Vault (BETTER_STACK_API_KEY)  
**Slack Channel**: #status-updates  
**Last Updated**: May 2026
