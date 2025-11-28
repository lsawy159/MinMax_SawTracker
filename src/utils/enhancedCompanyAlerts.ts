import { Company } from './alerts'
import { differenceInDays } from 'date-fns'

// Simple enhanced alert interface for compatibility
export interface SimpleEnhancedAlert {
  id: string
  type: 'commercial_registration' | 'social_insurance_expiry'  // تحديث: insurance_subscription → social_insurance_expiry
  priority: 'urgent' | 'medium' | 'low'
  title: string
  message: string
  company: {
    id: string
    name: string
    commercial_registration_number?: string
  }
  expiry_date?: string
  days_remaining?: number
  action_required: string
  created_at: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  estimated_cost?: string
  
  // Enhanced fields for compatibility
  alert_type: 'commercial_registration' | 'social_insurance_expiry' | 'government_docs_renewal'  // تحديث: insurance_subscription → social_insurance_expiry
  document_category: 'legal' | 'financial' | 'operational'
  renewal_complexity: 'simple' | 'moderate' | 'complex'
  estimated_renewal_time: string
  related_documents: string[]
  compliance_risk: 'low' | 'medium' | 'high' | 'critical'
  business_impact: 'minimal' | 'moderate' | 'significant' | 'critical'
  suggested_actions: string[]
  renewal_cost_estimate?: {
    min: number
    max: number
    currency: string
  }
  responsible_department?: string
  renewal_history: any[]
}

// Enhanced thresholds with customizable settings
export interface AlertThresholds {
  commercial_reg: {
    urgent: number
    medium: number
    low: number
  }
  social_insurance: {  // تحديث: insurance → social_insurance
    urgent: number
    medium: number
    low: number
  }
  government_docs: {
    urgent: number
    medium: number
    low: number
  }
}

export const DEFAULT_ENHANCED_THRESHOLDS: AlertThresholds = {
  commercial_reg: { urgent: 30, medium: 60, low: 90 },
  social_insurance: { urgent: 30, medium: 60, low: 90 },  // تحديث: insurance → social_insurance
  government_docs: { urgent: 15, medium: 45, low: 75 }
}

export interface EnhancedAlert {
  id: string
  type: 'commercial_registration' | 'social_insurance_expiry' | 'government_docs_renewal'  // تحديث: insurance_subscription → social_insurance_expiry
  priority: 'urgent' | 'medium' | 'low'
  title: string
  message: string
  company: {
    id: string
    name: string
    commercial_registration_number?: string
  }
  expiry_date?: string
  days_remaining?: number
  action_required: string
  created_at: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  estimated_cost?: string
  alert_type: 'commercial_registration' | 'social_insurance_expiry' | 'government_docs_renewal'  // تحديث: insurance_subscription → social_insurance_expiry
  document_category: 'legal' | 'financial' | 'operational'
  renewal_complexity: 'simple' | 'moderate' | 'complex'
  estimated_renewal_time: string
  related_documents: string[]
  compliance_risk: 'low' | 'medium' | 'high' | 'critical'
  business_impact: 'minimal' | 'moderate' | 'significant' | 'critical'
  suggested_actions: string[]
  renewal_cost_estimate?: {
    min: number
    max: number
    currency: string
  }
  responsible_department?: string
  last_renewal_date?: string
  renewal_history: Array<{
    date: string
    duration: number
    cost?: number
    notes?: string
  }>
}

/**
 * Simple Enhanced Company Alert Generator
 */
