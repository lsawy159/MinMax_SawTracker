import { differenceInDays } from 'date-fns'

/**
 * حساب عدد الأيام المتبقية على انتهاء تاريخ معين
 */
export const calculateDaysRemaining = (date: string | null | undefined): number => {
  if (!date) return 0
  
  const expiryDate = new Date(date)
  const today = new Date()
  
  // إعادة تعيين الوقت لضمان المقارنة الصحيحة
  today.setHours(0, 0, 0, 0)
  expiryDate.setHours(0, 0, 0, 0)
  
  return differenceInDays(expiryDate, today)
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء السجل التجاري
 * النظام الجديد:
 * - ≤7 أيام: أحمر (حرج)
 * - 8-30 يوم: أصفر (متوسط)
 * - >30 يوم: أخضر (ساري)
 */
export const calculateCommercialRegistrationStatus = (expiryDate: string | null | undefined): {
  status: 'غير محدد' | 'منتهي' | 'حرج' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء السجل التجاري غير محدد',
      priority: 'low'
    }
  }

  const daysRemaining = calculateDaysRemaining(expiryDate)
  
  if (daysRemaining < 0) {
    // منتهي الصلاحية
    const expiredDays = Math.abs(daysRemaining)
    return {
      status: 'منتهي',
      daysRemaining,
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description: `انتهت صلاحية السجل التجاري منذ ${expiredDays} يوم`,
      priority: 'critical'
    }
  } else if (daysRemaining <= 7) {
    // حرج - أقل من أو يساوي 7 أيام
    const description = daysRemaining === 0 
      ? 'ينتهي السجل التجاري اليوم - إجراء فوري مطلوب'
      : daysRemaining === 1
      ? 'ينتهي السجل التجاري غداً - إجراء فوري مطلوب'
      : `ينتهي السجل التجاري خلال ${daysRemaining} أيام - إجراء فوري مطلوب`
    
    return {
      status: 'حرج',
      daysRemaining,
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description,
      priority: 'critical'
    }
  } else if (daysRemaining <= 30) {
    // متوسط - من 8 إلى 30 يوم
    const description = daysRemaining <= 15 
      ? `ينتهي السجل التجاري خلال ${daysRemaining} يوم - متابعة مطلوبة`
      : `ينتهي السجل التجاري خلال شهر - متابعة مطلوبة`
    
    return {
      status: 'متوسط',
      daysRemaining,
      color: {
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      },
      description,
      priority: 'medium'
    }
  } else {
    // ساري - أكثر من 30 يوم
    return {
      status: 'ساري',
      daysRemaining,
      color: {
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      description: `السجل التجاري ساري المفعول (${daysRemaining} يوم متبقي)`,
      priority: 'low'
    }
  }
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء اشتراك التأمينات
 * نفس النظام المستخدم للسجل التجاري
 */
export const calculateInsuranceSubscriptionStatus = (expiryDate: string | null | undefined): {
  status: 'غير محدد' | 'منتهي' | 'حرج' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء اشتراك التأمينات غير محدد',
      priority: 'low'
    }
  }

  const daysRemaining = calculateDaysRemaining(expiryDate)
  
  if (daysRemaining < 0) {
    // منتهي الصلاحية
    const expiredDays = Math.abs(daysRemaining)
    return {
      status: 'منتهي',
      daysRemaining,
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description: `انتهى اشتراك التأمينات منذ ${expiredDays} يوم`,
      priority: 'critical'
    }
  } else if (daysRemaining <= 7) {
    // حرج - أقل من أو يساوي 7 أيام
    const description = daysRemaining === 0 
      ? 'ينتهي اشتراك التأمينات اليوم - إجراء فوري مطلوب'
      : daysRemaining === 1
      ? 'ينتهي اشتراك التأمينات غداً - إجراء فوري مطلوب'
      : `ينتهي اشتراك التأمينات خلال ${daysRemaining} أيام - إجراء فوري مطلوب`
    
    return {
      status: 'حرج',
      daysRemaining,
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description,
      priority: 'critical'
    }
  } else if (daysRemaining <= 30) {
    // متوسط - من 8 إلى 30 يوم
    const description = daysRemaining <= 15 
      ? `ينتهي اشتراك التأمينات خلال ${daysRemaining} يوم - متابعة مطلوبة`
      : `ينتهي اشتراك التأمينات خلال شهر - متابعة مطلوبة`
    
    return {
      status: 'متوسط',
      daysRemaining,
      color: {
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      },
      description,
      priority: 'medium'
    }
  } else {
    // ساري - أكثر من 30 يوم
    return {
      status: 'ساري',
      daysRemaining,
      color: {
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      description: `اشتراك التأمينات ساري المفعول (${daysRemaining} يوم متبقي)`,
      priority: 'low'
    }
  }
}

/**
 * حساب إحصائيات السجل التجاري
 */
export interface CommercialRegStats {
  total: number
  expired: number
  critical: number
  medium: number
  valid: number
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageCritical: number
  percentageMedium: number
  percentageNotSpecified: number
}

export const calculateCommercialRegStats = (companies: Array<{ commercial_registration_expiry: string | null }>): CommercialRegStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    critical: 0,
    medium: 0,
    valid: 0,
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageCritical: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'حرج':
        stats.critical++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageCritical = Math.round((stats.critical / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب إحصائيات اشتراك التأمينات
 */
export interface InsuranceStats {
  total: number
  expired: number
  critical: number
  medium: number
  valid: number
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageCritical: number
  percentageMedium: number
  percentageNotSpecified: number
}

export const calculateInsuranceStats = (companies: Array<{ insurance_subscription_expiry: string | null }>): InsuranceStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    critical: 0,
    medium: 0,
    valid: 0,
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageCritical: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculateInsuranceSubscriptionStatus(company.insurance_subscription_expiry)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'حرج':
        stats.critical++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageCritical = Math.round((stats.critical / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب إحصائيات موحدة للمؤسسة (السجل التجاري + اشتراك التأمينات)
 */
export interface CompanyStatusStats {
  totalCompanies: number
  commercialRegStats: CommercialRegStats
  insuranceStats: InsuranceStats
  totalCriticalAlerts: number
  totalMediumAlerts: number
}

export const calculateCompanyStatusStats = (companies: Array<{
  id: string
  name: string
  commercial_registration_expiry: string | null
  insurance_subscription_expiry: string | null
}>): CompanyStatusStats => {
  const commercialRegCompanies = companies.map(c => ({
    commercial_registration_expiry: c.commercial_registration_expiry
  }))
  
  const insuranceCompanies = companies.map(c => ({
    insurance_subscription_expiry: c.insurance_subscription_expiry
  }))

  const commercialRegStats = calculateCommercialRegStats(commercialRegCompanies)
  const insuranceStats = calculateInsuranceStats(insuranceCompanies)

  // حساب إجمالي التنبيهات الحرجة والمتوسطة
  let totalCriticalAlerts = 0
  let totalMediumAlerts = 0

  companies.forEach(company => {
    const commercialStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    const insuranceStatus = calculateInsuranceSubscriptionStatus(company.insurance_subscription_expiry)
    
    if (commercialStatus.priority === 'critical' || insuranceStatus.priority === 'critical') {
      totalCriticalAlerts++
    }
    
    if (commercialStatus.priority === 'medium' || insuranceStatus.priority === 'medium') {
      totalMediumAlerts++
    }
  })

  return {
    totalCompanies: companies.length,
    commercialRegStats,
    insuranceStats,
    totalCriticalAlerts,
    totalMediumAlerts
  }
}