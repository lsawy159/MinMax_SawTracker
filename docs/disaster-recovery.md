# Disaster Recovery Plan — SawTracker

**Document Status**: Production Ready  
**Last Updated**: May 2026  
**Reviewed By**: Engineering Team  

---

## Executive Summary

This document outlines SawTracker's disaster recovery strategy, including RTO/RPO targets, backup procedures, and step-by-step recovery instructions.

---

## RTO & RPO Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **RTO** (Recovery Time Objective) | 4 hours | Automated backup restore; Vercel failover; DNS failover to staging |
| **RPO** (Recovery Point Objective) | 15 minutes | Automated backups every 15 minutes; point-in-time recovery to latest backup |
| **Data Loss Tolerance** | < 15 minutes | Acceptable data loss window equals backup frequency |

---

## Critical Systems

### Tier 1: Must Recover First (< 1 hour)

- **Supabase Database**: Core data (companies, employees, payroll)
- **API Layer**: Edge Functions (authentication, data validation)
- **Frontend**: React SPA (dashboards, forms)

### Tier 2: Important (1-4 hours)

- **Email Queue**: Delayed message delivery acceptable
- **Backup Storage**: Restore from archives
- **Reporting System**: Data integrity critical

### Tier 3: Non-Critical (4-24 hours)

- **Activity Logs**: Historical auditing
- **Notification Archive**: Archived messages only
- **Search Indices**: Can rebuild from DB

---

## Backup Strategy

### Automated Backups

**Frequency**: Every 15 minutes (via scheduled Edge Function `trigger-backup`)

**Storage**:
- **Primary**: Supabase Storage (`sawtracker-backups/` bucket)
- **Secondary**: Archives encrypted with AES-256-GCM
- **Retention**: 30 days (automatic cleanup)

**Backup Content**:
- All tables EXCEPT `user_sessions` (security-sensitive)
- Schema definitions (migrations)
- Configuration snapshots

**Backup Format**:
```
sawtracker-backups/
├── 2026-05-01/
│   ├── 09-00-db-backup-20260501T090000Z.sql.encrypted
│   ├── 09-15-db-backup-20260501T091500Z.sql.encrypted
│   └── ...
├── 2026-05-02/
│   └── ...
```

### Manual Backup (Pre-Deployment)

Before major deployments, run:

```bash
# Snapshot database manually
supabase db push-snapshot --output ./backups/pre-deploy-2026-05-01.sql

# Verify backup integrity
ls -lah ./backups/
```

---

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption

**Detection**: Queries fail, invalid data in core tables

**Recovery Steps**:

1. **Immediate**: Alert ops team, disable auto-backups temporarily
   ```bash
   # Check latest successful backup
   supabase db backups list
   ```

2. **Identify Point-in-Time** (within 15-min window):
   ```bash
   # List all backups from last hour
   aws s3 ls s3://sawtracker-backups/2026-05-01/ --recursive
   ```

3. **Restore from Latest Clean Backup**:
   ```bash
   # Download encrypted backup
   aws s3 cp s3://sawtracker-backups/2026-05-01/09-00-db-backup-20260501T090000Z.sql.encrypted ./

   # Decrypt (key in vault: BACKUP_ENCRYPTION_KEY)
   openssl enc -aes-256-gcm -d -in ./09-00-db-backup-*.sql.encrypted -out ./backup.sql \
     -K ${BACKUP_ENCRYPTION_KEY}

   # Restore (test environment first)
   supabase db reset --dir ./supabase/migrations --file ./backup.sql
   ```

4. **Verify**:
   ```sql
   SELECT COUNT(*) FROM companies;
   SELECT COUNT(*) FROM employees;
   SELECT MAX(created_at) FROM audit_log;
   ```

5. **Notify Stakeholders**: Document recovery time, data loss window

---

### Scenario 2: API Service Unavailable

**Detection**: Vercel deployment fails, Edge Functions return 503

**Recovery Steps**:

1. **Check Deployment Status**:
   ```bash
   # Vercel status
   curl https://status.vercel.com/

   # Check recent deployments
   vercel ls --limit 10
   ```

2. **Rollback to Last Working Version**:
   ```bash
   # View deployment history
   vercel list --all

   # Promote previous deployment
   vercel promote <previous-deployment-id>
   ```

3. **If Rollback Fails** — Deploy from main branch:
   ```bash
   git push origin main  # Triggers GitHub Actions → Vercel deploy
   ```

4. **Verify**:
   ```bash
   curl -X GET https://api.sawtracker.com/health
   # Should return 200 OK with service status
   ```

5. **Post-Incident**:
   - Review deployment logs
   - Identify cause of failure
   - Add pre-deployment validation

---

### Scenario 3: Storage Bucket Deleted

**Detection**: Backup downloads fail with 404; file serving fails

**Recovery Steps**:

1. **Check Bucket Status**:
   ```bash
   supabase storage ls sawtracker-backups
   # If error: bucket deleted or inaccessible
   ```

2. **Restore Bucket**:
   ```bash
   # Supabase backup should have bucket metadata
   supabase db push --dir ./supabase/migrations
   # This re-creates storage policies and bucket

   # Or manually recreate:
   supabase storage create sawtracker-backups --public=false
   supabase storage rls sawtracker-backups --rls-enable
   ```

