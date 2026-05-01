/**
 * Feature flags for gradual rollout and A/B testing
 */

export const featureFlags = {
  /**
   * Use new payroll RPC functions alongside old implementation
   * Enables dual-write validation before full migration
   */
  useNewPayrollRPC: import.meta.env.VITE_USE_NEW_PAYROLL_RPC === 'true',
} as const

export type FeatureFlag = keyof typeof featureFlags

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
