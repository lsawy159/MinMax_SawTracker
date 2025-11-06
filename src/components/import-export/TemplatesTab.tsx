import { FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function TemplatesTab() {
  
  const downloadEmployeeTemplate = () => {
    try {
      const templateData = [
        {
          'الاسم': 'محمد أحمد',
          'المهنة': 'مهندس',
          'الجنسية': 'مصري',
          'تاريخ الميلاد': '1990-01-15',
          'رقم الجوال': '0501234567',
          'رقم الجواز': 'A1234567',
          'رقم الإقامة': '2123456789',
          'تاريخ الالتحاق': '2023-01-01',
          'انتهاء العقد': '2025-01-01',
          'انتهاء الإقامة': '2025-12-31',
          'اسم المشروع': 'مشروع رقم 1',
          'الحساب البنكي': 'SA1234567890123456789012',
          'الراتب': '8000',
          'رابط صورة الإقامة': '',
          'انتهاء اشتراك التأمين': '2025-06-30',
          'المؤسسة': 'مؤسسة النجاح',
          'حقول إضافية': '{"allowances": "500", "employee_number": "EMP001"}'
        }
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'قالب الموظفين')

      // Set column widths
      const wscols = [
        { wch: 20 }, // الاسم
        { wch: 20 }, // المهنة
        { wch: 15 }, // الجنسية
        { wch: 15 }, // تاريخ الميلاد
        { wch: 15 }, // رقم الجوال
        { wch: 15 }, // رقم الجواز
        { wch: 15 }, // رقم الإقامة
        { wch: 15 }, // تاريخ الالتحاق
        { wch: 15 }, // انتهاء العقد
        { wch: 15 }, // انتهاء الإقامة
        { wch: 20 }, // اسم المشروع
        { wch: 25 }, // الحساب البنكي
        { wch: 15 }, // الراتب
        { wch: 25 }, // رابط صورة الإقامة
        { wch: 20 }, // انتهاء اشتراك التأمين
        { wch: 25 }, // المؤسسة
        { wch: 30 }  // حقول إضافية
      ]
      ws['!cols'] = wscols

      // Add instructions as comment
      const instructions = `
تعليمات استخدام قالب الموظفين:

1. الحقول المطلوبة (يجب تعبئتها):
   - الاسم
   - المهنة  
   - الجنسية
   - رقم الجواز
   - رقم الإقامة
   - تاريخ الالتحاق
   - انتهاء الإقامة

2. الحقول الاختيارية:
   - تاريخ الميلاد
   - رقم الجوال
   - انتهاء العقد
   - اسم المشروع
   - الحساب البنكي
   - الراتب (هام جداً)
   - رابط صورة الإقامة
   - انتهاء اشتراك التأمين
   - المؤسسة

3. صيغ التواريخ: يجب أن تكون بصيغة YYYY-MM-DD (مثال: 2024-12-31)

4. رقم الجوال: يجب أن يكون رقماً من 10-15 خانة

5. الراتب: يمكن إدخاله في حقل الراتب أو في الحقول الإضافية

6. المؤسسة: يجب أن يكون اسم المؤسسة موجوداً في النظام

7. الحقول الإضافية: JSON بصيغة {"key": "value"}

8. لا تقم بتغيير أسماء الأعمدة
      `.trim()

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(data, 'قالب_الموظفين.xlsx')

      toast.success('تم تحميل قالب الموظفين')
    } catch (error) {
      console.error('Error:', error)
      toast.error('فشل تحميل القالب')
    }
  }

  const downloadCompanyTemplate = () => {
    try {
      const templateData = [
        {
          'اسم المؤسسة': 'مؤسسة النجاح للتجارة',
          'الرقم التأميني': '700123456789',
          'الرقم الموحد': '1234567890',
          'رقم اشتراك قوى': '123456',
          'نوع المؤسسة': 'تجارية',
          'تاريخ انتهاء السجل التجاري': '2026-12-31',
          'تاريخ انتهاء اشتراك التأمين': '2026-06-30',
          'تاريخ تجديد الوثائق الحكومية': '2026-01-15',
          'تاريخ انتهاء اشتراك قوى': '2026-08-31',
          'عدد الموظفين': 25,
          'الحد الأقصى للموظفين': 50,
          'حقول إضافية': '{"employee_limit": 50, "sector": "تجارة"}'
        }
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'قالب المؤسسات')

      const wscols = [
        { wch: 30 }, // اسم المؤسسة
        { wch: 20 }, // الرقم التأميني
        { wch: 20 }, // الرقم الموحد
        { wch: 20 }, // رقم اشتراك قوى
        { wch: 15 }, // نوع المؤسسة
        { wch: 20 }, // تاريخ انتهاء السجل التجاري
        { wch: 20 }, // تاريخ انتهاء اشتراك التأمين
        { wch: 25 }, // تاريخ تجديد الوثائق الحكومية
        { wch: 20 }, // تاريخ انتهاء اشتراك قوى
        { wch: 15 }, // عدد الموظفين
        { wch: 20 }, // الحد الأقصى للموظفين
        { wch: 30 }  // حقول إضافية
      ]
      ws['!cols'] = wscols

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(data, 'قالب_المؤسسات.xlsx')

      toast.success('تم تحميل قالب المؤسسات')
    } catch (error) {
      console.error('Error:', error)
      toast.error('فشل تحميل القالب')
    }
  }

  const templates = [
    {
      id: 'employees',
      title: 'قالب الموظفين',
      description: 'قالب Excel جاهز لاستيراد بيانات الموظفين',
      fields: [
        'الاسم (مطلوب)',
        'المهنة (مطلوب)',
        'الجنسية (مطلوب)',
        'تاريخ الميلاد',
        'رقم الجوال',
        'رقم الجواز (مطلوب)',
        'رقم الإقامة (مطلوب)',
        'تاريخ الالتحاق (مطلوب)',
        'انتهاء العقد',
        'انتهاء الإقامة (مطلوب)',
        'اسم المشروع',
        'الحساب البنكي',
        'الراتب (مهم)',
        'رابط صورة الإقامة',
        'انتهاء اشتراك التأمين',
        'المؤسسة',
        'حقول إضافية'
      ],
      color: 'blue',
      icon: '👥',
      downloadFn: downloadEmployeeTemplate
    },
    {
      id: 'companies',
      title: 'قالب المؤسسات',
      description: 'قالب Excel جاهز لاستيراد بيانات المؤسسات',
      fields: [
        'اسم المؤسسة (مطلوب)',
        'الرقم التأميني',
        'الرقم الموحد',
        'رقم اشتراك قوى',
        'نوع المؤسسة',
        'تاريخ انتهاء السجل التجاري',
        'تاريخ انتهاء اشتراك التأمين',
        'تاريخ تجديد الوثائق الحكومية',
        'تاريخ انتهاء اشتراك قوى',
        'عدد الموظفين',
        'الحد الأقصى للموظفين',
        'حقول إضافية'
      ],
      color: 'green',
      icon: '🏢',
      downloadFn: downloadCompanyTemplate
    }
  ]

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">📋 تعليمات استخدام القوالب</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">1.</span>
            <span>قم بتحميل القالب المناسب (موظفين أو مؤسسات)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">2.</span>
            <span>افتح الملف في Microsoft Excel أو Google Sheets</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">3.</span>
            <span>احذف الصف النموذجي وأضف بياناتك الخاصة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">4.</span>
            <span>تأكد من تعبئة جميع الحقول المطلوبة (المشار إليها بكلمة "مطلوب")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">5.</span>
            <span>لا تقم بتغيير أسماء الأعمدة أو ترتيبها</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">6.</span>
            <span>احفظ الملف بصيغة .xlsx واستخدم تبويب "الاستيراد" لرفعه</span>
          </li>
        </ul>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`border-2 border-${template.color}-200 rounded-xl p-6 bg-${template.color}-50 hover:shadow-lg transition`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{template.icon}</div>
                <div>
                  <h3 className={`text-xl font-bold text-${template.color}-900`}>{template.title}</h3>
                  <p className={`text-sm text-${template.color}-700 mt-1`}>{template.description}</p>
                </div>
              </div>
            </div>

            {/* Fields List */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">الحقول المتضمنة:</h4>
              <ul className="space-y-1">
                {template.fields.map((field, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    {field}
                  </li>
                ))}
              </ul>
            </div>

            {/* Download Button */}
            <button
              onClick={template.downloadFn}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 bg-${template.color}-600 text-white rounded-lg hover:bg-${template.color}-700 font-medium transition`}
            >
              <Download className="w-5 h-5" />
              تحميل القالب
            </button>
          </div>
        ))}
      </div>

      {/* Additional Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-yellow-900 mb-3">💡 نصائح مهمة</h3>
        <ul className="space-y-2 text-yellow-800">
          <li className="flex items-start gap-2">
            <span className="text-yellow-600">•</span>
            <span>استخدم صيغة التاريخ: YYYY-MM-DD (مثال: 2024-12-31)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-600">•</span>
            <span>رقم الجوال يجب أن يكون من 10-15 خانة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-600">•</span>
            <span>تأكد من أن أسماء المؤسسات موجودة في النظام قبل استيراد الموظفين</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-600">•</span>
            <span>الحقول الإضافية يجب أن تكون بصيغة JSON صحيحة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-600">•</span>
            <span>قم بعمل نسخة احتياطية من بياناتك الحالية قبل الاستيراد</span>
          </li>
        </ul>
      </div>

      {/* Format Examples */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">📝 أمثلة على التنسيق الصحيح</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium text-gray-900 mb-2">التواريخ:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">✅ صحيح:</span>
                <span className="font-mono text-green-600">2024-12-31</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">❌ خاطئ:</span>
                <span className="font-mono text-red-600">31/12/2024</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium text-gray-900 mb-2">رقم الجوال:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">✅ صحيح:</span>
                <span className="font-mono text-green-600">0501234567</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">❌ خاطئ:</span>
                <span className="font-mono text-red-600">050-123-4567</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium text-gray-900 mb-2">حقول إضافية:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">✅ صحيح:</span>
                <span className="font-mono text-green-600 text-xs">{"{'key':'value'}"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">❌ خاطئ:</span>
                <span className="font-mono text-red-600">key: value</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="font-medium text-gray-900 mb-2">الأرقام:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">✅ صحيح:</span>
                <span className="font-mono text-green-600">50</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">❌ خاطئ:</span>
                <span className="font-mono text-red-600">خمسون</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
