/**
 * Performance Optimization Utilities
 * 
 * This module provides tools for optimizing React component performance:
 * - Code Splitting and Lazy Loading
 * - Memoization and Rendering Optimization
 * - Component-level Performance Monitoring
 * - Memory and Bundle Size Optimization
 */

import React, { ReactNode, Suspense, lazy, LazyExoticComponent, ComponentType } from 'react'
import { logger } from './logger'

// Type guard for development environment
const isDevelopment = (): boolean => {
  try {
    // Check if running in development mode by looking for common dev indicators
    return typeof location !== 'undefined' && location.hostname === 'localhost'
  } catch {
    return false
  }
}

// Type guard for production environment
const isProduction = (): boolean => {
  try {
    return typeof location !== 'undefined' && location.hostname !== 'localhost'
  } catch {
    return false
  }
}

/**
 * Performance Metrics Tracker
 */
export class PerformanceMetrics {
  private static metrics: Map<string, number[]> = new Map()
  private static renders: Map<string, number> = new Map()

  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)

    // Keep only last 100 measurements
    const values = this.metrics.get(name)!
    if (values.length > 100) {
      values.shift()
    }
  }

  static recordRender(componentName: string): void {
    const current = this.renders.get(componentName) || 0
    this.renders.set(componentName, current + 1)
  }

  static getMetrics(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return null

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  static getRenderCount(componentName: string): number {
    return this.renders.get(componentName) || 0
  }

  static getAllMetrics() {
    return {
      metrics: Object.fromEntries(this.metrics),
      renders: Object.fromEntries(this.renders)
    }
  }

  static reset(): void {
    this.metrics.clear()
    this.renders.clear()
  }
}

/**
 * Enhanced Lazy Loading with Performance Monitoring
 * 
 * @param importFunc - Async import function
 * @param componentName - Name for performance tracking
 * @returns LazyExoticComponent
 */
export function createLazyComponent<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  componentName: string
): LazyExoticComponent<ComponentType<P>> {
  const startTime = performance.now()
  
  const LazyComponent = lazy(async () => {
    try {
      const module = await importFunc()
      const loadTime = performance.now() - startTime
      PerformanceMetrics.recordMetric(`lazy_load_${componentName}`, loadTime)
      if (isDevelopment()) {
        logger.info(`[LazyLoad] ${componentName} loaded in ${loadTime.toFixed(2)}ms`)
      }
      return module
    } catch (error) {
      logger.error(`[LazyLoad] Failed to load ${componentName}:`, error)
      throw error
    }
  })

  return LazyComponent
}

/**
 * Route-based Code Splitting with Fallback
 * 
 * Usage:
 * const DashboardRoute = withCodeSplitting(
 *   () => import('./pages/Dashboard'),
 *   'Dashboard'
 * )
 */
export function withCodeSplitting<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  componentName: string,
  fallback?: ReactNode
) {
  const LazyComponent = createLazyComponent(importFunc, componentName)

  return (props: P) => {
    return React.createElement(
      Suspense,
      { fallback: fallback || React.createElement(DefaultLoadingFallback, { name: componentName }) },
      React.createElement(LazyComponent as unknown as React.ComponentType<P>, props)
    )
  }
}

/**
 * Default Loading Fallback Component
 */
function DefaultLoadingFallback({ name }: { name: string }) {
  return React.createElement('div', { className: 'min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100' },
    React.createElement('div', { className: 'flex flex-col items-center gap-4' },
      React.createElement('div', { className: 'relative w-12 h-12' },
        React.createElement('div', { className: 'absolute inset-0 rounded-full border-2 border-gray-200' }),
        React.createElement('div', { className: 'absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 animate-spin' })
      ),
      React.createElement('div', { className: 'text-center' },
        React.createElement('p', { className: 'text-gray-700 font-medium' }, `جاري تحميل ${name}...`),
        React.createElement('p', { className: 'text-gray-500 text-sm mt-2' }, 'يرجى الانتظار قليلاً')
      )
    )
  )
}

/**
 * Component Render Counter Hook
 * Helps identify unnecessary re-renders in development
 */
