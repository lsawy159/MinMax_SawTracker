import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import CustomFieldManager from '@/components/settings/CustomFieldManager'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Settings, Database, Shield, Sparkles } from 'lucide-react'

export default function AdminSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'unified' | 'fields' | 'general'>('unified')

  useEffect(() => {
    // التحقق من صلاحيات المدير
    if (user?.role !== 'admin') {
      navigate('/dashboard')
    }
  }, [user, navigate])

  if (user?.role !== 'admin') {
    return null
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">إعدادات النظام</h1>
              <p className="text-gray-600 mt-1">إدارة جميع إعدادات النظام: الحالات، التنبيهات، الألوان، والحقول المخصصة</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('unified')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition whitespace-nowrap ${
                activeTab === 'unified'
                  ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              الإعدادات المركزية
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition whitespace-nowrap ${
                activeTab === 'fields'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Database className="w-5 h-5" />
              إدارة الحقول المخصصة
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'general'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              إعدادات عامة
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'unified' && <UnifiedSettings />}
          {activeTab === 'fields' && <CustomFieldManager />}
          {activeTab === 'general' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-center py-12 text-gray-500">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">الإعدادات العامة</h3>
                <p className="text-sm">سيتم إضافة المزيد من الإعدادات العامة قريباً</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
