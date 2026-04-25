import { useState, useEffect } from 'react'
import { supabase, Project } from '@/lib/supabase'
import { X, FolderKanban, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectModalProps {
  isOpen: boolean
  project?: Project | null
  onClose: () => void
  onSuccess: () => void
}

export default function ProjectModal({ isOpen, project, onClose, onSuccess }: ProjectModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive' | 'completed'
  })

  const isEditing = !!project

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setFormData({
          name: project.name || '',
          description: project.description || '',
          status: project.status || 'active'
        })
      } else {
        setFormData({
          name: '',
          description: '',
          status: 'active'
        })
      }
    }
  }, [isOpen, project])

  // معالجة ESC لإغلاق المودال
  useEffect(() => {
    if (!isOpen) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // التحقق من أن المستخدم لا يكتب في حقل إدخال
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم المشروع')
      return
    }

    setLoading(true)
    try {
      if (isEditing && project) {
        // التحقق من تغيير اسم المشروع
        const nameChanged = project.name !== formData.name.trim()
        
        // تحديث المشروع
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id)

        if (error) throw error

        // إذا تغير اسم المشروع، تحديث project_name في جدول الموظفين
        if (nameChanged) {
          const { error: updateError } = await supabase
            .from('employees')
            .update({ project_name: formData.name.trim() })
            .eq('project_id', project.id)

          if (updateError) {
            console.error('Error updating employees project_name:', updateError)
            toast.warning('تم تحديث المشروع ولكن فشل تحديث أسماء المشروع في جدول الموظفين')
          }
        }

        toast.success('تم تحديث المشروع بنجاح')
      } else {
        // إنشاء مشروع جديد
        const { error } = await supabase
          .from('projects')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            status: formData.status
          })

        if (error) {
          if (error.code === '23505') {
            toast.error('يوجد مشروع بنفس الاسم بالفعل')
          } else {
            throw error
          }
          return
        }
        toast.success('تم إنشاء المشروع بنجاح')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving project:', error)
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ المشروع'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="app-modal-surface max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="app-modal-header flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="app-icon-chip">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'تعديل المشروع' : 'إضافة مشروع جديد'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* اسم المشروع */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المشروع <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="app-input"
              placeholder="أدخل اسم المشروع"
              required
              disabled={loading}
            />
          </div>

          {/* الوصف */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الوصف
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="app-input min-h-[110px] resize-none"
              placeholder="أدخل وصف المشروع (اختياري)"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* الحالة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحالة
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'completed' })}
              className="app-input"
              disabled={loading}
            >
              <option value="active">نشط</option>
              <option value="inactive">متوقف</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="app-button-secondary"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="app-button-primary"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'جاري الحفظ...' : (isEditing ? 'تحديث' : 'إنشاء')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

