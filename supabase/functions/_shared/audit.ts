import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuditLogEntry {
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete'
  changed_fields?: Record<string, unknown>
  changes_summary?: string
  notes?: string
}

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      changed_fields: entry.changed_fields,
      changes_summary: entry.changes_summary,
      notes: entry.notes,
    })

    if (error) {
      console.warn('Failed to log audit entry:', error)
    }
  } catch (err) {
    console.warn('Error logging audit:', err)
  }
}