export function generateEnhancedCompanyAlerts(companies: Company[]): SimpleEnhancedAlert[] {
  const alerts: SimpleEnhancedAlert[] = []
  
  companies.forEach(company => {
    // Commercial Registration Alerts
    if (company.commercial_registration_expiry) {
      const expiryDate = new Date(company.commercial_registration_expiry)
      const today = new Date()
      const daysRemaining = differenceInDays(expiryDate, today)
      
      if (daysRemaining <= 90 && daysRemaining <= DEFAULT_ENHANCED_THRESHOLDS.commercial_reg.low) {
        const priority = daysRemaining < 0 ? 'urgent' : 
                        daysRemaining <= 30 ? 'urgent' : 
                        daysRemaining <= 60 ? 'medium' : 'low'
        
        alerts.push({
          id: `enhanced_${company.id}_${company.commercial_registration_expiry}`,
          type: 'commercial_registration',
          priority,
          title: 'انتهاء صلاحية السجل التجاري',
          message: `ينتهي السجل التجاري للمؤسسة "${company.name}" ${daysRemaining < 0 ? `منذ ${Math.abs(daysRemaining)} يوم` : `خلال ${daysRemaining} يوم`}`,
          company: {
            id: company.id,
            name: company.name,
            commercial_registration_number: company.commercial_registration_number
          },
          expiry_date: company.commercial_registration_expiry,
          days_remaining: daysRemaining,
          action_required: `قم بترتيب تجديد السجل التجاري للمؤسسة "${company.name}"`,
          created_at: new Date().toISOString(),
          risk_level: daysRemaining < 0 ? 'critical' : 
                     daysRemaining <= 30 ? 'high' : 
                     daysRemaining <= 60 ? 'medium' : 'low',
          estimated_cost: '500 - 2000 ريال',
          
          // Enhanced fields
          alert_type: 'commercial_registration',
          document_category: 'legal',
          renewal_complexity: 'moderate',
          estimated_renewal_time: daysRemaining < 7 ? '1-3 أيام' : '1-2 أسبوع',
          related_documents: ['السجل التجاري', 'الرخصة المهنية', 'التأمين'],
          compliance_risk: daysRemaining < 0 ? 'critical' : 
                          daysRemaining <= 30 ? 'high' : 
                          daysRemaining <= 60 ? 'medium' : 'low',
          business_impact: daysRemaining < 0 ? 'critical' : 
                          daysRemaining <= 30 ? 'significant' : 
                          daysRemaining <= 60 ? 'moderate' : 'minimal',
          suggested_actions: [
            'جمع الوثائق المطلوبة',
            'دفع الرسوم المقررة',
            'مراجعة هيئة التجارة',
            'متابعة حالة الطلب'
          ],
          renewal_cost_estimate: { min: 500, max: 2000, currency: 'SAR' },
          responsible_department: 'Legal Affairs',
          renewal_history: []
        })
      }
    }
    
    // Social Insurance Alerts (التأمينات الاجتماعية للمؤسسات)
    if (company.social_insurance_expiry) {
      const expiryDate = new Date(company.social_insurance_expiry)
      const today = new Date()
      const daysRemaining = differenceInDays(expiryDate, today)
      
      if (daysRemaining <= DEFAULT_ENHANCED_THRESHOLDS.social_insurance.low) {
        const priority = daysRemaining < 0 ? 'urgent' : 
                        daysRemaining <= 30 ? 'urgent' : 
                        daysRemaining <= 60 ? 'medium' : 'low'
        
        alerts.push({
          id: `enhanced_social_insurance_${company.id}_${company.social_insurance_expiry}`,
          type: 'social_insurance_expiry',
          priority,
          title: 'انتهاء صلاحية التأمينات الاجتماعية',
          message: `تنتهي التأمينات الاجتماعية للمؤسسة "${company.name}" ${daysRemaining < 0 ? `منذ ${Math.abs(daysRemaining)} يوم` : `خلال ${daysRemaining} يوم`}`,
          company: {
            id: company.id,
            name: company.name,
            commercial_registration_number: company.commercial_registration_number
          },
          expiry_date: company.social_insurance_expiry,
          days_remaining: daysRemaining,
          action_required: `قم بترتيب تجديد التأمينات الاجتماعية للمؤسسة "${company.name}"`,
          created_at: new Date().toISOString(),
          risk_level: daysRemaining < 0 ? 'critical' : 
                     daysRemaining <= 30 ? 'high' : 
                     daysRemaining <= 60 ? 'medium' : 'low',
          estimated_cost: '2000 - 10000 ريال',
          
          // Enhanced fields
          alert_type: 'social_insurance_expiry',
          document_category: 'financial',
          renewal_complexity: 'simple',
          estimated_renewal_time: daysRemaining < 7 ? '1-2 أيام' : '3-5 أيام',
          related_documents: ['وثيقة التأمينات الاجتماعية', 'الفواتير', 'الشهادات'],
          compliance_risk: daysRemaining < 0 ? 'critical' : 
                          daysRemaining <= 30 ? 'high' : 
                          daysRemaining <= 60 ? 'medium' : 'low',
          business_impact: daysRemaining < 0 ? 'critical' : 
                          daysRemaining <= 30 ? 'significant' : 
                          daysRemaining <= 60 ? 'moderate' : 'minimal',
          suggested_actions: [
            'التواصل مع مؤسسة التأمينات الاجتماعية',
            'مراجعة شروط الوثيقة',
            'دفع قسط التجديد',
            'تأكيد التجديد'
          ],
          renewal_cost_estimate: { min: 2000, max: 10000, currency: 'SAR' },
          responsible_department: 'Finance',
          renewal_history: []
        })
      }
    }
  })
  
  return alerts.sort((a, b) => {
    const priorityOrder = { urgent: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

// Simplified - removed complex functions for build compatibility

// Simplified statistics functions

// Helper functions

function generateCommercialRegActions(days: number, company: Company): string[] {
  const actions = []
  
  if (days < 0) {
    actions.push('اتصل بوزارة التجارة فوراً')
    actions.push('اطلب موعد عاجل لتجديد السجل')
    actions.push('أعد جميع الوثائق المطلوبة')
  } else if (days <= 7) {
    actions.push('احجز موعد فوري لتجديد السجل')
    actions.push('تحقق من صحة جميع الوثائق')
    actions.push('أعد استمارة الطلب مسبقاً')
  } else if (days <= 30) {
    actions.push('احجز موعد لتجديد السجل')
    actions.push('اجمع الوثائق المطلوبة')
    actions.push('تحقق من سريان الوثائق المرتبطة')
  } else {
    actions.push('خطط لتجديد السجل مسبقاً')
    actions.push('راجع متطلبات التجديد')
  }
  
  return actions
}

function generateInsuranceActions(days: number, company: Company): string[] {
  const actions = []
  
  if (days < 0) {
    actions.push('اتصل بشركة التأمين فوراً')
    actions.push('أوقف العمل مؤقتاً لحين التجديد')
    actions.push('أعد استمارة التجديد')
  } else if (days <= 7) {
    actions.push('اتصل بشركة التأمين')
    actions.push('احجز موعد للمقابلة')
    actions.push('أعد الوثائق المطلوبة')
  } else if (days <= 30) {
    actions.push('ابدأ إجراءات التجديد')
    actions.push('تحقق من وثائق التأمين')
    actions.push('احصل على عرض سعر محدث')
  } else {
    actions.push('راجع شروط التأمين الحالية')
    actions.push('قارن العروض المتاحة')
  }
  
  return actions
}

function generateGovDocsActions(days: number, company: Company): string[] {
  const actions = []
  
  if (days < 0) {
    actions.push('اتصل بالجهات الحكومية المختصة')
    actions.push('اطلب موعد عاجل')
    actions.push('أعد جميع الوثائق المطلوبة')
  } else if (days <= 7) {
    actions.push('احجز موعد فوري')
    actions.push('تحقق من متطلبات التجديد')
    actions.push('أعد النماذج مسبقاً')
  } else if (days <= 30) {
    actions.push('ابدأ إجراءات التجديد')
    actions.push('اجمع الوثائق المطلوبة')
    actions.push('احجز موعد في الجهة المختصة')
  } else {
    actions.push('خطط لتجديد الوثائق')
    actions.push('راجع متطلبات التجديد')
  }
  
  return actions
}

function determineRenewalComplexity(company: Company): EnhancedAlert['renewal_complexity'] {
  // Simple logic - could be enhanced with more company attributes
  if (company.commercial_registration_number && company.commercial_registration_number.length > 10) {
    return 'moderate'
  }
  return 'simple'
}

function determineInsuranceComplexity(company: Company): EnhancedAlert['renewal_complexity'] {
  // Insurance renewal is typically moderate complexity
  return 'moderate'
}

function estimateRenewalTime(days: number, complexity: EnhancedAlert['renewal_complexity']): string {
  if (complexity === 'simple') {
    return days < 0 ? '3-5 أيام عمل' : '1-3 أيام عمل'
  } else if (complexity === 'moderate') {
    return days < 0 ? '5-10 أيام عمل' : '3-7 أيام عمل'
  } else {
    return days < 0 ? '10-20 يوم عمل' : '7-15 يوم عمل'
  }
}

function getEnhancedTitle(type: string, days: number): string {
  if (type === 'commercial_registration') {
    if (days < 0) return 'السجل التجاري منتهي'
    if (days <= 7) return 'السجل التجاري عاجل'
    if (days <= 30) return 'تجديد السجل التجاري مطلوب'
    return 'متابعة تجديد السجل التجاري'
  } else if (type === 'social_insurance_expiry') {  // تحديث: insurance_subscription → social_insurance_expiry
    if (days < 0) return 'التأمينات الاجتماعية منتهي'
    if (days <= 7) return 'التأمينات الاجتماعية عاجل'
    if (days <= 30) return 'تجديد التأمينات الاجتماعية مطلوب'
    return 'متابعة تجديد التأمينات الاجتماعية'
  }
  
  return 'تنبيه تجديد الوثائق'
}

function getEnhancedMessage(type: string, days: number, company: Company): string {
  const companyName = company.name
  
  if (type === 'commercial_registration') {
    if (days < 0) {
      return `انتهت صلاحية السجل التجاري للمؤسسة "${companyName}" منذ ${Math.abs(days)} يوم. هذا يؤثر على الوضع القانوني للمؤسسة ويعرضها للمخاطر القانونية والمالية.`
    } else if (days <= 7) {
      return `ينتهي السجل التجاري للمؤسسة "${companyName}" خلال ${days} يوم. يجب تجديده فوراً لضمان استمرار النشاط القانوني.`
    } else if (days <= 30) {
      return `ينتهي السجل التجاري للمؤسسة "${companyName}" خلال ${days} يوم. يُفضل تجديده خلال الأسبوع القادم.`
    } else {
      return `السجل التجاري للمؤسسة "${companyName}" سينتهي خلال ${days} يوم. يمكن البدء في إجراءات التجديد.`
    }
  } else if (type === 'social_insurance_expiry') {  // تحديث: insurance_subscription → social_insurance_expiry
    if (days < 0) {
      return `انتهت صلاحية التأمينات الاجتماعية للمؤسسة "${companyName}" منذ ${Math.abs(days)} يوم. هذا يعرض المؤسسة لمخاطر مالية كبيرة في حالة وقوع أي حوادث.`
    } else if (days <= 7) {
      return `تنتهي التأمينات الاجتماعية للمؤسسة "${companyName}" خلال ${days} يوم. يجب تجديدها فوراً لضمان الحماية المالية.`
    } else if (days <= 30) {
      return `تنتهي التأمينات الاجتماعية للمؤسسة "${companyName}" خلال ${days} يوم. يُفضل تجديدها خلال الأسبوع القادم.`
    } else {
      return `التأمينات الاجتماعية للمؤسسة "${companyName}" ستنتهي خلال ${days} يوم. يمكن البدء في إجراءات التجديد.`
    }
  }
  
  return `تنبيه تجديد الوثائق للمؤسسة "${companyName}"`
}

function getEnhancedActionRequired(type: string, days: number, company: Company): string {
  const companyName = company.name
  
  if (type === 'commercial_registration') {
    if (days < 0) {
      return `قم بترتيب تجديد السجل التجاري للمؤسسة "${companyName}" في أقرب وقت ممكن. تأكد من تجميع جميع الوثائق المطلوبة والحصول على موعد عاجل.`
    } else if (days <= 7) {
      return `قم بترتيب تجديد السجل التجاري للمؤسسة "${companyName}" خلال ${days} يوم القادمة. احجز موعد فوري وأعد جميع الوثائق المطلوبة.`
    } else if (days <= 30) {
      return `قم ببدء إجراءات تجديد السجل التجاري للمؤسسة "${companyName}". احجز موعد خلال الأسبوع القادم.`
    } else {
      return `قم بالتخطيط لتجديد السجل التجاري للمؤسسة "${companyName}" قبل انتهاء المدة.`
    }
  } else if (type === 'social_insurance_expiry') {  // تحديث: insurance_subscription → social_insurance_expiry
    if (days < 0) {
      return `قم بتجديد التأمينات الاجتماعية للمؤسسة "${companyName}" فوراً. اتصل بمؤسسة التأمينات الاجتماعية وأعد الوثائق المطلوبة.`
    } else if (days <= 7) {
      return `قم بترتيب تجديد التأمينات الاجتماعية للمؤسسة "${companyName}" خلال ${days} يوم القادمة.`
    } else if (days <= 30) {
      return `ابدأ إجراءات تجديد التأمينات الاجتماعية للمؤسسة "${companyName}".`
    } else {
      return `راجع شروط التأمينات الاجتماعية الحالية للمؤسسة "${companyName}" وخطط للتجديد.`
    }
  }
  
  return `قم بترتيب تجديد الوثائق للمؤسسة "${companyName}"`
}

function getRelatedDocuments(type: string): string[] {
  if (type === 'commercial_registration') {
    return [
      'السجل التجاري الحالي',
      'بطاقة الهوية للمالك',
      'عقد الإيجار أو سند الملكية',
      'شهادة الزكاة والضريبة',
      'كشف حساب بنكي'
    ]
  } else if (type === 'social_insurance_expiry') {  // تحديث: insurance_subscription → social_insurance_expiry
    return [
      'السجل التجاري',
      'بطاقة الهوية للمالك',
      'شهادة تقدير المخاطر',
      'الفواتير الضريبية الأخيرة',
      'كشف حساب بنكي',
      'وثيقة التأمينات الاجتماعية'
    ]
  } else {
    return [
      'السجل التجاري',
      'بطاقة الهوية',
      'الوثائق الحكومية المطلوبة',
      'الشهادات المهنية',
      'الفاتورة الضريبية'
    ]
  }
}

function getRenewalCostEstimate(type: string): { min: number; max: number; currency: string } {
  if (type === 'commercial_registration') {
    return { min: 500, max: 2000, currency: 'SAR' }
  } else if (type === 'social_insurance_expiry') {  // تحديث: insurance_subscription → social_insurance_expiry
    return { min: 2000, max: 10000, currency: 'SAR' }
  } else {
    return { min: 300, max: 1500, currency: 'SAR' }
  }
}

/**
 * Get alert statistics with enhanced metrics
 */
export function getEnhancedAlertsStats(alerts: EnhancedAlert[]) {
  const total = alerts.length
  const urgent = alerts.filter(a => a.priority === 'urgent').length
  const medium = alerts.filter(a => a.priority === 'medium').length
  const low = alerts.filter(a => a.priority === 'low').length
  
  const byRisk = {
    critical: alerts.filter(a => a.compliance_risk === 'critical').length,
    high: alerts.filter(a => a.compliance_risk === 'high').length,
    medium: alerts.filter(a => a.compliance_risk === 'medium').length,
    low: alerts.filter(a => a.compliance_risk === 'low').length
  }
  
  const byDocumentCategory = {
    legal: alerts.filter(a => a.document_category === 'legal').length,
    financial: alerts.filter(a => a.document_category === 'financial').length,
    operational: alerts.filter(a => a.document_category === 'operational').length
  }
  
  const byBusinessImpact = {
    critical: alerts.filter(a => a.business_impact === 'critical').length,
    significant: alerts.filter(a => a.business_impact === 'significant').length,
    moderate: alerts.filter(a => a.business_impact === 'moderate').length,
    minimal: alerts.filter(a => a.business_impact === 'minimal').length
  }
  
  return {
    total,
    urgent,
    medium,
    low,
    byRisk,
    byDocumentCategory,
    byBusinessImpact,
    commercialRegAlerts: alerts.filter(a => a.alert_type === 'commercial_registration').length,
    socialInsuranceAlerts: alerts.filter(a => a.alert_type === 'social_insurance_expiry').length,  // تحديث: insurance_subscription → social_insurance_expiry
    govDocsAlerts: alerts.filter(a => a.alert_type === 'government_docs_renewal').length
  }
}

/**
 * Filter alerts by multiple criteria
 */
export function filterEnhancedAlertsByMultipleCriteria(
  alerts: EnhancedAlert[], 
  criteria: {
    priority?: EnhancedAlert['priority'][]
    complianceRisk?: EnhancedAlert['compliance_risk'][]
    documentCategory?: EnhancedAlert['document_category'][]
    businessImpact?: EnhancedAlert['business_impact'][]
    alertType?: EnhancedAlert['alert_type'][]
  }
): EnhancedAlert[] {
  return alerts.filter(alert => {
    if (criteria.priority && !criteria.priority.includes(alert.priority)) return false
    if (criteria.complianceRisk && !criteria.complianceRisk.includes(alert.compliance_risk)) return false
    if (criteria.documentCategory && !criteria.documentCategory.includes(alert.document_category)) return false
    if (criteria.businessImpact && !criteria.businessImpact.includes(alert.business_impact)) return false
    if (criteria.alertType && !criteria.alertType.includes(alert.alert_type)) return false
    
    return true
  })
}

/**
 * Get critical alerts that need immediate attention
 */
export function getCriticalAlerts(alerts: EnhancedAlert[]): EnhancedAlert[] {
  return alerts.filter(alert => 
    alert.priority === 'urgent' || 
    alert.compliance_risk === 'critical' || 
    alert.business_impact === 'critical'
  )
}

/**
 * Generate alert summary report
 */
export function generateAlertSummaryReport(alerts: EnhancedAlert[]): {
  total: number
  criticalCount: number
  estimatedRenewalCosts: { min: number; max: number; currency: string }
  departments: Record<string, number>
  timeline: {
    overdue: number
    urgent: number
    upcoming: number
  }
} {
  const stats = getEnhancedAlertsStats(alerts)
  const criticalCount = getCriticalAlerts(alerts).length
  
  const estimatedRenewalCosts = alerts.reduce(
    (total, alert) => {
      if (alert.renewal_cost_estimate) {
        return {
          min: total.min + alert.renewal_cost_estimate.min,
          max: total.max + alert.renewal_cost_estimate.max,
          currency: alert.renewal_cost_estimate.currency
        }
      }
      return total
    },
    { min: 0, max: 0, currency: 'SAR' }
  )
  
  const departments = alerts.reduce((acc, alert) => {
    const dept = alert.responsible_department || 'Unknown'
    acc[dept] = (acc[dept] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const timeline = {
    overdue: alerts.filter(a => (a.days_remaining ?? 0) < 0).length,
    urgent: alerts.filter(a => a.priority === 'urgent').length,
    upcoming: alerts.filter(a => (a.days_remaining ?? 0) > 0).length
  }
  
  return {
    total: stats.total,
    criticalCount,
    estimatedRenewalCosts,
    departments,
    timeline
  }
}
