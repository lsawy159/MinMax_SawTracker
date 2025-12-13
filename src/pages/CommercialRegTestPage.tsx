import { useState } from 'react'
import Layout from '@/components/layout/Layout'
import { Building2 } from 'lucide-react'
import { 
  calculateDaysRemaining, 
  getStatusColor, 
  getStatusText, 
  getStatusIcon,
  getStatusCategory,
  calculateCommercialRegStats,
  getShortStatusText
} from '@/utils/commercialRegistration'

interface TestCompany {
  id: string
  name: string
  commercial_registration_expiry: string
}

export default function CommercialRegTestPage() {
  // Test data with different expiry scenarios
  const [testCompanies] = useState<TestCompany[]>([
    {
      id: '1',
      name: 'مؤسسة نشطة',
      commercial_registration_expiry: '2026-12-31' // أكثر من سنة
    },
    {
      id: '2',
      name: 'مؤسسة قريبة من الانتهاء',
      commercial_registration_expiry: '2025-12-15' // حوالي شهر
    },
    {
      id: '3',
      name: 'مؤسسة تحتاج تجديد',
      commercial_registration_expiry: '2025-11-20' // أقل من أسبوعين
    },
    {
      id: '4',
      name: 'مؤسسة منتهية الصلاحية',
      commercial_registration_expiry: '2025-10-01' // منتهية
    },
    {
      id: '5',
      name: 'مؤسسة أخرى نشطة',
      commercial_registration_expiry: '2026-06-30' // حوالي 8 أشهر
    },
    {
      id: '6',
      name: 'مؤسسة تجديد متوسط',
      commercial_registration_expiry: '2026-02-15' // حوالي 3 أشهر
    },
    {
      id: '7',
      name: 'مؤسسة بدون تاريخ',
      commercial_registration_expiry: ''
    }
  ])

  const stats = calculateCommercialRegStats(testCompanies)

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">اختبار نظام السجل التجاري</h1>
            <p className="text-sm text-gray-600 mt-1">
              اختبار نظام الإحصائيات والتلوين للسجل التجاري
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">الإحصائيات العامة</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">إجمالي المؤسسات</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats.valid}</div>
              <div className="text-sm text-blue-600">ساري ({stats.percentageValid}%)</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{stats.expiringSoon}</div>
              <div className="text-sm text-yellow-600">عاجل ({stats.percentageExpiringSoon}%)</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
              <div className="text-sm text-red-600">منتهي ({stats.percentageExpired}%)</div>
            </div>
          </div>
        </div>

        {/* Individual Company Tests */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">اختبار كل مؤسسة</h2>
          <div className="space-y-4">
            {testCompanies.map((company) => {
              const daysRemaining = company.commercial_registration_expiry 
                ? calculateDaysRemaining(company.commercial_registration_expiry)
                : null
              
              const statusColor = daysRemaining !== null ? getStatusColor(daysRemaining) : null
              const category = daysRemaining !== null ? getStatusCategory(daysRemaining) : null

              return (
                <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{company.name}</h3>
                      <p className="text-sm text-gray-600">
                        تاريخ الانتهاء: {company.commercial_registration_expiry || 'غير محدد'}
                      </p>
                    </div>
                    
                    {daysRemaining !== null && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{daysRemaining}</div>
                        <div className="text-sm text-gray-600">يوم متبقي</div>
                      </div>
                    )}
                  </div>

                  {daysRemaining !== null && statusColor && (
                    <div className={`px-4 py-3 rounded-lg text-sm font-medium border-2 ${statusColor.backgroundColor} ${statusColor.textColor} ${statusColor.borderColor}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getStatusIcon(daysRemaining)}</span>
                        <div className="flex flex-col">
                          <span className="font-bold">{getStatusText(daysRemaining)}</span>
                          <span className="text-xs opacity-75">
                            تصنيف: {
                              category === 'valid' ? 'ساري' :
                              category === 'expiring_soon' ? 'عاجل' :
                              category === 'expired' ? 'منتهي' : 'غير محدد'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!company.commercial_registration_expiry && (
                    <div className="px-4 py-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                      لا يوجد تاريخ انتهاء محدد
                    </div>
                  )}

                  {/* Test different display formats */}
                  {daysRemaining !== null && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 p-2 rounded">
                        <strong>النص المختصر:</strong> {getShortStatusText(daysRemaining)}
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <strong>الأيام المحسوبة:</strong> {daysRemaining} يوم
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Color Reference Guide */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">دليل الألوان</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border-2 border-blue-200 mb-2">
                <div className="text-lg">✅</div>
                <div className="font-bold">ساري</div>
                <div className="text-xs">أكثر من 60 يوم</div>
              </div>
              <div className="text-sm text-gray-600">أزرق</div>
            </div>
            
            <div className="text-center">
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 border-2 border-yellow-200 mb-2">
                <div className="text-lg">🟡</div>
                <div className="font-bold">عاجل</div>
                <div className="text-xs">30-60 يوم</div>
              </div>
              <div className="text-sm text-gray-600">أصفر</div>
            </div>
            
            <div className="text-center">
              <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border-2 border-red-200 mb-2">
                <div className="text-lg">❌</div>
                <div className="font-bold">منتهي</div>
                <div className="text-xs">أقل من 30 يوم</div>
              </div>
              <div className="text-sm text-gray-600">أحمر</div>
            </div>
          </div>
        </div>

        {/* Function Testing */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">اختبار الدوال</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-2">حسابات الأيام</h3>
              <div className="space-y-2 text-sm">
                <div>تاريخ اليوم: 2025-11-06</div>
                <div>2025-12-06 → {calculateDaysRemaining('2025-12-06')} يوم</div>
                <div>2025-11-10 → {calculateDaysRemaining('2025-11-10')} يوم</div>
                <div>2025-10-01 → {calculateDaysRemaining('2025-10-01')} يوم</div>
                <div>2026-01-01 → {calculateDaysRemaining('2026-01-01')} يوم</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold mb-2">تصنيف الحالات</h3>
              <div className="space-y-2 text-sm">
                <div>-10 أيام → {getStatusCategory(-10)}</div>
                <div>15 يوم → {getStatusCategory(15)}</div>
                <div>45 يوم → {getStatusCategory(45)}</div>
                <div>120 يوم → {getStatusCategory(120)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
