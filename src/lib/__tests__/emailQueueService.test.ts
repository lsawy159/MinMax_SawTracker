import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enqueueEmail } from '../emailQueueService'
import { supabase } from '../supabase'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('emailQueueService activity logging', () => {
  let insertMock: any
  let catchMock: any

  beforeEach(() => {
    vi.stubEnv('VITE_EMAIL_QUEUE_MODE', 'normal')

    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup default mock behavior
    catchMock = vi.fn(() => Promise.resolve({}))
    insertMock = vi.fn(() => ({
      catch: catchMock,
    }))
  })

  describe('success path logs create_success', () => {
    it('should log successful email enqueue to activity_log', async () => {
      const mockData = { id: 'test-email-id' }

      // Mock successful email_queue insert
      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === 'email_queue') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
              }),
            }),
          }
        }
        if (table === 'activity_log') {
          return { insert: insertMock }
        }
      })

      const result = await enqueueEmail({
        toEmails: ['test@example.com'],
        subject: 'Test Email',
        htmlContent: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.id).toBe('test-email-id')

      // Verify activity_log.insert was called with create_success
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'email_queue',
          action: 'create_success',
          entity_id: 'test-email-id',
        })
      )
    })
  })

  describe('failure path logs create_failed', () => {
    it('should log DB error to activity_log with create_failed action', async () => {
      const mockError = { message: 'Database connection failed' }

      // Mock failed email_queue insert
      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === 'email_queue') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
              }),
            }),
          }
        }
        if (table === 'activity_log') {
          return { insert: insertMock }
        }
      })

      const result = await enqueueEmail({
        toEmails: ['test@example.com'],
        subject: 'Test Email',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to enqueue email.')

      // Verify activity_log.insert was called with create_failed
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'email_queue',
          action: 'create_failed',
          details: 'Database connection failed',
        })
      )
    })
  })

  describe('exception path logs create_exception', () => {
    it('should log unexpected exception to activity_log with create_exception action', async () => {
      const mockError = new Error('Network timeout')

      // Mock exception during email enqueue
      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === 'email_queue') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockRejectedValue(mockError),
              }),
            }),
          }
        }
        if (table === 'activity_log') {
          return { insert: insertMock }
        }
      })

      const result = await enqueueEmail({
        toEmails: ['test@example.com'],
        subject: 'Test Email',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('An unexpected error occurred.')

      // Verify activity_log.insert was called with create_exception
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'email_queue',
          action: 'create_exception',
          details: 'Network timeout',
        })
      )
    })
  })

  describe('non-blocking error handling', () => {
    it('should not fail email enqueue if activity_log insert fails', async () => {
      const mockData = { id: 'test-email-id' }

      // Mock successful email_queue but failed activity_log
      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === 'email_queue') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
              }),
            }),
          }
        }
        if (table === 'activity_log') {
          return {
            insert: vi.fn().mockReturnValue({
              catch: vi.fn().mockImplementation((fn) => {
                // Simulate activity_log error being caught and ignored
                fn(new Error('activity_log insert failed'))
                return Promise.resolve({})
              }),
            }),
          }
        }
      })

      const result = await enqueueEmail({
        toEmails: ['test@example.com'],
        subject: 'Test Email',
      })

      // Email enqueue should still succeed even if activity_log fails
      expect(result.success).toBe(true)
      expect(result.id).toBe('test-email-id')
    })
  })

  describe('queue mode constraint', () => {
    it('should allow emails in normal mode (production: digest-only constraint enforced separately)', async () => {
      // Tests run in normal mode via VITE_EMAIL_QUEUE_MODE=normal mock at top of file
      // Production digest-only constraint is enforced at deployment via env var
      const mockData = { id: 'normal-mode-email-id' }

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === 'email_queue') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
              }),
            }),
          }
        }
        if (table === 'activity_log') {
          return { insert: vi.fn(() => ({ catch: vi.fn() })) }
        }
      })

      const result = await enqueueEmail({
        toEmails: ['any@example.com'],
        subject: 'Any Email Subject',
      })

      expect(result.success).toBe(true)
      expect(result.id).toBe('normal-mode-email-id')
    })
  })
})
