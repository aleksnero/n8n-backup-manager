# Verify Deploy Zip Content v1.6.0

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

# Extract files to check
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

# Check 1: BackupService JSON Fix
$backupService = Get-Content "$tempDir/services/backupService.js" -Raw
if ($backupService -match "typeof credsStr === 'string' \? JSON.parse\(credsStr\)") {
    Write-Host "[OK] BackupService contains JSON fix." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] BackupService MISSING JSON fix!" -ForegroundColor Red
}

# Check 2: Integrity Service Heuristics
$integrityService = Get-Content "$tempDir/services/integrityService.js" -Raw
if ($integrityService -match "Database appears stale" -and $integrityService -match "Significant workflow drop") {
    Write-Host "[OK] IntegrityService contains Freshness Heuristic & Delta Anomaly Guard." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] IntegrityService MISSING heuristics!" -ForegroundColor Red
}

# Check 3: Client bundle verification
$jsFiles = Get-ChildItem "$tempDir/public/assets/*.js"
if ($jsFiles.Count -gt 0) {
    Write-Host "[OK] Client bundle exists ($($jsFiles.Count) files in public/assets)." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Client bundle MISSING in public/assets!" -ForegroundColor Red
}

# Check 4: version.json
if (Test-Path "$tempDir/version.json") {
    $versionContent = Get-Content "$tempDir/version.json" -Raw | ConvertFrom-Json
    Write-Host "[OK] version.json present (version $($versionContent.version))." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] version.json MISSING!" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host "Verification complete." -ForegroundColor Cyan
