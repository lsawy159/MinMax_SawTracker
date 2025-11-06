/**
 * إصلاح frontend لمشكلة الإحصائيات
 * 
 * يعمل على تحديث كود loadCompanies() مع إضافة debug logging
 * وإصلاح مشكلة race condition
 */

// 1. تحديث loadCompanies function في Companies.tsx
// ==================================================

const updatedLoadCompanies = `
const loadCompanies = async () => {
  try {
    console.log('🔍 [DEBUG] Starting loadCompanies...');
    
    // فحص حالة الجلسات
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 [DEBUG] User session:', session ? 'authenticated' : 'not authenticated');
    
    if (!session) {
      console.warn('⚠️ [DEBUG] User not authenticated, companies will not load properly');
      setLoading(false);
      return;
    }
    
    console.log('📡 [DEBUG] Fetching companies from database...');
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .order('name')
      
    if (companiesError) {
      console.error('❌ [DEBUG] Companies query error:', companiesError);
      throw companiesError;
    }
    
    console.log('📊 [DEBUG] Companies fetched:', companiesData?.length || 0);
    
    if (!companiesData || companiesData.length === 0) {
      console.warn('⚠️ [DEBUG] No companies found in database');
      setCompanies([]);
      setLoading(false);
      return;
    }
    
    // حساب عدد الموظفين لكل شركة
    console.log('👥 [DEBUG] Calculating employee counts for companies...');
    const companiesWithCount = await Promise.all(
      companiesData.map(async (company, index) => {
        console.log(\`🏢 [DEBUG] Processing company \${index + 1}: \${company.name}\`);
        
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);
          
        const employeeCount = count || 0;
        const maxEmployees = company.max_employees || 4;
        const availableSlots = Math.max(0, maxEmployees - employeeCount);
        
        console.log(\`📈 [DEBUG] \${company.name}: \${employeeCount} employees, \${availableSlots} available slots\`);
        
        return { 
          ...company, 
          employee_count: employeeCount, 
          available_slots: availableSlots 
        };
      })
    );
    
    console.log('✅ [DEBUG] All companies processed, total:', companiesWithCount.length);
    setCompanies(companiesWithCount);
    
    // Extract unique company types
    const typesSet = new Set<string>();
    companiesWithCount.forEach(company => {
      if (company.company_type) {
        typesSet.add(company.company_type);
      }
      if (company.additional_fields?.company_type) {
        typesSet.add(company.additional_fields.company_type);
      }
      if (company.additional_fields?.type) {
        typesSet.add(company.additional_fields.type);
      }
    });
    setCompanyTypes(Array.from(typesSet).sort());
    
    console.log('📋 [DEBUG] Company types extracted:', Array.from(typesSet));
    
  } catch (error) {
    console.error('💥 [DEBUG] Error loading companies:', error);
  } finally {
    setLoading(false);
  }
};`;

// 2. تحديث useEffect مع debug logging
// =====================================

const updatedUseEffect = `
useEffect(() => {
  const initializeData = async () => {
    console.log('🚀 [DEBUG] Initializing Companies page...');
    
    // فحص حالة المصادقة
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 [DEBUG] Current user:', user ? \`\${user.email} (ID: \${user.id})\` : 'not logged in');
    
    await loadCompanies();
    loadSavedFilters();
    console.log('✅ [DEBUG] Companies page initialized');
  };
  
  initializeData();
}, []);`;

// 3. تحديث دالة حساب الإحصائيات مع debug logging
// =================================================

