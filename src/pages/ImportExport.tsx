import { useState } from 'react'
import Layout from '@/components/layout/Layout'
import { FileDown, FileUp, FileText, Download } from 'lucide-react'
import ExportTab from '@/components/import-export/ExportTab'
import ImportTab from '@/components/import-export/ImportTab'
import TemplatesTab from '@/components/import-export/TemplatesTab'
import { usePermissions } from '@/utils/permissions'

type TabType = 'export' | 'import' | 'templates'

export default function ImportExport() {
  const { canImport, canExport } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('export')

  const tabs = [
    {
      id: 'export' as TabType,
      label: 'التصدير',
      icon: FileDown,
      description: 'تصدير البيانات إلى ملفات Excel',
      color: 'blue'
    },
    {
      id: 'import' as TabType,
      label: 'الاستيراد',
      icon: FileUp,
      description: 'استيراد البيانات من ملفات Excel',
      color: 'green'
    },
    {
      id: 'templates' as TabType,
      label: 'القوالب',
      icon: FileText,
      description: 'تحميل قوالب Excel الجاهزة',
      color: 'purple'
    }
  ]

  return (
    <Layout>
      <div className="p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start gap-2 sm:mb-6 sm:items-center sm:gap-3">
          <div className="app-icon-chip flex-shrink-0">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">استيراد وتصدير</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">إدارة البيانات</p>
          </div>
        </div>

        {/* Tabs Navigation - Responsive */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4 sm:flex-row mb-4 sm:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            const activeStyles = 'bg-primary/15 border-primary/60 text-slate-900 shadow-soft'
            const inactiveStyles = 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 transition-all duration-200 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3 ${
                  isActive ? activeStyles : inactiveStyles
                }`}
              >
                <div className={`rounded-lg p-1.5 sm:p-2 ${
                  isActive ? 'bg-primary/20' : 'bg-gray-100'
                }`}>
                  <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    isActive ? 'text-slate-900' : 'text-gray-500'
                  }`} />
                </div>
                <span className="font-medium text-xs sm:text-sm text-center leading-tight">{tab.label}</span>
                <p className={`hidden text-center text-[10px] leading-tight line-clamp-1 sm:inline sm:text-xs ${
                  isActive ? 'text-slate-700' : 'text-gray-500'
                }`}>
                  {tab.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="app-panel p-3 sm:p-4">
          {activeTab === 'export' && canExport('importExport') && <ExportTab />}
          {activeTab === 'import' && canImport('importExport') && <ImportTab />}
          {activeTab === 'templates' && <TemplatesTab />}
        </div>
      </div>
    </Layout>
  )
}
