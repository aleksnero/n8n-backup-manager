# Build Deployment Archive Script v1.3.5


Write-Host "Starting build process..." -ForegroundColor Cyan

# 1. Build Client
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location "client"
# Check if node_modules exists, if not install dependencies
if (!(Test-Path "node_modules")) {
    Write-Host "Installing client dependencies..." -ForegroundColor Yellow
    npm install
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed!"
    exit 1
}
Set-Location ".."

# 2. Prepare Public Directory
Write-Host "Updating server/public..." -ForegroundColor Yellow
if (!(Test-Path "server/public")) {
    New-Item -ItemType Directory -Force "server/public" | Out-Null
}
Copy-Item -Recurse -Force "client/dist/*" "server/public"

# 3. Create Temporary Deploy Directory
Write-Host "Preparing deployment package..." -ForegroundColor Yellow
if (Test-Path "deploy") {
    Remove-Item -Recurse -Force "deploy"
}
New-Item -ItemType Directory -Force "deploy" | Out-Null

# 4. Copy Server Files
$filesToCopy = @(
    "server/package.json",
    "server/index.js",
    "server/database.js",
    "server/routes",
    "server/services",
    "server/models",
    "server/middleware",
    "server/public",
    "version.json",
    "news.json"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item -Recurse -Force $file "deploy/"
    }
    else {
        Write-Warning "File not found: $file"
    }
}

# 5. Create Zip Archive (using Node AdmZip to ensure Linux-compatible forward slash '/' paths)
Write-Host "Creating Linux-compatible zip archives..." -ForegroundColor Yellow
if (Test-Path "deploy.zip") { Remove-Item -Force "deploy.zip" }

node -e "
const AdmZip = require('./server/node_modules/adm-zip');
const zip = new AdmZip();
zip.addLocalFolder('deploy');
zip.writeZip('deploy.zip');

const version = require('./version.json').version || '1.6.0';
const updateZipName = 'backup_v' + version + '.zip';
zip.writeZip(updateZipName);
console.log('Created deploy.zip and ' + updateZipName);
"

# 6. Cleanup
Remove-Item -Recurse -Force "deploy"

Write-Host "Success! deploy.zip and backup_v*.zip created." -ForegroundColor Green
Write-Host "You can now upload backup_v*.zip directly in the Updates web page!" -ForegroundColor Cyan
