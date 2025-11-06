import { Employee, Company } from '../lib/supabase'

export interface EmployeeAlert {
  id: string
  type: 'contract_expiry' | 'residence_expiry' | 'insurance_expiry'
  priority: 'urgent' | 'medium' | 'low'
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
export function generateEmployeeAlerts(employees: Employee[], companies: Company[]): EmployeeAlert[] {
  const alerts: EmployeeAlert[] = []
  
  employees.forEach(employee => {
    // Add contract expiry alerts
    const contractAlert = checkContractExpiry(employee)
    if (contractAlert) {
      alerts.push(contractAlert)
    }
    
    // Add residence expiry alerts
    const residenceAlert = checkResidenceExpiry(employee)
    if (residenceAlert) {
      alerts.push(residenceAlert)
    }
    
    // Add insurance expiry alerts
    const insuranceAlert = checkInsuranceExpiry(employee)
    if (insuranceAlert) {
      alerts.push(insuranceAlert)
    }
  })
  
  return alerts.sort((a, b) => {
    // Sort by priority (urgent first)
    const priorityOrder = { urgent: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // Then by days remaining (fewest days first)
    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

/**
 * Check contract expiry for employee
 */
export function checkContractExpiry(employee: Employee): EmployeeAlert | null {
  if (!employee.contract_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.contract_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  // No alert if contract is valid for more than 90 days
  if (daysRemaining > 90) {
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
    title = 'عقد منتهي الصلاحية'
    message = `انتهت صلاحية عقد الموظف "${employee.name}" منذ ${daysExpired} يوم. يجب تجديد العقد فوراً لتجنب المشاكل القانونية.`
    actionRequired = `قم بتجديد عقد الموظف "${employee.name}" في أقرب وقت ممكن لضمان استمرار العمل القانوني.`
  } else if (daysRemaining <= 30) {
    priority = 'urgent'
    title = 'عقد ينتهي قريباً'
    message = `ينتهي عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بترتيب تجديد عقد الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= 60) {
    priority = 'medium'
    title = 'عقد ينتهي قريباً'
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
export function checkResidenceExpiry(employee: Employee): EmployeeAlert | null {
  if (!employee.residence_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(employee.residence_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  // No alert if residence is valid for more than 90 days
  if (daysRemaining > 90) {
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
  } else if (daysRemaining <= 7) {
    priority = 'urgent'
    title = 'إقامة تنتهي هذا الأسبوع'
    message = `تنتهي إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديدها فوراً.`
    actionRequired = `قم بترتيب تجديد إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= 30) {
    priority = 'urgent'
    title = 'إقامة تنتهي قريباً'
    message = `تنتهي إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم. يجب تجديدها قريباً.`
    actionRequired = `قم بترتيب تجديد إقامة الموظف "${employee.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= 60) {
    priority = 'medium'
    title = 'إقامة تنتهي قريباً'
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
 * Check insurance expiry for employee
 */
export function checkInsuranceExpiry(employee: Employee): EmployeeAlert | null {
  // This would depend on whether insurance data is stored per employee or per company
  // For now, we'll assume insurance is managed at company level
  
  // Check if we need to add insurance expiry logic here
  // This is a placeholder for now as insurance appears to be company-level
  
  return null
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
  const medium = alerts.filter(a => a.priority === 'medium').length
  const low = alerts.filter(a => a.priority === 'low').length
  const contractAlerts = alerts.filter(a => a.type === 'contract_expiry').length
  const residenceAlerts = alerts.filter(a => a.type === 'residence_expiry').length
  const insuranceAlerts = alerts.filter(a => a.type === 'insurance_expiry').length
  
  return {
    total,
    urgent,
    medium,
    low,
    contractAlerts,
    residenceAlerts,
    insuranceAlerts
  }
}

/**
 * Get urgent employee alerts only
 */
export function getUrgentEmployeeAlerts(alerts: EmployeeAlert[]): EmployeeAlert[] {
  return alerts.filter(alert => alert.priority === 'urgent')
}

/**
 * Get expired employee alerts
 */
export function getExpiredEmployeeAlerts(alerts: EmployeeAlert[]): EmployeeAlert[] {
  return alerts.filter(alert => 
    alert.days_remaining !== undefined && alert.days_remaining < 0
  )
}