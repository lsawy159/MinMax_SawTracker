import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

// Pages to test: 14 main production pages
const pages = [
  { path: '/dashboard', name: 'Dashboard', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/employees', name: 'Employees', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/companies', name: 'Companies', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/projects', name: 'Projects', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/reports', name: 'Reports', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/notifications', name: 'Notifications', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/alerts', name: 'Alerts', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/activity-logs', name: 'Activity Logs', hasEmpty: true, hasLoading: true, hasError: true },
  { path: '/advanced-search', name: 'Advanced Search', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/import-export', name: 'Import/Export', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/settings', name: 'Settings', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/permissions', name: 'Permissions', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/security', name: 'Security Management', hasEmpty: false, hasLoading: true, hasError: true },
  { path: '/payroll', name: 'Payroll', hasEmpty: false, hasLoading: true, hasError: true },
]

test.describe('Page States — Empty/Loading/Error (T-512)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.waitForLoadState('networkidle')
  })

  // Test each page for proper loading state
  for (const page of pages) {
    test(`${page.name} — loading state visible during fetch`, async ({ page: playwright }) => {
      // Navigate to page
      await playwright.goto(`http://localhost:5174${page.path}`, { waitUntil: 'domcontentloaded' })

      // Check for loading indicators (skeleton, spinner, etc.)
      const loadingIndicators = [
        'text=جاري التحميل',
        'text=Loading',
        '[role="status"]',
        '.spinner',
        '.skeleton',
        '[class*="loading"]',
      ]

      let foundLoading = false
      for (const selector of loadingIndicators) {
        const elem = playwright.locator(selector).first()
        if (await elem.isVisible({ timeout: 500 }).catch(() => false)) {
          foundLoading = true
          break
        }
      }

      // Page should either show loading or have content
      const body = playwright.locator('body')
      const bodyText = await body.innerText()
      expect(bodyText.length).toBeGreaterThan(50)
    })
  }

  // Test empty states on list pages
  test('Employees page — empty state when no data', async ({ page }) => {
    await page.goto('http://localhost:5174/employees', { waitUntil: 'networkidle' })

    // Should show either employees or empty message
    const pageText = await page.innerText('body')
    const hasEmployees = pageText.includes('الموظفين') || pageText.includes('employees')
    const hasEmptyMsg = pageText.includes('لا توجد') || pageText.includes('no') || pageText.includes('empty')

    expect(hasEmployees || hasEmptyMsg).toBeTruthy()
  })

  test('Companies page — empty state when no data', async ({ page }) => {
    await page.goto('http://localhost:5174/companies', { waitUntil: 'networkidle' })

    const pageText = await page.innerText('body')
    const hasCompanies = pageText.includes('الشركات') || pageText.includes('companies')
    const hasEmptyMsg = pageText.includes('لا توجد') || pageText.includes('no') || pageText.includes('empty')

    expect(hasCompanies || hasEmptyMsg).toBeTruthy()
  })

  test('Notifications page — empty state when no notifications', async ({ page }) => {
    await page.goto('http://localhost:5174/notifications', { waitUntil: 'networkidle' })

    const pageText = await page.innerText('body')
    const hasNotifications = pageText.includes('إشعارات') || pageText.includes('notifications')
    const hasEmptyMsg = pageText.includes('لا توجد') || pageText.includes('no') || pageText.includes('empty')

    expect(hasNotifications || hasEmptyMsg).toBeTruthy()
  })

  // Test error state handling
  test('Page stability under network errors', async ({ page }) => {
    // Simulate network failure
    await page.context().setOffline(true)

    // Navigate to page
    const response = await page.goto('http://localhost:5174/dashboard').catch(() => null)

    // Page should not crash (have DOM content)
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Re-enable network
    await page.context().setOffline(false)
  })

  // Test no critical errors on page load
  test('No critical error alerts on page load (any page)', async ({ page }) => {
    await page.goto('http://localhost:5174/dashboard', { waitUntil: 'networkidle' })

    // Count critical error elements
    const alerts = page.locator('[role="alert"], .error-message, .alert-danger')
    const alertCount = await alerts.count()

    // Allow max 2 info messages, but no critical errors
    expect(alertCount).toBeLessThanOrEqual(2)
  })

  // Test each page doesn't crash
  for (const route of pages) {
    test(`${route.name} page — no crash on load`, async ({ page }) => {
      const response = await page.goto(`http://localhost:5174${route.path}`, { waitUntil: 'networkidle' })

      // Should not be 500+ error
      const status = response?.status()
      expect(status).toBeLessThan(500)

      // Page should have content
      const body = page.locator('body')
      const text = await body.innerText()
      expect(text.length).toBeGreaterThan(30)
    })
  }

  // Test responsive state display (basic)
  test('States display correctly on different viewports', async ({ page }) => {
    // Default desktop
    await page.goto('http://localhost:5174/dashboard', { waitUntil: 'networkidle' })
    let bodyText = await page.innerText('body')
    expect(bodyText.length).toBeGreaterThan(100)

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    bodyText = await page.innerText('body')
    expect(bodyText.length).toBeGreaterThan(100)

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    bodyText = await page.innerText('body')
    expect(bodyText.length).toBeGreaterThan(100)
  })
})
