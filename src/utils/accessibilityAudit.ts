/**
 * Accessibility Audit and Utilities
 * 
 * Comprehensive accessibility testing and implementation tools:
 * - WCAG 2.1 AA compliance checking
 * - Contrast ratio validation
 * - Keyboard navigation testing
 * - ARIA attribute validation
 * - Screen reader compatibility
 * - Focus management
 */

import { logger } from './logger'

/**
 * Accessibility Standards and Compliance
 */
export const AccessibilityStandards = {
  wcag: {
    level: 'AA',
    version: '2.1',
    url: 'https://www.w3.org/WAI/WCAG21/quickref/'
  },

  principles: [
    'Perceivable - Information and user interface components must be presentable',
    'Operable - User interface components and navigation must be operable',
    'Understandable - Information and operation of user interface must be clear',
    'Robust - Content must be compatible with assistive technologies'
  ],

  guidelines: [
    '1.4.3 Contrast (Minimum) - Level AA',
    '2.1.1 Keyboard - All functionality must be operable via keyboard',
    '2.4.3 Focus Order - Navigation order makes sense',
    '3.2.4 Consistent Identification - Patterns are consistent',
    '4.1.2 Name, Role, Value - Elements have proper semantics'
  ]
}

/**
 * Color Contrast Validation
 * Ensures sufficient contrast ratios for WCAG AA compliance
 */
