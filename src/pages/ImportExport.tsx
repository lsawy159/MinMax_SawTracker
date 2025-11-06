import { useState } from 'react'
import Layout from '../components/layout/Layout'
import { FileDown, FileUp, FileText, Download, Upload } from 'lucide-react'
import ExportTab from '../components/import-export/ExportTab'
import ImportTab from '../components/import-export/ImportTab'
import TemplatesTab from '../components/import-export/TemplatesTab'

type TabType = 'export' | 'import' | 'templates'

export default function ImportExport() {
  const [activeTab, setActiveTab] = useState<TabType>('export')

  const tabs = [
    {
      id: 'export' as TabType,
      label: 'التصدير',
      icon: FileDown,
      description: 'تصدير البيانات إلى ملفات Excel'
    },
    {
      id: 'import' as TabType,
      label: 'الاستيراد',
      icon: FileUp,
      description: 'استيراد البيانات من ملفات Excel'
    },
    {
      id: 'templates' as TabType,
      label: 'القوالب',
      icon: FileText,
      description: 'تحميل قوالب Excel الجاهزة'
    }
  ]

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Download className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">مركز الاستيراد والتصدير</h1>
            <p className="text-gray-600 mt-1">إدارة متقدمة لاستيراد وتصدير البيانات</p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <Download className="w-8 h-8 mb-2" />
            <div className="text-2xl font-bold mb-1">تصدير شامل</div>
            <div className="text-blue-100 text-sm">تصدير البيانات بتنسيق Excel احترافي</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <Upload className="w-8 h-8 mb-2" />
            <div className="text-2xl font-bold mb-1">استيراد ذكي</div>
            <div className="text-green-100 text-sm">استيراد مع فحص تلقائي للأخطاء</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <FileText className="w-8 h-8 mb-2" />
            <div className="text-2xl font-bold mb-1">قوالب جاهزة</div>
            <div className="text-purple-100 text-sm">قوالب Excel محضرة مسبقاً</div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab Description */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {activeTab === 'export' && <ExportTab />}
          {activeTab === 'import' && <ImportTab />}
          {activeTab === 'templates' && <TemplatesTab />}
        </div>
      </div>
    </Layout>
  )
}
