import { supabase } from '@/lib/supabase'
import { logger, AuditActionType } from './securityLogger'

/**
 * Audit Service
 * Provides utility methods for logging audit events
 */
export class AuditService {
  /**
   * Log a create action
   */
  static async logCreate(
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const user = await supabase.auth.getUser()
      await logger.logAudit({
        user_id: user.data.user?.id,
        action_type: AuditActionType.CREATE,
        resource_type: resourceType,
        resource_id: resourceId,
        new_values: data,
      })
    } catch (error) {
      console.error('Error logging create action:', error)
    }
  }

  /**
   * Log an update action
   */
  static async logUpdate(
    resourceType: string,
    resourceId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): Promise<void> {
    try {
      const user = await supabase.auth.getUser()
      await logger.logAudit({
        user_id: user.data.user?.id,
        action_type: AuditActionType.UPDATE,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: oldData,
        new_values: newData,
      })
    } catch (error) {
      console.error('Error logging update action:', error)
    }
  }

  /**
   * Log a delete action
   */
  static async logDelete(
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const user = await supabase.auth.getUser()
      await logger.logAudit({
        user_id: user.data.user?.id,
        action_type: AuditActionType.DELETE,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: data,
      })
    } catch (error) {
      console.error('Error logging delete action:', error)
    }
  }

  /**
   * Get audit logs for a specific user
   */
  static async getUserAuditLogs(userId: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching user audit logs:', error)
      return []
    }
  }

  /**
   * Get recent audit logs for a resource
   */
  static async getResourceAuditLogs(
    resourceType: string,
    resourceId: string,
    limit: number = 50
  ) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching resource audit logs:', error)
      return []
    }
  }

  /**
   * Get security events
   */
  static async getSecurityEvents(
    limit: number = 100,
    unresolved_only: boolean = false
  ) {
    try {
      let query = supabase
        .from('security_events')
        .select('*')

      if (unresolved_only) {
        query = query.eq('is_resolved', false)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching security events:', error)
      return []
    }
  }

  /**
   * Resolve a security event
   */
  static async resolveSecurityEvent(eventId: string, resolvedBy?: string) {
    try {
      const user = resolvedBy || (await supabase.auth.getUser()).data.user?.id

      const { error } = await supabase
        .from('security_events')
        .update({
          is_resolved: true,
          resolved_by: user,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', eventId)

      if (error) throw error
    } catch (error) {
      console.error('Error resolving security event:', error)
    }
  }

  /**
   * Get audit log statistics
   */
  static async getAuditStatistics(days: number = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const { data, error } = await supabase
        .from('audit_log')
        .select('action_type, status')
        .gte('created_at', cutoffDate.toISOString())

      if (error) throw error

      // Calculate statistics
      const stats = {
        total: data?.length || 0,
        byAction: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        failures: 0,
      }

      data?.forEach(log => {
        stats.byAction[log.action_type] = (stats.byAction[log.action_type] || 0) + 1
        stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1
        if (log.status === 'failure') stats.failures++
      })

      return stats
    } catch (error) {
      console.error('Error getting audit statistics:', error)
      return null
    }
  }
}

export default AuditService
