#!/usr/bin/env bash
# rotate-secrets.sh — Rotate production secrets for SawTracker
# Usage: ./scripts/rotate-secrets.sh [--dry-run]
#
# Prerequisites:
#   - Supabase CLI installed and logged in (supabase login)
#   - Vercel CLI installed and logged in (vercel login)
#   - openssl available (brew install openssl / apt install openssl)
#
# Secrets rotated:
#   - CRON_SECRET          (random 48-byte hex)
#   - BACKUP_ENCRYPTION_KEY (random 32-byte base64, AES-256 key)
#
# Secrets NOT rotated here (require manual provider action):
#   - RESEND_API_KEY   → rotate at resend.com/api-keys, then update manually
#   - SUPABASE_SERVICE_ROLE_KEY → rotate in Supabase project settings
#   - SUPABASE_ANON_KEY         → rotate in Supabase project settings

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "==> DRY RUN mode — no secrets will actually be updated"
fi

# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[ERROR] $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "Required command not found: $1. Please install it first."
}

confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }
}

set_supabase_secret() {
  local name="$1"
  local value="$2"
  if [[ "$DRY_RUN" == true ]]; then
    log "DRY RUN: would set Supabase secret $name"
  else
    supabase secrets set "${name}=${value}" --project-ref "$SUPABASE_PROJECT_REF"
    log "Set Supabase secret: $name"
  fi
}

set_vercel_env() {
  local name="$1"
  local value="$2"
  local env_target="${3:-production}"
  if [[ "$DRY_RUN" == true ]]; then
    log "DRY RUN: would set Vercel env $name ($env_target)"
  else
    # Remove old value silently, then add new
    vercel env rm "$name" "$env_target" --yes 2>/dev/null || true
    echo "$value" | vercel env add "$name" "$env_target"
    log "Set Vercel env: $name ($env_target)"
  fi
}

# ──────────────────────────────────────────────────────────
# Dependency checks
# ──────────────────────────────────────────────────────────

require_cmd openssl
require_cmd supabase
require_cmd vercel

# ──────────────────────────────────────────────────────────
# Project reference
# ──────────────────────────────────────────────────────────

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
  # Try to read from .env.local
  if [[ -f ".env.local" ]]; then
    SUPABASE_PROJECT_REF=$(grep -E '^VITE_SUPABASE_URL' .env.local | sed 's|.*supabase.co/.*||' | grep -oP '(?<=https://)[^.]+' || true)
  fi
fi

if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
  read -r -p "Enter Supabase project ref (e.g. abcxyz123456): " SUPABASE_PROJECT_REF
fi

[[ -z "$SUPABASE_PROJECT_REF" ]] && err "SUPABASE_PROJECT_REF is required"
log "Using Supabase project: $SUPABASE_PROJECT_REF"

# ──────────────────────────────────────────────────────────
# Generate new secrets
# ──────────────────────────────────────────────────────────

NEW_CRON_SECRET=$(openssl rand -hex 48)
NEW_BACKUP_KEY=$(openssl rand -base64 32)

log "Generated new CRON_SECRET (${#NEW_CRON_SECRET} chars)"
log "Generated new BACKUP_ENCRYPTION_KEY (${#NEW_BACKUP_KEY} chars)"

# ──────────────────────────────────────────────────────────
# Preview + confirmation
# ──────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════"
echo "  Secrets to be rotated:"
echo "  CRON_SECRET           → ${NEW_CRON_SECRET:0:12}... (truncated)"
echo "  BACKUP_ENCRYPTION_KEY → ${NEW_BACKUP_KEY:0:12}... (truncated)"
echo ""
echo "  Targets:"
echo "  - Supabase project: $SUPABASE_PROJECT_REF"
echo "  - Vercel (production)"
echo "══════════════════════════════════════════════════"
echo ""

if [[ "$DRY_RUN" != true ]]; then
  confirm "Proceed with rotation? This will invalidate existing cron jobs until redeployed."
fi

# ──────────────────────────────────────────────────────────
# Rotate CRON_SECRET
# ──────────────────────────────────────────────────────────

log "Rotating CRON_SECRET..."
set_supabase_secret "CRON_SECRET" "$NEW_CRON_SECRET"
set_vercel_env "CRON_SECRET" "$NEW_CRON_SECRET" "production"

# ──────────────────────────────────────────────────────────
# Rotate BACKUP_ENCRYPTION_KEY
# ──────────────────────────────────────────────────────────

log "Rotating BACKUP_ENCRYPTION_KEY..."
set_supabase_secret "BACKUP_ENCRYPTION_KEY" "$NEW_BACKUP_KEY"
set_vercel_env "BACKUP_ENCRYPTION_KEY" "$NEW_BACKUP_KEY" "production"

# ──────────────────────────────────────────────────────────
# Save record to local audit file (never commit this!)
# ──────────────────────────────────────────────────────────

AUDIT_DIR=".secret-rotation-audit"
mkdir -p "$AUDIT_DIR"
AUDIT_FILE="$AUDIT_DIR/rotation-$(date '+%Y%m%d-%H%M%S').txt"

cat > "$AUDIT_FILE" <<EOF
Rotation Date: $(date '+%Y-%m-%d %H:%M:%S %Z')
Supabase Project: $SUPABASE_PROJECT_REF
Dry Run: $DRY_RUN

Rotated:
  CRON_SECRET           [OK]
  BACKUP_ENCRYPTION_KEY [OK]

Manual rotation required:
  RESEND_API_KEY         → resend.com/api-keys
  SUPABASE_SERVICE_ROLE_KEY → Supabase project settings > API
  SUPABASE_ANON_KEY         → Supabase project settings > API
EOF

log "Audit record saved: $AUDIT_FILE"
log "WARNING: Add $AUDIT_DIR/ to .gitignore — never commit rotation records"

# ──────────────────────────────────────────────────────────
# Remind about manual secrets
# ──────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════"
echo "  MANUAL STEPS REQUIRED:"
echo ""
echo "  1. RESEND_API_KEY — rotate at https://resend.com/api-keys"
echo "     Then run:"
echo "       supabase secrets set RESEND_API_KEY=<new_key> --project-ref $SUPABASE_PROJECT_REF"
echo "       vercel env rm RESEND_API_KEY production && echo '<new_key>' | vercel env add RESEND_API_KEY production"
echo ""
echo "  2. SUPABASE keys — rotate in Supabase project settings:"
echo "     https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/settings/api"
echo "     Then update VITE_SUPABASE_ANON_KEY in Vercel environment variables"
echo ""
echo "  3. Redeploy Edge Functions after rotating Supabase secrets:"
echo "     supabase functions deploy --project-ref $SUPABASE_PROJECT_REF"
echo ""
echo "  4. Redeploy Vercel after updating env vars:"
echo "     vercel --prod"
echo "══════════════════════════════════════════════════"
echo ""

log "Rotation complete."
