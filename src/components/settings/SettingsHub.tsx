import React, { Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettingsTabState, SETTINGS_TABS } from './useSettingsTabState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy load tab components
const UsersPermissionsTab = React.lazy(() =>
  import('./tabs/UsersPermissionsTab').then((mod) => ({ default: mod.UsersPermissionsTab }))
);

const BackupTab = React.lazy(() =>
  import('./tabs/BackupTab').then((mod) => ({ default: mod.BackupTab }))
);

interface SettingsTabConfig {
  id: typeof SETTINGS_TABS[number];
  label: string;
  labelAr: string;
  component: React.LazyExoticComponent<() => JSX.Element>;
  requiredPermission?: string;
}

const SETTINGS_TAB_CONFIGS: SettingsTabConfig[] = [
  {
    id: 'users-permissions',
    label: 'Users & Permissions',
    labelAr: 'المستخدمون والصلاحيات',
    component: UsersPermissionsTab,
    requiredPermission: 'manage_users',
  },
  {
    id: 'backup',
    label: 'Backup',
    labelAr: 'النسخ الاحتياطية',
    component: BackupTab,
    requiredPermission: 'manage_backups',
  },
];

interface SettingsHubProps {
  userPermissions?: string[];
}

export function SettingsHub({ userPermissions = [] }: SettingsHubProps): JSX.Element {
  const { activeTab, setActiveTab } = useSettingsTabState();
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChangesGuard({
    isDirty,
    onNavigate: () => {
      setIsDirty(false);
    },
  });

  // Filter tabs based on permissions
  const visibleTabs = SETTINGS_TAB_CONFIGS.filter((tab) => {
    if (!tab.requiredPermission) return true;
    return userPermissions.includes(tab.requiredPermission);
  });

  if (visibleTabs.length === 0) {
    return <div className="p-6 text-center text-neutral-500">لا توجد أذونات كافية. No permissions.</div>;
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} dir="rtl" className="w-full">
      <TabsList className="grid w-full gap-2" role="tablist" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex flex-col gap-1"
            aria-label={`${tab.labelAr} - ${tab.label}`}
            role="tab"
          >
            <span className="text-sm font-medium">{tab.labelAr}</span>
            <span className="text-xs text-neutral-500">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => {
        const TabComponent = tab.component;
        return (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <Suspense
              fallback={
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              }
            >
              <TabComponent />
            </Suspense>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
