import { useEffect, useState } from 'react'
import { supabase, User } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Shield, 
  UserCheck, 
  UserX, 
  X,
  Save,
  Search,
  Clock,
  AlertCircle
} from 'lucide-react'
import { formatDateTimeWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'
import { 
  PermissionMatrix, 
  defaultPermissions, 
  adminPermissions, 
  normalizePermissions,
  usePermissions
} from '@/utils/permissions'

export default function Users() {
  const { user: currentUser } = useAuth()
  const { canView } = usePermissions()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeleteingUser] = useState<User | null>(null)
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    new_password: '', // كلمة المرور الجديدة عند التعديل
    role: 'user' as 'admin' | 'user',
    permissions: defaultPermissions,
    is_active: true
  })

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('users')
  const isAdmin = currentUser?.role === 'admin'

  // ← [تم النقل] useEffect يجب أن يكون قبل return الشرطي
  useEffect(() => {
    if (currentUser && hasViewPermission) {
      loadUsers()
    }
  }, [currentUser, hasViewPermission])

  // Check if user has view permission
  if (!currentUser || !hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const loadUsers = async () => {
    try {
      // استخدام RPC function للحصول على المستخدمين مع مراعاة الصلاحيات
      const { data, error } = await supabase
        .rpc('get_all_users_for_admin')

      if (error) throw error
      
      // Normalize permissions for all users to ensure they have the correct structure
      // Apply admin permissions automatically for admin users
      const normalizedUsers = (data || []).map(user => ({
        ...user,
        permissions: normalizePermissions(user.permissions, user.role as 'admin' | 'user')
      }))
      
      setUsers(normalizedUsers)
    } catch (error) {
      logger.error('Error loading users:', error)
      toast.error('فشل تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      full_name: '',
      password: '',
      new_password: '',
      role: 'user',
      permissions: defaultPermissions,
      is_active: true
    })
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      new_password: '',
      role: user.role,
      permissions: normalizePermissions(user.permissions, user.role),
      is_active: user.is_active
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      if (editingUser) {
        // تحديث مستخدم موجود باستخدام RPC function
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data, error } = await supabase
          .rpc('update_user_as_admin', {
            user_id: editingUser.id,
            new_email: formData.email,
            new_full_name: formData.full_name,
            new_role: formData.role,
            new_permissions: formData.permissions,
            new_is_active: formData.is_active
          })

        if (error) throw error

        // إذا تم إدخال كلمة مرور جديدة، قم بتحديثها
        if (formData.new_password && formData.new_password.length >= 6) {
          const { data: passwordData, error: passwordError } = await supabase.functions.invoke('update-user-password', {
            body: {
              user_id: editingUser.id,
              new_password: formData.new_password
            }
          })

          if (passwordError) throw passwordError
          
          if (passwordData?.error) {
            throw new Error(passwordData.error.message)
          }
        }

        toast.success('تم تحديث المستخدم بنجاح')
      } else {
        // إنشاء مستخدم جديد عبر Edge Function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: 'user', // دائماً user عند الإنشاء
            permissions: formData.permissions,
            is_active: formData.is_active
          }
        })

        if (error) throw error
        
        if (data?.error) {
          throw new Error(data.error.message)
        }

        toast.success('تم إنشاء المستخدم بنجاح')
      }

      setShowModal(false)
      loadUsers()
    } catch (error) {
      logger.error('Error saving user:', error)
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ المستخدم'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return

    try {
      // التحقق من صحة user_id
      if (!deletingUser.id || typeof deletingUser.id !== 'string') {
        throw new Error('معرف المستخدم غير صحيح')
      }

      // التحقق من محاولة حذف آخر مدير نشط
      const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active)
      if (deletingUser.role === 'admin' && activeAdmins.length === 1) {
        throw new Error('لا يمكن حذف آخر مدير نشط في النظام. يجب أن يكون هناك مدير واحد على الأقل.')
      }

      // التحقق من محاولة حذف المستخدم الحالي
      if (deletingUser.id === currentUser?.id) {
        throw new Error('لا يمكنك حذف حسابك الخاص')
      }

      logger.debug('[Users] Attempting to delete user:', {
        id: deletingUser.id,
        email: deletingUser.email,
        role: deletingUser.role
      })

      // حذف المستخدم باستخدام RPC function
      const { data, error } = await supabase
        .rpc('delete_user_as_admin', {
          user_id: deletingUser.id
        })

      if (error) {
        logger.error('[Users] RPC Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      logger.debug('[Users] User deleted successfully:', data)

      toast.success('تم حذف المستخدم بنجاح')
      setShowDeleteModal(false)
      setDeleteingUser(null)
      loadUsers()
    } catch (error) {
      logger.error('[Users] Error deleting user:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        user: deletingUser
      })

      // عرض رسالة خطأ واضحة بالعربية
      let errorMessage = 'حدث خطأ أثناء حذف المستخدم'
      
      if (error?.message) {
        const message = error.message.toLowerCase()
        if (message.includes('access denied') || message.includes('admin privileges')) {
          errorMessage = 'ليس لديك صلاحية لحذف المستخدمين'
        } else if (message.includes('cannot delete your own account')) {
          errorMessage = 'لا يمكنك حذف حسابك الخاص'
        } else if (message.includes('user not found')) {
          errorMessage = 'المستخدم غير موجود'
        } else if (message.includes('last admin') || message.includes('admin must exist')) {
          errorMessage = 'لا يمكن حذف آخر مدير نشط في النظام'
        } else {
          errorMessage = error.message
        }
      }

      toast.error(errorMessage)
    }
  }

  const toggleUserStatus = async (user: User) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)

      if (error) throw error
      
      toast.success(user.is_active ? 'تم إيقاف المستخدم' : 'تم تفعيل المستخدم')
      loadUsers()
    } catch (error) {
      logger.error('Error toggling user status:', error)
      toast.error('فشل تغيير حالة المستخدم')
    }
  }

  const updatePermission = (category: keyof PermissionMatrix, action: string, value: boolean) => {
    setFormData(prev => {
      const currentCategory = prev.permissions[category] as Record<string, boolean>
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [category]: {
            ...currentCategory,
            [action]: value
          }
        }
      }
    })
  }

  const setRolePermissions = (role: 'admin' | 'user') => {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: role === 'admin' ? adminPermissions : defaultPermissions
    }))
  }

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">إدارة المستخدمين</h1>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <UserPlus className="w-5 h-5" />
              إضافة مستخدم جديد
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الاسم الكامل</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">البريد الإلكتروني</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الدور</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الحالة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">آخر تسجيل دخول</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          <Shield className="w-3 h-3" />
                          {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {user.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {user.last_login ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <HijriDateDisplay date={user.last_login}>
                              {formatDateTimeWithHijri(user.last_login)}
                            </HijriDateDisplay>
                          </div>
                        ) : (
                          <span className="text-gray-400">لم يسجل دخول بعد</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user)}
                              className={`p-2 rounded-lg transition ${
                                user.is_active
                                  ? 'text-orange-600 hover:bg-orange-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={user.is_active ? 'إيقاف' : 'تفعيل'}
                            >
                              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteingUser(user)
                                setShowDeleteModal(true)
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">عرض فقط</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>لا توجد نتائج</p>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-3xl p-3 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">
                  {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* القسم الأيسر - المعلومات الأساسية */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                      المعلومات الأساسية
                    </h3>
                    
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          الاسم الكامل *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          البريد الإلكتروني *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                        />
                      </div>

                      {!editingUser && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            كلمة المرور *
                          </label>
                          <input
                            type="password"
                            required={!editingUser}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                            minLength={6}
                          />
                        </div>
                      )}

                      {editingUser && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            كلمة المرور الجديدة
                          </label>
                          <input
                            type="password"
                            value={formData.new_password}
                            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition"
                            minLength={6}
                            placeholder="اتركها فارغة إذا لم ترد التغيير"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          الدور *
                        </label>
                        <select
                          value={formData.role}
                          onChange={(e) => setRolePermissions(e.target.value as 'admin' | 'user')}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition"
                          disabled={editingUser && editingUser.role === 'admin' && users.filter(u => u.role === 'admin' && u.is_active).length === 1}
                        >
                          <option value="user">مستخدم</option>
                          {editingUser && editingUser.role === 'admin' && (
                            <option value="admin">مدير</option>
                          )}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-200 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-xs font-medium text-gray-700 cursor-pointer">
                          المستخدم نشط
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* القسم الأيمن - الصلاحيات */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      الصلاحيات التفصيلية
                    </h3>

                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-3 space-y-2.5 border border-gray-200">
                      {/* Grid للصلاحيات - تصميم compact - مرتبة حسب ترتيب الصفحات في القائمة الجانبية */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* الرئيسية */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">الرئيسية</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.dashboard.view}
                                onChange={(e) => updatePermission('dashboard', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* الموظفين */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">الموظفين</h4>
                          <div className="space-y-1">
                            {['view', 'create', 'edit', 'delete'].map(action => (
                              <label key={action} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.employees[action as keyof typeof formData.permissions.employees]}
                                  onChange={(e) => updatePermission('employees', action, e.target.checked)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">
                                  {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* المؤسسات */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">المؤسسات</h4>
                          <div className="space-y-1">
                            {['view', 'create', 'edit', 'delete'].map(action => (
                              <label key={action} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.companies[action as keyof typeof formData.permissions.companies]}
                                  onChange={(e) => updatePermission('companies', action, e.target.checked)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">
                                  {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* المشاريع */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">المشاريع</h4>
                          <div className="space-y-1">
                            {['view', 'create', 'edit', 'delete'].map(action => (
                              <label key={action} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.projects[action as keyof typeof formData.permissions.projects]}
                                  onChange={(e) => updatePermission('projects', action, e.target.checked)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">
                                  {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* التنبيهات */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">التنبيهات</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.alerts.view}
                                onChange={(e) => updatePermission('alerts', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* البحث المتقدم */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">البحث المتقدم</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.advancedSearch.view}
                                onChange={(e) => updatePermission('advancedSearch', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* التقارير */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">التقارير</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.reports.view}
                                onChange={(e) => updatePermission('reports', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.reports.export}
                                onChange={(e) => updatePermission('reports', 'export', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">تصدير</span>
                            </label>
                          </div>
                        </div>

                        {/* سجل النشاطات */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">سجل النشاطات</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.activityLogs.view}
                                onChange={(e) => updatePermission('activityLogs', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* استيراد/تصدير */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">استيراد/تصدير</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.importExport.view}
                                onChange={(e) => updatePermission('importExport', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.importExport.import}
                                onChange={(e) => updatePermission('importExport', 'import', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">استيراد</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.importExport.export}
                                onChange={(e) => updatePermission('importExport', 'export', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">تصدير</span>
                            </label>
                          </div>
                        </div>

                        {/* المستخدمين */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">المستخدمين</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.users.view}
                                onChange={(e) => updatePermission('users', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* حدود الشركات */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">حدود الشركات</h4>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                              <input
                                type="checkbox"
                                checked={formData.permissions.settings.view}
                                onChange={(e) => updatePermission('settings', 'view', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">عرض</span>
                            </label>
                          </div>
                        </div>

                        {/* إعدادات النظام */}
                        <div className="bg-white/60 rounded-lg p-2 border border-gray-200/50">
                          <h4 className="text-xs font-semibold text-gray-800 mb-1.5">إعدادات النظام</h4>
                          <div className="space-y-1">
                            {['view', 'edit'].map(action => (
                              <label key={action} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50/50 rounded px-1 py-0.5 transition">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.adminSettings[action as keyof typeof formData.permissions.adminSettings]}
                                  onChange={(e) => updatePermission('adminSettings', action, e.target.checked)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">
                                  {action === 'view' ? 'عرض' : 'تعديل'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end border-t border-gray-200 pt-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                    disabled={saving}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:from-blue-400 disabled:to-blue-400 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'جاري الحفظ...' : editingUser ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && deletingUser && (() => {
          const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active)
          const isLastAdmin = deletingUser.role === 'admin' && activeAdmins.length === 1
          const isCurrentUser = deletingUser.id === currentUser?.id
          const canDelete = !isLastAdmin && !isCurrentUser

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">تأكيد الحذف</h3>
                    <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا المستخدم؟</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">الاسم:</span> {deletingUser.full_name}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">البريد:</span> {deletingUser.email}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">الدور:</span> {deletingUser.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </p>
                </div>

                {isLastAdmin && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">تحذير: لا يمكن حذف آخر مدير</p>
                        <p className="text-xs text-red-600 mt-1">
                          لا يمكن حذف آخر مدير نشط في النظام. يجب أن يكون هناك مدير واحد على الأقل لإدارة النظام.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isCurrentUser && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">تحذير: لا يمكن حذف حسابك الخاص</p>
                        <p className="text-xs text-red-600 mt-1">
                          لا يمكنك حذف حسابك الخاص. يرجى استخدام حساب مدير آخر لحذف هذا المستخدم.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteingUser(null)
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!canDelete}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      canDelete
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </Layout>
  )
}