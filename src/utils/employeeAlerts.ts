import { Employee, Company } from '../lib/supabase'
import { supabase } from '../lib/supabase'

export interface EmployeeAlert {
  id: string
  type: 'contract_expiry' | 'residence_expiry' | 'health_insurance_expiry' | 'hired_worker_contract_expiry'  // تحديث: insurance_expiry → health_insurance_expiry
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  employee: {
    id: string
    name: string
    profession: string
    nationality: string
    company_id: string
  }
  company: {
    id: string
    name: string
    commercial_registration_number?: string
  }
  expiry_date?: string
  days_remaining?: number
  action_required: string
  created_at: string
}

/**
 * Generate alerts for employee document expirations
 */
export async function generateEmployeeAlerts(employees: Employee[], companies: Company[]): Promise<EmployeeAlert[]> {
  const alerts: EmployeeAlert[] = []
  
  for (const employee of employees) {
    // Add contract expiry alerts
    const contractAlert = await checkContractExpiry(employee)
    if (contractAlert) {
      alerts.push(contractAlert)
    }
    
    // Add residence expiry alerts
    const residenceAlert = await checkResidenceExpiry(employee)
    if (residenceAlert) {
      alerts.push(residenceAlert)
    }
    
    // Add health insurance expiry alerts
    const healthInsuranceAlert = await checkHealthInsuranceExpiry(employee)
    if (healthInsuranceAlert) {
      alerts.push(healthInsuranceAlert)
    }
    
    // Add hired worker contract expiry alerts
    const hiredWorkerContractAlert = await checkHiredWorkerContractExpiry(employee)
    if (hiredWorkerContractAlert) {
      alerts.push(hiredWorkerContractAlert)
    }
  }
  
  return alerts.sort((a, b) => {
    // Sort by priority (urgent first)
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // Then by days remaining (fewest days first)
    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

// Default thresholds for employee alerts
const DEFAULT_EMPLOYEE_THRESHOLDS = {
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,
  hired_worker_contract_urgent_days: 7,
  hired_worker_contract_high_days: 15,
  hired_worker_contract_medium_days: 30
}

// Cache for employee notification thresholds
let employeeThresholdsCache: typeof DEFAULT_EMPLOYEE_THRESHOLDS | null = null
let employeeCacheTimestamp: number = 0
const EMPLOYEE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// Function to invalidate the cache (call this when settings are saved)
export function invalidateEmployeeNotificationThresholdsCache() {
  employeeThresholdsCache = null
  employeeCacheTimestamp = 0
}

// Get notification thresholds from database settings with caching
async function getEmployeeNotificationThresholds() {
  // Check if cache is valid
  const now = Date.now()
  if (employeeThresholdsCache && (now - employeeCacheTimestamp) < EMPLOYEE_CACHE_TTL) {
    return employeeThresholdsCache
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_thresholds')
      .maybeSingle()

    if (error || !data || !data.setting_value) {
      console.log('Using default employee notification thresholds')
      // Cache the defaults
      employeeThresholdsCache = DEFAULT_EMPLOYEE_THRESHOLDS
      employeeCacheTimestamp = now
      return DEFAULT_EMPLOYEE_THRESHOLDS
    }

    // Merge with defaults to ensure all required fields exist
    const mergedThresholds = { ...DEFAULT_EMPLOYEE_THRESHOLDS, ...data.setting_value }
    // Update cache
    employeeThresholdsCache = mergedThresholds
    employeeCacheTimestamp = now
    return mergedThresholds
  } catch (error) {
    console.error('Error loading employee notification thresholds:', error)
    // Cache the defaults on error
    employeeThresholdsCache = DEFAULT_EMPLOYEE_THRESHOLDS
    employeeCacheTimestamp = now
    return DEFAULT_EMPLOYEE_THRESHOLDS
  }
}

/**
 * Check contract expiry for employee
 */
export async function checkContractExpiry(employee: Employee): Promise<EmployeeAlert | null> {
  if (!employee.contract_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.contract_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getEmployeeNotificationThresholds()
  
  // No alert if contract is valid for more than medium threshold
  if (daysRemaining > thresholds.contract_medium_days) {
    return null
  }
  
  // Determine priority based on days remaining
  let priority: EmployeeAlert['priority']
  let title: string
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    title = 'عقد منتهي'
    message = `انتهت صلاحية عقد الموظف "${employee.name}" منذ ${daysExpired} يوم. يجب تجديد العقد فوراً لتجنب المشاكل القانونية.`
    actionRequired = `قم بتجديد عقد الموظف "${employee.name}" في أقرب وقت ممكن لضمان استمرار العمل القانوني.`
  } else if (daysRemaining <= thresholds.contract_urgent_days) {
    priority = 'urgent'
    title = 'انتهاء عقد'
    message = `ينتهي عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بترتيب تجديد عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= (thresholds.contract_high_days || thresholds.contract_urgent_days + 8)) {
    priority = 'high'
    title = 'انتهاء عقد'
    message = `ينتهي عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده قريباً.`
    actionRequired = `قم بترتيب تجديد عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= thresholds.contract_medium_days) {
    priority = 'medium'
    title = 'انتهاء عقد'
    message = `ينتهي عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم. يفضل تجديده قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد عقد الموظف "${employee.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    title = 'متابعة العقد'
    message = `عقد الموظف "${employee.name}" سينتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد عقد الموظف "${employee.name}" عند الحاجة.`
  }
  
  return {
    id: `contract_${employee.id}_${employee.contract_expiry}`,
    type: 'contract_expiry',
    priority,
    title,
    message,
    employee: {
      id: employee.id,
      name: employee.name,
      profession: employee.profession,
      nationality: employee.nationality,
      company_id: employee.company_id
    },
    company: {
      id: '', // Will be populated when generating alerts
      name: '',
      commercial_registration_number: ''
    },
    expiry_date: employee.contract_expiry,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * Check residence expiry for employee
 */
export async function checkResidenceExpiry(employee: Employee): Promise<EmployeeAlert | null> {
  if (!employee.residence_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.residence_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getEmployeeNotificationThresholds()
  
  // No alert if residence is valid for more than medium threshold
  if (daysRemaining > thresholds.residence_medium_days) {
    return null
  }
  
  // Determine priority based on days remaining
  let priority: EmployeeAlert['priority']
  let title: string
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    title = 'إقامة منتهية الصلاحية'
    message = `انتهت صلاحية إقامة الموظف "${employee.name}" منذ ${daysExpired} يوم. يجب تجديدها فوراً لتجنب المشاكل القانونية.`
    actionRequired = `قم بتجديد إقامة الموظف "${employee.name}" في أقرب وقت ممكن لضمان وضعه القانوني.`
  } else if (daysRemaining <= thresholds.residence_urgent_days) {
    priority = 'urgent'
    title = 'إقامة تنتهي هذا الأسبوع'
    message = `تنتهي إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديدها فوراً.`
    actionRequired = `قم بترتيب تجديد إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= (thresholds.residence_high_days || thresholds.residence_urgent_days + 8)) {
    priority = 'high'
    title = 'إقامة عاجل'
    message = `تنتهي إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديدها قريباً.`
    actionRequired = `قم بترتيب تجديد إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= thresholds.residence_medium_days) {
    priority = 'medium'
    title = 'إقامة عاجل'
    message = `تنتهي إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم. يفضل تجديدها قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد إقامة الموظف "${employee.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    title = 'متابعة الإقامة'
    message = `إقامة الموظف "${employee.name}" ستنتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد إقامة الموظف "${employee.name}" عند الحاجة.`
  }
  
  return {
    id: `residence_${employee.id}_${employee.residence_expiry}`,
    type: 'residence_expiry',
    priority,
    title,
    message,
    employee: {
      id: employee.id,
      name: employee.name,
      profession: employee.profession,
      nationality: employee.nationality,
      company_id: employee.company_id
    },
    company: {
      id: '', // Will be populated when generating alerts
      name: '',
      commercial_registration_number: ''
    },
    expiry_date: employee.residence_expiry,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * فحص انتهاء صلاحية التأمين الصحي للموظف
 */
export async function checkHealthInsuranceExpiry(employee: Employee): Promise<EmployeeAlert | null> {
  // فحص التأمين الصحي للموظف (ليس التأمينات الاجتماعية للمؤسسة)
  if (!employee.health_insurance_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.health_insurance_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getEmployeeNotificationThresholds()
  
  // لا يوجد تنبيه إذا كان التأمين الصحي سارياً لأكثر من medium threshold
  if (daysRemaining > thresholds.health_insurance_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  let priority: EmployeeAlert['priority']
  let title: string
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    title = 'التأمين الصحي منتهي'
    message = `انتهت صلاحية التأمين الصحي للموظف "${employee.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً لتجنب المشاكل الصحية والقانونية.`
    actionRequired = `قم بتجديد التأمين الصحي للموظف "${employee.name}" في أقرب وقت ممكن لضمان حمايته الصحية.`
  } else if (daysRemaining <= thresholds.health_insurance_urgent_days) {
    priority = 'urgent'
    title = 'التأمين الصحي عاجل'
    message = `ينتهي التأمين الصحي للموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بترتيب تجديد التأمين الصحي للموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= (thresholds.health_insurance_high_days || thresholds.health_insurance_urgent_days + 15)) {
    priority = 'high'
    title = 'التأمين الصحي عاجل'
    message = `ينتهي التأمين الصحي للموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده قريباً.`
    actionRequired = `قم بترتيب تجديد التأمين الصحي للموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= thresholds.health_insurance_medium_days) {
    priority = 'medium'
    title = 'التأمين الصحي عاجل'
    message = `ينتهي التأمين الصحي للموظف "${employee.name}" خلال ${daysRemaining} يوم. يفضل تجديده قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد التأمين الصحي للموظف "${employee.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    title = 'متابعة التأمين الصحي'
    message = `التأمين الصحي للموظف "${employee.name}" سينتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد التأمين الصحي للموظف "${employee.name}" عند الحاجة.`
  }
  
  return {
    id: `health_insurance_${employee.id}_${employee.health_insurance_expiry}`,
    type: 'health_insurance_expiry',
    priority,
    title,
    message,
    employee: {
      id: employee.id,
      name: employee.name,
      profession: employee.profession,
      nationality: employee.nationality,
      company_id: employee.company_id
    },
    company: {
      id: '', // Will be populated when generating alerts
      name: '',
      commercial_registration_number: ''
    },
    expiry_date: employee.health_insurance_expiry,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * Check hired worker contract expiry for employee
 */
export async function checkHiredWorkerContractExpiry(employee: Employee): Promise<EmployeeAlert | null> {
  if (!employee.hired_worker_contract_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.hired_worker_contract_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getEmployeeNotificationThresholds()
  
  // استخدام إعدادات عقد أجير المخصصة، أو استخدام إعدادات العقد العادية كبديل
  const urgentDays = thresholds.hired_worker_contract_urgent_days ?? thresholds.contract_urgent_days
  const highDays = thresholds.hired_worker_contract_high_days ?? thresholds.contract_high_days
  const mediumDays = thresholds.hired_worker_contract_medium_days ?? thresholds.contract_medium_days
  
  // No alert if contract is valid for more than medium threshold
  if (daysRemaining > mediumDays) {
    return null
  }
  
  // Determine priority based on days remaining
  let priority: EmployeeAlert['priority']
  let title: string
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    title = 'عقد أجير منتهي'
    message = `انتهت صلاحية عقد أجير الموظف "${employee.name}" منذ ${daysExpired} يوم. يجب تجديد العقد فوراً لتجنب المشاكل القانونية.`
    actionRequired = `قم بتجديد عقد أجير الموظف "${employee.name}" في أقرب وقت ممكن لضمان استمرار العمل القانوني.`
  } else if (daysRemaining <= urgentDays) {
    priority = 'urgent'
    title = 'انتهاء عقد أجير'
    message = `ينتهي عقد أجير الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بترتيب تجديد عقد أجير الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= (highDays || urgentDays + 8)) {
    priority = 'high'
    title = 'انتهاء عقد أجير'
    message = `ينتهي عقد أجير الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده قريباً.`
    actionRequired = `قم بترتيب تجديد عقد أجير الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= mediumDays) {
    priority = 'medium'
    title = 'انتهاء عقد أجير'
    message = `ينتهي عقد أجير الموظف "${employee.name}" خلال ${daysRemaining} يوم. يفضل تجديده قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد عقد أجير الموظف "${employee.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    title = 'متابعة عقد أجير'
    message = `عقد أجير الموظف "${employee.name}" سينتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد عقد أجير الموظف "${employee.name}" عند الحاجة.`
  }
  
  return {
    id: `hired_worker_contract_${employee.id}_${employee.hired_worker_contract_expiry}`,
    type: 'hired_worker_contract_expiry',
    priority,
    title,
    message,
    employee: {
      id: employee.id,
      name: employee.name,
      profession: employee.profession,
      nationality: employee.nationality,
      company_id: employee.company_id
    },
    company: {
      id: '', // Will be populated when generating alerts
      name: '',
      commercial_registration_number: ''
    },
    expiry_date: employee.hired_worker_contract_expiry,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * Check insurance expiry for employee (deprecated - use checkHealthInsuranceExpiry instead)
 * @deprecated Use checkHealthInsuranceExpiry instead
 */
export async function checkInsuranceExpiry(employee: Employee): Promise<EmployeeAlert | null> {
  return checkHealthInsuranceExpiry(employee)
}

/**
 * Populate company information for employee alerts
 */
export function enrichEmployeeAlertsWithCompanyData(alerts: EmployeeAlert[], companies: Company[]): EmployeeAlert[] {
  return alerts.map(alert => {
    const company = companies.find(c => c.id === alert.employee.company_id)
    if (company) {
      return {
        ...alert,
        company: {
          id: company.id,
          name: company.name,
          commercial_registration_number: company.commercial_registration_expiry
        }
      }
    }
    return alert
  })
}

/**
 * Filter employee alerts by priority
 */
export function filterEmployeeAlertsByPriority(alerts: EmployeeAlert[], priority: EmployeeAlert['priority']): EmployeeAlert[] {
  return alerts.filter(alert => alert.priority === priority)
}

/**
 * Filter employee alerts by type
 */
export function filterEmployeeAlertsByType(alerts: EmployeeAlert[], type: EmployeeAlert['type']): EmployeeAlert[] {
  return alerts.filter(alert => alert.type === type)
}

/**
 * Get employee alerts statistics
 */
export function getEmployeeAlertsStats(alerts: EmployeeAlert[]) {
  const total = alerts.length
  const urgent = alerts.filter(a => a.priority === 'urgent').length
  const high = alerts.filter(a => a.priority === 'high').length
  const medium = alerts.filter(a => a.priority === 'medium').length
  const low = alerts.filter(a => a.priority === 'low').length
  const contractAlerts = alerts.filter(a => a.type === 'contract_expiry').length
  const residenceAlerts = alerts.filter(a => a.type === 'residence_expiry').length
  const healthInsuranceAlerts = alerts.filter(a => a.type === 'health_insurance_expiry').length
  const hiredWorkerContractAlerts = alerts.filter(a => a.type === 'hired_worker_contract_expiry').length
  
  return {
    total,
    urgent,
    high,
    medium,
    low,
    contractAlerts,
    residenceAlerts,
    healthInsuranceAlerts,  // بدلاً من insuranceAlerts
    hiredWorkerContractAlerts
  }
}

/**
 * Get urgent and high priority employee alerts only
 */
export function getUrgentEmployeeAlerts(alerts: EmployeeAlert[]): EmployeeAlert[] {
  return alerts.filter(alert => alert.priority === 'urgent' || alert.priority === 'high')
}

/**
 * Get expired employee alerts
 */
export function getExpiredEmployeeAlerts(alerts: EmployeeAlert[]): EmployeeAlert[] {
  return alerts.filter(alert => 
    alert.days_remaining !== undefined && alert.days_remaining < 0
  )
}