const updatedStatsCalculation = `
// إضافة debug logging في مكان حساب الإحصائيات
{(() => {
  const companyDataForStats = companies.map(c => ({
    id: c.id,
    name: c.name,
    commercial_registration_expiry: c.commercial_registration_expiry,
    insurance_subscription_expiry: c.insurance_subscription_expiry
  }));
  
  console.log('📊 [DEBUG] Calculating stats for companies:', companyDataForStats.length);
  console.log('🏢 [DEBUG] Companies data:', companyDataForStats);
  
  const stats = calculateCompanyStatusStats(companyDataForStats);
  
  console.log('📈 [DEBUG] Calculated stats:', {
    totalCompanies: stats.totalCompanies,
    commercialRegStats: {
      valid: stats.commercialRegStats.valid,
      medium: stats.commercialRegStats.medium,
      critical: stats.commercialRegStats.critical,
      expired: stats.commercialRegStats.expired
    }
  });
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* إجمالي المؤسسات */}
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <div className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</div>
        <div className="text-sm text-gray-600">إجمالي المؤسسات</div>
      </div>
      
      {/* ساري */}
      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="text-2xl font-bold text-green-700">{stats.commercialRegStats.valid}</div>
        <div className="text-sm text-green-600">ساري ({stats.commercialRegStats.percentageValid}%)</div>
      </div>
      
      {/* متوسطة الأهمية */}
      <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="text-2xl font-bold text-yellow-700">{stats.commercialRegStats.medium}</div>
        <div className="text-sm text-yellow-600">متوسطة الأهمية ({stats.commercialRegStats.percentageMedium}%)</div>
      </div>
      
      {/* حرج/منتهي */}
      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
        <div className="text-2xl font-bold text-red-700">{stats.commercialRegStats.critical + stats.commercialRegStats.expired}</div>
        <div className="text-sm text-red-600">حرج/منتهي ({stats.commercialRegStats.percentageCritical + stats.commercialRegStats.percentageExpired}%)</div>
      </div>
    </div>
  );
})()}`;

// 4. ملخص التحديثات المطلوبة
// ============================

const updatesSummary = {
  files: [
    {
      file: 'sawtracker/src/pages/Companies.tsx',
      changes: [
        '1. إضافة debug logging في loadCompanies()',
        '2. إضافة فحص الجلسة في useEffect',
        '3. إضافة logging في حساب الإحصائيات',
        '4. تحسين error handling'
      ]
    }
  ],
  instructions: [
    '1. افتح ملف sawtracker/src/pages/Companies.tsx',
    '2. ابحث عن دالة loadCompanies() (السطر ~130)',
    '3. استبدلها بالكود المحدث في updatedLoadCompanies',
    '4. ابحث عن useEffect (السطر ~58)',
    '5. استبدلها بالكود المحدث في updatedUseEffect',
    '6. ابحث عن قسم الإحصائيات (السطر ~797)',
    '7. أضف debug logging كما في updatedStatsCalculation',
    '8. احفظ الملف وجرب الصفحة في المتصفح',
    '9. افتح Console (F12) وشاهد الـ debug logs'
  ]
};

// 5. ما نتوقعه في Console بعد التحديث
// =====================================

const expectedConsoleOutput = `
🚀 [DEBUG] Initializing Companies page...
👤 [DEBUG] Current user: user@email.com (ID: 123...)
🔍 [DEBUG] Starting loadCompanies...
🔐 [DEBUG] User session: authenticated
📡 [DEBUG] Fetching companies from database...
📊 [DEBUG] Companies fetched: 16
👥 [DEBUG] Calculating employee counts for companies...
🏢 [DEBUG] Processing company 1: شركة محمد النفيعي للتشغيل والصيانة
📈 [DEBUG] company 1: 2 employees, 2 available slots
... (كرار لـ 15 شركة أخرى)
✅ [DEBUG] All companies processed, total: 16
📋 [DEBUG] Company types extracted: ['شركة تشغيل وصيانة', 'مقاولات', ...]
📊 [DEBUG] Calculating stats for companies: 16
🏢 [DEBUG] Companies data: [array of 16 companies with dates]
📈 [DEBUG] Calculated stats: {
  totalCompanies: 16,
  commercialRegStats: { valid: 12, medium: 3, critical: 1, expired: 0 }
}
`;

// 6. الاختبار
// ============

const testingSteps = [
  '1. تطبيق ملف fix_companies_stats_complete.sql في Supabase',
  '2. تحديث كود Companies.tsx بالـ debug logging',
  '3. فتح الصفحة في المتصفح',
  '4. فتح Console (F12) ومراقبة الـ debug logs',
  '5. التأكد من أن:',
  '   - الشركات تُحمل بنجاح (16 شركة)',
  '   - الإحصائيات تُحسب بشكل صحيح',
  '   - لا توجد أخطاء في Console'
];

console.log('🔧 إصلاح Frontend لمشكلة الإحصائيات');
console.log('📋 ملخص التحديثات:', updatesSummary);
console.log('🎯 ما نتوقعه في Console:', expectedConsoleOutput);
console.log('🧪 خطوات الاختبار:', testingSteps);