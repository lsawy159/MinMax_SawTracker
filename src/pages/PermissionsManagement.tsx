import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Shield, Users, Key, Plus, Edit, Trash2, Save, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'

interface User {
  id: string
  email: string
  role: string
  created_at: string
  is_active: boolean
}

interface Permission {
  id: string
  user_id: string
  resource_type: string
  permission_level: string
  granted_by: string
  granted_at: string
  expires_at?: string
  is_active: boolean
  users?: { email: string }
  granted_by_user?: { email: string }
}

interface PermissionRequest {
  user_id: string
  resource_type: string
  permission_level: string
  expires_at?: string
}

type ResourceType = 'employees' | 'companies' | 'users' | 'reports' | 'settings' | 'backups'
type PermissionLevel = 'read' | 'write' | 'delete' | 'export' | 'admin'

const resourceTypeLabels: Record<ResourceType, string> = {
  employees: 'الموظفين',
  companies: 'المؤسسات',
  users: 'المستخدمين',
  reports: 'التقارير',
  settings: 'الإعدادات',
  backups: 'النسخ الاحتياطية'
}

const permissionLevelLabels: Record<PermissionLevel, string> = {
  read: 'قراءة',
  write: 'كتابة',
  delete: 'حذف',
  export: 'تصدير',
  admin: 'إدارة كاملة'
}

const permissionLevelColors: Record<PermissionLevel, string> = {
  read: 'bg-green-100 text-green-800',
  write: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  export: 'bg-yellow-100 text-yellow-800',
  admin: 'bg-purple-100 text-purple-800'
}