3. **Restore Backup Files**:
   ```bash
   # From S3 secondary backup (if configured)
   aws s3 sync s3://sawtracker-backups-archive/ s3://sawtracker-backups/ --replica-sync
   ```

---

### Scenario 4: Complete Data Center Failure

**Detection**: All services unavailable (Supabase, Vercel, Storage)

**Recovery Steps**:

1. **Activate Disaster Recovery Site** (if configured):
   ```bash
   # Switch DNS to staging environment
   # Update DNS record: sawtracker.com → staging.sawtracker.com
   ```

2. **Restore from Latest Backup**:
   ```bash
   # Use secondary backup location (S3, separate region)
   aws s3 cp s3://dr-backup-secondary/latest-backup.sql.encrypted ./

   # Decrypt and restore to new Supabase project
   openssl enc -aes-256-gcm -d -in latest-backup.sql.encrypted -out backup.sql
   psql -h new-supabase-host.supabase.co -U postgres < backup.sql
   ```

3. **Update Environment Variables**:
   ```bash
   # Point frontend to new Supabase URL
   VITE_SUPABASE_URL=https://new-project.supabase.co
   VITE_SUPABASE_ANON_KEY=<new-key>
   ```

4. **Redeploy**:
   ```bash
   vercel --prod  # Deploy to alternative hosting or new project
   ```

5. **Switch Traffic**:
   ```bash
   # Update DNS, notify users of downtime window
   ```

---

## Recovery Runbooks (Detailed)

### Runbook 1: Automated Restore Script

```bash
#!/bin/bash
# recovery.sh — Automated backup restore

set -e

BACKUP_DATE="${1:-$(date +%Y-%m-%d)}"
BACKUP_TIME="${2:-latest}"

echo "🔄 Starting recovery from backup $BACKUP_DATE/$BACKUP_TIME..."

# 1. Decrypt backup
aws s3 cp "s3://sawtracker-backups/$BACKUP_DATE/*-db-backup-*.sql.encrypted" ./backup.sql.encrypted
openssl enc -aes-256-gcm -d -in ./backup.sql.encrypted -out ./backup.sql \
  -K ${BACKUP_ENCRYPTION_KEY}

# 2. Verify integrity
if ! pg_dump -s | diff - ./backup.sql > /dev/null 2>&1; then
  echo "⚠️ Schema mismatch — manual intervention required"
  exit 1
fi

# 3. Restore in test environment
PGPASSWORD=$STAGING_DB_PASSWORD psql -h staging-db.supabase.co -U postgres \
  --dbname=postgres -f ./backup.sql

# 4. Run integrity checks
PGPASSWORD=$STAGING_DB_PASSWORD psql -h staging-db.supabase.co -U postgres -c \
  "SELECT COUNT(*) as total_rows FROM pg_stat_user_tables;"

echo "✅ Recovery complete. Verify data, then promote to production."
```

### Runbook 2: Database Replication Check

```bash
#!/bin/bash
# check_replication.sh — Monitor database replication lag

SUPABASE_HOST=$VITE_SUPABASE_URL
PGPASSWORD=$DB_PASSWORD

psql -h $SUPABASE_HOST -U postgres -c "
SELECT 
  client_addr,
  pg_wal_lsn_diff(CASE WHEN flush_lsn IS NOT NULL THEN flush_lsn 
                       ELSE write_lsn END, '0/0') AS flush_lsn_bytes,
  EXTRACT(EPOCH FROM (now() - xact_start))::int AS replication_lag_sec
FROM pg_stat_replication
ORDER BY xact_start DESC;
"
```

---

## Testing & Drills

### Monthly Recovery Drill Schedule

| Date | Type | Coordinator |
|------|------|------------|
| 1st Monday | Database restore | DB Admin |
| 2nd Monday | API failover | DevOps |
| 3rd Monday | Storage recovery | Storage Admin |
| 4th Monday | Full disaster simulation | Engineering Lead |

**Drill Template**:
1. Announce "DR DRILL - NOT PRODUCTION" in #ops-alerts
2. Execute recovery steps in **staging environment only**
3. Verify data integrity (row counts, timestamps, checksums)
4. Document time taken, issues encountered
5. Post-drill debrief: lessons learned, process improvements

**Success Criteria**:
- Data integrity: 100% (no rows lost)
- RTO met: Recovery < 4 hours
- RPO met: Data loss < 15 minutes
- All critical systems: Operational

---

## Contacts & Escalation

| Role | Name | Contact | On-Call |
|------|------|---------|---------|
| **Engineering Lead** | Ahmed Al-Sawy | ahmad.alsawy159@gmail.com | Primary |
| **Database Admin** | TBD | - | Secondary |
| **Infrastructure** | TBD | - | Tertiary |

**Escalation Path**:
1. Alert on-call engineer
2. After 15 min: Escalate to Engineering Lead
3. After 1 hour: Escalate to CTO
4. After 2 hours: Execute DR Site activation

---

## Maintenance & Updates

This document should be reviewed and updated:

- **Quarterly**: Test recovery procedures
- **Semi-annually**: Review RTO/RPO targets
- **After incidents**: Post-mortem improvements

**Last Reviewed**: May 2026  
**Next Review**: August 2026  
