import { useSearchParams } from 'react-router-dom'

export const SETTINGS_TABS = ['users-permissions', 'backup'] as const
export type SettingsTabId = (typeof SETTINGS_TABS)[number]

interface UseSettingsTabStateReturn {
  activeTab: SettingsTabId
  setActiveTab: (tabId: SettingsTabId) => void
  isValidTab: (value: unknown) => value is SettingsTabId
}

export function useSettingsTabState(): UseSettingsTabStateReturn {
  const [searchParams, setSearchParams] = useSearchParams()

  const isValidTab = (value: unknown): value is SettingsTabId => {
    return typeof value === 'string' && SETTINGS_TABS.includes(value as SettingsTabId)
  }

  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTabId = isValidTab(tabParam) ? tabParam : 'users-permissions'

  const setActiveTab = (tabId: SettingsTabId) => {
    setSearchParams({ tab: tabId }, { replace: true })
  }

  return { activeTab, setActiveTab, isValidTab }
}
