param(
    [string]$SrcDir = ".\src"
)

$files = Get-ChildItem -Path $SrcDir -Filter "*.tsx" -Recurse | Where-Object { $_.FullName -notmatch '\.claude' }
$fixedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Remove className from phosphor icon usages: <Icon className="..." /> -> <Icon />
    # Match pattern: <IconName className="..." />
    # BUT keep the closing bracket: />

    $content = $content -replace '<([A-Z][a-zA-Z]*)\s+className="[^"]*"\s*/>', '<$1 />'

    # Also handle when there are other props after className
    $content = $content -replace 'className="[^"]*"\s+/>', '/>'
    $content = $content -replace 'className="[^"]*"\s+(?=[a-zA-Z])', ''

    Set-Content -Path $file.FullName -Value $content
    $fixedCount++
}

Write-Host "Removed className from all icons: $fixedCount files processed"
