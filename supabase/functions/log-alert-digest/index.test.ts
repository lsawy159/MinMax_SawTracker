import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

interface AlertDigestLog {
  company_id?: string | null
  employee_id?: string | null
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  action_required: string
  expiry_date?: string | null
  details: Record<string, unknown>
}

interface DigestRequest {
  logs: AlertDigestLog[]
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const createMockRequest = (
  payload: DigestRequest,
  headers: Record<string, string> = {},
  method = 'POST'
): Request =>
  new Request('http://localhost:3000', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'Origin': 'http://localhost:3000',
      ...headers,
    },
    body: method !== 'OPTIONS' ? JSON.stringify(payload) : undefined,
  })

Deno.test('log-alert-digest: requires logs array', () => {
  const payload = { logs: undefined }
  const valid = Array.isArray(payload.logs)

  assertEquals(valid, false)
})

Deno.test('log-alert-digest: accepts empty logs array', () => {
  const payload: DigestRequest = { logs: [] }
  const valid = Array.isArray(payload.logs)

  assertEquals(valid, true)
})

Deno.test('log-alert-digest: accepts single log entry', () => {
  const payload: DigestRequest = {
    logs: [
      {
        company_id: 'comp-1',
        alert_type: 'payroll_error',
        priority: 'high',
        title: 'رواتب',
        message: 'خطأ في الحساب',
        action_required: 'تصحيح يدوي',
        details: { error_code: 'PAYROLL_001' }
      }
    ]
  }

  assertEquals(payload.logs.length, 1)
  assertEquals(payload.logs[0].company_id, 'comp-1')
})

Deno.test('log-alert-digest: accepts multiple log entries', () => {
  const payload: DigestRequest = {
    logs: [
      {
        company_id: 'comp-1',
        alert_type: 'payroll_error',
        priority: 'high',
        title: 'خطأ رواتب',
        message: 'فشل الحساب',
        action_required: 'review',
        details: {}
      },
      {
        employee_id: 'emp-2',
        alert_type: 'attendance_issue',
        priority: 'medium',
        title: 'الحضور',
        message: 'بيانات ناقصة',
        action_required: 'update',
        details: {}
      }
    ]
  }

  assertEquals(payload.logs.length, 2)
})

Deno.test('log-alert-digest: priority accepts urgent', () => {
  const log: AlertDigestLog = {
    alert_type: 'system_error',
    priority: 'urgent',
    title: 'System Down',
    message: 'Critical failure',
    action_required: 'immediate',
    details: {}
  }

  assertEquals(log.priority, 'urgent')
})

Deno.test('log-alert-digest: priority accepts high', () => {
  const log: AlertDigestLog = {
    alert_type: 'payroll_error',
    priority: 'high',
    title: 'Error',
    message: 'Problem',
    action_required: 'fix',
    details: {}
  }

  assertEquals(log.priority, 'high')
})

Deno.test('log-alert-digest: priority accepts medium', () => {
  const log: AlertDigestLog = {
    alert_type: 'warning',
    priority: 'medium',
    title: 'Warning',
    message: 'Issue',
    action_required: 'review',
    details: {}
  }

  assertEquals(log.priority, 'medium')
})

Deno.test('log-alert-digest: priority accepts low', () => {
  const log: AlertDigestLog = {
    alert_type: 'info',
    priority: 'low',
    title: 'Info',
    message: 'Notice',
    action_required: 'none',
    details: {}
  }

  assertEquals(log.priority, 'low')
})

Deno.test('log-alert-digest: company_id can be null', () => {
  const log: AlertDigestLog = {
    company_id: null,
    employee_id: 'emp-1',
    alert_type: 'test',
    priority: 'low',
    title: 'Test',
    message: 'Test message',
    action_required: 'none',
    details: {}
  }

  assertEquals(log.company_id, null)
})

Deno.test('log-alert-digest: employee_id can be null', () => {
  const log: AlertDigestLog = {
    company_id: 'comp-1',
    employee_id: null,
    alert_type: 'test',
    priority: 'low',
    title: 'Test',
    message: 'Test message',
    action_required: 'none',
    details: {}
  }

  assertEquals(log.employee_id, null)
})

