# Verify Deploy Zip Content v1.3.5


$zipPath = "deploy.zip"

if (-not (Test-Path $zipPath)) {
    Write-Error "deploy.zip not found!"
    exit 1
}

Write-Host "Verifying deploy.zip content..." -ForegroundColor Cyan

# Create temp dir for verification
$tempDir = "verify_temp"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Force $tempDir | Out-Null

# Extract specific files to check
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

# Check 1: BackupService JSON Fix
$backupService = Get-Content "$tempDir/services/backupService.js" -Raw
if ($backupService -match "typeof credsStr === 'string' \? JSON.parse\(credsStr\)") {
    Write-Host "[OK] BackupService contains JSON fix." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] BackupService MISSING JSON fix!" -ForegroundColor Red
}

# Check 2: Backups.jsx Window.Confirm Fix (Client is compiled, so we check if the string exists in the bundle)
# We need to find the JS file in public/assets
$jsFiles = Get-ChildItem "$tempDir/public/assets/*.js"
$foundConfirm = $false
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "window\.confirm") {
        $foundConfirm = $true
        break
    }
}

if ($foundConfirm) {
    Write-Host "[OK] Client bundle contains window.confirm." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Client bundle MISSING window.confirm! (Did you run npm run build?)" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host "Verification complete." -ForegroundColor Cyan
