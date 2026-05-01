# Monthly Restore Drill — SawTracker

**Schedule**: 1st Monday of each month at 10:00 AM UTC  
**Duration**: ~30 minutes  
**Environment**: Staging only (NOT production)

---

## Pre-Drill Checklist

- [ ] Notify team in #ops-alerts: "🚨 DR DRILL STARTING — Staging environment only"
- [ ] Verify staging database is available
- [ ] Confirm backup encryption key is accessible (`BACKUP_ENCRYPTION_KEY` in vault)
- [ ] Have recovery script ready: `scripts/restore-from-backup.sh`
- [ ] Document start time: `__________________`

---

## Drill Execution

### Step 1: Download Latest Backup (2 min)

```bash
#!/bin/bash
# Get list of today's backups
aws s3 ls s3://sawtracker-backups/$(date +%Y-%m-%d)/ --recursive

# Download latest backup
LATEST_BACKUP=$(aws s3 ls s3://sawtracker-backups/$(date +%Y-%m-%d)/ --recursive \
  | awk '{print $NF}' | tail -1)

aws s3 cp "s3://sawtracker-backups/$LATEST_BACKUP" ./staging-restore.sql.encrypted

echo "✓ Downloaded: $LATEST_BACKUP"
ls -lh ./staging-restore.sql.encrypted
```

**Success Criteria**:
- File downloaded successfully
- File size > 1 MB (indicates data present)
- File is encrypted (ends in `.encrypted`)

---

### Step 2: Decrypt Backup (1 min)

```bash
#!/bin/bash
# Decrypt using AES-256-GCM
openssl enc -aes-256-gcm -d \
  -in ./staging-restore.sql.encrypted \
  -out ./staging-restore.sql \
  -K ${BACKUP_ENCRYPTION_KEY} \
  -nosalt

echo "✓ Decrypted: ./staging-restore.sql"
ls -lh ./staging-restore.sql

# Verify SQL format
head -n 5 ./staging-restore.sql
# Should show: CREATE TABLE, CREATE SCHEMA, INSERT, etc.
```

**Success Criteria**:
- Decryption succeeds (no "bad decrypt" error)
- Output file size similar to encrypted file
- File contains valid SQL statements

---

### Step 3: Reset Staging Database (5 min)

```bash
#!/bin/bash
# Connect to staging Supabase
PGPASSWORD=${STAGING_DB_PASSWORD} psql \
  -h ${STAGING_DB_HOST} \
  -U postgres \
  -d postgres \
  << EOF

-- Drop all tables to simulate fresh start
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Verify schema is empty
SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

EOF

echo "✓ Staging database reset"
```

**Success Criteria**:
- Staging database empty (table count = 0)
- No errors during drop/recreate
- schema `public` exists and is empty

---

### Step 4: Restore from Backup (10 min)

```bash
#!/bin/bash
# Restore SQL dump to staging
PGPASSWORD=${STAGING_DB_PASSWORD} psql \
  -h ${STAGING_DB_HOST} \
  -U postgres \
  -d postgres \
  -f ./staging-restore.sql

echo "✓ Restore complete"
```

**Success Criteria**:
- No errors during restore (warnings OK)
- Process completes within 10 minutes
- Database connection stable

---

### Step 5: Verify Data Integrity (5 min)

```bash
#!/bin/bash
# Run integrity checks
PGPASSWORD=${STAGING_DB_PASSWORD} psql \
  -h ${STAGING_DB_HOST} \
  -U postgres \
  -d postgres \
  << EOF

-- Table row counts
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Verify primary keys
SELECT 
  tablename,
  constraint_name
FROM information_schema.table_constraints
WHERE constraint_type = 'PRIMARY KEY'
ORDER BY tablename;

-- Check most recent data
SELECT 
  'companies' as table_name, 
  COUNT(*) as row_count,
  MAX(updated_at) as latest_update
FROM companies
UNION ALL
SELECT 
  'employees', 
  COUNT(*),
  MAX(updated_at)
FROM employees
UNION ALL
SELECT 
  'payroll_runs',
  COUNT(*),
  MAX(created_at)
FROM payroll_runs;

EOF
```

**Success Criteria**:
- All core tables exist (companies, employees, payroll_runs, etc.)
- Row counts match production baseline:
  - `companies`: >= 5 rows
  - `employees`: >= 50 rows
  - `payroll_runs`: >= 10 rows
- Latest update timestamps are recent (within 24 hours)

---

## Post-Drill Validation

### Checklist

- [ ] Data row counts verified
- [ ] All tables accessible
- [ ] No orphaned foreign keys
- [ ] Recent data present (max 15 min old)
- [ ] Timestamps in correct timezone
- [ ] Audit log entries present

### Documentation

**Fill out after drill completes**:

```markdown
## Drill Results — [DATE]

**Start Time**: [TIME]  
**End Time**: [TIME]  
**Total Duration**: [XX minutes]  

### Metrics
- Download time: ___ min
- Decrypt time: ___ min
- Restore time: ___ min
- Verify time: ___ min

### Issues Encountered
- [ ] None
- [ ] Minor (document below)
- [ ] Critical (abort drill, escalate)

**Issues**:
[Describe any problems, error messages, etc.]

### Data Verification
- Companies: ___ rows (baseline: 5+)
- Employees: ___ rows (baseline: 50+)
- Payroll: ___ rows (baseline: 10+)
- Latest update: ___

### Lessons Learned
[Any process improvements or observations]

### Sign-off
- **Conducted By**: _______________
- **Reviewed By**: _______________
- **Date**: _______________
```

---

## Success/Failure Criteria

### ✅ DRILL PASSED

- All steps complete within 30 minutes
- Zero data loss (row counts match)
- No critical errors
- Staging environment fully operational
- Documentation complete

### ❌ DRILL FAILED

- Any step takes > expected time
- Data integrity issues detected (missing tables/rows)
- Critical errors (encryption, network, etc.)
- **Action**: File incident report, delay next drill until resolved

---

## Automated Monthly Schedule

Add to GitHub Actions `.github/workflows/restore-drill.yml`:

```yaml
name: Monthly Restore Drill

on:
  schedule:
    - cron: '0 10 1 * 1'  # 1st Monday, 10:00 AM UTC

jobs:
  restore-drill:
    name: Execute Restore Drill
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Notify drill start
        run: |
          echo "🚨 Restore drill started"
          # Send Slack notification
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"DR Drill: Restore started"}'
      
      - name: Run restore script
        env:
          BACKUP_ENCRYPTION_KEY: ${{ secrets.BACKUP_ENCRYPTION_KEY }}
          STAGING_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
          STAGING_DB_HOST: ${{ secrets.STAGING_DB_HOST }}
        run: bash scripts/restore-from-backup.sh
      
      - name: Run integrity checks
        env:
          STAGING_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
          STAGING_DB_HOST: ${{ secrets.STAGING_DB_HOST }}
        run: bash scripts/verify-restore.sh
      
      - name: Notify drill complete
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"✅ Restore drill completed"}'
```

---

## Contact & Escalation

If drill fails:

1. **Immediate**: Post in #ops-alerts with issue details
2. **15 min**: Escalate to Database Admin
3. **30 min**: Escalate to Engineering Lead
4. **Decision**: Postpone drill OR continue investigation

---

**Last Drill**: [YYYY-MM-DD]  
**Next Scheduled**: [1st Monday of next month]
