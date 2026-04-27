import React, { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Settings, Database, Users } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const BackupTab = React.lazy(() =>
  import('@/components/settings/tabs/BackupTab').then((mod) => ({ default: mod.BackupTab }))
)

const UsersPermissionsTab = React.lazy(() =>
  import('@/components/settings/tabs/UsersPermissionsTab').then((mod) => ({
    default: mod.UsersPermissionsTab,
  }))
)

export default function AdminSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users-permissions')

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard')
    }
  }, [user, navigate])

  if (user?.role !== 'admin') {
    return null
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="app-icon-chip p-3">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">إعدادات النظام</h1>
              <p className="mt-1 text-foreground-secondary">إدارة المستخدمين والصلاحيات والنسخ الاحتياطي</p>
            </div>
          </div>
        </div>

        <div className="app-panel">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="border-b rounded-none bg-surface">
              <TabsTrigger value="users-permissions" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                المستخدمون والصلاحيات
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                النسخ الاحتياطية
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users-permissions" className="p-6">
              <Suspense fallback={<LoadingSpinner />}>
                <UsersPermissionsTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="backup" className="p-6">
              <Suspense fallback={<LoadingSpinner />}>
                <BackupTab />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  )
}
