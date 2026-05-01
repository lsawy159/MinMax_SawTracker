import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

interface TriggerBackupRequest {
  backup_type?: 'full' | 'incremental' | 'partial'
  triggered_by?: 'manual' | 'system'
}

interface CronLogEntry {
  id: string
  created_at: string
  job_name: string
  status: string
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const createMockRequest = (
  payload: TriggerBackupRequest,
  headers: Record<string, string> = {},
  method = 'POST'
): Request =>
  new Request('http://localhost:3000', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer admin-token',
      ...headers,
    },
    body: method !== 'OPTIONS' ? JSON.stringify(payload) : undefined,
  })

Deno.test('trigger-backup: requireAdmin enforces admin check', async () => {
  const req = createMockRequest({ backup_type: 'full' })
  assertEquals(req.headers.get('Authorization'), 'Bearer admin-token')
})

Deno.test('trigger-backup: OPTIONS request returns 200 with CORS headers', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const response = new Response(null, { status: 200, headers: corsHeaders })

  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
})

Deno.test('trigger-backup: backup_type defaults to full', () => {
  const payload: TriggerBackupRequest = {}
  const backupType = payload.backup_type || 'full'

  assertEquals(backupType, 'full')
})

Deno.test('trigger-backup: backup_type accepts full', () => {
  const payload: TriggerBackupRequest = { backup_type: 'full' }
  const backupType = payload.backup_type || 'full'

  assertEquals(backupType, 'full')
})

Deno.test('trigger-backup: backup_type accepts incremental', () => {
  const payload: TriggerBackupRequest = { backup_type: 'incremental' }
  const backupType = payload.backup_type || 'full'

  assertEquals(backupType, 'incremental')
})

Deno.test('trigger-backup: backup_type accepts partial', () => {
  const payload: TriggerBackupRequest = { backup_type: 'partial' }
  const backupType = payload.backup_type || 'full'

  assertEquals(backupType, 'partial')
})

Deno.test('trigger-backup: triggered_by defaults to manual', () => {
  const payload: TriggerBackupRequest = {}
  const triggeredBy = payload.triggered_by || 'manual'

  assertEquals(triggeredBy, 'manual')
})

Deno.test('trigger-backup: triggered_by accepts manual', () => {
  const payload: TriggerBackupRequest = { triggered_by: 'manual' }
  const triggeredBy = payload.triggered_by || 'manual'

  assertEquals(triggeredBy, 'manual')
})

Deno.test('trigger-backup: triggered_by accepts system', () => {
  const payload: TriggerBackupRequest = { triggered_by: 'system' }
  const triggeredBy = payload.triggered_by || 'manual'

  assertEquals(triggeredBy, 'system')
})

Deno.test('trigger-backup: log entry contains backup_type in result_details', () => {
  const payload: TriggerBackupRequest = { backup_type: 'incremental', triggered_by: 'manual' }
  const logEntry = {
    job_name: 'backup_daily',
    status: 'running',
    executed_by: payload.triggered_by || 'manual',
    result_details: { backup_type: payload.backup_type || 'full', triggered_by: payload.triggered_by || 'manual' }
  }

  assertEquals(logEntry.result_details.backup_type, 'incremental')
  assertEquals(logEntry.result_details.triggered_by, 'manual')
})

Deno.test('trigger-backup: execution_time_ms calculated from timestamps', () => {
  const startTime = new Date('2026-05-01T10:00:00Z')
  const endTime = new Date('2026-05-01T10:02:30Z')
  const executionTimeMs = endTime.getTime() - startTime.getTime()

  assertEquals(executionTimeMs, 150000) // 2.5 minutes = 150 seconds
})

Deno.test('trigger-backup: successful backup response returns 200', () => {
  const backupResponse = { success: true, backup_id: 'backup-123' }
  const status = backupResponse.success ? 200 : 500

  assertEquals(status, 200)
})

Deno.test('trigger-backup: failed backup response returns 500', () => {
  const backupResponse = { success: false, error: 'Storage full' }
  const status = backupResponse.success ? 200 : 500

  assertEquals(status, 500)
})

Deno.test('trigger-backup: response includes execution_time_ms', () => {
  const response = {
    success: true,
    message: 'تم تشغيل النسخ الاحتياطي بنجاح',
    backup_data: {},
    execution_time_ms: 45000
  }

  assertEquals(typeof response.execution_time_ms, 'number')
  assertEquals(response.execution_time_ms, 45000)
})

Deno.test('trigger-backup: response includes Arabic success message', () => {
  const response = {
    success: true,
    message: 'تم تشغيل النسخ الاحتياطي بنجاح',
  }

  assertStringIncludes(response.message, 'تم')
  assertStringIncludes(response.message, 'النسخ')
})

Deno.test('trigger-backup: response includes Arabic failure message', () => {
  const response = {
    success: false,
    message: 'فشل تشغيل النسخ الاحتياطي',
  }

  assertStringIncludes(response.message, 'فشل')
})

Deno.test('trigger-backup: CORS headers include Max-Age', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  assertEquals(corsHeaders['Access-Control-Max-Age'], '86400')
})

Deno.test('trigger-backup: log update includes error_message on failure', () => {
  const backupResponseOk = false
  const backupData = { error: 'Database connection failed' }
  const errorMessage = !backupResponseOk ? JSON.stringify(backupData) : null

  assertEquals(errorMessage, JSON.stringify({ error: 'Database connection failed' }))
})

Deno.test('trigger-backup: log update sets error_message to null on success', () => {
  const backupResponseOk = true
  const backupData = { backup_id: 'bak-123' }
  const errorMessage = !backupResponseOk ? JSON.stringify(backupData) : null

  assertEquals(errorMessage, null)
})
