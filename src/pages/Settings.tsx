import { SettingsHub } from '@/components/settings/SettingsHub'
import { useAuth } from '@/contexts/AuthContext'

export default function Settings() {
  const { user } = useAuth()

  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : []

  return (
    <>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            الإعدادات
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Manage your account settings and preferences
          </p>
        </div>

        <SettingsHub userPermissions={userPermissions} />
      </div>
    </>
  )
}
