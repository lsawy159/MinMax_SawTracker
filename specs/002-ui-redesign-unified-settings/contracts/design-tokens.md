# Contract: Design Tokens v2

**Owner**: `src/styles/tokens.css`, `src/lib/tokens.ts`, `tailwind.config.js`

CSS custom properties define authoritative values. TypeScript const enum mirrors names for type-safe usage. Tailwind binds via `theme.extend.colors` referencing `var(--color-...)`.

---

## Color Scale

### Primary (Brand)

Light mode:

```css
--color-primary-50:  hsl(217 100% 97%);
--color-primary-100: hsl(217  95% 93%);
--color-primary-200: hsl(217  91% 86%);
--color-primary-300: hsl(217  88% 75%);
--color-primary-400: hsl(217  85% 65%);
--color-primary-500: hsl(217  85% 55%);  /* default brand */
--color-primary-600: hsl(217  85% 45%);
--color-primary-700: hsl(217  85% 36%);
--color-primary-800: hsl(217  85% 28%);
--color-primary-900: hsl(217  85% 20%);
--color-primary-950: hsl(217  85% 12%);
```

Dark mode shifts lightness +10–15% on 400–600 to maintain contrast on dark surfaces. Specific values authored in `tokens.css [data-theme="dark"]` block.

### Neutral (Surface, Border, Text)

11-step neutral scale (`--color-neutral-50` through `--color-neutral-950`).
Light surface base: `neutral-50`. Dark surface base: `neutral-950`.

### Semantic

```css
--color-success-500
--color-warning-500
--color-danger-500
--color-info-500
```

Each with -50 (background tint) and -700 (foreground/text) variants for badge styling.

### Contrast Guarantees

| Pairing | Min ratio | Token |
|---------|-----------|-------|
| Body text on background | 4.5:1 | `neutral-900` on `neutral-50` (light) / `neutral-100` on `neutral-950` (dark) |
| Heading text on background | 4.5:1 | same as body |
| Disabled text on background | 3:1 | `neutral-500` on surface |
| Interactive element border | 3:1 | `neutral-300` (light) / `neutral-700` (dark) on surface |
| Focus ring | 3:1 | `primary-500` on surface |

All pairings auto-tested via vitest-axe.

---

## Typography

```css
--font-family-display: 'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif;
--font-family-body:    'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif;
--font-family-mono:    ui-monospace, 'Cascadia Mono', 'Fira Code', monospace;

--font-size-xs:   0.75rem;   /* 12px */
--font-size-sm:   0.875rem;  /* 14px */
--font-size-base: 1rem;      /* 16px */
--font-size-lg:   1.125rem;  /* 18px */
--font-size-xl:   1.25rem;   /* 20px */
--font-size-2xl:  1.5rem;    /* 24px */
--font-size-3xl:  1.875rem;  /* 30px */
--font-size-4xl:  2.25rem;   /* 36px */

--font-weight-regular:  400;
--font-weight-medium:   500;
--font-weight-semibold: 600;
--font-weight-bold:     700;

--line-height-tight:   1.25;
--line-height-normal:  1.5;
--line-height-relaxed: 1.7;  /* preferred for Arabic body */
```

---

## Spacing (4px base)

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
--space-20: 5rem;
--space-24: 6rem;
```

---

## Radius

```css
--radius-sm:   0.25rem;
--radius-md:   0.5rem;
--radius-lg:   0.75rem;
--radius-xl:   1rem;
--radius-full: 9999px;
```

---

## Shadow

```css
--shadow-sm: 0 1px 2px hsl(217 30% 15% / 0.05);
--shadow-md: 0 4px 8px hsl(217 30% 15% / 0.08);
--shadow-lg: 0 12px 24px hsl(217 30% 15% / 0.10);
--shadow-xl: 0 24px 48px hsl(217 30% 15% / 0.12);
```

Dark mode shadows tuned with higher opacity on a deeper hue.

---

## Motion

```css
--duration-fast:   120ms;
--duration-normal: 200ms;
--duration-slow:   320ms;
--easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
--easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

All animations must respect `@media (prefers-reduced-motion: reduce)` → set `transition-duration: 0ms` on global rule.

---

## Tailwind Binding

`tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        50: 'var(--color-primary-50)',
        // ... full scale
        950: 'var(--color-primary-950)',
      },
      neutral: { /* same */ },
      success: { /* same */ },
      warning: { /* same */ },
      danger:  { /* same */ },
      info:    { /* same */ },
    },
    fontFamily: {
      display: ['var(--font-family-display)'],
      sans:    ['var(--font-family-body)'],
      mono:    ['var(--font-family-mono)'],
    },
    spacing: { /* mapped from --space-* */ },
    borderRadius: { /* mapped from --radius-* */ },
    boxShadow: { /* mapped from --shadow-* */ },
    transitionDuration: { fast: '120ms', normal: '200ms', slow: '320ms' },
  },
}
```

---

## TypeScript Token Helper

`src/lib/tokens.ts`:

```ts
export const TOKEN = {
  color: {
    primary: { 50: 'var(--color-primary-50)', /* ... */ } as const,
    // ...
  },
  // ...
} as const

export type ColorTokenName = keyof typeof TOKEN.color
```

Used only when components need to read tokens dynamically (e.g. canvas/charts). Most styling stays in Tailwind classes.

---

## Migration Strategy (informational, not contract)

1. Author `tokens.css` with all v2 values.
2. Update `tailwind.config.js` to bind.
3. Replace shadcn-ui primitive component skins one by one (`button`, `input`, `card`, ...).
4. Visual regression: run `pnpm dev`, walk each page in the Style Guide (`/design-system`).
5. Verify Lighthouse a11y ≥ 95 on representative pages.

---

## Test Contract

| Test | Assertion |
|------|-----------|
| Token names match between `tokens.css`, `lib/tokens.ts`, and `tailwind.config.js` | Static check via test file `src/styles/__tests__/tokens.test.ts`. |
| Light/dark contrast for body text ≥ 4.5:1 | Computed at test time using token HSL values. |
| `prefers-reduced-motion` disables transitions | DOM test with `matchMedia` mock. |
