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

interface PermissionMatrix {
  employees: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  settings: { view: boolean; edit: boolean }
}

const defaultPermissions: PermissionMatrix = {
  employees: { view: true, create: false, edit: false, delete: false },
  companies: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false },
  settings: { view: false, edit: false }
}

const adminPermissions: PermissionMatrix = {
  employees: { view: true, create: true, edit: true, delete: true },
  companies: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  settings: { view: true, edit: true }
}

// Helper function to normalize permissions and ensure all required properties exist
// If role is 'admin', automatically returns adminPermissions regardless of stored permissions
const normalizePermissions = (permissions: any, role?: 'admin' | 'user'): PermissionMatrix => {
  // إذا كان المستخدم مدير، إرجاع صلاحيات المدير الكاملة تلقائيًا
  if (role === 'admin') {
    return adminPermissions
  }

  // إذا كانت الصلاحيات فارغة أو غير صحيحة، إرجاع الصلاحيات الافتراضية
  if (!permissions || typeof permissions !== 'object') {
    return defaultPermissions
  }

  return {
    employees: {
      view: permissions.employees?.view ?? defaultPermissions.employees.view,
      create: permissions.employees?.create ?? defaultPermissions.employees.create,
      edit: permissions.employees?.edit ?? defaultPermissions.employees.edit,
      delete: permissions.employees?.delete ?? defaultPermissions.employees.delete
    },
    companies: {
      view: permissions.companies?.view ?? defaultPermissions.companies.view,
      create: permissions.companies?.create ?? defaultPermissions.companies.create,
      edit: permissions.companies?.edit ?? defaultPermissions.companies.edit,
      delete: permissions.companies?.delete ?? defaultPermissions.companies.delete
    },
    users: {
      view: permissions.users?.view ?? defaultPermissions.users.view,
      create: permissions.users?.create ?? defaultPermissions.users.create,
      edit: permissions.users?.edit ?? defaultPermissions.users.edit,
      delete: permissions.users?.delete ?? defaultPermissions.users.delete
    },
    settings: {
      view: permissions.settings?.view ?? defaultPermissions.settings.view,
      edit: permissions.settings?.edit ?? defaultPermissions.settings.edit
    }
  }
}

export default function Users() {
  const { user: currentUser } = useAuth()
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

  // ← [تم النقل] useEffect يجب أن يكون قبل return الشرطي
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      loadUsers()
    }
  }, [currentUser])

  // Check if user is admin
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، هذه الصفحة متاحة للمديرين فقط.</p>
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
      console.error('Error loading users:', error)
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
    } catch (error: any) {
      console.error('Error saving user:', error)
      toast.error(error.message || 'حدث خطأ أثناء حفظ المستخدم')
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

      console.log('[Users] Attempting to delete user:', {
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
        console.error('[Users] RPC Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      console.log('[Users] User deleted successfully:', data)

      toast.success('تم حذف المستخدم بنجاح')
      setShowDeleteModal(false)
      setDeleteingUser(null)
      loadUsers()
    } catch (error: any) {
      console.error('[Users] Error deleting user:', {
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
    } catch (error: any) {
      console.error('Error toggling user status:', error)
      toast.error('فشل تغيير حالة المستخدم')
    }
  }

  const updatePermission = (category: keyof PermissionMatrix, action: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...prev.permissions[category],
          [action]: value
        }
      }
    }))
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
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UserPlus className="w-5 h-5" />
            إضافة مستخدم جديد
          </button>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">المعلومات الأساسية</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الاسم الكامل *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        البريد الإلكتروني *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          كلمة المرور *
                        </label>
                        <input
                          type="password"
                          required={!editingUser}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          minLength={6}
                        />
                      </div>
                    )}

                    {editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          كلمة المرور الجديدة (اتركها فارغة إذا لم ترد التغيير)
                        </label>
                        <input
                          type="password"
                          value={formData.new_password}
                          onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          minLength={6}
                          placeholder="أدخل كلمة مرور جديدة (6 أحرف على الأقل)"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          يمكنك تغيير كلمة مرور هذا المستخدم. سيتم حفظ التغيير فوراً.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الدور *
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setRolePermissions(e.target.value as 'admin' | 'user')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        disabled={editingUser && editingUser.role === 'admin' && users.filter(u => u.role === 'admin' && u.is_active).length === 1}
                      >
                        <option value="user">مستخدم</option>
                        {editingUser && editingUser.role === 'admin' && (
                          <option value="admin">مدير</option>
                        )}
                      </select>
                      {editingUser && editingUser.role === 'admin' && users.filter(u => u.role === 'admin' && u.is_active).length === 1 && (
                        <p className="text-xs text-red-500 mt-1">
                          لا يمكن تغيير دور المدير الوحيد في النظام
                        </p>
                      )}
                      {!editingUser && (
                        <p className="text-xs text-gray-500 mt-1">
                          لا يمكن إنشاء مستخدمين جدد بدور مدير. المدير الوحيد هو أحمد الصاوي.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                      المستخدم نشط
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    الصلاحيات التفصيلية
                  </h3>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">الموظفين</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <label key={action} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.permissions.employees[action as keyof typeof formData.permissions.employees]}
                              onChange={(e) => updatePermission('employees', action, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">المؤسسات</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <label key={action} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.permissions.companies[action as keyof typeof formData.permissions.companies]}
                              onChange={(e) => updatePermission('companies', action, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">المستخدمين</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <label key={action} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.permissions.users[action as keyof typeof formData.permissions.users]}
                              onChange={(e) => updatePermission('users', action, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              {action === 'view' ? 'عرض' : action === 'create' ? 'إضافة' : action === 'edit' ? 'تعديل' : 'حذف'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">الإعدادات</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'edit'].map(action => (
                          <label key={action} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.permissions.settings[action as keyof typeof formData.permissions.settings]}
                              onChange={(e) => updatePermission('settings', action, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              {action === 'view' ? 'عرض' : 'تعديل'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    disabled={saving}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed"
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