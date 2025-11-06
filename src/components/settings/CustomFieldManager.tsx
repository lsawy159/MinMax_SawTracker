import { useState, useEffect } from 'react'
import { supabase, CustomField } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

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
    display_order: 0
  })
  const [selectOptions, setSelectOptions] = useState<string>('')

  useEffect(() => {
    loadFields()
  }, [])

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('entity_type')
        .order('display_order')

      if (error) throw error
      setFields(data || [])
    } catch (error) {
      console.error('Error loading custom fields:', error)
      toast.error('فشل تحميل الحقول المخصصة')
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
        display_order: field.display_order
      })
      if (field.field_type === 'select' && field.field_options?.options) {
        setSelectOptions(field.field_options.options.join('\n'))
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
        display_order: fields.length
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
    // التحقق من البيانات
    if (!formData.field_name || !formData.field_label) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    // معالجة خيارات القائمة المنسدلة
    const finalFormData = { ...formData }
    if (formData.field_type === 'select') {
      const options = selectOptions.split('\n').filter(opt => opt.trim())
      if (options.length === 0) {
        toast.error('يرجى إضافة خيار واحد على الأقل للقائمة المنسدلة')
        return
      }
      finalFormData.field_options = { options }
    }

    try {
      if (editingField) {
        // تحديث حقل موجود
        const { error } = await supabase
          .from('custom_fields')
          .update(finalFormData)
          .eq('id', editingField.id)

        if (error) throw error
        toast.success('تم تحديث الحقل بنجاح')
      } else {
        // إضافة حقل جديد
        const { error } = await supabase
          .from('custom_fields')
          .insert([finalFormData])

        if (error) throw error
        toast.success('تم إضافة الحقل بنجاح')
      }

      handleCloseForm()
      loadFields()
    } catch (error: any) {
      console.error('Error saving field:', error)
      toast.error('فشل حفظ الحقل: ' + error.message)
    }
  }

  const handleDelete = async (field: CustomField) => {
    if (!confirm(`هل أنت متأكد من حذف الحقل "${field.field_label}"؟`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', field.id)

      if (error) throw error
      toast.success('تم حذف الحقل بنجاح')
      loadFields()
    } catch (error: any) {
      console.error('Error deleting field:', error)
      toast.error('فشل حذف الحقل')
    }
  }

  const handleToggleActive = async (field: CustomField) => {
    try {
      const { error } = await supabase
        .from('custom_fields')
        .update({ is_active: !field.is_active })
        .eq('id', field.id)

      if (error) throw error
      toast.success(field.is_active ? 'تم إيقاف الحقل' : 'تم تفعيل الحقل')
      loadFields()
    } catch (error) {
      toast.error('فشل تحديث حالة الحقل')
    }
  }

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'نص',
      number: 'رقم',
      date: 'تاريخ',
      select: 'قائمة منسدلة',
      boolean: 'صح/خطأ',
      textarea: 'نص طويل'
    }
    return labels[type] || type
  }

  const employeeFields = fields.filter(f => f.entity_type === 'employee')
  const companyFields = fields.filter(f => f.entity_type === 'company')

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الحقول المخصصة</h2>
            <p className="text-gray-600 text-sm mt-1">
              إدارة الحقول الإضافية للموظفين والمؤسسات
            </p>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            إضافة حقل جديد
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">حقول الموظفين ({employeeFields.length})</h3>
            </div>
            <div className="p-6">
              {employeeFields.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>لا توجد حقول مخصصة للموظفين</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-3 h-3 rounded-full ${field.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{field.field_label}</h4>
                            {field.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                مطلوب
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-600">
                              <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                                {field.field_name}
                              </code>
                            </span>
                            <span className="text-sm text-gray-500">•</span>
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
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {field.is_active ? 'إيقاف' : 'تفعيل'}
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">حقول المؤسسات ({companyFields.length})</h3>
            </div>
            <div className="p-6">
              {companyFields.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>لا توجد حقول مخصصة للمؤسسات</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {companyFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-3 h-3 rounded-full ${field.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{field.field_label}</h4>
                            {field.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                مطلوب
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-600">
                              <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                                {field.field_name}
                              </code>
                            </span>
                            <span className="text-sm text-gray-500">•</span>
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
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {field.is_active ? 'إيقاف' : 'تفعيل'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingField ? 'تعديل حقل مخصص' : 'إضافة حقل مخصص جديد'}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الكيان <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entity_type}
                  onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as EntityType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={!!editingField}
                >
                  <option value="employee">موظف</option>
                  <option value="company">مؤسسة</option>
                </select>
              </div>

              {/* Field Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الحقل (بالإنجليزية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="مثال: emergency_contact"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  disabled={!!editingField}
                />
                <p className="text-xs text-gray-500 mt-1">استخدم أحرف إنجليزية صغيرة وشرطة سفلية فقط</p>
              </div>

              {/* Field Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التسمية (للعرض) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                  placeholder="مثال: جهة الاتصال في حالات الطوارئ"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الحقل <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) => setFormData({ ...formData, field_type: e.target.value as FieldType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="text">نص قصير</option>
                  <option value="textarea">نص طويل</option>
                  <option value="number">رقم</option>
                  <option value="date">تاريخ</option>
                  <option value="select">قائمة منسدلة</option>
                  <option value="boolean">صح/خطأ</option>
                </select>
              </div>

              {/* Select Options (if type is select) */}
              {formData.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    خيارات القائمة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={selectOptions}
                    onChange={(e) => setSelectOptions(e.target.value)}
                    placeholder="اكتب كل خيار في سطر منفصل"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">اكتب كل خيار في سطر جديد</p>
                </div>
              )}

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">حقل مطلوب</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">مفعّل</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={handleCloseForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Save className="w-4 h-4" />
                {editingField ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
