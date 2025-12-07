# Deploy Backup Manager locally
Write-Host "Building and deploying Backup Manager..." -ForegroundColor Green

# 1. Create server/public directory if it doesn't exist
Write-Host "Creating server/public directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "server/public" -Force | Out-Null

# 2. Copy built client files to server/public
Write-Host "Copying frontend files..." -ForegroundColor Yellow
Copy-Item -Path "client/dist/*" -Destination "server/public" -Recurse -Force

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "You can now start the server with: cd server; npm start" -ForegroundColor Cyan
