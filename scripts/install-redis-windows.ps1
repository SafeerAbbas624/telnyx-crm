# Install Redis for Windows
Write-Host "🚀 Installing Redis for Windows..." -ForegroundColor Green

# Create Redis directory
$redisDir = "C:\Redis"
if (-not (Test-Path $redisDir)) {
    New-Item -ItemType Directory -Path $redisDir -Force
    Write-Host "✅ Created Redis directory: $redisDir" -ForegroundColor Green
}

# Download Redis for Windows
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.zip"
$redisZip = "$redisDir\Redis.zip"

Write-Host "📥 Downloading Redis..." -ForegroundColor Blue
try {
    Invoke-WebRequest -Uri $redisUrl -OutFile $redisZip
    Write-Host "✅ Redis downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download Redis: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Extract Redis
Write-Host "📦 Extracting Redis..." -ForegroundColor Blue
try {
    Expand-Archive -Path $redisZip -DestinationPath $redisDir -Force
    Write-Host "✅ Redis extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to extract Redis: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Start Redis server
Write-Host "🚀 Starting Redis server..." -ForegroundColor Blue
$redisServer = "$redisDir\redis-server.exe"

if (Test-Path $redisServer) {
    # Start Redis in background
    Start-Process -FilePath $redisServer -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    # Test Redis connection
    $redisClient = "$redisDir\redis-cli.exe"
    if (Test-Path $redisClient) {
        try {
            $result = & $redisClient ping
            if ($result -eq "PONG") {
                Write-Host "✅ Redis is running successfully!" -ForegroundColor Green
                Write-Host "🎉 Redis installed and started on localhost:6379" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Redis may not be responding correctly" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️ Could not test Redis connection" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ Redis server executable not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 Redis Installation Complete!" -ForegroundColor Green
Write-Host "Now restart your CRM development server to see the caching benefits:" -ForegroundColor Blue
Write-Host "1. Stop the current server (Ctrl+C)" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. You should see Redis connection success messages!" -ForegroundColor White
