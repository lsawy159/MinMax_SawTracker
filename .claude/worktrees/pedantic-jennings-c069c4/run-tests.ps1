# Script مؤقت لتشغيل الاختبارات بدون إضافة Node للـ PATH

$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  تشغيل اختبارات Vitest (Unit Tests)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# تشغيل Vitest
& "C:\Program Files\nodejs\node.exe" "$PSScriptRoot\node_modules\vitest\vitest.mjs" run

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ملخص اختبارات Playwright" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  لتشغيل اختبارات Playwright:" -ForegroundColor Yellow
Write-Host "   1. شغّل التطبيق: & 'C:\Program Files\nodejs\node.exe' .\node_modules\vite\bin\vite.js" -ForegroundColor White
Write-Host "   2. في terminal آخر: & 'C:\Program Files\nodejs\node.exe' .\node_modules\@playwright\test\cli.js test" -ForegroundColor White
Write-Host ""
