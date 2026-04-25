import { Page } from '@playwright/test';

/**
 * دالة مساعدة لتسجيل الدخول
 * تُستخدم في جميع الاختبارات التي تحتاج لـ authenticated user
 */
export async function loginAsAdmin(page: Page) {
  console.log('🔐 [Auth Helper] Starting login...')
  
  await page.goto('http://localhost:5174/login');
  console.log('📍 [Auth Helper] At login page')
  
  // Wait for email input to be ready
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  await page.fill('input[type="email"]', 'ahmad.alsawy159@gmail.com');
  console.log('📧 [Auth Helper] Email filled')
  
  await page.fill('input[type="password"]', 'password123');
  console.log('🔑 [Auth Helper] Password filled')
  
  // Click login button - try multiple selectors
  let loginButton = page.locator('button:has-text("تسجيل الدخول")');
  if (await loginButton.count() === 0) {
    loginButton = page.locator('button:has-text("دخول")');
  }
  if (await loginButton.count() === 0) {
    loginButton = page.locator('button[type="submit"]');
  }
  
  if (await loginButton.count() > 0) {
    await loginButton.click();
    console.log('🔘 [Auth Helper] Login button clicked')
  } else {
    console.error('❌ [Auth Helper] Could not find login button')
    throw new Error('Login button not found')
  }
  
  // Wait for navigation - try multiple routes since app might redirect differently
  try {
    await page.waitForURL(/\/(dashboard|companies|home)/, { timeout: 15000 });
    console.log(`✅ [Auth Helper] Navigated to: ${page.url()}`)
  } catch (e) {
    console.error(`❌ [Auth Helper] Navigation timeout. Current URL: ${page.url()}`)
    // Still continue, URL might have changed but waitForURL timeout
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }
  
  // Final wait for page stability
  await page.waitForTimeout(1500);
  console.log(`✅ [Auth Helper] Login complete, URL: ${page.url()}`)
}

/**
 * دالة مساعدة للتحقق من تسجيل الخروج
 */
export async function logout(page: Page) {
  // ابحث عن زر تسجيل الخروج (LogOut)
  const logoutButton = page.locator('button:has-text("تسجيل خروج"), button:has-text("خروج"), button:has-text("Logout")').first();
  
  if (await logoutButton.count() === 0) {
    // قد يكون الزر مختفي تحت قائمة، ابحث عن قائمة المستخدم أولاً
    const userMenuButton = page.locator('button[aria-label*="ملف شخصي"], button[aria-label*="profile"], [data-testid="user-menu"], button:has-text("ملف شخصي")').first();
    
    if (await userMenuButton.count() > 0) {
      await userMenuButton.click();
      await page.waitForTimeout(300);
    }
  }

  // حاول النقر على زر تسجيل الخروج
  const logoutBtn = page.locator('button:has-text("تسجيل خروج"), button:has-text("خروج")').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1000);
  }
}
