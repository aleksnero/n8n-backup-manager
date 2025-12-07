Write-Host "Creating deployment package for n8n Backup Manager..." -ForegroundColor Green

# 1. Prepare frontend
Write-Host "`n[1/3] Preparing frontend..." -ForegroundColor Yellow

# Build frontend
if (Test-Path "client") {
    Write-Host "Building frontend..." -ForegroundColor Cyan
    Push-Location "client"
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing frontend dependencies..." -ForegroundColor Gray
            npm install
        }
        Write-Host "Running build..." -ForegroundColor Gray
        npm run build
    }
    catch {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

if (-Not (Test-Path "server/public")) {
    New-Item -ItemType Directory -Path "server/public" -Force | Out-Null
}

if (Test-Path "client/dist") {
    Write-Host "Copying frontend to server/public..." -ForegroundColor Cyan
    Copy-Item -Path "client/dist/*" -Destination "server/public" -Recurse -Force
    Write-Host "Frontend prepared successfully." -ForegroundColor Green
}
else {
    Write-Host "WARNING: client/dist not found after build. Frontend won't be included!" -ForegroundColor Red
    exit 1
}

# 2. Create deployment package
Write-Host "`n[2/3] Creating deployment package..." -ForegroundColor Yellow
$exclude = @("node_modules", ".git", "backups", "data", "deploy.zip", "deploy.tar.gz", "create_deploy_package.ps1", "deploy_temp", ".gemini", "deploy_local.ps1")
$source = Get-Location
$tempDir = Join-Path $source "deploy_temp"

# Get version from package.json
$packageJson = Get-Content "server/package.json" | ConvertFrom-Json
$version = $packageJson.version
$zipName = "deploy_v$version.zip"
$destination = Join-Path $source $zipName

# Clean up previous runs
if (Test-Path $destination) { Remove-Item $destination }
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# Create temp dir
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files to temp dir, excluding specified items
Get-ChildItem -Path $source -Exclude $exclude | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
}

# Zip the temp dir contents
Compress-Archive -Path "$tempDir\*" -DestinationPath $destination

# Cleanup temp dir
Remove-Item $tempDir -Recurse -Force

Write-Host "`n[3/3] Package created successfully!" -ForegroundColor Green
Write-Host "File: $destination" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round((Get-Item $destination).Length / 1MB, 2)) MB" -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Upload deploy.zip to your server using WinSCP/FileZilla" -ForegroundColor White
Write-Host "2. Follow deployment_guide.md section 3-4 to deploy on server" -ForegroundColor White
