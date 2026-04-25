param(
    [string]$SrcDir = ".\src"
)

$files = Get-ChildItem -Path $SrcDir -Filter "*.tsx" -Recurse
$fixedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content

    # Replace all JSX icon usages with className with a wrapper approach
    # <IconName className="..." /> becomes <IconName className="..." weight="fill" />
    # OR replace className with direct styling

    # For now, add weight prop to all @phosphor-icons usages
    $content = $content -replace '(<[A-Z][a-zA-Z]*(?:Icon)?(?:\s+[a-zA-Z]+="[^"]*")*\s+className="[^"]*")(\s*/>)', '$1 weight="fill"$2'

    # Fix icon name usages: Edit2 -> PencilSimple, Trash2 -> Trash, Save -> FloppyDisk, etc.
    # Only if they match the icon usage pattern
    $replacements = @{
        '\b(Edit|Edit2)\b' = 'PencilSimple'
        '\b(Trash|Trash2)\b' = 'Trash'
        '\bSave\b' = 'FloppyDisk'
        '\bRefreshCcw\b' = 'ArrowCounterClockwise'
        '\bAlertCircle\b' = 'Warning'
        '\bUserX\b' = 'User'
    }

    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        $content = $content -replace $pattern, $replacement
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content
        $fixedCount++
        Write-Host "Fixed: $($file.Name)"
    }
}

Write-Host "`nFixed: $fixedCount files"
