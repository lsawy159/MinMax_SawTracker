import { useState, useEffect } from 'react'
import { Employee, Company, CustomField, supabase } from '../../lib/supabase'
import { X, Calendar, Phone, MapPin, Briefcase, CreditCard, FileText, Save, AlertTriangle } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import { toast } from 'sonner'

interface EmployeeCardProps {
  employee: Employee & { company: Company }
  onClose: () => void
  onUpdate: () => void
}

export default function EmployeeCard({ employee, onClose, onUpdate }: EmployeeCardProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [formData, setFormData] = useState<any>({
    ...employee,
    additional_fields: employee.additional_fields || {}
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'custom'>('basic')

  useEffect(() => {
    loadCustomFields()
  }, [])

  const loadCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('entity_type', 'employee')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setCustomFields(data || [])
    } catch (error) {
      console.error('Error loading custom fields:', error)
    }
  }

  const getDaysRemaining = (date: string) => {
    return differenceInDays(new Date(date), new Date())
  }

  const getStatusColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50 border-red-200'
    if (days <= 7) return 'text-red-600 bg-red-50 border-red-200'
    if (days <= 15) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (days <= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          name: formData.name,
          profession: formData.profession,
          nationality: formData.nationality,
          phone: formData.phone,
          passport_number: formData.passport_number,
          project_name: formData.project_name,
          bank_account: formData.bank_account,
          additional_fields: formData.additional_fields
        })
        .eq('id', employee.id)

      if (error) throw error

      toast.success('تم حفظ التعديلات بنجاح')
      onUpdate()
      onClose()
    } catch (error: any) {
      console.error('Error saving employee:', error)
      toast.error('فشل حفظ التعديلات')
    } finally {
      setSaving(false)
    }
  }

  const residenceDays = getDaysRemaining(employee.residence_expiry)
  const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className="text-blue-100 mt-1">{employee.profession} - {employee.company.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Alerts */}
        <div className="p-6 space-y-3 bg-gray-50">
          <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(residenceDays)}`}>
            <AlertTriangle className="w-5 h-5" />
            <div className="flex-1">
              <div className="font-medium">انتهاء الإقامة</div>
              <div className="text-sm">
                {format(new Date(employee.residence_expiry), 'yyyy-MM-dd')}
                {residenceDays < 0 ? ' (منتهية)' : ` (بعد ${residenceDays} يوم)`}
              </div>
            </div>
          </div>

          {contractDays !== null && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(contractDays)}`}>
              <AlertTriangle className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">انتهاء العقد</div>
                <div className="text-sm">
                  {format(new Date(employee.contract_expiry!), 'yyyy-MM-dd')}
                  {contractDays < 0 ? ' (منتهي)' : ` (بعد ${contractDays} يوم)`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex-1 px-6 py-3 font-medium transition ${
                activeTab === 'basic'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              البيانات الأساسية
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-6 py-3 font-medium transition ${
                activeTab === 'custom'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الحقول الإضافية ({customFields.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'basic' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* الاسم */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* المهنة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  المهنة
                </label>
                <input
                  type="text"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الجنسية */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  الجنسية
                </label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الهاتف */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الشركة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الشركة</label>
                <input
                  type="text"
                  value={employee.company.name}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* رقم الإقامة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  رقم الإقامة
                </label>
                <input
                  type="text"
                  value={employee.residence_number}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono"
                />
              </div>

              {/* رقم الجواز */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم الجواز</label>
                <input
                  type="text"
                  value={formData.passport_number || ''}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* المشروع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المشروع</label>
                <input
                  type="text"
                  value={formData.project_name || ''}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الحساب البنكي */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  الحساب البنكي
                </label>
                <input
                  type="text"
                  value={formData.bank_account || ''}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* تاريخ الميلاد */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الميلاد
                </label>
                <input
                  type="date"
                  value={employee.birth_date}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* تاريخ الالتحاق */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الالتحاق
                </label>
                <input
                  type="date"
                  value={employee.joining_date}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {customFields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>لا توجد حقول إضافية محددة</p>
                  <p className="text-sm mt-2">يمكن إضافة حقول مخصصة من صفحة الإعدادات</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.field_label}
                        {field.is_required && <span className="text-red-500 mr-1">*</span>}
                      </label>
                      
                      {field.field_type === 'text' && (
                        <input
                          type="text"
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {field.field_type === 'textarea' && (
                        <textarea
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {field.field_type === 'number' && (
                        <input
                          type="number"
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {field.field_type === 'date' && (
                        <input
                          type="date"
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {field.field_type === 'select' && field.field_options.options && (
                        <select
                          value={formData.additional_fields[field.field_name] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            additional_fields: {
                              ...formData.additional_fields,
                              [field.field_name]: e.target.value
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">اختر...</option>
                          {field.field_options.options.map((option: string) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}

                      {field.field_type === 'boolean' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.additional_fields[field.field_name] || false}
                            onChange={(e) => setFormData({
                              ...formData,
                              additional_fields: {
                                ...formData.additional_fields,
                                [field.field_name]: e.target.checked
                              }
                            })}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">نعم</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            disabled={saving}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  )
}
