$ErrorActionPreference = "Stop"

Write-Host "Building Client..."
Set-Location "client"
npm install
npm run build
if ($LASTEXITCODE -ne 0) { throw "Client build failed" }
Set-Location ".."

Write-Host "Cleaning Server Public Directory..."
if (Test-Path "server/public") {
    Remove-Item -Path "server/public" -Recurse -Force
}
New-Item -ItemType Directory -Path "server/public" | Out-Null

Write-Host "Copying Client Build to Server..."
Copy-Item -Path "client/dist/*" -Destination "server/public" -Recurse

Write-Host "Creating Release Archive..."
$exclude = @("node_modules", "data", "backups", ".env", ".git", ".gitignore", "package-lock.json")
$serverPath = Resolve-Path "server"
$releaseZip = "release.zip"

if (Test-Path $releaseZip) {
    Remove-Item $releaseZip -Force
}

# Create a temporary directory for packaging
$tempDir = "temp_release"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy server files
Copy-Item -Path "server/*" -Destination "$tempDir" -Recurse
# Remove excluded items from temp
foreach ($item in $exclude) {
    if (Test-Path "$tempDir/$item") {
        Remove-Item "$tempDir/$item" -Recurse -Force
    }
}

# Zip the contents of the temp directory
Compress-Archive -Path "$tempDir/*" -DestinationPath $releaseZip -Force

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host "Release build complete: $releaseZip"
