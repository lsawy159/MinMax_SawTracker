param(
    [string]$SrcDir = ".\src"
)

$mappingFile = ".\.claude\icon-migration.json"
if (-not (Test-Path $mappingFile)) {
    Write-Error "Icon mapping file not found: $mappingFile"
    exit 1
}

$mapping = Get-Content $mappingFile | ConvertFrom-Json
$lucideToPhosphor = $mapping.lucide_to_phosphor

$files = Get-ChildItem -Path $SrcDir -Filter "*.tsx" -Recurse
$migratedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Check if file imports from lucide-react
    if ($content -notmatch "from ['`"]lucide-react['`"]") {
        continue
    }

    # Extract imports: find lines like: import { Icon1, Icon2 as Alias } from 'lucide-react'
    if ($content -match "import\s+\{([^}]+)\}\s+from\s+['`"]lucide-react['`"]") {
        $imports = $matches[1]
        $importItems = @()

        # Split by comma and process each
        $imports -split ',' | ForEach-Object {
            $item = $_.Trim()
            if ($item -match "(\w+)\s+as\s+(\w+)") {
                $originalIcon = $matches[1]
                $alias = $matches[2]
                $mappedIcon = if ($lucideToPhosphor.PSObject.Properties.Name -contains $originalIcon) {
                    $lucideToPhosphor.$originalIcon
                } else {
                    $originalIcon
                }
                $importItems += "$mappedIcon as $alias"

                # Replace usage: Alias → MappedIcon
                $content = $content -replace "\b$alias\b", $mappedIcon
            } else {
                $mappedIcon = if ($lucideToPhosphor.PSObject.Properties.Name -contains $item) {
                    $lucideToPhosphor.$item
                } else {
                    $item
                }
                $importItems += $mappedIcon
            }
        }

        # Replace import line
        $newImport = "import { $($importItems -join ', ') } from '@phosphor-icons/react'"
        $content = $content -replace "import\s+\{[^}]+\}\s+from\s+['`"]lucide-react['`"]", $newImport

        # Write updated content
        Set-Content -Path $file.FullName -Value $content
        $migratedCount++
        Write-Host "OK: $($file.Name)"
    }
}

Write-Host "`nDone: $migratedCount files"