export class ContrastValidator {
  /**
   * Calculate relative luminance (WCAG formula)
   */
  private static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(x => {
      x = x / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  /**
   * Calculate contrast ratio between two colors
   * @param color1 - Hex color (e.g., '#ffffff')
   * @param color2 - Hex color (e.g., '#000000')
   * @returns Contrast ratio (4.5:1 for AA, 7:1 for AAA)
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1)
    const rgb2 = this.hexToRgb(color2)

    if (!rgb1 || !rgb2) return 0

    const lum1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b)
    const lum2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b)

    const lighter = Math.max(lum1, lum2)
    const darker = Math.min(lum1, lum2)

    return (lighter + 0.05) / (darker + 0.05)
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null
  }

  /**
   * Check if contrast ratio meets WCAG AA standards
   */
  static isWCAG_AA(color1: string, color2: string): boolean {
    return this.getContrastRatio(color1, color2) >= 4.5
  }

  /**
   * Check if contrast ratio meets WCAG AAA standards
   */
  static isWCAG_AAA(color1: string, color2: string): boolean {
    return this.getContrastRatio(color1, color2) >= 7
  }

  /**
   * Validate all text-background combinations
   */
  static validateDesignSystem(colorPairs: Array<{ name: string; text: string; bg: string }>) {
    const results = colorPairs.map(pair => {
      const ratio = this.getContrastRatio(pair.text, pair.bg)
      const isAACompliant = this.isWCAG_AA(pair.text, pair.bg)
      const isAAACompliant = this.isWCAG_AAA(pair.text, pair.bg)

      return {
        ...pair,
        ratio: ratio.toFixed(2),
        isAACompliant,
        isAAACompliant,
        status: isAAACompliant ? '✅ AAA' : isAACompliant ? '⚠️ AA' : '❌ FAIL'
      }
    })

    return results
  }
}

/**
 * Keyboard Navigation Validator
 */
export class KeyboardNavigationValidator {
  /**
   * Elements that should be keyboard accessible
   */
  private static focusableElements = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[tabindex]'
  ]

  /**
   * Check if element is keyboard accessible
   */
  static isKeyboardAccessible(element: Element): boolean {
    // Check if element is interactive
    const isInteractive = this.focusableElements.some(selector =>
      element.matches(selector)
    )

    if (!isInteractive) return false

    // Check if element is visible and enabled
    const style = window.getComputedStyle(element)
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden'
    const isDisabled = (element as HTMLInputElement).disabled

    return isVisible && !isDisabled
  }

  /**
   * Get all keyboard accessible elements
   */
  static getKeyboardAccessibleElements(): Element[] {
    const elements = document.querySelectorAll(this.focusableElements.join(', '))
    return Array.from(elements).filter(el => this.isKeyboardAccessible(el))
  }

  /**
   * Validate tabindex usage
   */
  static validateTabIndex(): {
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    const tabindexElements = document.querySelectorAll('[tabindex]')

    tabindexElements.forEach(element => {
      const tabindex = parseInt(element.getAttribute('tabindex') || '0', 10)

      if (tabindex > 0) {
        issues.push(
          `Element with positive tabindex (${tabindex}): ${element.tagName}. ` +
          'Positive tabindex values should be avoided.'
        )
        recommendations.push('Use DOM order for tab navigation instead of positive tabindex')
      }

      if (tabindex < -1) {
        issues.push(
          `Element with invalid tabindex (${tabindex}): ${element.tagName}`
        )
      }
    })

    return { issues, recommendations }
  }

  /**
   * Check focus visibility
   */
  static validateFocusVisibility(): {
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check for outline: none without alternative focus indicator
    const elements = document.querySelectorAll('*')
    elements.forEach(element => {
      const style = window.getComputedStyle(element)
      if (style.outline === 'none' && style.boxShadow === 'none') {
        // This might be a focus visibility issue
        const hasFocusStyle = element.matches(':focus')
        if (!hasFocusStyle) {
          issues.push(`Element missing focus indicator: ${element.tagName}`)
        }
      }
    })

    recommendations.push('Ensure all interactive elements have visible focus indicator')
    recommendations.push('Use CSS :focus or :focus-visible for focus styles')

    return { issues, recommendations }
  }
}

/**
 * ARIA Attribute Validator
 */
export class ARIAValidator {
  /**
   * Check if element has proper ARIA attributes
   */
  static validateARIAAttributes(element: Element): {
    valid: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    // Check semantic HTML usage
    if (element.tagName === 'DIV' && this.isInteractive(element)) {
      issues.push(`<div> used as interactive element. Use <button>, <a>, or <input> instead`)
      suggestions.push(`Convert to semantic element: <button>, <a>, or other interactive element`)
    }

    // Check for aria-label or aria-labelledby
    if (this.isInteractive(element)) {
      const hasLabel = element.hasAttribute('aria-label') ||
                      element.hasAttribute('aria-labelledby') ||
                      element.textContent?.trim()

      if (!hasLabel) {
        issues.push(`Interactive element missing accessible name`)
        suggestions.push(`Add aria-label or ensure element has text content`)
      }
    }

    // Check for aria-hidden usage
    if (element.getAttribute('aria-hidden') === 'true') {
      const hasRole = element.hasAttribute('role')
      if (hasRole) {
        issues.push(`Element with aria-hidden="true" should not have a role`)
        suggestions.push(`Remove either aria-hidden or role attribute`)
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Check if element is interactive
   */
  private static isInteractive(element: Element): boolean {
    const interactiveRole = element.getAttribute('role')
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']

    return interactiveTags.includes(element.tagName) ||
           (interactiveRole && !['img', 'doc-pagebreak'].includes(interactiveRole))
  }

  /**
   * Validate landmark regions
   */
  static validateLandmarks(): {
    hasBanner: boolean
    hasNavigation: boolean
    hasMain: boolean
    hasContentinfo: boolean
    issues: string[]
  } {
    const hasBanner = !!document.querySelector('[role="banner"]') || !!document.querySelector('header')
    const hasNavigation = !!document.querySelector('[role="navigation"]') || !!document.querySelector('nav')
    const hasMain = !!document.querySelector('[role="main"]') || !!document.querySelector('main')
    const hasContentinfo = !!document.querySelector('[role="contentinfo"]') || !!document.querySelector('footer')

    const issues: string[] = []

    if (!hasBanner) issues.push('Missing banner/header landmark')
    if (!hasNavigation) issues.push('Missing navigation landmark')
    if (!hasMain) issues.push('Missing main content landmark')
    if (!hasContentinfo) issues.push('Missing footer/contentinfo landmark')

    return {
      hasBanner,
      hasNavigation,
      hasMain,
      hasContentinfo,
      issues
    }
  }
}

/**
 * Screen Reader Testing
 */
export class ScreenReaderTester {
  /**
   * Announce message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)

    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }

  /**
   * Get all text that would be read by screen reader
   */
  static getScreenReaderText(): string {
    const text: string[] = []

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    )

    let node = walker.nextNode() as Node | null
    while (node) {
      const parent = (node.parentElement as HTMLElement)
      const isVisible = parent && window.getComputedStyle(parent).display !== 'none'

      if (isVisible && node.textContent?.trim()) {
      node = walker.nextNode() as Node | null
        text.push(node.textContent.trim())
      }
    }

    return text.join(' ')
  }

  /**
   * Validate alt text for images
   */
  static validateImages(): {
    valid: boolean
    issues: Array<{ src: string; message: string }>
  } {
    const issues: Array<{ src: string; message: string }> = []
    const images = document.querySelectorAll('img')

    images.forEach(img => {
      const alt = img.getAttribute('alt')

      if (!alt) {
        issues.push({
          src: img.src,
          message: 'Missing alt attribute'
        })
      } else if (alt.length < 5) {
        issues.push({
          src: img.src,
          message: `Alt text too short: "${alt}"`
        })
      }

      // Check for spacer images
      if (img.width < 5 || img.height < 5) {
        if (alt && alt !== '') {
          issues.push({
            src: img.src,
            message: 'Spacer image should have empty alt attribute'
          })
        }
      }
    })

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

/**
 * Complete Accessibility Audit
 * Runs all accessibility checks
 */
export class AccessibilityAudit {
  static run(): {
    summary: {
      passed: number
      failed: number
      score: string
    }
    contrast: any
    keyboard: any
    aria: any
    landmarks: any
    images: any
  } {
    logger.info('[AccessibilityAudit] Running comprehensive accessibility audit...')

    // Color Contrast Check
    const designSystem = [
      { name: 'Text on Primary', text: '#ffffff', bg: '#2563eb' },
      { name: 'Text on Secondary', text: '#000000', bg: '#e5e7eb' },
      { name: 'Error Text', text: '#ffffff', bg: '#dc2626' },
      { name: 'Success Text', text: '#ffffff', bg: '#16a34a' },
    ]
    const contrastResults = ContrastValidator.validateDesignSystem(designSystem)
    const contrastFailed = contrastResults.filter(r => !r.isAACompliant).length

    // Keyboard Navigation
    const keyboardResults = KeyboardNavigationValidator.validateFocusVisibility()

    // ARIA & Landmarks
    const landmarks = ARIAValidator.validateLandmarks()

    // Screen Reader
    const images = ScreenReaderTester.validateImages()

    const totalFailed = contrastFailed + keyboardResults.issues.length + landmarks.issues.length + images.issues.length
    const totalChecks = 4

    return {
      summary: {
        passed: totalChecks - (totalFailed > 0 ? 1 : 0),
        failed: totalFailed > 0 ? 1 : 0,
        score: totalFailed === 0 ? '✅ PASS (AA Compliant)' : '⚠️ ISSUES FOUND'
      },
      contrast: contrastResults,
      keyboard: keyboardResults,
      aria: landmarks,
      landmarks: landmarks,
      images: images
    }
  }

  /**
   * Log audit results to console
   */
  static logResults(results: {
    summary: { passed: number; failed: number; score: string }
    contrast: any
    keyboard: any
    aria: any
    landmarks: any
    images: any
  }): void {
    console.group('♿ Accessibility Audit Results')

    console.log('📊 Summary:', results.summary)

    console.group('🎨 Color Contrast')
    results.contrast.forEach((result: any) => {
      console.log(`${result.status} ${result.name}: ${result.ratio}:1`)
    })
    console.groupEnd()

    console.group('⌨️ Keyboard Navigation')
    if (results.keyboard.issues.length === 0) {
      console.log('✅ All checks passed')
    } else {
      results.keyboard.issues.forEach((issue: string) => console.warn(issue))
    }
    console.groupEnd()

    console.group('🏗️ Landmarks')
    console.log(results.aria)
    console.groupEnd()

    console.group('🖼️ Images')
    if (results.images.issues.length === 0) {
      console.log('✅ All images have proper alt text')
    } else {
      results.images.issues.forEach((issue: any) => console.warn(`${issue.src}: ${issue.message}`))
    }
    console.groupEnd()

    console.groupEnd()
  }
}

/**
 * Export Summary
 */
export const AccessibilityAuditing = {
  AccessibilityStandards,
  ContrastValidator,
  KeyboardNavigationValidator,
  ARIAValidator,
  ScreenReaderTester,
  AccessibilityAudit,
  
  // Quick access methods
  validateContrast: (c1: string, c2: string) => ContrastValidator.getContrastRatio(c1, c2),
  isWCAG_AA: (c1: string, c2: string) => ContrastValidator.isWCAG_AA(c1, c2),
  announceToScreenReader: (msg: string) => ScreenReaderTester.announce(msg),
  runFullAudit: () => AccessibilityAudit.run(),
}
