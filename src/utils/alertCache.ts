/**
 * Alert Cache Module
 * Prevents excessive alert generation calls by caching results
 * and implementing request deduplication
 */

import { Employee, Company } from '../lib/supabase'
import { generateEmployeeAlerts, EmployeeAlert } from './employeeAlerts'
import { generateCompanyAlertsSync } from './alerts'
import { Alert } from '../components/alerts/AlertCard'
import { logger } from './logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  key: string
}

class AlertCacheManager {
  private employeeAlertsCache: CacheEntry<EmployeeAlert[]> | null = null
  private companyAlertsCache: CacheEntry<Alert[]> | null = null
  private generatingEmployee = false
  private generatingCompany = false
  private pendingEmployeeRequests: Array<(alerts: EmployeeAlert[]) => void> = []
  private pendingCompanyRequests: Array<(alerts: Alert[]) => void> = []
  
  // Cache validity: 2 minutes
  private readonly CACHE_TTL = 2 * 60 * 1000

  /**
   * Generate cache key based on data size
   */
  private generateKey(employees: Employee[], companies: Company[]): string {
    return `e${employees.length}-c${companies.length}`
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid<T>(cache: CacheEntry<T> | null, currentKey: string): boolean {
    if (!cache) return false
    const age = Date.now() - cache.timestamp
    const isValid = cache.key === currentKey && age < this.CACHE_TTL
    
    if (!isValid) {
      logger.debug('[AlertCache] Cache invalid or expired')
    }
    
    return isValid
  }

  /**
   * Get employee alerts with caching and deduplication
   */
  async getEmployeeAlerts(
    employees: Employee[],
    companies: Company[],
    forceRefresh = false
  ): Promise<EmployeeAlert[]> {
    const cacheKey = this.generateKey(employees, companies)

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid(this.employeeAlertsCache, cacheKey)) {
      logger.debug('[AlertCache] Returning cached employee alerts')
      return this.employeeAlertsCache!.data
    }

    // If already generating, queue this request
    if (this.generatingEmployee) {
      logger.debug('[AlertCache] Employee alerts generation in progress, queuing request')
      return new Promise<EmployeeAlert[]>((resolve) => {
        this.pendingEmployeeRequests.push(resolve)
      })
    }

    // Start generation
    this.generatingEmployee = true
    logger.debug('[AlertCache] Generating employee alerts')

    try {
      const alerts = await generateEmployeeAlerts(employees, companies)
      
      // Update cache
      this.employeeAlertsCache = {
        data: alerts,
        timestamp: Date.now(),
        key: cacheKey
      }

      // Resolve all pending requests with the same data
      this.pendingEmployeeRequests.forEach(resolve => resolve(alerts))
      this.pendingEmployeeRequests = []

      logger.debug(`[AlertCache] Employee alerts generated and cached (${alerts.length} alerts)`)
      return alerts
    } finally {
      this.generatingEmployee = false
    }
  }

  /**
   * Get company alerts with caching and deduplication
   */
  async getCompanyAlerts(
    companies: Company[],
    forceRefresh = false
  ): Promise<Alert[]> {
    const cacheKey = `c${companies.length}`

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid(this.companyAlertsCache, cacheKey)) {
      logger.debug('[AlertCache] Returning cached company alerts')
      return this.companyAlertsCache!.data
    }

    // If already generating, queue this request
    if (this.generatingCompany) {
      logger.debug('[AlertCache] Company alerts generation in progress, queuing request')
      return new Promise<Alert[]>((resolve) => {
        this.pendingCompanyRequests.push(resolve)
      })
    }

    // Start generation
    this.generatingCompany = true
    logger.debug('[AlertCache] Generating company alerts')

    try {
      const alerts = await generateCompanyAlertsSync(companies)
      
      // Update cache
      this.companyAlertsCache = {
        data: alerts,
        timestamp: Date.now(),
        key: cacheKey
      }

      // Resolve all pending requests with the same data
      this.pendingCompanyRequests.forEach(resolve => resolve(alerts))
      this.pendingCompanyRequests = []

      logger.debug(`[AlertCache] Company alerts generated and cached (${alerts.length} alerts)`)
      return alerts
    } finally {
      this.generatingCompany = false
    }
  }

  /**
   * Invalidate employee alerts cache
   */
  invalidateEmployeeAlerts() {
    this.employeeAlertsCache = null
    logger.debug('[AlertCache] Employee alerts cache invalidated')
  }

  /**
   * Invalidate company alerts cache
   */
  invalidateCompanyAlerts() {
    this.companyAlertsCache = null
    logger.debug('[AlertCache] Company alerts cache invalidated')
  }

  /**
   * Invalidate all caches
   */
  invalidateAll() {
    this.employeeAlertsCache = null
    this.companyAlertsCache = null
    logger.debug('[AlertCache] All caches invalidated')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      employeeCache: {
        valid: this.employeeAlertsCache !== null,
        age: this.employeeAlertsCache ? Date.now() - this.employeeAlertsCache.timestamp : 0,
        count: this.employeeAlertsCache?.data.length || 0
      },
      companyCache: {
        valid: this.companyAlertsCache !== null,
        age: this.companyAlertsCache ? Date.now() - this.companyAlertsCache.timestamp : 0,
        count: this.companyAlertsCache?.data.length || 0
      }
    }
  }
}

// Export singleton instance
export const alertCache = new AlertCacheManager()
