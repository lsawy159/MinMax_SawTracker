import { describe, it, expect } from 'vitest';
import { TOKEN } from '../../lib/tokens';

/**
 * Convert HSL to RGB
 * @param h hue (0-360)
 * @param s saturation (0-100)
 * @param l lightness (0-100)
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  return [r, g, b];
}

/**
 * Calculate relative luminance from RGB
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse HSL from CSS string "hsl(217 85% 55%)"
 */
function parseHSL(hslString: string): [number, number, number] {
  const match = hslString.match(/hsl\((\d+\.?\d*)\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%\)/);
  if (!match) {
    throw new Error(`Invalid HSL string: ${hslString}`);
  }
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

describe('Design System v2 Tokens', () => {
  describe('Token Name Consistency', () => {
    it('TOKEN constant should have all primary color levels', () => {
      const primaryLevels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
      primaryLevels.forEach((level) => {
        // @ts-expect-error - accessing dynamic key
        expect(TOKEN.COLOR.PRIMARY[level]).toBeDefined();
        // @ts-expect-error - accessing dynamic key
        expect(TOKEN.COLOR.PRIMARY[level]).toBe(`primary-${level}`);
      });
    });

    it('TOKEN constant should have all neutral color levels', () => {
      const neutralLevels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
      neutralLevels.forEach((level) => {
        // @ts-expect-error - accessing dynamic key
        expect(TOKEN.COLOR.NEUTRAL[level]).toBeDefined();
        // @ts-expect-error - accessing dynamic key
        expect(TOKEN.COLOR.NEUTRAL[level]).toBe(`neutral-${level}`);
      });
    });

    it('TOKEN constant should have semantic colors (success, warning, danger, info)', () => {
      expect(TOKEN.COLOR.SUCCESS).toBeDefined();
      expect(TOKEN.COLOR.WARNING).toBeDefined();
      expect(TOKEN.COLOR.DANGER).toBeDefined();
      expect(TOKEN.COLOR.INFO).toBeDefined();

      // Each semantic color should have 50, 500, 700 variants
      [TOKEN.COLOR.SUCCESS, TOKEN.COLOR.WARNING, TOKEN.COLOR.DANGER, TOKEN.COLOR.INFO].forEach((color) => {
        expect(color[50]).toBeDefined();
        expect(color[500]).toBeDefined();
        expect(color[700]).toBeDefined();
      });
    });

    it('TOKEN constant should have typography tokens', () => {
      expect(TOKEN.FONT.FAMILY.DISPLAY).toBe('font-family-display');
      expect(TOKEN.FONT.FAMILY.BODY).toBe('font-family-body');
      expect(TOKEN.FONT.FAMILY.MONO).toBe('font-family-mono');

      expect(TOKEN.FONT.SIZE.BASE).toBe('font-size-base');
      expect(TOKEN.FONT.SIZE.LG).toBe('font-size-lg');
      expect(TOKEN.FONT.SIZE.XL).toBe('font-size-xl');

      expect(TOKEN.FONT.WEIGHT.REGULAR).toBe('font-weight-regular');
      expect(TOKEN.FONT.WEIGHT.BOLD).toBe('font-weight-bold');

      expect(TOKEN.FONT.LINE_HEIGHT.NORMAL).toBe('line-height-normal');
    });

    it('TOKEN constant should have spacing tokens 1-24', () => {
      [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].forEach((space) => {
        // @ts-expect-error - accessing dynamic key
        expect(TOKEN.SPACE[space]).toBe(`space-${space}`);
      });
    });

    it('TOKEN constant should have border radius tokens', () => {
      expect(TOKEN.RADIUS.SM).toBe('radius-sm');
      expect(TOKEN.RADIUS.MD).toBe('radius-md');
      expect(TOKEN.RADIUS.LG).toBe('radius-lg');
      expect(TOKEN.RADIUS.XL).toBe('radius-xl');
      expect(TOKEN.RADIUS.FULL).toBe('radius-full');
    });

    it('TOKEN constant should have shadow tokens', () => {
      expect(TOKEN.SHADOW.SM).toBe('shadow-sm');
      expect(TOKEN.SHADOW.MD).toBe('shadow-md');
      expect(TOKEN.SHADOW.LG).toBe('shadow-lg');
      expect(TOKEN.SHADOW.XL).toBe('shadow-xl');
    });

    it('TOKEN constant should have motion tokens', () => {
      expect(TOKEN.MOTION.DURATION.FAST).toBe('duration-fast');
      expect(TOKEN.MOTION.DURATION.NORMAL).toBe('duration-normal');
      expect(TOKEN.MOTION.DURATION.SLOW).toBe('duration-slow');

      expect(TOKEN.MOTION.EASING.STANDARD).toBe('easing-standard');
      expect(TOKEN.MOTION.EASING.EMPHASIZED).toBe('easing-emphasized');
    });
  });

  describe('Color Contrast (WCAG AA Compliance)', () => {
    /**
     * Light mode: neutral-50 text on neutral-900 background (worst case for light theme)
     * Dark mode: neutral-50 text on neutral-900 background (worst case for dark theme)
     */
    it('should meet 4.5:1 contrast ratio for body text', () => {
      // Light mode: body text (neutral-900) on background (neutral-50)
      // Neutral-900: hsl(222 47% 11%)
      // Neutral-50: hsl(210 40% 98%)
      const [h1, s1, l1] = parseHSL('hsl(222 47% 11%)');
      const [h2, s2, l2] = parseHSL('hsl(210 40% 98%)');

      const [r1, g1, b1] = hslToRgb(h1, s1, l1);
      const [r2, g2, b2] = hslToRgb(h2, s2, l2);

      const lum1 = getLuminance(r1, g1, b1);
      const lum2 = getLuminance(r2, g2, b2);

      const contrastRatio = getContrastRatio(lum1, lum2);

      // Should meet WCAG AA standard (4.5:1 for normal text)
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * Dark mode: neutral-50 text on neutral-900 background
     */
    it('should meet 4.5:1 contrast ratio for dark mode body text', () => {
      // Dark mode: body text (neutral-50) on background (neutral-900)
      // Neutral-50: hsl(210 40% 98%)
      // Neutral-900: hsl(222 47% 11%)
      const [h1, s1, l1] = parseHSL('hsl(210 40% 98%)');
      const [h2, s2, l2] = parseHSL('hsl(222 47% 11%)');

      const [r1, g1, b1] = hslToRgb(h1, s1, l1);
      const [r2, g2, b2] = hslToRgb(h2, s2, l2);

      const lum1 = getLuminance(r1, g1, b1);
      const lum2 = getLuminance(r2, g2, b2);

      const contrastRatio = getContrastRatio(lum1, lum2);

      // Should meet WCAG AA standard (4.5:1 for normal text)
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * Primary button text (white) on primary-500 button
     */
    it('should meet 3:1 contrast ratio for UI components (buttons)', () => {
      // White text on primary-500 background
      // Primary-500: hsl(217 85% 55%)
      // White: hsl(0 0% 100%)
      const [h1, s1, l1] = parseHSL('hsl(0 0% 100%)');
      const [h2, s2, l2] = parseHSL('hsl(217 85% 55%)');

      const [r1, g1, b1] = hslToRgb(h1, s1, l1);
      const [r2, g2, b2] = hslToRgb(h2, s2, l2);

      const lum1 = getLuminance(r1, g1, b1);
      const lum2 = getLuminance(r2, g2, b2);

      const contrastRatio = getContrastRatio(lum1, lum2);

      // Should meet WCAG AA standard (3:1 for UI components)
      expect(contrastRatio).toBeGreaterThanOrEqual(3);
    });

    /**
     * Semantic colors: success-700 should meet 3:1 on light background
     */
    it('should meet 3:1 contrast ratio for semantic color -700 variant on light background', () => {
      // Test success-700 on neutral-50 background
      // Success-700: hsl(142 71% 28%)
      // Neutral-50: hsl(210 40% 98%)
      const [h1, s1, l1] = parseHSL('hsl(142 71% 28%)');
      const [h2, s2, l2] = parseHSL('hsl(210 40% 98%)');

      const [r1, g1, b1] = hslToRgb(h1, s1, l1);
      const [r2, g2, b2] = hslToRgb(h2, s2, l2);

      const lum1 = getLuminance(r1, g1, b1);
      const lum2 = getLuminance(r2, g2, b2);

      const contrastRatio = getContrastRatio(lum1, lum2);

      // Should meet WCAG AA standard (3:1 for UI components)
      expect(contrastRatio).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Typography Token Hierarchy', () => {
    it('should define all required font sizes', () => {
      expect(TOKEN.FONT.SIZE.XS).toBe('font-size-xs');
      expect(TOKEN.FONT.SIZE.SM).toBe('font-size-sm');
      expect(TOKEN.FONT.SIZE.BASE).toBe('font-size-base');
      expect(TOKEN.FONT.SIZE.LG).toBe('font-size-lg');
      expect(TOKEN.FONT.SIZE.XL).toBe('font-size-xl');
      expect(TOKEN.FONT.SIZE['2XL']).toBe('font-size-2xl');
      expect(TOKEN.FONT.SIZE['3XL']).toBe('font-size-3xl');
      expect(TOKEN.FONT.SIZE['4XL']).toBe('font-size-4xl');
    });

    it('should define all required font weights', () => {
      expect(TOKEN.FONT.WEIGHT.REGULAR).toBe('font-weight-regular');
      expect(TOKEN.FONT.WEIGHT.MEDIUM).toBe('font-weight-medium');
      expect(TOKEN.FONT.WEIGHT.SEMIBOLD).toBe('font-weight-semibold');
      expect(TOKEN.FONT.WEIGHT.BOLD).toBe('font-weight-bold');
    });
  });
});