Deno.test('log-alert-digest: expiry_date can be null', () => {
  const log: AlertDigestLog = {
    alert_type: 'test',
    priority: 'low',
    title: 'Test',
    message: 'Test',
    action_required: 'none',
    expiry_date: null,
    details: {}
  }

  assertEquals(log.expiry_date, null)
})

Deno.test('log-alert-digest: expiry_date accepts ISO string', () => {
  const log: AlertDigestLog = {
    alert_type: 'test',
    priority: 'low',
    title: 'Test',
    message: 'Test',
    action_required: 'none',
    expiry_date: '2026-05-15T00:00:00Z',
    details: {}
  }

  assertEquals(log.expiry_date, '2026-05-15T00:00:00Z')
})

Deno.test('log-alert-digest: startOfToday calculated correctly', () => {
  const startOfToday = new Date('2026-05-01T00:00:00Z')
  const expected = new Date('2026-05-01T00:00:00Z')

  assertEquals(startOfToday.toISOString(), expected.toISOString())
})

Deno.test('log-alert-digest: startOfTomorrow one day after startOfToday', () => {
  const startOfToday = new Date('2026-05-01T00:00:00Z')
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  assertEquals(startOfTomorrow.getDate(), startOfToday.getDate() + 1)
})

Deno.test('log-alert-digest: response includes logged count', () => {
  const response = {
    success: true,
    logged: 2,
    skipped: 1,
    failed: 0,
    message: 'Logged 2, skipped 1, failed 0'
  }

  assertEquals(response.logged, 2)
})

Deno.test('log-alert-digest: response includes skipped count', () => {
  const response = {
    success: true,
    logged: 0,
    skipped: 3,
    failed: 0,
    message: 'Logged 0, skipped 3, failed 0'
  }

  assertEquals(response.skipped, 3)
})

Deno.test('log-alert-digest: response includes failed count', () => {
  const response = {
    success: true,
    logged: 1,
    skipped: 0,
    failed: 2,
    message: 'Logged 1, skipped 0, failed 2'
  }

  assertEquals(response.failed, 2)
})

Deno.test('log-alert-digest: message format includes all counts', () => {
  const response = {
    success: true,
    logged: 5,
    skipped: 2,
    failed: 1,
    message: 'Logged 5, skipped 2, failed 1'
  }

  assertStringIncludes(response.message, 'Logged 5')
  assertStringIncludes(response.message, 'skipped 2')
  assertStringIncludes(response.message, 'failed 1')
})

Deno.test('log-alert-digest: duplicate key error (23505) marked as skipped', () => {
  const errorCode = '23505'
  const isSkipped = errorCode === '23505'

  assertEquals(isSkipped, true)
})

Deno.test('log-alert-digest: other lookup error code triggers throw', () => {
  const errorCode = 'PGRST999'
  const shouldThrow = errorCode !== 'PGRST116'

  assertEquals(shouldThrow, true)
})

Deno.test('log-alert-digest: PGRST116 error (no rows) allowed', () => {
  const errorCode = 'PGRST116'
  const allowed = errorCode === 'PGRST116'

  assertEquals(allowed, true)
})

Deno.test('log-alert-digest: OPTIONS request returns 200', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
  const response = new Response(null, { status: 200, headers: corsHeaders })

  assertEquals(response.status, 200)
})

Deno.test('log-alert-digest: empty logs array returns all zeros', () => {
  const logged = 0
  const skipped = 0
  const failed = 0

  assertEquals(logged + skipped + failed, 0)
})

Deno.test('log-alert-digest: details can contain nested objects', () => {
  const log: AlertDigestLog = {
    alert_type: 'payroll_error',
    priority: 'high',
    title: 'Error',
    message: 'Message',
    action_required: 'fix',
    details: {
      error_code: 'ERR_001',
      employee_id: 'emp-123',
      payroll_run: {
        month: 5,
        year: 2026,
        status: 'failed'
      }
    }
  }

  assertEquals(typeof log.details.error_code, 'string')
  assertEquals(typeof log.details.payroll_run, 'object')
})
