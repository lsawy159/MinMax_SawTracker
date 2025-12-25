import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateDaysRemaining,
  calculateCommercialRegistrationStatus,
  calculateSocialInsuranceStatus,
  calculateCommercialRegStats,
  calculateSocialInsuranceStats,
  calculateCompanyStatusStats,
} from '../autoCompanyStatus'

describe('autoCompanyStatus utils', () => {
  let today: Date
  let yesterday: Date
  let tomorrow: Date
  let in5Days: Date
  let in15Days: Date
  let in45Days: Date

  beforeEach(() => {
    today = new Date()
    today.setHours(0, 0, 0, 0)

    yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    in5Days = new Date(today)
    in5Days.setDate(in5Days.getDate() + 5)

    in15Days = new Date(today)
    in15Days.setDate(in15Days.getDate() + 15)

    in45Days = new Date(today)
    in45Days.setDate(in45Days.getDate() + 45)
  })

  describe('calculateDaysRemaining', () => {
    it('should return 0 for null date', () => {
      expect(calculateDaysRemaining(null)).toBe(0)
    })

    it('should return 0 for undefined date', () => {
      expect(calculateDaysRemaining(undefined)).toBe(0)
    })

    it('should return negative for past dates', () => {
      const result = calculateDaysRemaining(yesterday.toISOString())
      expect(result).toBe(-1)
    })

    it('should return 0 for today', () => {
      const result = calculateDaysRemaining(today.toISOString())
      expect(result).toBe(0)
    })

    it('should return positive for future dates', () => {
      const result = calculateDaysRemaining(in5Days.toISOString())
      expect(result).toBe(5)
    })

    it('should handle date strings without time', () => {
      const dateString = '2025-12-31'
      const result = calculateDaysRemaining(dateString)
      expect(typeof result).toBe('number')
    })
  })

  describe('calculateCommercialRegistrationStatus', () => {
    it('should return "غير محدد" status for null date', () => {
      const result = calculateCommercialRegistrationStatus(null)
      
      expect(result.status).toBe('غير محدد')
      expect(result.daysRemaining).toBe(0)
      expect(result.priority).toBe('low')
      expect(result.description).toContain('غير محدد')
    })

    it('should return "غير محدد" status for undefined date', () => {
      const result = calculateCommercialRegistrationStatus(undefined)
      
      expect(result.status).toBe('غير محدد')
      expect(result.daysRemaining).toBe(0)
      expect(result.priority).toBe('low')
    })

    it('should return "منتهي" status for expired date', () => {
      const result = calculateCommercialRegistrationStatus(yesterday.toISOString())
      
      expect(result.status).toBe('منتهي')
      expect(result.daysRemaining).toBeLessThan(0)
      expect(result.priority).toBe('urgent')
      expect(result.description).toContain('منذ')
      expect(result.color.backgroundColor).toBe('bg-red-50')
    })

    it('should return "طارئ" status for 0 days remaining (today)', () => {
      const result = calculateCommercialRegistrationStatus(today.toISOString())
      
      expect(result.status).toBe('طارئ')
      expect(result.daysRemaining).toBe(0)
      expect(result.priority).toBe('urgent')
      expect(result.description).toContain('اليوم')
    })

    it('should return "طارئ" status for 1 day remaining (tomorrow)', () => {
      const result = calculateCommercialRegistrationStatus(tomorrow.toISOString())
      
      expect(result.status).toBe('طارئ')
      expect(result.daysRemaining).toBe(1)
      expect(result.priority).toBe('urgent')
      expect(result.description).toContain('غداً')
    })

    it('should return "طارئ" status for 5 days remaining', () => {
      const result = calculateCommercialRegistrationStatus(in5Days.toISOString())
      
      expect(result.status).toBe('طارئ')
      expect(result.daysRemaining).toBe(5)
      expect(result.priority).toBe('urgent')
      expect(result.color.backgroundColor).toBe('bg-red-50')
    })

    it('should return "عاجل" status for 15 days remaining', () => {
      const result = calculateCommercialRegistrationStatus(in15Days.toISOString())
      
      expect(result.status).toBe('عاجل')
      expect(result.daysRemaining).toBe(15)
      expect(result.priority).toBe('high')
      expect(result.color.backgroundColor).toBe('bg-orange-50')
    })

    it('should return "ساري" status for 45 days remaining', () => {
      const result = calculateCommercialRegistrationStatus(in45Days.toISOString())
      
      expect(result.status).toBe('ساري')
      expect(result.daysRemaining).toBe(45)
      expect(result.priority).toBe('low')
      expect(result.color.backgroundColor).toBe('bg-green-50')
    })

    it('should have correct color properties structure', () => {
      const result = calculateCommercialRegistrationStatus(in45Days.toISOString())
      
      expect(result.color).toHaveProperty('backgroundColor')
      expect(result.color).toHaveProperty('textColor')
      expect(result.color).toHaveProperty('borderColor')
    })

    it('should have correct priorities for different ranges', () => {
      const expiredResult = calculateCommercialRegistrationStatus(yesterday.toISOString())
      const criticalResult = calculateCommercialRegistrationStatus(in5Days.toISOString())
      const mediumResult = calculateCommercialRegistrationStatus(in15Days.toISOString())
      const validResult = calculateCommercialRegistrationStatus(in45Days.toISOString())
      
      expect(expiredResult.priority).toBe('urgent')
      expect(criticalResult.priority).toBe('urgent')
      expect(mediumResult.priority).toBe('high')
      expect(validResult.priority).toBe('low')
    })
  })

  describe('calculateSocialInsuranceStatus', () => {
    it('should return "غير محدد" status for null date', () => {
      const result = calculateSocialInsuranceStatus(null)
      
      expect(result.status).toBe('غير محدد')
      expect(result.daysRemaining).toBe(0)
      expect(result.priority).toBe('low')
      expect(result.description).toContain('غير محدد')
    })

    it('should return "منتهي" status for expired date', () => {
      const result = calculateSocialInsuranceStatus(yesterday.toISOString())
      
      expect(result.status).toBe('منتهي')
      expect(result.daysRemaining).toBeLessThan(0)
      expect(result.priority).toBe('urgent')
      expect(result.description).toContain('انتهى')
    })

    it('should return "طارئ" status for 0 days remaining', () => {
      const result = calculateSocialInsuranceStatus(today.toISOString())
      
      expect(result.status).toBe('طارئ')
      expect(result.daysRemaining).toBe(0)
      expect(result.priority).toBe('urgent')
      expect(result.description).toContain('اليوم')
    })

    it('should return "متوسط" status for 15 days remaining', () => {
      const result = calculateSocialInsuranceStatus(in15Days.toISOString())
      
      expect(result.status).toBe('عاجل')
      expect(result.daysRemaining).toBe(15)
      expect(result.priority).toBe('high')
    })

    it('should return "ساري" status for 45 days remaining', () => {
      const result = calculateSocialInsuranceStatus(in45Days.toISOString())
      
      expect(result.status).toBe('ساري')
      expect(result.daysRemaining).toBe(45)
      expect(result.priority).toBe('low')
    })

    it('should have same structure as commercial registration status', () => {
      const result = calculateSocialInsuranceStatus(in45Days.toISOString())
      
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('daysRemaining')
      expect(result).toHaveProperty('color')
      expect(result).toHaveProperty('description')
      expect(result).toHaveProperty('priority')
    })
  })

  describe('calculateCommercialRegStats', () => {
    it('should return correct stats for empty array', () => {
      const stats = calculateCommercialRegStats([])
      
      expect(stats.total).toBe(0)
      expect(stats.expired).toBe(0)
      expect(stats.urgent).toBe(0)
      expect(stats.high).toBe(0)
      expect(stats.medium).toBe(0)
      expect(stats.valid).toBe(0)
      expect(stats.notSpecified).toBe(0)
    })

    it('should calculate correct stats for mixed companies', () => {
      const companies = [
        { commercial_registration_expiry: yesterday.toISOString().split('T')[0] }, // منتهي
        { commercial_registration_expiry: in5Days.toISOString().split('T')[0] },   // طارئ
        { commercial_registration_expiry: in15Days.toISOString().split('T')[0] },  // متوسط
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },  // ساري
        { commercial_registration_expiry: null },                                    // غير محدد
      ]
      
      const stats = calculateCommercialRegStats(companies)
      
      expect(stats.total).toBe(5)
      expect(stats.expired).toBe(1)
      expect(stats.urgent).toBe(1)
      expect(stats.high).toBe(1)
      expect(stats.medium).toBe(0)
      expect(stats.valid).toBe(1)
      expect(stats.notSpecified).toBe(1)
      expect(stats.notSpecified).toBe(1)
    })

    it('should calculate correct percentages', () => {
      const companies = [
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
      ]
      
      const stats = calculateCommercialRegStats(companies)
      
      expect(stats.percentageValid).toBe(100)
      expect(stats.percentageExpired).toBe(0)
    })

    it('should round percentages correctly', () => {
      const companies = [
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
        { commercial_registration_expiry: in45Days.toISOString().split('T')[0] },
        { commercial_registration_expiry: yesterday.toISOString().split('T')[0] },
      ]
      
      const stats = calculateCommercialRegStats(companies)
      
      // 2/3 = 66.67 -> 67
      expect(stats.percentageValid).toBe(67)
      // 1/3 = 33.33 -> 33
      expect(stats.percentageExpired).toBe(33)
    })

    it('should handle all null dates', () => {
      const companies = [
        { commercial_registration_expiry: null },
        { commercial_registration_expiry: null },
      ]
      
      const stats = calculateCommercialRegStats(companies)
      
      expect(stats.notSpecified).toBe(2)
      expect(stats.percentageNotSpecified).toBe(100)
    })
  })

  describe('calculateSocialInsuranceStats', () => {
    it('should return correct stats for empty array', () => {
      const stats = calculateSocialInsuranceStats([])
      
      expect(stats.total).toBe(0)
      expect(stats.expired).toBe(0)
      expect(stats.urgent).toBe(0)
      expect(stats.high).toBe(0)
      expect(stats.medium).toBe(0)
      expect(stats.valid).toBe(0)
    })

    it('should calculate correct stats for mixed companies', () => {
      const companies = [
        { social_insurance_expiry: yesterday.toISOString().split('T')[0] }, // منتهي
        { social_insurance_expiry: in5Days.toISOString().split('T')[0] },   // طارئ
        { social_insurance_expiry: in15Days.toISOString().split('T')[0] },  // متوسط
        { social_insurance_expiry: in45Days.toISOString().split('T')[0] },  // ساري
      ]
      
      const stats = calculateSocialInsuranceStats(companies)
      
      expect(stats.total).toBe(4)
      expect(stats.expired).toBe(1)
      expect(stats.urgent).toBe(1)
      expect(stats.high).toBe(1)
      expect(stats.medium).toBe(0)
      expect(stats.valid).toBe(1)
    })

    it('should have same structure as commercial reg stats', () => {
      const stats = calculateSocialInsuranceStats([])
      
      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('expired')
      expect(stats).toHaveProperty('urgent')
      expect(stats).toHaveProperty('high')
      expect(stats).toHaveProperty('medium')
      expect(stats).toHaveProperty('valid')
      expect(stats).toHaveProperty('notSpecified')
      expect(stats).toHaveProperty('percentageValid')
      expect(stats).toHaveProperty('percentageExpired')
      expect(stats).toHaveProperty('percentageUrgent')
      expect(stats).toHaveProperty('percentageHigh')
      expect(stats).toHaveProperty('percentageMedium')
      expect(stats).toHaveProperty('percentageNotSpecified')
    })
  })

  describe('calculateCompanyStatusStats', () => {
    it('should return correct combined stats', () => {
      const companies = [
        {
          id: '1',
          name: 'شركة 1',
          commercial_registration_expiry: in45Days.toISOString().split('T')[0],
          social_insurance_expiry: in45Days.toISOString().split('T')[0],
        },
        {
          id: '2',
          name: 'شركة 2',
          commercial_registration_expiry: in5Days.toISOString().split('T')[0],
          social_insurance_expiry: in45Days.toISOString().split('T')[0],
        },
      ]
      
      const stats = calculateCompanyStatusStats(companies)
      
      expect(stats.totalCompanies).toBe(2)
      expect(stats.commercialRegStats.total).toBe(2)
      expect(stats.socialInsuranceStats.total).toBe(2)
    })

    it('should calculate critical alerts correctly', () => {
      const companies = [
        {
          id: '1',
          name: 'شركة طارئة',
          commercial_registration_expiry: in5Days.toISOString().split('T')[0], // طارئ
          social_insurance_expiry: in45Days.toISOString().split('T')[0], // ساري
        },
        {
          id: '2',
          name: 'شركة سارية',
          commercial_registration_expiry: in45Days.toISOString().split('T')[0],
          social_insurance_expiry: in45Days.toISOString().split('T')[0],
        },
      ]
      
      const stats = calculateCompanyStatusStats(companies)
      
      // شركة واحدة لديها تنبيه طارئ
      expect(stats.totalCriticalAlerts).toBe(1)
    })

    it('should calculate medium alerts correctly', () => {
      const companies = [
        {
          id: '1',
          name: 'شركة متوسطة',
          commercial_registration_expiry: in15Days.toISOString().split('T')[0], // عاجل
          social_insurance_expiry: in45Days.toISOString().split('T')[0],
        },
        {
          id: '2',
          name: 'شركة سارية',
          commercial_registration_expiry: in45Days.toISOString().split('T')[0],
          social_insurance_expiry: in45Days.toISOString().split('T')[0],
        },
      ]
      
      const stats = calculateCompanyStatusStats(companies)
      
      expect(stats.totalCriticalAlerts).toBe(0)
    })

    it('should handle companies with null dates', () => {
      const companies = [
        {
          id: '1',
          name: 'شركة بدون تواريخ',
          commercial_registration_expiry: null,
          social_insurance_expiry: null,
        },
      ]
      
      const stats = calculateCompanyStatusStats(companies)
      
      expect(stats.totalCompanies).toBe(1)
      expect(stats.commercialRegStats.notSpecified).toBe(1)
      expect(stats.socialInsuranceStats.notSpecified).toBe(1)
      expect(stats.totalCriticalAlerts).toBe(0)
    })

    it('should handle empty array', () => {
      const stats = calculateCompanyStatusStats([])
      
      expect(stats.totalCompanies).toBe(0)
      expect(stats.totalCriticalAlerts).toBe(0)
      expect(stats.totalMediumAlerts).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle very large days remaining', () => {
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 10)
      
      const result = calculateCommercialRegistrationStatus(farFuture.toISOString())
      
      expect(result.status).toBe('ساري')
      expect(result.daysRemaining).toBeGreaterThan(3000)
    })

    it('should handle very old expired dates', () => {
      const farPast = new Date()
      farPast.setFullYear(farPast.getFullYear() - 1)
      
      const result = calculateCommercialRegistrationStatus(farPast.toISOString())
      
      expect(result.status).toBe('منتهي')
      expect(result.daysRemaining).toBeLessThan(-300)
    })

    it('should handle boundary at 7 days', () => {
      const day7 = new Date(today)
      day7.setDate(day7.getDate() + 7)
      
      const result = calculateCommercialRegistrationStatus(day7.toISOString())
      
      expect(result.status).toBe('طارئ')
      expect(result.daysRemaining).toBe(7)
    })

    it('should handle boundary at 8 days', () => {
      const day8 = new Date(today)
      day8.setDate(day8.getDate() + 8)
      
      const result = calculateCommercialRegistrationStatus(day8.toISOString())
      
      expect(result.status).toBe('عاجل')
      expect(result.daysRemaining).toBe(8)
    })

    it('should handle boundary at 30 days', () => {
      const day30 = new Date(today)
      day30.setDate(day30.getDate() + 30)
      
      const result = calculateCommercialRegistrationStatus(day30.toISOString())
      
      expect(result.status).toBe('متوسط')
      expect(result.daysRemaining).toBe(30)
    })

    it('should handle boundary at 31 days', () => {
      const day31 = new Date(today)
      day31.setDate(day31.getDate() + 31)
      
      const result = calculateCommercialRegistrationStatus(day31.toISOString())
      
      expect(result.status).toBe('ساري')
      expect(result.daysRemaining).toBe(31)
    })
  })
})
