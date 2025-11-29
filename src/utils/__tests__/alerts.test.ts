import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateCompanyAlertsSync,
  filterAlertsByPriority,
  filterAlertsByType,
  getAlertsStats,
  getUrgentAlerts,
  getExpiredAlerts,
  type Company,
} from '../alerts'
import { type Alert } from '../../components/alerts/AlertCard'

describe('alerts utils', () => {
  let mockCompanies: Company[]
  let mockAlerts: Alert[]

  beforeEach(() => {
    // إعداد شركات تجريبية
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const in5Days = new Date(today)
    in5Days.setDate(in5Days.getDate() + 5)
    const in15Days = new Date(today)
    in15Days.setDate(in15Days.getDate() + 15)
    const in45Days = new Date(today)
    in45Days.setDate(in45Days.getDate() + 45)
    const in90Days = new Date(today)
    in90Days.setDate(in90Days.getDate() + 90)

    mockCompanies = [
      {
        id: '1',
        name: 'شركة منتهية',
        commercial_registration_expiry: yesterday.toISOString().split('T')[0],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: '2',
        name: 'شركة عاجلة',
        commercial_registration_expiry: in5Days.toISOString().split('T')[0],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: '3',
        name: 'شركة متوسطة',
        commercial_registration_expiry: in45Days.toISOString().split('T')[0],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: '4',
        name: 'شركة سارية',
        commercial_registration_expiry: in90Days.toISOString().split('T')[0],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]

    // إعداد تنبيهات تجريبية
    mockAlerts = [
      {
        id: '1',
        type: 'commercial_registration',
        priority: 'urgent',
        title: 'تنبيه عاجل 1',
        message: 'رسالة تجريبية',
        company: { id: '1', name: 'شركة 1' },
        expiry_date: yesterday.toISOString().split('T')[0],
        days_remaining: -1,
        action_required: 'تجديد فوري',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'social_insurance_expiry',
        priority: 'urgent',
        title: 'تنبيه عاجل 2',
        message: 'رسالة تجريبية',
        company: { id: '2', name: 'شركة 2' },
        expiry_date: in5Days.toISOString().split('T')[0],
        days_remaining: 5,
        action_required: 'تجديد قريب',
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'commercial_registration',
        priority: 'medium',
        title: 'تنبيه متوسط',
        message: 'رسالة تجريبية',
        company: { id: '3', name: 'شركة 3' },
        expiry_date: in45Days.toISOString().split('T')[0],
        days_remaining: 45,
        action_required: 'مراجعة',
        created_at: new Date().toISOString(),
      },
      {
        id: '4',
        type: 'social_insurance_expiry',
        priority: 'low',
        title: 'تنبيه خفيف',
        message: 'رسالة تجريبية',
        company: { id: '4', name: 'شركة 4' },
        expiry_date: in90Days.toISOString().split('T')[0],
        days_remaining: 90,
        action_required: 'متابعة',
        created_at: new Date().toISOString(),
      },
    ]
  })

  describe('generateCompanyAlertsSync', () => {
    it('should generate alerts for companies with expiring commercial registration', async () => {
      const alerts = await generateCompanyAlertsSync(mockCompanies)
      
      expect(alerts).toBeDefined()
      expect(Array.isArray(alerts)).toBe(true)
      
      // يجب أن تكون هناك تنبيهات للشركات التي ستنتهي خلال 60 يوم
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('should sort alerts by priority and days remaining', async () => {
      const alerts = await generateCompanyAlertsSync(mockCompanies)
      
      // التنبيهات العاجلة يجب أن تكون أولاً
      const priorities = alerts.map(a => a.priority)
      const firstUrgentIndex = priorities.indexOf('urgent')
      const firstMediumIndex = priorities.indexOf('medium')
      
      if (firstUrgentIndex !== -1 && firstMediumIndex !== -1) {
        expect(firstUrgentIndex).toBeLessThan(firstMediumIndex)
      }
    })

    it('should set correct priority based on days remaining', async () => {
      const alerts = await generateCompanyAlertsSync(mockCompanies)
      
      alerts.forEach(alert => {
        if (alert.days_remaining !== undefined) {
          if (alert.days_remaining < 0 || alert.days_remaining <= 30) {
            expect(alert.priority).toBe('urgent')
          } else if (alert.days_remaining <= 45) {
            expect(alert.priority).toBe('high')
          } else if (alert.days_remaining <= 60) {
            expect(alert.priority).toBe('medium')
          } else {
            expect(alert.priority).toBe('low')
          }
        }
      })
    })

    it('should not generate alerts for companies without expiry dates', async () => {
      const companiesWithoutDates: Company[] = [
        {
          id: '5',
          name: 'شركة بدون تواريخ',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]
      
      const alerts = await generateCompanyAlertsSync(companiesWithoutDates)
      expect(alerts.length).toBe(0)
    })

    it('should include required fields in each alert', async () => {
      const alerts = await generateCompanyAlertsSync(mockCompanies)
      
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('id')
        expect(alert).toHaveProperty('type')
        expect(alert).toHaveProperty('priority')
        expect(alert).toHaveProperty('title')
        expect(alert).toHaveProperty('message')
        expect(alert).toHaveProperty('company')
        expect(alert).toHaveProperty('expiry_date')
        expect(alert).toHaveProperty('days_remaining')
        expect(alert).toHaveProperty('action_required')
        expect(alert).toHaveProperty('created_at')
      })
    })
  })

  describe('filterAlertsByPriority', () => {
    it('should filter alerts by urgent priority', () => {
      const urgentAlerts = filterAlertsByPriority(mockAlerts, 'urgent')
      
      expect(urgentAlerts.length).toBe(2)
      urgentAlerts.forEach(alert => {
        expect(alert.priority).toBe('urgent')
      })
    })

    it('should filter alerts by medium priority', () => {
      const mediumAlerts = filterAlertsByPriority(mockAlerts, 'medium')
      
      expect(mediumAlerts.length).toBe(1)
      expect(mediumAlerts[0].priority).toBe('medium')
    })

    it('should filter alerts by low priority', () => {
      const lowAlerts = filterAlertsByPriority(mockAlerts, 'low')
      
      expect(lowAlerts.length).toBe(1)
      expect(lowAlerts[0].priority).toBe('low')
    })

    it('should return empty array if no alerts match priority', () => {
      const emptyAlerts = filterAlertsByPriority([], 'urgent')
      expect(emptyAlerts).toEqual([])
    })
  })

  describe('filterAlertsByType', () => {
    it('should filter alerts by commercial_registration type', () => {
      const commercialAlerts = filterAlertsByType(mockAlerts, 'commercial_registration')
      
      expect(commercialAlerts.length).toBe(2)
      commercialAlerts.forEach(alert => {
        expect(alert.type).toBe('commercial_registration')
      })
    })

    it('should filter alerts by social_insurance_expiry type', () => {
      const insuranceAlerts = filterAlertsByType(mockAlerts, 'social_insurance_expiry')
      
      expect(insuranceAlerts.length).toBe(2)
      insuranceAlerts.forEach(alert => {
        expect(alert.type).toBe('social_insurance_expiry')
      })
    })

    it('should return empty array if no alerts match type', () => {
      const emptyAlerts = filterAlertsByType([], 'commercial_registration')
      expect(emptyAlerts).toEqual([])
    })
  })

  describe('getAlertsStats', () => {
    it('should return correct statistics', () => {
      const stats = getAlertsStats(mockAlerts)
      
      expect(stats.total).toBe(4)
      expect(stats.urgent).toBe(2)
      expect(stats.medium).toBe(1)
      expect(stats.low).toBe(1)
      expect(stats.commercialRegAlerts).toBe(2)
      expect(stats.socialInsuranceAlerts).toBe(2)
    })

    it('should return zeros for empty alerts array', () => {
      const stats = getAlertsStats([])
      
      expect(stats.total).toBe(0)
      expect(stats.urgent).toBe(0)
      expect(stats.medium).toBe(0)
      expect(stats.low).toBe(0)
      expect(stats.commercialRegAlerts).toBe(0)
      expect(stats.socialInsuranceAlerts).toBe(0)
    })

    it('should count correctly with mixed priorities', () => {
      const mixedAlerts: Alert[] = [
        { ...mockAlerts[0], priority: 'urgent' },
        { ...mockAlerts[1], priority: 'urgent' },
        { ...mockAlerts[2], priority: 'urgent' },
      ]
      
      const stats = getAlertsStats(mixedAlerts)
      expect(stats.urgent).toBe(3)
      expect(stats.medium).toBe(0)
      expect(stats.low).toBe(0)
    })
  })

  describe('getUrgentAlerts', () => {
    it('should return only urgent alerts', () => {
      const urgentAlerts = getUrgentAlerts(mockAlerts)
      
      expect(urgentAlerts.length).toBe(2)
      urgentAlerts.forEach(alert => {
        expect(alert.priority).toBe('urgent')
      })
    })

    it('should return empty array if no urgent alerts', () => {
      const nonUrgentAlerts = mockAlerts.filter(a => a.priority !== 'urgent')
      const urgentAlerts = getUrgentAlerts(nonUrgentAlerts)
      
      expect(urgentAlerts).toEqual([])
    })

    it('should maintain alert order', () => {
      const urgentAlerts = getUrgentAlerts(mockAlerts)
      
      // التحقق من أن الترتيب الأصلي محفوظ
      expect(urgentAlerts[0].id).toBe('1')
      expect(urgentAlerts[1].id).toBe('2')
    })
  })

  describe('getExpiredAlerts', () => {
    it('should return only expired alerts', () => {
      const expiredAlerts = getExpiredAlerts(mockAlerts)
      
      expect(expiredAlerts.length).toBe(1)
      expiredAlerts.forEach(alert => {
        expect(alert.days_remaining).toBeLessThan(0)
      })
    })

    it('should not include alerts with positive days remaining', () => {
      const expiredAlerts = getExpiredAlerts(mockAlerts)
      
      expiredAlerts.forEach(alert => {
        expect(alert.days_remaining).not.toBeGreaterThanOrEqual(0)
      })
    })

    it('should return empty array if no expired alerts', () => {
      const nonExpiredAlerts = mockAlerts.filter(a => 
        a.days_remaining === undefined || a.days_remaining >= 0
      )
      const expiredAlerts = getExpiredAlerts(nonExpiredAlerts)
      
      expect(expiredAlerts).toEqual([])
    })

    it('should handle undefined days_remaining', () => {
      const alertsWithUndefined: Alert[] = [
        ...mockAlerts,
        {
          ...mockAlerts[0],
          id: '5',
          days_remaining: undefined,
        },
      ]
      
      const expiredAlerts = getExpiredAlerts(alertsWithUndefined)
      
      // لا يجب أن تشمل التنبيهات مع days_remaining غير معرف
      expiredAlerts.forEach(alert => {
        expect(alert.days_remaining).toBeDefined()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty companies array', async () => {
      const alerts = await generateCompanyAlertsSync([])
      expect(alerts).toEqual([])
    })

    it('should handle companies with invalid dates', async () => {
      const invalidCompanies: Company[] = [
        {
          id: '1',
          name: 'شركة تاريخ خاطئ',
          commercial_registration_expiry: 'invalid-date',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]
      
      const alerts = await generateCompanyAlertsSync(invalidCompanies)
      
      // يجب ألا يسبب خطأ، لكن قد لا ينتج تنبيهات
      expect(Array.isArray(alerts)).toBe(true)
    })

    it('should handle very large days_remaining values', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 10)
      
      const farFutureCompanies: Company[] = [
        {
          id: '1',
          name: 'شركة مستقبلية',
          commercial_registration_expiry: futureDate.toISOString().split('T')[0],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]
      
      const alerts = await generateCompanyAlertsSync(farFutureCompanies)
      
      // لا يجب أن تنشئ تنبيهات للتواريخ البعيدة جداً
      expect(alerts.length).toBe(0)
    })
  })
})
