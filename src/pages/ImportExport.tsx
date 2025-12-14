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
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
            <Download className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
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
            const colorClass = tab.color as 'blue' | 'green' | 'purple'
            
            const activeStyles = {
              blue: 'bg-blue-50 border-blue-500 text-blue-700 shadow-md',
              green: 'bg-green-50 border-green-500 text-green-700 shadow-md',
              purple: 'bg-purple-50 border-purple-500 text-purple-700 shadow-md'
            }
            
            const inactiveStyles = 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                  isActive 
                    ? activeStyles[colorClass]
                    : inactiveStyles
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${
                  isActive
                    ? colorClass === 'blue' ? 'bg-blue-100' : colorClass === 'green' ? 'bg-green-100' : 'bg-purple-100'
                    : 'bg-gray-100'
                }`}>
                  <Icon className={`w-3 sm:w-4 h-3 sm:h-4 ${
                    isActive
                      ? colorClass === 'blue' ? 'text-blue-600' : colorClass === 'green' ? 'text-green-600' : 'text-purple-600'
                      : 'text-gray-500'
                  }`} />
                </div>
                <span className="font-medium text-xs sm:text-sm text-center leading-tight">{tab.label}</span>
                <p className={`text-[10px] sm:text-xs text-center leading-tight line-clamp-1 hidden sm:inline ${
                  isActive
                    ? colorClass === 'blue' ? 'text-blue-600' : colorClass === 'green' ? 'text-green-600' : 'text-purple-600'
                    : 'text-gray-500'
                }`}>
                  {tab.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          {activeTab === 'export' && canExport('importExport') && <ExportTab />}
          {activeTab === 'import' && canImport('importExport') && <ImportTab />}
          {activeTab === 'templates' && <TemplatesTab />}
        </div>
      </div>
    </Layout>
  )
}
