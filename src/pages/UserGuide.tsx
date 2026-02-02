import { useState } from 'react'
import { BookOpen, Search, Download, Home, Users, Building2, FolderKanban, Bell, SearchIcon, BarChart3, ArrowDownUp, Lightbulb, ChevronLeft, type LucideIcon } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { usePermissions } from '@/utils/permissions'

interface GuideSection {
  id: string
  title: string
  icon: LucideIcon
  color: string
  gradient: string
  content: string
  tips: string[]
  steps?: {
    number: number
    title: string
    description: string
  }[]
}

export default function UserGuide() {
  const { canView } = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('')

  // Check permissions
  if (!canView('userGuide')) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const guideSections: GuideSection[] = [
    {
      id: 'intro',
      title: 'مرحباً بك في SawTracker',
      icon: BookOpen,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      content: 'نظام متكامل وسهل لإدارة الموظفين والشركات والمشاريع. صُمم ليكون بسيطاً وفعالاً في نفس الوقت.',
      tips: [
        'استخدم القائمة الجانبية للتنقل بين الصفحات',
        'استفد من خاصية البحث للعثور على ما تريد بسرعة',
        'راقب التنبيهات الملونة لمعرفة ما يحتاج اهتمامك'
      ]
    },
    {
      id: 'dashboard',
      title: 'الصفحة الرئيسية',
      icon: Home,
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
      content: 'مركز التحكم الذي يعرض لك ملخص شامل لحالة النظام والإحصائيات المهمة.',
      tips: [
        'البطاقات الحمراء تعني وضع طارئ يحتاج اهتمام فوري',
        'البطاقات الصفراء تعني تحذير يحتاج متابعة قريباً',
        'البطاقات الخضراء تعني كل شيء على ما يرام'
      ],
      steps: [
        { number: 1, title: 'راجع الإحصائيات العامة', description: 'انظر إلى عدد الموظفين والشركات والفراغات المتاحة' },
        { number: 2, title: 'تحقق من التنبيهات', description: 'لاحظ أي تنبيهات حمراء أو صفراء واتخذ إجراء' },
        { number: 3, title: 'اضغط على أي بطاقة', description: 'للذهاب مباشرة للصفحة التفصيلية' }
      ]
    },
    {
      id: 'employees',
      title: 'إدارة الموظفين',
      icon: Users,
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      content: 'إدارة كاملة لبيانات الموظفين مع مراقبة تواريخ انتهاء الوثائق.',
      tips: [
        'استخدم البحث السريع للعثور على موظف معين',
        'الألوان تشير لحالة الوثائق: أحمر (منتهي/طارئ)، برتقالي (عاجل)، أصفر (متوسط)، أخضر (صحيح)',
        'يمكنك التبديل بين عرض الجدول والبطاقات'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة الموظفين', description: 'من القائمة الجانبية' },
        { number: 2, title: 'ابحث أو صفّ', description: 'استخدم البحث أو الفلاتر لإيجاد من تريد' },
        { number: 3, title: 'اضغط على الموظف', description: 'لرؤية كل التفاصيل أو التعديل' }
      ]
    },
    {
      id: 'companies',
      title: 'إدارة الشركات',
      icon: Building2,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      content: 'إدارة معلومات الشركات ومراقبة السجلات التجارية والاشتراكات.',
      tips: [
        'راقب حالة السجل التجاري والتأمينات الاجتماعية',
        'الشركات الممتلئة (بدون فراغات) تظهر باللون الأحمر',
        'يمكنك عرض جميع موظفي الشركة بضغطة واحدة'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة المؤسسات', description: 'من القائمة الجانبية' },
        { number: 2, title: 'راجع البطاقات', description: 'كل بطاقة تعرض معلومات مهمة عن الشركة' },
        { number: 3, title: 'اضغط للتفاصيل', description: 'لرؤية كل المعلومات والموظفين' }
      ]
    },
    {
      id: 'projects',
      title: 'إدارة المشاريع',
      icon: FolderKanban,
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      content: 'تنظيم وإدارة المشاريع ومتابعة الموظفين المكلفين بها.',
      tips: [
        'كل مشروع يعرض عدد الموظفين المخصصين له',
        'يمكنك رؤية إجمالي الرواتب للمشروع',
        'حالة المشروع: نشط (أخضر)، غير نشط (أحمر)'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة المشاريع', description: 'من القائمة الجانبية' },
        { number: 2, title: 'اختر تبويب الإحصائيات', description: 'لرؤية تحليل شامل للمشاريع' },
        { number: 3, title: 'أضف أو عدّل', description: 'حسب صلاحياتك' }
      ]
    },
    {
      id: 'alerts',
      title: 'التنبيهات',
      icon: Bell,
      color: 'red',
      gradient: 'from-red-500 to-red-600',
      content: 'مركز التنبيهات يعرض لك كل ما يحتاج اهتمامك من وثائق قاربت على الانتهاء.',
      tips: [
        'تنبيهات الشركات والموظفين في تبويبات منفصلة',
        'اضغط على التنبيه للذهاب مباشرة للعنصر المتأثر',
        'يمكنك تصفية التنبيهات حسب الأولوية'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة التنبيهات', description: 'من القائمة أو من الأيقونة الحمراء' },
        { number: 2, title: 'اختر نوع التنبيه', description: 'شركات، موظفين، أو الكل' },
        { number: 3, title: 'تابع التنبيهات الطارئة', description: 'ابدأ بالتنبيهات الحمراء أولاً' }
      ]
    },
    {
      id: 'search',
      title: 'البحث المتقدم',
      icon: SearchIcon,
      color: 'cyan',
      gradient: 'from-cyan-500 to-cyan-600',
      content: 'أداة بحث قوية مع فلاتر متعددة لإيجاد أي بيانات بسهولة.',
      tips: [
        'يمكنك حفظ عمليات البحث المتكررة',
        'استخدم الفلاتر المتعددة للبحث الدقيق',
        'صدّر نتائج البحث إلى Excel'
      ],
      steps: [
        { number: 1, title: 'افتح البحث المتقدم', description: 'من القائمة الجانبية' },
        { number: 2, title: 'اختر نوع البحث', description: 'موظفين أو شركات' },
        { number: 3, title: 'طبّق الفلاتر', description: 'اختر الخيارات التي تريدها' },
        { number: 4, title: 'احفظ البحث', description: 'لاستخدامه لاحقاً' }
      ]
    },
    {
      id: 'reports',
      title: 'التقارير',
      icon: BarChart3,
      color: 'teal',
      gradient: 'from-teal-500 to-teal-600',
      content: 'تقارير شاملة وإحصائيات مفصلة عن حالة الشركات والموظفين.',
      tips: [
        'التقارير تحدث تلقائياً مع البيانات',
        'يمكنك تصدير أي تقرير إلى Excel',
        'الجداول قابلة للترتيب والتصفية'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة التقارير', description: 'من القائمة الجانبية' },
        { number: 2, title: 'اختر نوع التقرير', description: 'شركات أو موظفين' },
        { number: 3, title: 'راجع الإحصائيات', description: 'في الأعلى لرؤية الملخص' },
        { number: 4, title: 'صدّر إذا أردت', description: 'لحفظ نسخة خارجية' }
      ]
    },
    {
      id: 'import-export',
      title: 'الاستيراد والتصدير',
      icon: ArrowDownUp,
      color: 'pink',
      gradient: 'from-pink-500 to-pink-600',
      content: 'نقل البيانات من وإلى Excel بسهولة وأمان.',
      tips: [
        'حمّل القوالب الجاهزة قبل الاستيراد',
        'تأكد من صيغة البيانات قبل الاستيراد',
        'يمكنك تصدير أي بيانات للعمل عليها خارجياً'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة الاستيراد/التصدير', description: 'من القائمة الجانبية' },
        { number: 2, title: 'اختر العملية', description: 'تصدير، استيراد، أو قوالب' },
        { number: 3, title: 'اتبع التعليمات', description: 'في كل تبويب' }
      ]
    }
  ]

  type ColorKey = 'blue' | 'indigo' | 'green' | 'purple' | 'orange' | 'red' | 'cyan' | 'teal' | 'pink'

  type ColorClasses = {
    bg: string
    border: string
    text: string
    icon: string
    badge: string
  }

  const colorMap: Record<ColorKey, ColorClasses> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600', badge: 'bg-green-100 text-green-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', icon: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700' },
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-600', badge: 'bg-teal-100 text-teal-700' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', icon: 'text-pink-600', badge: 'bg-pink-100 text-pink-700' }
  }

  const getColorClasses = (color: string): ColorClasses => {
    return colorMap[(color as ColorKey)] ?? colorMap.blue
  }

  const filteredSections = guideSections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedSectionData = guideSections.find(s => s.id === selectedSection)

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                <BookOpen className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">دليل المستخدم</h1>
                <p className="text-blue-100 text-lg">كل ما تحتاج معرفته لاستخدام النظام بكفاءة</p>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="mt-8 max-w-2xl">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ابحث عن أي موضوع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-12 pl-4 py-4 rounded-2xl text-gray-900 border-0 shadow-xl focus:ring-4 focus:ring-white/50 transition"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {!selectedSectionData ? (
            /* Grid View - Show all sections */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSections.map((section) => {
                const Icon = section.icon
                const colors = getColorClasses(section.color)
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`group relative overflow-hidden rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 text-right transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:-translate-y-1`}
                  >
                    {/* Gradient overlay */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${section.gradient} opacity-10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150`} />
                    
                    <div className="relative">
                      <div className={`inline-flex p-4 rounded-xl ${colors.badge} mb-4`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      
                      <h3 className={`text-2xl font-bold ${colors.text} mb-3`}>
                        {section.title}
                      </h3>
                      
                      <p className="text-gray-600 leading-relaxed mb-4">
                        {section.content}
                      </p>
                      
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: colors.icon.replace('text-', '') }}>
                        <span>اقرأ المزيد</span>
                        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Detail View - Show selected section */
            <div className="max-w-4xl mx-auto">
              {/* Back button */}
              <button
                onClick={() => setSelectedSection('')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
                <span className="font-medium">العودة لجميع المواضيع</span>
              </button>

              {/* Section detail card */}
              <div className={`rounded-3xl border-2 ${getColorClasses(selectedSectionData.color).border} bg-white shadow-2xl overflow-hidden`}>
                {/* Header with gradient */}
                <div className={`bg-gradient-to-r ${selectedSectionData.gradient} text-white p-8`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                      <selectedSectionData.icon className="w-12 h-12" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">{selectedSectionData.title}</h2>
                      <p className="text-white/90 mt-2 text-lg">{selectedSectionData.content}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  {/* Tips Section */}
                  {selectedSectionData.tips && selectedSectionData.tips.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <Lightbulb className="w-5 h-5 text-yellow-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">نصائح مفيدة</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSectionData.tips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                              {idx + 1}
                            </div>
                            <p className="text-gray-700 flex-1">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Steps Section */}
                  {selectedSectionData.steps && selectedSectionData.steps.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-6">خطوات الاستخدام</h3>
                      <div className="space-y-4">
                        {selectedSectionData.steps.map((step) => (
                          <div key={step.number} className={`flex items-start gap-4 p-6 rounded-2xl border-2 ${getColorClasses(selectedSectionData.color).border} ${getColorClasses(selectedSectionData.color).bg} transition-all hover:shadow-lg`}>
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${selectedSectionData.gradient} text-white flex items-center justify-center text-xl font-bold shadow-lg`}>
                              {step.number}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h4>
                              <p className="text-gray-600">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Download button */}
              <div className="mt-8 flex justify-center">
                <a
                  href="/docs/USER_GUIDE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:shadow-2xl transition-all hover:scale-105 font-medium"
                >
                  <Download className="w-5 h-5" />
                  تحميل الدليل الكامل
                </a>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-12 text-center">
            <div className="inline-block px-6 py-3 bg-white rounded-2xl shadow-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                <strong>آخر تحديث:</strong> 13 ديسمبر 2025 | 
                <strong className="mr-2">الإصدار:</strong> 1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

