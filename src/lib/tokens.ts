/* Design System v2 Token Constants & Types */

/**
 * Color token names (HSL) from src/styles/tokens.css
 * Used for type-safe token access in components
 */
export type ColorTokenName =
  // Primary scale (11-step)
  | 'primary-50'
  | 'primary-100'
  | 'primary-200'
  | 'primary-300'
  | 'primary-400'
  | 'primary-500'
  | 'primary-600'
  | 'primary-700'
  | 'primary-800'
  | 'primary-900'
  | 'primary-950'
  // Neutral scale (11-step)
  | 'neutral-50'
  | 'neutral-100'
  | 'neutral-200'
  | 'neutral-300'
  | 'neutral-400'
  | 'neutral-500'
  | 'neutral-600'
  | 'neutral-700'
  | 'neutral-800'
  | 'neutral-900'
  | 'neutral-950'
  // Semantic colors
  | 'success-50'
  | 'success-500'
  | 'success-700'
  | 'warning-50'
  | 'warning-500'
  | 'warning-700'
  | 'danger-50'
  | 'danger-500'
  | 'danger-700'
  | 'info-50'
  | 'info-500'
  | 'info-700'

/**
 * Typography token names
 */
export type TypographyTokenName =
  | 'font-family-display'
  | 'font-family-body'
  | 'font-family-mono'
  | 'font-size-xs'
  | 'font-size-sm'
  | 'font-size-base'
  | 'font-size-lg'
  | 'font-size-xl'
  | 'font-size-2xl'
  | 'font-size-3xl'
  | 'font-size-4xl'
  | 'font-weight-regular'
  | 'font-weight-medium'
  | 'font-weight-semibold'
  | 'font-weight-bold'
  | 'line-height-tight'
  | 'line-height-normal'
  | 'line-height-relaxed'

/**
 * Spacing token names (4px base)
 */
export type SpacingTokenName =
  | 'space-1'
  | 'space-2'
  | 'space-3'
  | 'space-4'
  | 'space-5'
  | 'space-6'
  | 'space-8'
  | 'space-10'
  | 'space-12'
  | 'space-16'
  | 'space-20'
  | 'space-24'

/**
 * Border radius token names
 */
export type RadiusTokenName = 'radius-sm' | 'radius-md' | 'radius-lg' | 'radius-xl' | 'radius-full'

/**
 * Shadow token names
 */
export type ShadowTokenName = 'shadow-sm' | 'shadow-md' | 'shadow-lg' | 'shadow-xl'

/**
 * Motion/transition token names
 */
export type MotionTokenName =
  | 'duration-fast'
  | 'duration-normal'
  | 'duration-slow'
  | 'easing-standard'
  | 'easing-emphasized'

/**
 * All token names combined
 */
export type TokenName =
  | ColorTokenName
  | TypographyTokenName
  | SpacingTokenName
  | RadiusTokenName
  | ShadowTokenName
  | MotionTokenName

/**
 * Token constant for referencing tokens as CSS custom properties
 * Usage: `--color-${TOKEN.COLOR.PRIMARY[500]}` → `--color-primary-500`
 */
export const TOKEN = {
  COLOR: {
    PRIMARY: {
      50: 'primary-50',
      100: 'primary-100',
      200: 'primary-200',
      300: 'primary-300',
      400: 'primary-400',
      500: 'primary-500',
      600: 'primary-600',
      700: 'primary-700',
      800: 'primary-800',
      900: 'primary-900',
      950: 'primary-950',
    } as const,
    NEUTRAL: {
      50: 'neutral-50',
      100: 'neutral-100',
      200: 'neutral-200',
      300: 'neutral-300',
      400: 'neutral-400',
      500: 'neutral-500',
      600: 'neutral-600',
      700: 'neutral-700',
      800: 'neutral-800',
      900: 'neutral-900',
      950: 'neutral-950',
    } as const,
    SUCCESS: {
      50: 'success-50',
      500: 'success-500',
      700: 'success-700',
    } as const,
    WARNING: {
      50: 'warning-50',
      500: 'warning-500',
      700: 'warning-700',
    } as const,
    DANGER: {
      50: 'danger-50',
      500: 'danger-500',
      700: 'danger-700',
    } as const,
    INFO: {
      50: 'info-50',
      500: 'info-500',
      700: 'info-700',
    } as const,
  },
  FONT: {
    FAMILY: {
      DISPLAY: 'font-family-display',
      BODY: 'font-family-body',
      MONO: 'font-family-mono',
    } as const,
    SIZE: {
      XS: 'font-size-xs',
      SM: 'font-size-sm',
      BASE: 'font-size-base',
      LG: 'font-size-lg',
      XL: 'font-size-xl',
      '2XL': 'font-size-2xl',
      '3XL': 'font-size-3xl',
      '4XL': 'font-size-4xl',
    } as const,
    WEIGHT: {
      REGULAR: 'font-weight-regular',
      MEDIUM: 'font-weight-medium',
      SEMIBOLD: 'font-weight-semibold',
      BOLD: 'font-weight-bold',
    } as const,
    LINE_HEIGHT: {
      TIGHT: 'line-height-tight',
      NORMAL: 'line-height-normal',
      RELAXED: 'line-height-relaxed',
    } as const,
  },
  SPACE: {
    1: 'space-1',
    2: 'space-2',
    3: 'space-3',
    4: 'space-4',
    5: 'space-5',
    6: 'space-6',
    8: 'space-8',
    10: 'space-10',
    12: 'space-12',
    16: 'space-16',
    20: 'space-20',
    24: 'space-24',
  } as const,
  RADIUS: {
    SM: 'radius-sm',
    MD: 'radius-md',
    LG: 'radius-lg',
    XL: 'radius-xl',
    FULL: 'radius-full',
  } as const,
  SHADOW: {
    SM: 'shadow-sm',
    MD: 'shadow-md',
    LG: 'shadow-lg',
    XL: 'shadow-xl',
  } as const,
  MOTION: {
    DURATION: {
      FAST: 'duration-fast',
      NORMAL: 'duration-normal',
      SLOW: 'duration-slow',
    } as const,
    EASING: {
      STANDARD: 'easing-standard',
      EMPHASIZED: 'easing-emphasized',
    } as const,
  },
} as const

/**
 * Helper to get CSS custom property reference
 * @example getCSSVar('color', 'primary-500') → 'var(--color-primary-500)'
 * @example getCSSVar('space', '4') → 'var(--space-4)'
 */
export function getCSSVar(category: string, value: string): string {
  return `var(--${category}-${value})`
}

/**
 * Helper to get CSS custom property for color
 * @example getColorVar('primary-500') → 'var(--color-primary-500)'
 */
export function getColorVar(colorName: ColorTokenName): string {
  return getCSSVar('color', colorName)
}

/**
 * Helper to get CSS custom property for spacing
 * @example getSpaceVar('space-4') → 'var(--space-4)'
 */
export function getSpaceVar(spaceName: SpacingTokenName): string {
  return `var(--${spaceName})`
}

/**
 * Helper to get CSS custom property for motion
 * @example getDurationVar('duration-normal') → 'var(--duration-normal)'
 */
export function getDurationVar(
  durationName: 'duration-fast' | 'duration-normal' | 'duration-slow'
): string {
  return `var(--${durationName})`
}

/**
 * Helper to get CSS custom property for easing
 * @example getEasingVar('easing-standard') → 'var(--easing-standard)'
 */
export function getEasingVar(easingName: 'easing-standard' | 'easing-emphasized'): string {
  return `var(--${easingName})`
}
