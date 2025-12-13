import { useState } from 'react'
import { Shield, Search, Download, Database, Users, Lock, Activity, Settings, HardDrive, CloudDownload, Wrench, AlertTriangle, ChevronLeft, Lightbulb, type LucideIcon } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/contexts/AuthContext'

interface GuideSection {
  id: string
  title: string
  icon: LucideIcon
  color: string
  gradient: string
  content: string
  warnings?: string[]
  tips: string[]
  steps?: {
    number: number
    title: string
    description: string
  }[]
}

export default function AdminGuide() {
  const { isAdmin } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('')

  // Check admin permissions
  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">وصول مقيد</h2>
            <p className="text-gray-600">عذراً، هذا الدليل متاح فقط لمديري النظام.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const guideSections: GuideSection[] = [
    {
      id: 'intro',
      title: 'مرحباً مدير النظام',
      icon: Shield,
      color: 'red',
      gradient: 'from-red-600 to-rose-600',
      content: 'هذا الدليل الشامل مخصص لمديري النظام فقط. يحتوي على معلومات حساسة وإرشادات متقدمة.',
      warnings: [
        'لا تشارك هذا الدليل مع مستخدمين غير مصرح لهم',
        'جميع العمليات المذكورة هنا حساسة وتؤثر على النظام بالكامل',
        'تأكد من فهمك الكامل قبل تنفيذ أي عملية'
      ],
      tips: [
        'احتفظ بنسخة احتياطية قبل أي تغيير كبير',
        'راجع السجلات بانتظام للتأكد من عدم وجود نشاط مريب',
        'طبّق التحديثات الأمنية فوراً'
      ]
    },
    {
      id: 'users',
      title: 'إدارة المستخدمين',
      icon: Users,
      color: 'blue',
      gradient: 'from-blue-600 to-cyan-600',
      content: 'إدارة كاملة لحسابات المستخدمين وصلاحياتهم وأدوارهم.',
      tips: [
        'راجع صلاحيات المستخدمين بشكل دوري',
        'عطّل الحسابات غير النشطة فوراً',
        'استخدم أدوار محددة بدلاً من صلاحيات فردية'
      ],
      steps: [
        { number: 1, title: 'افتح صفحة المستخدمين', description: 'من القائمة الجانبية' },
        { number: 2, title: 'أضف مستخدم جديد', description: 'أدخل البريد الإلكتروني واختر الدور' },
        { number: 3, title: 'تعيين الصلاحيات', description: 'حدد ما يمكنه فعله في النظام' },
        { number: 4, title: 'أرسل الدعوة', description: 'سيستقبل بريد تأكيد للتسجيل' }
      ]
    },
    {
      id: 'permissions',
      title: 'إدارة الأدوار والصلاحيات',
      icon: Lock,
      color: 'purple',
      gradient: 'from-purple-600 to-pink-600',
      content: 'نظام صلاحيات متقدم يتيح لك التحكم الدقيق في ما يمكن لكل مستخدم فعله.',
      tips: [
        'الأدوار الافتراضية: مستخدم (عرض فقط)، محرر (عرض وتعديل)، مدير (كل شيء)',
        'يمكنك إنشاء أدوار مخصصة حسب احتياجاتك',
        'طبّق مبدأ الحد الأدنى من الصلاحيات'
      ],
      steps: [
        { number: 1, title: 'افتح إدارة الأدوار', description: 'من صفحة المستخدمين' },
        { number: 2, title: 'أنشئ دور جديد', description: 'أعطه اسماً ووصفاً واضحين' },
        { number: 3, title: 'اختر الصلاحيات', description: 'حدد ما يمكن لهذا الدور فعله' },
        { number: 4, title: 'عيّن المستخدمين', description: 'أضف المستخدمين لهذا الدور' }
      ]
    },
    {
      id: 'activity-logs',
      title: 'سجل النشاطات',
      icon: Activity,
      color: 'green',
      gradient: 'from-green-600 to-emerald-600',
      content: 'تتبع كامل لجميع العمليات والتغييرات في النظام لأغراض التدقيق والأمان.',
      tips: [
        'راجع السجلات أسبوعياً على الأقل',
        'ابحث عن أنماط غير عادية أو نشاط مريب',
        'صدّر السجلات المهمة واحتفظ بها خارجياً'
      ],
      steps: [
        { number: 1, title: 'افتح سجل النشاطات', description: 'من القائمة الجانبية' },
        { number: 2, title: 'صفّ وبحث', description: 'حسب المستخدم أو العملية أو التاريخ' },
        { number: 3, title: 'راجع التفاصيل', description: 'اضغط على أي سجل لرؤية التفاصيل الكاملة' },
        { number: 4, title: 'صدّر إذا لزم', description: 'لحفظ نسخة للمراجعة المستقبلية' }
      ]
    },
    {
      id: 'settings',
      title: 'الإعدادات العامة',
      icon: Settings,
      color: 'orange',
      gradient: 'from-orange-600 to-amber-600',
      content: 'إعدادات النظام الأساسية والإقليمية والتخصيص.',
      tips: [
        'أي تغيير هنا يؤثر على جميع المستخدمين',
        'اختبر التغييرات في بيئة تجريبية أولاً',
        'احتفظ بسجل للقيم القديمة قبل التعديل'
      ],
      steps: [
        { number: 1, title: 'افتح الإعدادات العامة', description: 'من القائمة الجانبية' },
        { number: 2, title: 'اختر القسم المطلوب', description: 'معلومات المؤسسة، إقليمية، بريد، جلسة، إلخ' },
        { number: 3, title: 'عدّل القيم', description: 'بعناية وتأكد من صحتها' },
        { number: 4, title: 'احفظ واختبر', description: 'تأكد من أن كل شيء يعمل كما متوقع' }
      ]
    },
    {
      id: 'security',
      title: 'الأمان والحماية',
      icon: Lock,
      color: 'red',
      gradient: 'from-red-600 to-red-700',
      content: 'إدارة أمان النظام والحماية من التهديدات.',
      warnings: [
        'الأمان هو أولوية قصوى - لا تتهاون',
        'أي ثغرة أمنية قد تعرض جميع البيانات للخطر',
        'طبّق سياسات كلمات مرور قوية'
      ],
      tips: [
        'فعّل المصادقة الثنائية للحسابات الحساسة',
        'راقب محاولات الدخول الفاشلة',
        'حدّث النظام فوراً عند توفر تحديثات أمنية'
      ],
      steps: [
        { number: 1, title: 'راجع سياسات الأمان', description: 'في إعدادات الأمان' },
        { number: 2, title: 'طبّق القيود المناسبة', description: 'حسب الموقع، الوقت، الجهاز' },
        { number: 3, title: 'راقب السجلات', description: 'ابحث عن نشاط مريب' },
        { number: 4, title: 'اتخذ إجراء فوري', description: 'عند اكتشاف أي تهديد' }
      ]
    },
    {
      id: 'storage',
      title: 'إدارة التخزين',
      icon: HardDrive,
      color: 'teal',
      gradient: 'from-teal-600 to-cyan-600',
      content: 'مراقبة وإدارة مساحة التخزين والملفات المرفوعة.',
      tips: [
        'راقب استخدام التخزين بانتظام',
        'احذف الملفات القديمة غير الضرورية',
        'ضع حدوداً لحجم الملفات المرفوعة'
      ],
      steps: [
        { number: 1, title: 'افتح إدارة التخزين', description: 'من الإعدادات الإدارية' },
        { number: 2, title: 'راجع الاستخدام', description: 'انظر إلى المساحة المستخدمة والمتاحة' },
        { number: 3, title: 'نظّف الملفات', description: 'احذف ما لم يعد ضرورياً' },
        { number: 4, title: 'راقب التنبيهات', description: 'عند الاقتراب من الحد الأقصى' }
      ]
    },
    {
      id: 'backups',
      title: 'النسخ الاحتياطية',
      icon: CloudDownload,
      color: 'indigo',
      gradient: 'from-indigo-600 to-blue-600',
      content: 'إدارة النسخ الاحتياطية واستعادة البيانات.',
      warnings: [
        'النسخ الاحتياطية هي خط الدفاع الأخير - لا تهملها',
        'اختبر الاستعادة دورياً للتأكد من سلامة النسخ',
        'احتفظ بنسخ في مواقع متعددة'
      ],
      tips: [
        'نسخة احتياطية تلقائية يومياً في 2:00 صباحاً',
        'يتم الاحتفاظ بـ 30 نسخة على الأقل',
        'جميع النسخ مشفرة وآمنة'
      ],
      steps: [
        { number: 1, title: 'افتح إدارة النسخ الاحتياطية', description: 'من الإعدادات' },
        { number: 2, title: 'راجع النسخ الموجودة', description: 'تأكد من وجود نسخ حديثة' },
        { number: 3, title: 'أنشئ نسخة يدوياً', description: 'قبل أي تغيير كبير' },
        { number: 4, title: 'اختبر الاستعادة', description: 'ربع سنوياً على الأقل' }
      ]
    },
    {
      id: 'database',
      title: 'صيانة قاعدة البيانات',
      icon: Database,
      color: 'violet',
      gradient: 'from-violet-600 to-purple-600',
      content: 'عمليات الصيانة الدورية لضمان أداء مثالي.',
      tips: [
        'التحسين يشتغل آلياً أسبوعياً',
        'قد تستغرق عملية التحسين عدة ساعات',
        'نفّذها في أوقات الذروة المنخفضة'
      ],
      steps: [
        { number: 1, title: 'افتح أدوات الصيانة', description: 'من الإعدادات الإدارية' },
        { number: 2, title: 'اختر العملية', description: 'تحسين، تنظيف، فحص، تحديث' },
        { number: 3, title: 'راجع التقرير', description: 'بعد اكتمال العملية' },
        { number: 4, title: 'راقب الأداء', description: 'تأكد من التحسن' }
      ]
    },
    {
      id: 'monitoring',
      title: 'المراقبة والتنبيهات',
      icon: AlertTriangle,
      color: 'yellow',
      gradient: 'from-yellow-600 to-orange-600',
      content: 'مراقبة صحة النظام والأداء.',
      tips: [
        'راجع لوحة المراقبة يومياً',
        'اضبط التنبيهات حسب احتياجاتك',
        'تصرف فوراً عند أي تنبيه حرج'
      ],
      steps: [
        { number: 1, title: 'افتح لوحة المراقبة', description: 'من الصفحة الرئيسية الإدارية' },
        { number: 2, title: 'راجع المؤشرات', description: 'سرعة الاستجابة، الأخطاء، الموارد' },
        { number: 3, title: 'اضبط التنبيهات', description: 'حدد متى تريد الإشعار' },
        { number: 4, title: 'راجع التقارير', description: 'يومياً وأسبوعياً وشهرياً' }
      ]
    },
    {
      id: 'maintenance',
      title: 'جدول الصيانة',
      icon: Wrench,
      color: 'gray',
      gradient: 'from-gray-600 to-slate-600',
      content: 'جدول موصى به للصيانة المنتظمة.',
      tips: [
        'اتبع هذا الجدول بانتظام',
        'وثّق جميع عمليات الصيانة',
        'شارك الجدول مع الفريق'
      ],
      steps: [
        { number: 1, title: 'يومياً', description: 'نسخ احتياطية تلقائية' },
        { number: 2, title: 'أسبوعياً', description: 'مراجعة السجلات والتحسين' },
        { number: 3, title: 'شهرياً', description: 'تنظيف البيانات وفحص الأداء' },
        { number: 4, title: 'ربع سنوياً', description: 'مراجعة الصلاحيات واختبار الاستعادة' }
      ]
    }
  ]

  type ColorKey = 'red' | 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'indigo' | 'violet' | 'yellow' | 'gray'

  type ColorClasses = {
    bg: string
    border: string
    text: string
    icon: string
    badge: string
  }

  const colorMap: Record<ColorKey, ColorClasses> = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600', badge: 'bg-green-100 text-green-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-600', badge: 'bg-teal-100 text-teal-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' }
  }

  const getColorClasses = (color: string): ColorClasses => {
    return colorMap[(color as ColorKey)] ?? colorMap.red
  }

  const filteredSections = guideSections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedSectionData = guideSections.find(s => s.id === selectedSection)

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        {/* Modern Header with security theme */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Shield className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">دليل مدير النظام</h1>
                <p className="text-red-100 text-lg">إرشادات متقدمة وحساسة - للمديرين فقط</p>
              </div>
            </div>
            
            {/* Security Warning Badge */}
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-900/50 backdrop-blur-sm rounded-full border-2 border-red-300/30">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">محتوى حساس - لا تشاركه مع غير المصرح لهم</span>
            </div>

            {/* Search Bar */}
            <div className="mt-8 max-w-2xl">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ابحث في دليل الإدارة..."
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
                  {/* Warnings Section */}
                  {selectedSectionData.warnings && selectedSectionData.warnings.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">⚠️ تحذيرات مهمة</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSectionData.warnings.map((warning, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border-2 border-red-200">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                              !
                            </div>
                            <p className="text-red-900 font-medium flex-1">{warning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tips Section */}
                  {selectedSectionData.tips && selectedSectionData.tips.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Lightbulb className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">نصائح للمديرين</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSectionData.tips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold mt-0.5">
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
                      <h3 className="text-xl font-bold text-gray-900 mb-6">خطوات التنفيذ</h3>
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
                  href="/docs/ADMIN_GUIDE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-2xl hover:shadow-2xl transition-all hover:scale-105 font-medium"
                >
                  <Download className="w-5 h-5" />
                  تحميل دليل الإدارة الكامل
                </a>
              </div>
            </div>
          )}

          {/* Footer note with security reminder */}
          <div className="mt-12 space-y-4">
            <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-red-900 mb-2">تذكير أمني مهم</h4>
                  <p className="text-red-800 text-sm leading-relaxed">
                    هذا الدليل يحتوي على معلومات حساسة عن إدارة النظام. تأكد من عدم مشاركته مع أشخاص غير مصرح لهم. 
                    راجع وحدّث هذا الدليل بانتظام مع كل تغيير أو إضافة للنظام.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-block px-6 py-3 bg-white rounded-2xl shadow-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>آخر تحديث:</strong> 13 ديسمبر 2025 | 
                  <strong className="mr-2">الإصدار:</strong> 1.0.0 |
                  <strong className="mr-2">مستوى الوصول:</strong> مديري النظام فقط
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
