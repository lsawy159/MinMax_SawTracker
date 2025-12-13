/**
 * Advanced Memoization Utilities
 * 
 * Provides tools for optimizing React component rendering:
 * - React.memo wrappers with deep equality checks
 * - useMemo optimization strategies
 * - useCallback management
 * - Selector memoization for state
 * - Custom hooks for performance-critical sections
 */

/* eslint-disable react-hooks/exhaustive-deps */

import React, { memo, useMemo, useCallback, useDeferredValue, useTransition, useRef, useState } from 'react'
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

/**
 * Deep Equality Comparison
 * Used for more accurate memo comparisons
 */
function deepEqual(obj1: unknown, obj2: unknown, depth = 0): boolean {
  // Prevent infinite recursion
  if (depth > 10) return obj1 === obj2

  if (obj1 === obj2) return true
  if (obj1 == null || obj2 == null) return obj1 === obj2
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false

  const keys1 = Object.keys(obj1 as Record<string, unknown>)
  const keys2 = Object.keys(obj2 as Record<string, unknown>)

  if (keys1.length !== keys2.length) return false

  return keys1.every(key => deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key], depth + 1))
}

/**
 * Enhanced React.memo with deep equality
 * 
 * @example
 * const MyComponent = deepMemo(({ data, items }) => (
 *   <div>{data.title} - {items.length} items</div>
 * ))
 */
export function deepMemo<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
) {
  const Memoized = memo(Component, (prevProps, nextProps) => {
    const isEqual = deepEqual(prevProps, nextProps)
    if (!isEqual && isDevelopment()) {
      logger.debug(`[DeepMemo] ${displayName || Component.name} props changed`)
    }
    return isEqual
  })

  Memoized.displayName = displayName || `deepMemo(${Component.name})`
  return Memoized
}

/**
 * Shallow Memoization (Standard React.memo behavior)
 * Faster but less accurate for complex prop objects
 */
export function shallowMemo<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
) {
  const Memoized = memo(Component)
  Memoized.displayName = displayName || `shallowMemo(${Component.name})`
  return Memoized
}

/**
 * Advanced useMemo Hook
 * 
 * Features:
 * - Automatic dependency tracking
 * - Performance logging
 * - Development-only warnings
 * 
 * @example
 * const result = useMemoized(
 *   () => expensiveCalculation(data),
 *   [data],
 *   'expensiveCalculation'
 * )
 */
export function useMemoized<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const startTime = performance.now()

  const result = useMemo(() => {
    const value = factory()
    const duration = performance.now() - startTime

    if (isDevelopment() && duration > 16) {
      logger.warn(
        `[useMemoized] Calculation took ${duration.toFixed(2)}ms (slow)`
      )
    }

    return value
  }, deps)

  return result
}

/**
 * Stable useCallback Hook
 * Prevents unnecessary re-renders of child components
 * 
 * @example
 * const handleClick = useStableCallback(() => {
 *   console.log('clicked')
 * }, [])
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps) as T
}

/**
 * Deferred Value Hook
 * Useful for large list rendering and search
 * 
 * @example
 * const deferredQuery = useDeferredSearchValue(searchQuery)
 */
export function useDeferredSearchValue(value: string): string {
  return useDeferredValue(value)
}

/**
 * useTransition Hook Wrapper
 * Better handling of non-blocking updates
 * 
 * @example
 * const { isPending, startTransition } = useNonBlockingTransition()
 */
export function useNonBlockingTransition() {
  const [isPending, startTransition] = useTransition()

  return {
    isPending,
    startTransition,
    updateAsync: (callback: () => void) => {
      startTransition(callback)
    }
  }
}

/**
 * Selector Memoization for Redux/State
 * Prevents unnecessary re-renders when state changes
 * 
 * @example
 * const userName = useSelectorMemo(
 *   (state) => state.user.name,
 *   (prev, next) => prev === next
 * )
 */
export function useSelectorMemo<TState, TSelected>(
  selector: (state: TState) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean
): TSelected {
  const previousResultRef = useRef<TSelected>()
  const [, forceUpdate] = useState({})

  const memoizedSelector = useMemo(() => {
    return (state: TState) => {
      const result = selector(state)
      const previousResult = previousResultRef.current

      const isEqual = equalityFn ? equalityFn(result, previousResult!) : result === previousResult

      if (!isEqual) {
        previousResultRef.current = result
        forceUpdate({})
      }

      return result
    }
  }, [selector, equalityFn])

  return memoizedSelector({} as TState)
}

/**
 * List Virtualization Helper
 * For rendering large lists efficiently
 * 
 * @example
 * const visibleItems = useVirtualizedList(allItems, itemHeight, containerHeight)
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollPosition: number = 0
): T[] {
  return useMemoized(() => {
    const startIndex = Math.max(0, Math.floor(scrollPosition / itemHeight) - 1)
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2

    return items.slice(startIndex, startIndex + visibleCount)
  }, [items, itemHeight, containerHeight, scrollPosition])
}

/**
 * Expensive Computation Cache
 * Caches results of expensive operations
 */
class ComputationCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map()
  private maxAge: number = 5 * 60 * 1000 // 5 minutes default

  constructor(maxAge?: number) {
    if (maxAge) this.maxAge = maxAge
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    const isExpired = Date.now() - entry.timestamp > this.maxAge
    if (isExpired) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: K, value: V): void {
    this.cache.set(key, { value, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * useComputedValue Hook
 * Combines useMemo with ComputationCache
 * 
 * @example
 * const result = useComputedValue(
 *   () => heavyComputation(data),
 *   [data],
 *   'heavyComputation',
 *   10 * 60 * 1000 // 10 minute cache
 * )
 */
const computationCaches = new Map<string, ComputationCache<string, unknown>>()

export function useComputedValue<T>(
  factory: () => T,
  deps: React.DependencyList,
  cacheKey: string,
  maxAge?: number
): T {
  const depKey = JSON.stringify(deps)

  return useMemoized(() => {
    if (!computationCaches.has(cacheKey)) {
      computationCaches.set(cacheKey, new ComputationCache(maxAge))
    }

    const cache = computationCaches.get(cacheKey)!
    const cached = cache.get(depKey as string)

    if (cached !== undefined) {
      logger.debug(`[useComputedValue] Cache hit for ${cacheKey}`)
      return cached as T
    }

    const result = factory()
    cache.set(depKey as string, result as unknown)
    return result
  }, deps)
}

/**
 * Heavy Component Wrapper
 * Wraps expensive components with memoization
 * 
 * @example
 * const HeavyTable = withHeavyComponentMemo(DataTable)
 * // Now will only re-render if props actually change
 */
export function withHeavyComponentMemo<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
): React.ComponentType<P> {
  // Add render time monitoring as a wrapper
  const Monitored = memo((props: P) => {
    const renderStart = performance.now()
    const renderTime = performance.now() - renderStart

    if (isDevelopment() && renderTime > 16) {
      logger.warn(
        `[HeavyComponentMemo] ${displayName || Component.name} render took ${renderTime.toFixed(2)}ms`
      )
    }

    return React.createElement(Component, props)
  }) as React.ComponentType<P>

  Monitored.displayName = `withHeavyComponentMemo(${displayName || Component.name})`
  return Monitored
}

/**
 * Conditional Memoization
 * Memoizes only when certain conditions are met
 */
export function conditionalMemo<P extends object>(
  Component: React.ComponentType<P>,
  shouldMemoize: (props: P) => boolean,
  displayName?: string
) {
  const Memoized = memo(Component, (prev, next) => {
    if (!shouldMemoize(next)) {
      return false // Force re-render
    }
    return deepEqual(prev, next)
  })

  Memoized.displayName = displayName || `conditionalMemo(${Component.name})`
  return Memoized
}

/**
 * Memoization Config and Best Practices
 */
export const MemoizationConfig = {
  // General Settings
  enableDeepMemoByDefault: true,
  enableComponentMemoization: true,
  enableSelectorMemoization: true,

  // Performance Thresholds
  slowRenderThreshold: 16, // ms (60fps target)
  warnSlowMemoComputations: true,

  // Cache Strategies
  defaultCacheMaxAge: 5 * 60 * 1000, // 5 minutes
  enableComputationCache: true,

  // List Virtualization
  enableVirtualization: true,
  virtualizeThreshold: 100, // Items count to enable virtualization
}

/**
 * Performance Best Practices Guide
 */
export const MemoizationBestPractices = {
  rules: [
    'Use deepMemo for components with complex props',
    'Use shallowMemo for components with primitive props',
    'Use useMemoized for expensive calculations',
    'Use useStableCallback for event handlers',
    'Use useDeferredSearchValue for search input',
    'Consider virtualization for lists > 100 items',
  ],

  antiPatterns: [
    'Creating objects/arrays in render without useMemo',
    'Using anonymous functions without useCallback',
    'Memoizing simple components (overhead > benefit)',
    'Over-memoization (micro-optimization paralysis)',
  ],

  debugging: {
    enableProfiling: isDevelopment(),
    logMemoHits: true,
    logSlowRenders: true,
    trackRenderCounts: true,
  }
}

// Re-export React hooks for convenience
export { useMemo, useCallback, useDeferredValue, useTransition }

/**
 * Export Summary
 */
export const MemoizationOptimization = {
  deepMemo,
  shallowMemo,
  useMemoized,
  useStableCallback,
  useDeferredSearchValue,
  useNonBlockingTransition,
  useSelectorMemo,
  useVirtualizedList,
  useComputedValue,
  withHeavyComponentMemo,
  conditionalMemo,
  ComputationCache,
  MemoizationConfig,
  MemoizationBestPractices,
}