export default function PermissionsManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
  
  const [newPermission, setNewPermission] = useState<PermissionRequest>({
    user_id: '',
    resource_type: 'employees' as ResourceType,
    permission_level: 'read' as PermissionLevel,
    expires_at: undefined
  })

  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedResource, setSelectedResource] = useState<string>('all')

  // --- [BEGIN FIX] ---
  // تم نقل الدوال التي يعتمد عليها الـ useEffect إلى هنا (قبل الـ Hook)
  // وتم نقل الـ Hook نفسه إلى هنا (قبل الـ return الشرطي)

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, role, created_at, is_active')
      .order('email')
    
    if (data) setUsers(data)
  }

  const loadPermissions = async () => {
    // محاكاة البيانات حتى يتم تحديث قاعدة البيانات
    const mockPermissions: Permission[] = [
      {
        id: '1',
        user_id: '1',
        resource_type: 'employees',
        permission_level: 'read',
        granted_by: 'admin',
        granted_at: new Date().toISOString(),
        is_active: true,
        users: { email: 'user@example.com' },
        granted_by_user: { email: 'admin@example.com' }
      },
      {
        id: '2',
        user_id: '1',
        resource_type: 'companies',
        permission_level: 'write',
        granted_by: 'admin',
        granted_at: new Date().toISOString(),
        is_active: true,
        users: { email: 'user@example.com' },
        granted_by_user: { email: 'admin@example.com' }
      }
    ]
    setPermissions(mockPermissions)
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([loadUsers(), loadPermissions()])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // [FIX] تم نقل الـ Hook إلى هنا ليكون قبل الـ return الشرطي
  useEffect(() => {
    // التأكد من أن المستخدم هو admin قبل تحميل البيانات
    // (على الرغم من أن الواجهة ستعرض "غير مصرح" أدناه)
    if (currentUser && currentUser.role === 'admin') {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]) // أضفنا currentUser كـ dependency

  // --- [END FIX] ---


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

  // تم نقل الدوال والـ useEffect للأعلى

  const filteredPermissions = permissions.filter(permission => {
    if (selectedUser !== 'all' && permission.user_id !== selectedUser) return false
    if (selectedResource !== 'all' && permission.resource_type !== selectedResource) return false
    return true
  })

  const addPermission = async () => {
    try {
      if (!newPermission.user_id || !newPermission.resource_type || !newPermission.permission_level) {
        toast.error('جميع الحقول مطلوبة')
        return
      }

      // التحقق من عدم وجود إذن مماثل
      const existingPermission = permissions.find(p => 
        p.user_id === newPermission.user_id && 
        p.resource_type === newPermission.resource_type &&
        p.is_active
      )

      if (existingPermission) {
        toast.error('يوجد إذن مماثل لهذا المستخدم والمورد')
        return
      }

      // محاكاة إضافة الإذن
      const newPerm: Permission = {
        id: Date.now().toString(),
        ...newPermission,
        granted_by: 'current-user-id',
        granted_at: new Date().toISOString(),
        is_active: true,
        users: { email: users.find(u => u.id === newPermission.user_id)?.email || '' },
        granted_by_user: { email: 'admin@example.com' }
      }

      setPermissions(prev => [...prev, newPerm])
      
      // إعادة تعيين النموذج
      setNewPermission({
        user_id: '',
        resource_type: 'employees',
        permission_level: 'read',
        expires_at: undefined
      })
      
      setShowAddModal(false)
      toast.success('تم إضافة الإذن بنجاح')
    } catch (error) {
      console.error('Error adding permission:', error)
      toast.error('فشل في إضافة الإذن')
    }
  }

  const updatePermission = async (permission: Permission) => {
    try {
      // محاكاة تحديث الإذن
      setPermissions(prev => 
        prev.map(p => p.id === permission.id ? permission : p)
      )
      
      setEditingPermission(null)
      toast.success('تم تحديث الإذن بنجاح')
    } catch (error) {
      console.error('Error updating permission:', error)
      toast.error('فشل في تحديث الإذن')
    }
  }

  const revokePermission = async (permissionId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الإذن؟')) return

    try {
      // محاكاة إلغاء الإذن
      setPermissions(prev => 
        prev.map(p => p.id === permissionId ? { ...p, is_active: false } : p)
      )
      
      toast.success('تم إلغاء الإذن بنجاح')
    } catch (error) {
      console.error('Error revoking permission:', error)
      toast.error('فشل في إلغاء الإذن')
    }
  }

  const deletePermission = async (permissionId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإذن نهائياً؟')) return

    try {
      // محاكاة حذف الإذن
      setPermissions(prev => prev.filter(p => p.id !== permissionId))
      
      toast.success('تم حذف الإذن نهائياً')
    } catch (error) {
      console.error('Error deleting permission:', error)
      toast.error('فشل في حذف الإذن')
    }
  }

  const formatDate = (dateString: string) => {
    return formatDateWithHijri(dateString, true)
  }

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const getPermissionStatus = (permission: Permission) => {
    if (!permission.is_active) return { text: 'ملغى', color: 'bg-gray-100 text-gray-800' }
    if (isExpired(permission.expires_at)) return { text: 'منتهي', color: 'bg-red-100 text-red-800' }
    return { text: 'نشط', color: 'bg-green-100 text-green-800' }
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Key className="w-8 h-8 text-blue-600" />
            إدارة الأذونات والصلاحيات
          </h1>
          <p className="text-gray-600">إدارة شاملة لأذونات المستخدمين وصلاحياتهم في النظام</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">إجمالي المستخدمين</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">الأذونات النشطة</p>
                <p className="text-2xl font-bold">{permissions.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">أذونات الإدارة</p>
                <p className="text-2xl font-bold">{permissions.filter(p => p.permission_level === 'admin').length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <X className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">أذونات منتهية</p>
                <p className="text-2xl font-bold">{permissions.filter(p => isExpired(p.expires_at)).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة إذن جديد
            </button>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">المستخدم:</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="all">جميع المستخدمين</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">المورد:</label>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="all">جميع الموارد</option>
                {Object.entries(resourceTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              تحديث
            </button>
          </div>
        </div>

        {/* Permissions Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">الأذونات الحالية ({filteredPermissions.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">المستخدم</th>
                  <th className="px-4 py-2 text-right">المورد</th>
                  <th className="px-4 py-2 text-right">مستوى الإذن</th>
                  <th className="px-4 py-2 text-right">الحالة</th>
                  <th className="px-4 py-2 text-right">منح بواسطة</th>
                  <th className="px-4 py-2 text-right">تاريخ المنح</th>
                  <th className="px-4 py-2 text-right">تاريخ الانتهاء</th>
                  <th className="px-4 py-2 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((permission) => (
                  <tr key={permission.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">
                      {permission.users?.email}
                    </td>
                    <td className="px-4 py-2">
                      {resourceTypeLabels[permission.resource_type as ResourceType]}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        permissionLevelColors[permission.permission_level as PermissionLevel]
                      }`}>
                        {permissionLevelLabels[permission.permission_level as PermissionLevel]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${getPermissionStatus(permission).color}`}>
                        {getPermissionStatus(permission).text}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {permission.granted_by_user?.email}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <HijriDateDisplay date={permission.granted_at}>
                        {formatDate(permission.granted_at)}
                      </HijriDateDisplay>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {permission.expires_at ? (
                        <HijriDateDisplay date={permission.expires_at}>
                          {formatDate(permission.expires_at)}
                        </HijriDateDisplay>
                      ) : 'لا ينتهي'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {editingPermission?.id === permission.id ? (
                          <>
                            <button
                              onClick={() => updatePermission(editingPermission)}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="حفظ"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingPermission(null)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="إلغاء"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingPermission(permission)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {permission.is_active && (
                              <button
                                onClick={() => revokePermission(permission.id)}
                                className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deletePermission(permission.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredPermissions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                لا توجد أذونات للعرض
              </div>
            )}
          </div>
        </div>

        {/* Add Permission Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">إضافة إذن جديد</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">المستخدم</label>
                  <select
                    value={newPermission.user_id}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, user_id: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">اختر المستخدم</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">المورد</label>
                  <select
                    value={newPermission.resource_type}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, resource_type: e.target.value as ResourceType }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {Object.entries(resourceTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">مستوى الإذن</label>
                  <select
                    value={newPermission.permission_level}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, permission_level: e.target.value as PermissionLevel }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {Object.entries(permissionLevelLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ الانتهاء (اختياري)</label>
                  <input
                    type="datetime-local"
                    value={newPermission.expires_at || ''}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, expires_at: e.target.value || undefined }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={addPermission}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  إضافة الإذن
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}