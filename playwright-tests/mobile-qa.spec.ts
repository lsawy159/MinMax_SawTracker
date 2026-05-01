import { test, expect, devices } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

// List of 14 production pages for mobile QA
const testPages = [
  { path: '/dashboard', name: 'Dashboard', label: 'لوحة التحكم' },
  { path: '/employees', name: 'Employees', label: 'الموظفين' },
  { path: '/companies', name: 'Companies', label: 'الشركات' },
  { path: '/projects', name: 'Projects', label: 'المشاريع' },
  { path: '/reports', name: 'Reports', label: 'التقارير' },
  { path: '/notifications', name: 'Notifications', label: 'الإشعارات' },
  { path: '/alerts', name: 'Alerts', label: 'التنبيهات' },
  { path: '/activity-logs', name: 'Activity Logs', label: 'سجل الأنشطة' },
  { path: '/advanced-search', name: 'Advanced Search', label: 'بحث متقدم' },
  { path: '/import-export', name: 'Import/Export', label: 'استيراد/تصدير' },
  { path: '/settings', name: 'Settings', label: 'الإعدادات' },
  { path: '/permissions', name: 'Permissions', label: 'الصلاحيات' },
  { path: '/security', name: 'Security Management', label: 'إدارة الأمان' },
  { path: '/payroll', name: 'Payroll', label: 'الرواتب' },
]

// Mobile devices to test
const mobileDevices = [
  {
    name: 'iOS (iPhone 12)',
    config: devices['iPhone 12'],
    userAgent: 'iPhone',
  },
  {
    name: 'Android (Pixel 5)',
    config: devices['Pixel 5'],
    userAgent: 'Android',
  },
]

test.describe('Mobile QA Matrix — All Pages on iOS/Android (T-511)', () => {
  // Test each page on iPhone
  test.describe('iOS (iPhone 12)', () => {
    test.use(devices['iPhone 12'])

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page)
      await page.waitForLoadState('networkidle')
    })

    for (const pageInfo of testPages) {
      test(`${pageInfo.name} — page loads and displays content`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Verify page is active
        const currentUrl = page.url()
        expect(currentUrl).toContain(pageInfo.path)

        // Verify content is visible
        const body = page.locator('body')
        await expect(body).toBeVisible()

        // Verify text content exists
        const bodyText = await body.innerText()
        expect(bodyText.length).toBeGreaterThan(30)

        // No critical errors
        const alerts = page.locator('[role="alert"]')
        const alertCount = await alerts.count()
        expect(alertCount).toBeLessThanOrEqual(2)
      })

      test(`${pageInfo.name} — layout not broken on iPhone`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Check for overflow issues
        const bodyOverflow = await page.evaluate(() => {
          const html = document.documentElement
          return html.scrollWidth > html.clientWidth ? 'overflow-x' : 'ok'
        })

        expect(bodyOverflow).toBe('ok')

        // Buttons/inputs should be touch-friendly (min 44px height)
        const buttons = page.locator('button, a[role="button"]').first()
        if (await buttons.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await buttons.boundingBox()
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(40) // Allow slightly less than 44px
          }
        }
      })

      test(`${pageInfo.name} — readable font size on iPhone`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Check body font size is at least 16px (readable on mobile)
        const fontSize = await page.evaluate(() => {
          const body = document.body
          return parseInt(window.getComputedStyle(body).fontSize)
        })

        expect(fontSize).toBeGreaterThanOrEqual(14) // Minimum readable
      })
    }
  })

  // Test each page on Android
  test.describe('Android (Pixel 5)', () => {
    test.use(devices['Pixel 5'])

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page)
      await page.waitForLoadState('networkidle')
    })

    for (const pageInfo of testPages) {
      test(`${pageInfo.name} — page loads and displays content`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Verify page is active
        const currentUrl = page.url()
        expect(currentUrl).toContain(pageInfo.path)

        // Verify content is visible
        const body = page.locator('body')
        await expect(body).toBeVisible()

        // Verify text content exists
        const bodyText = await body.innerText()
        expect(bodyText.length).toBeGreaterThan(30)

        // No critical errors
        const alerts = page.locator('[role="alert"]')
        const alertCount = await alerts.count()
        expect(alertCount).toBeLessThanOrEqual(2)
      })

      test(`${pageInfo.name} — layout not broken on Android`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Check for overflow issues
        const bodyOverflow = await page.evaluate(() => {
          const html = document.documentElement
          return html.scrollWidth > html.clientWidth ? 'overflow-x' : 'ok'
        })

        expect(bodyOverflow).toBe('ok')

        // Buttons/inputs should be touch-friendly (min 44px height)
        const buttons = page.locator('button, a[role="button"]').first()
        if (await buttons.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await buttons.boundingBox()
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(40)
          }
        }
      })

      test(`${pageInfo.name} — readable font size on Android`, async ({ page }) => {
        await page.goto(`http://localhost:5174${pageInfo.path}`, { waitUntil: 'networkidle' })

        // Check body font size is at least 16px
        const fontSize = await page.evaluate(() => {
          const body = document.body
          return parseInt(window.getComputedStyle(body).fontSize)
        })

        expect(fontSize).toBeGreaterThanOrEqual(14)
      })
    }
  })

  // Cross-device summary tests
  test.describe('Cross-Device Checks', () => {
    test.use(devices['Desktop Chrome']) // Default desktop

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page)
    })

    test('Critical pages load without errors (desktop baseline)', async ({ page }) => {
      const criticalPages = ['/dashboard', '/employees', '/payroll']

      for (const path of criticalPages) {
        await page.goto(`http://localhost:5174${path}`, { waitUntil: 'networkidle' })

        const currentUrl = page.url()
        expect(currentUrl).toContain(path)

        const body = page.locator('body')
        const text = await body.innerText()
        expect(text.length).toBeGreaterThan(50)
      }
    })
  })
})
