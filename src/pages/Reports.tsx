import Layout from '../components/layout/Layout'
import { BarChart3 } from 'lucide-react' // استخدمنا نفس الأيقونة الخاصة بالتقارير

export default function Reports() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">التقارير</h1>
        </div>

        {/* --- بداية محتوى "تحت الإنشاء" --- */}
        <div className="flex items-center justify-center h-[60vh] bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              الصفحة تحت الإنشاء
            </h2>
            <p className="text-gray-600">
              هذه الصفحة قيد التطوير حالياً وستكون متاحة قريباً بإذن الله.
            </p>
          </div>
        </div>
        {/* --- نهاية محتوى "تحت الإنشاء" --- */}

      </div>
    </Layout>
  )
}