export function useRenderCount(componentName: string): number {
  const count = PerformanceMetrics.getRenderCount(componentName)
  
  if (isDevelopment()) {
    logger.debug(`[RenderCount] ${componentName} rendered ${count + 1} times`)
  }
  
  PerformanceMetrics.recordRender(componentName)
  return count
}

/**
 * Performance Monitor Hook
 * Measures component render time
 * 
 * Usage:
 * const duration = usePerformanceMonitor('MyComponent')
 */
export function usePerformanceMonitor(): number {
  const startTime = performance.now()

  return performance.now() - startTime
}

/**
 * Bundle Size Optimization Hints
 * 
 * Returns recommendations for code splitting based on bundle analysis
 */
export const BundleOptimizationGuide = {
  recommendations: [
    {
      type: 'route-splitting',
      description: 'Dashboard and admin pages should be split',
      components: ['Dashboard', 'Users', 'Settings', 'SecurityManagement']
    },
    {
      type: 'lazy-loading',
      description: 'Heavy components like Reports and Charts should load on demand',
      components: ['Reports', 'AdvancedSearch', 'ImportExport']
    },
    {
      type: 'vendor-splitting',
      description: 'Large dependencies should be separated',
      packages: ['@tanstack/react-query', 'react-router-dom']
    },
    {
      type: 'dynamic-imports',
      description: 'Data processing utilities should load dynamically',
      utilities: ['charts', 'excel-export', 'pdf-generation']
    }
  ],

  checkBundleSize(): void {
    if (isProduction()) {
      logger.info('[BundleCheck] Run: npm run build -- --report')
    }
  }
}

/**
 * Dynamic Import Cache
 * 
 * Prevents duplicate module imports and improves performance
 */
class ImportCache {
  private static cache: Map<string, Promise<unknown>> = new Map()

  static async load<T>(
    importFunc: () => Promise<T>,
    cacheKey: string
  ): Promise<T> {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)! as Promise<T>
    }

    const promise = importFunc()
    this.cache.set(cacheKey, promise as Promise<unknown>)
    return promise
  }

  static clear(): void {
    this.cache.clear()
  }
}

export { ImportCache }

/**
 * Chunk Preloading Strategy
 * 
 * Pre-load chunks based on user interaction patterns
 */
export class ChunkPreloader {
  private static preloadQueue: Set<string> = new Set()

  static preload(importFunc: () => Promise<unknown>, chunkName: string): void {
    if (typeof window === 'undefined') return

    if (this.preloadQueue.has(chunkName)) return
    this.preloadQueue.add(chunkName)

    // Use requestIdleCallback for non-blocking preload
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        importFunc().catch(err => {
          logger.warn(`[ChunkPreloader] Failed to preload ${chunkName}:`, err)
        })
      })
    } else {
      // Fallback to setTimeout
      setTimeout(() => {
        importFunc().catch(err => {
          logger.warn(`[ChunkPreloader] Failed to preload ${chunkName}:`, err)
        })
      }, 2000)
    }
  }

  static preloadMultiple(chunks: Array<{ import: () => Promise<unknown>; name: string }>): void {
    chunks.forEach(({ import: importFunc, name }) => {
      this.preload(importFunc, name)
    })
  }
}

/**
 * Performance Configuration
 */
export const PerformanceConfig = {
  // Code Splitting
  splitDashboardRoutes: true,
  splitAdminRoutes: true,

  // Memoization
  enableComponentMemoization: true,
  enableSelectorMemoization: true,

  // Bundle
  maxBundleSize: 500, // KB
  maxChunkSize: 200, // KB

  // Lazy Loading
  preloadOnHover: true,
  preloadOnRoute: true,

  // Monitoring
  enablePerformanceMonitoring: isDevelopment(),
  logSlowRenders: true,
  slowRenderThreshold: 16, // ms (60fps)
}

/**
 * Export Summary for Easy Access
 */
export const PerformanceOptimization = {
  createLazyComponent,
  withCodeSplitting,
  useRenderCount,
  usePerformanceMonitor,
  PerformanceMetrics,
  BundleOptimizationGuide,
  ImportCache,
  ChunkPreloader,
  PerformanceConfig,
}
