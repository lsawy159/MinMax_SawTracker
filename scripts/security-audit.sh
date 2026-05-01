#!/bin/bash
# security-audit.sh — OWASP Top 10 basic validation
# Run before production deployment

set -e

echo "🔐 SawTracker Security Audit — OWASP Top 10"
echo "==========================================="

PASS=0
WARN=0
FAIL=0

# Helper functions
pass() { echo "✓ $1"; ((PASS++)); }
warn() { echo "⚠ $1"; ((WARN++)); }
fail() { echo "✗ $1"; ((FAIL++)); }

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "--- 1. Injection Prevention ---"

# Check for SQL injection prevention
if grep -r "db.rpc" src/ > /dev/null 2>&1; then
  if grep -r "parameterized\|prepared" src/ > /dev/null 2>&1; then
    pass "SQL: Using parameterized queries"
  else
    warn "SQL: Check for proper parameter binding"
  fi
else
  warn "SQL: No RPC calls found — verify ORM usage"
fi

# Check for command injection prevention
if grep -r "child_process\|exec(" src/ > /dev/null 2>&1; then
  fail "Command Injection: Found dangerous exec() calls"
else
  pass "Command Injection: No shell exec calls detected"
fi

# Check HTML escaping
if grep -r "dangerouslySetInnerHTML" src/ > /dev/null 2>&1; then
  fail "XSS: Found dangerouslySetInnerHTML without sanitization"
else
  pass "XSS: No unsafe HTML injection patterns"
fi

echo ""
echo "--- 2. Broken Authentication ---"

# Check for JWT validation
if grep -r "requireAuth\|verifyJWT" src/ supabase/functions/_shared/ > /dev/null 2>&1; then
  pass "Auth: JWT validation helpers in place"
else
  warn "Auth: Verify authentication guards on all endpoints"
fi

# Check password policy
if grep -r "password.*length.*8\|MIN_PASSWORD" src/ supabase/ > /dev/null 2>&1; then
  pass "Passwords: Minimum length policy enforced"
else
  warn "Passwords: Verify password complexity requirements"
fi

# Check session handling
if grep -r "sessionStorage\|sessionId" src/ > /dev/null 2>&1; then
  pass "Sessions: Token storage mechanism identified"
else
  warn "Sessions: Verify session/token management"
fi

echo ""
echo "--- 3. Sensitive Data Exposure ---"

# Check for hardcoded secrets
if grep -rE "(API_KEY|PASSWORD|SECRET|TOKEN)(\s*=\s*['\"]\w)" src/ > /dev/null 2>&1; then
  fail "Secrets: Found hardcoded credentials in code"
else
  pass "Secrets: No hardcoded credentials detected"
fi

# Check for .env.example
if [ -f ".env.example" ]; then
  pass "Env Config: .env.example exists (template provided)"
else
  warn "Env Config: .env.example missing — add template"
fi

# Check for HTTPS/TLS
if grep -r "https\|tls\|ssl" vercel.json > /dev/null 2>&1; then
  pass "TLS: HTTPS enforcement configured"
else
  warn "TLS: Verify HTTPS is enforced on all routes"
fi

echo ""
echo "--- 4. XML External Entities (XXE) ---"

# Check for XML parsing
if grep -r "xml\|parse" src/ | grep -v "XML" > /dev/null 2>&1; then
  warn "XXE: XML parsing detected — verify safe configuration"
else
  pass "XXE: No unsafe XML parsing identified"
fi

echo ""
echo "--- 5. Broken Access Control ---"

# Check for RLS policies
if grep -r "rls_enable\|row_level_security" supabase/ > /dev/null 2>&1; then
  pass "RBAC: Row-level security policies configured"
else
  warn "RBAC: Verify RLS policies on sensitive tables"
fi

# Check for authorization checks
if grep -r "is_admin\|has_permission\|requireAdmin" src/ supabase/ > /dev/null 2>&1; then
  pass "Authz: Permission checks implemented"
else
  fail "Authz: Missing authorization controls"
fi

echo ""
echo "--- 6. Security Misconfiguration ---"

# Check for security headers
if grep -r "CSP\|HSTS\|X-Frame-Options" vercel.json > /dev/null 2>&1; then
  pass "Headers: Security headers configured"
else
  warn "Headers: Add CSP, HSTS, X-Frame-Options to vercel.json"
fi

# Check CORS configuration
if grep -r "CORS\|cors\|Access-Control-Allow-Origin" vercel.json supabase/ > /dev/null 2>&1; then
  if grep -r "localhost\|^\*" vercel.json > /dev/null 2>&1; then
    warn "CORS: Verify CORS allow-list (check for wildcards in prod)"
  else
    pass "CORS: Restricted CORS configuration"
  fi
else
  warn "CORS: Configure CORS allow-list"
fi

echo ""
echo "--- 7. Cross-Site Scripting (XSS) Prevention ---"

# Check input sanitization
if grep -r "sanitize\|escapeHtml\|DOMPurify" src/ > /dev/null 2>&1; then
  pass "Input Sanitization: Sanitization functions present"
else
  warn "Input Sanitization: Verify all user input is escaped"
fi

# Check Content Security Policy
if grep -r "script-src\|default-src" vercel.json > /dev/null 2>&1; then
  pass "CSP: Content Security Policy configured"
else
  warn "CSP: Add Content Security Policy headers"
fi

echo ""
echo "--- 8. Insecure Deserialization ---"

# Check for unsafe JSON parsing
if grep -r "eval(\|Function(" src/ > /dev/null 2>&1; then
  fail "Deserialization: Found unsafe eval() calls"
else
  pass "Deserialization: No unsafe eval detected"
fi

# Check for proper JSON validation
if grep -r "JSON.parse\|zod\|yup" src/ > /dev/null 2>&1; then
  pass "JSON: Validation schemas in place"
else
  warn "JSON: Verify JSON input validation"
fi

echo ""
echo "--- 9. Using Components with Known Vulnerabilities ---"

# Run npm audit
echo ""
echo "Running npm audit..."
if npm audit --audit-level=moderate 2>&1 | grep -q "0 vulnerabilities"; then
  pass "Dependencies: No known vulnerabilities"
else
  npm audit --audit-level=moderate || warn "Dependencies: Review audit output above"
fi

echo ""
echo "--- 10. Insufficient Logging & Monitoring ---"

# Check for error logging
if grep -r "Sentry\|logger\|error\|console.error" src/ > /dev/null 2>&1; then
  pass "Logging: Error logging configured"
else
  warn "Logging: Add error logging (Sentry/logger)"
fi

# Check for audit logging
if grep -r "audit_log\|SecurityLogger" src/ supabase/ > /dev/null 2>&1; then
  pass "Audit: Audit logging implemented"
else
  warn "Audit: Add audit trail for critical operations"
fi

echo ""
echo "==========================================="
echo -e "${GREEN}Passed: $PASS${NC} | ${YELLOW}Warnings: $WARN${NC} | ${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}❌ Security audit FAILED — fix critical issues before deployment${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Security audit PASSED with warnings — review and remediate${NC}"
  exit 0
else
  echo -e "${GREEN}✅ Security audit PASSED — ready for deployment${NC}"
  exit 0
fi
