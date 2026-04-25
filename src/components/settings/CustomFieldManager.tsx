import { useState, useEffect } from 'react'
import { supabase, CustomField } from '@/lib/supabase'
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog'

type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea'
type EntityType = 'employee' | 'company'

interface FieldFormData {
  entity_type: EntityType
  field_name: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  is_active: boolean
  field_options: { options?: string[] }
  display_order: number
}

export default function CustomFieldManager() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [formData, setFormData] = useState<FieldFormData>({
    entity_type: 'employee',
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    is_active: true,
    field_options: {},
    display_order: 0,
  })
  const [selectOptions, setSelectOptions] = useState<string>('')

  // Confirmation Dialog
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null)

  useEffect(() => {
    loadFields()
  }, [])

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select(
          'id,entity_type,field_name,field_label,field_type,field_options,is_required,is_active,display_order,created_at,created_by,updated_at'
        )
        .order('entity_type')
        .order('display_order')

      if (error) throw error
      setFields((data || []) as unknown as CustomField[])
    } catch (error) {
      console.error('Error loading custom fields:', error)
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط®طµطµط©')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForm = (field?: CustomField) => {
    if (field) {
      setEditingField(field)
      setFormData({
        entity_type: field.entity_type as EntityType,
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type as FieldType,
        is_required: field.is_required,
        is_active: field.is_active,
        field_options: field.field_options || {},
        display_order: field.display_order,
      })
      if (field.field_type === 'select' && field.field_options?.options) {
        if (Array.isArray(field.field_options.options)) {
          setSelectOptions(field.field_options.options.join('\n'))
        } else if (typeof field.field_options.options === 'string') {
          setSelectOptions(field.field_options.options)
        }
      }
    } else {
      setEditingField(null)
      setFormData({
        entity_type: 'employee',
        field_name: '',
        field_label: '',
        field_type: 'text',
        is_required: false,
        is_active: true,
        field_options: {},
        display_order: fields.length,
      })
      setSelectOptions('')
    }
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingField(null)
    setSelectOptions('')
  }

  const handleSave = async () => {
    // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ط¨ظٹط§ظ†ط§طھ
    if (!formData.field_name || !formData.field_label) {
      toast.error('ظٹط±ط¬ظ‰ ظ…ظ„ط، ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط·ظ„ظˆط¨ط©')
      return
    }

    // ظ…ط¹ط§ظ„ط¬ط© ط®ظٹط§ط±ط§طھ ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظ†ط³ط¯ظ„ط©
    const finalFormData = { ...formData }
    if (formData.field_type === 'select') {
      const options = selectOptions.split('\n').filter((opt) => opt.trim())
      if (options.length === 0) {
        toast.error(
          'ظٹط±ط¬ظ‰ ط¥ط¶ط§ظپط© ط®ظٹط§ط± ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ ظ„ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظ†ط³ط¯ظ„ط©'
        )
        return
      }
      finalFormData.field_options = { options }
    }

    try {
      setIsSaving(true)
      if (editingField) {
        // طھط­ط¯ظٹط« ط­ظ‚ظ„ ظ…ظˆط¬ظˆط¯
        const { error } = await supabase
          .from('custom_fields')
          .update(finalFormData)
          .eq('id', editingField.id)

        if (error) throw error
        toast.success('طھظ… طھط­ط¯ظٹط« ط§ظ„ط­ظ‚ظ„ ط¨ظ†ط¬ط§ط­')
      } else {
        // ط¥ط¶ط§ظپط© ط­ظ‚ظ„ ط¬ط¯ظٹط¯
        const { error } = await supabase.from('custom_fields').insert([finalFormData])

        if (error) throw error
        toast.success('طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط­ظ‚ظ„ ط¨ظ†ط¬ط§ط­')
      }

      handleCloseForm()
      loadFields()
    } catch (error: unknown) {
      console.error('Error saving field:', error)
      toast.error(
        'ظپط´ظ„ ط­ظپط¸ ط§ظ„ط­ظ‚ظ„: ' + (error instanceof Error ? error.message : String(error))
      )
    }
  }

  const handleDelete = async (field: CustomField) => {
    setFieldToDelete(field)
    setShowConfirmDelete(true)
  }

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return

    try {
      const { error } = await supabase.from('custom_fields').delete().eq('id', fieldToDelete.id)

      if (error) throw error
      toast.success('طھظ… ط­ط°ظپ ط§ظ„ط­ظ‚ظ„ ط¨ظ†ط¬ط§ط­')
      loadFields()
      setShowConfirmDelete(false)
      setFieldToDelete(null)
    } catch (error: unknown) {
      console.error('Error deleting field:', error)
      toast.error('ظپط´ظ„ ط­ط°ظپ ط§ظ„ط­ظ‚ظ„')
    }
  }

  const handleToggleActive = async (field: CustomField) => {
    try {
      const { error } = await supabase
        .from('custom_fields')
        .update({ is_active: !field.is_active })
        .eq('id', field.id)

      if (error) throw error
      toast.success(field.is_active ? 'طھظ… ط¥ظٹظ‚ط§ظپ ط§ظ„ط­ظ‚ظ„' : 'طھظ… طھظپط¹ظٹظ„ ط§ظ„ط­ظ‚ظ„')
      loadFields()
    } catch {
      toast.error('ظپط´ظ„ طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط­ظ‚ظ„')
    } finally {
      setIsSaving(false)
    }
  }

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'ظ†طµ',
      number: 'ط±ظ‚ظ…',
      date: 'طھط§ط±ظٹط®',
      select: 'ظ‚ط§ط¦ظ…ط© ظ…ظ†ط³ط¯ظ„ط©',
      boolean: 'طµط­/ط®ط·ط£',
      textarea: 'ظ†طµ ط·ظˆظٹظ„',
    }
    return labels[type] || type
  }

  const employeeFields = fields.filter((f) => f.entity_type === 'employee')
  const companyFields = fields.filter((f) => f.entity_type === 'company')

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="app-panel p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط®طµطµط©</h2>
            <p className="text-neutral-600 text-sm mt-1">
              ط¥ط¯ط§ط±ط© ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط¥ط¶ط§ظپظٹط© ظ„ظ„ظ…ظˆط¸ظپظٹظ† ظˆط§ظ„ظ…ط¤ط³ط³ط§طھ
            </p>
          </div>
          <button onClick={() => handleOpenForm()} className="app-button-primary">
            <Plus className="w-5 h-5" />
            ط¥ط¶ط§ظپط© ط­ظ‚ظ„ ط¬ط¯ظٹط¯
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Employee Fields */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50">
              <h3 className="font-semibold text-neutral-900">
                ط­ظ‚ظˆظ„ ط§ظ„ظ…ظˆط¸ظپظٹظ† ({employeeFields.length})
              </h3>
            </div>
            <div className="p-6">
              {employeeFields.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
                  <p>ظ„ط§ طھظˆط¬ط¯ ط­ظ‚ظˆظ„ ظ…ط®طµطµط© ظ„ظ„ظ…ظˆط¸ظپظٹظ†</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`w-3 h-3 rounded-full ${field.is_active ? 'bg-green-500' : 'bg-neutral-400'}`}
                        ></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-neutral-900">{field.field_label}</h4>
                            {field.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                ظ…ط·ظ„ظˆط¨
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-neutral-600">
                              <code className="px-2 py-0.5 bg-neutral-100 rounded text-xs font-mono">
                                {field.field_name}
                              </code>
                            </span>
                            <span className="text-sm text-neutral-500">â€¢</span>
                            <span className="text-sm text-blue-600">
                              {getFieldTypeLabel(field.field_type)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(field)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            field.is_active
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-success-700 hover:bg-green-200'
                          }`}
                        >
                          {field.is_active ? 'ط¥ظٹظ‚ط§ظپ' : 'طھظپط¹ظٹظ„'}
                        </button>
                        <button
                          onClick={() => handleOpenForm(field)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(field)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Company Fields */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50">
              <h3 className="font-semibold text-neutral-900">
                ط­ظ‚ظˆظ„ ط§ظ„ظ…ط¤ط³ط³ط§طھ ({companyFields.length})
              </h3>
            </div>
            <div className="p-6">
              {companyFields.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
                  <p>ظ„ط§ طھظˆط¬ط¯ ط­ظ‚ظˆظ„ ظ…ط®طµطµط© ظ„ظ„ظ…ط¤ط³ط³ط§طھ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {companyFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`w-3 h-3 rounded-full ${field.is_active ? 'bg-green-500' : 'bg-neutral-400'}`}
                        ></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-neutral-900">{field.field_label}</h4>
                            {field.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                ظ…ط·ظ„ظˆط¨
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-neutral-600">
                              <code className="px-2 py-0.5 bg-neutral-100 rounded text-xs font-mono">
                                {field.field_name}
                              </code>
                            </span>
                            <span className="text-sm text-neutral-500">â€¢</span>
                            <span className="text-sm text-blue-600">
                              {getFieldTypeLabel(field.field_type)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(field)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            field.is_active
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-success-700 hover:bg-green-200'
                          }`}
                        >
                          {field.is_active ? 'ط¥ظٹظ‚ط§ظپ' : 'طھظپط¹ظٹظ„'}
                        </button>
                        <button
                          onClick={() => handleOpenForm(field)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(field)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="app-modal-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            {/* Header */}
            <div className="app-modal-header flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
              <h3 className="text-xl font-bold">
                {editingField
                  ? 'طھط¹ط¯ظٹظ„ ط­ظ‚ظ„ ظ…ط®طµطµ'
                  : 'ط¥ط¶ط§ظپط© ط­ظ‚ظ„ ظ…ط®طµطµ ط¬ط¯ظٹط¯'}
              </h3>
              <button
                onClick={handleCloseForm}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Entity Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ظ†ظˆط¹ ط§ظ„ظƒظٹط§ظ† <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.entity_type}
                  onChange={(e) =>
                    setFormData({ ...formData, entity_type: e.target.value as EntityType })
                  }
                  className="app-input"
                  disabled={!!editingField || isSaving}
                >
                  <option value="employee">ظ…ظˆط¸ظپ</option>
                  <option value="company">ظ…ط¤ط³ط³ط©</option>
                </select>
              </div>

              {/* Field Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ط§ط³ظ… ط§ظ„ط­ظ‚ظ„ (ط¨ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹط©){' '}
                  <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      field_name: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                    })
                  }
                  placeholder="ظ…ط«ط§ظ„: emergency_contact"
                  className="app-input font-mono"
                  disabled={!!editingField || isSaving}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  ط§ط³طھط®ط¯ظ… ط£ط­ط±ظپ ط¥ظ†ط¬ظ„ظٹط²ظٹط© طµط؛ظٹط±ط© ظˆط´ط±ط·ط© ط³ظپظ„ظٹط©
                  ظپظ‚ط·
                </p>
              </div>

              {/* Field Label */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ط§ظ„طھط³ظ…ظٹط© (ظ„ظ„ط¹ط±ط¶) <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                  placeholder="ظ…ط«ط§ظ„: ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„ ظپظٹ ط­ط§ظ„ط§طھ ط§ظ„ط·ظˆط§ط±ط¦"
                  className="app-input"
                  disabled={isSaving}
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ظ†ظˆط¹ ط§ظ„ط­ظ‚ظ„ <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) =>
                    setFormData({ ...formData, field_type: e.target.value as FieldType })
                  }
                  className="app-input bg-white"
                >
                  <option value="text">ظ†طµ ظ‚طµظٹط±</option>
                  <option value="textarea">ظ†طµ ط·ظˆظٹظ„</option>
                  <option value="number">ط±ظ‚ظ…</option>
                  <option value="date">طھط§ط±ظٹط®</option>
                  <option value="select">ظ‚ط§ط¦ظ…ط© ظ…ظ†ط³ط¯ظ„ط©</option>
                  <option value="boolean">طµط­/ط®ط·ط£</option>
                </select>
              </div>

              {/* Select Options (if type is select) */}
              {formData.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    ط®ظٹط§ط±ط§طھ ط§ظ„ظ‚ط§ط¦ظ…ط© <span className="text-danger-500">*</span>
                  </label>
                  <textarea
                    value={selectOptions}
                    onChange={(e) => setSelectOptions(e.target.value)}
                    placeholder="ط§ظƒطھط¨ ظƒظ„ ط®ظٹط§ط± ظپظٹ ط³ط·ط± ظ…ظ†ظپطµظ„"
                    rows={5}
                    className="app-input min-h-[120px] resize-none"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    ط§ظƒطھط¨ ظƒظ„ ط®ظٹط§ط± ظپظٹ ط³ط·ط± ط¬ط¯ظٹط¯
                  </p>
                </div>
              )}

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  <span className="text-sm text-neutral-700">ط­ظ‚ظ„ ظ…ط·ظ„ظˆط¨</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  <span className="text-sm text-neutral-700">ظ…ظپط¹ظ‘ظ„</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="app-modal-footer sticky bottom-0 flex justify-end gap-3 border-t border-neutral-200 bg-white p-6">
              <button
                onClick={handleCloseForm}
                disabled={isSaving}
                className="app-button-secondary"
              >
                ط¥ظ„ط؛ط§ط،
              </button>
              <button onClick={handleSave} disabled={isSaving} className="app-button-primary">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'ط¬ط§ط±ظچ ط§ظ„ط­ظپط¸...' : editingField ? 'طھط­ط¯ظٹط«' : 'ط¥ط¶ط§ظپط©'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setFieldToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        title="ط­ط°ظپ ط§ظ„ط­ظ‚ظ„ ط§ظ„ظ…ط®طµطµ"
        message={`ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ط§ظ„ط­ظ‚ظ„ "${fieldToDelete?.field_label}"طں ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط±ط§ط¬ط¹ ط¹ظ† ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط،.`}
        confirmText="ط­ط°ظپ"
        cancelText="ط¥ظ„ط؛ط§ط،"
        isDangerous={true}
        icon="alert"
      />
    </div>
  )
}
