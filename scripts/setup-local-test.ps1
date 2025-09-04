# Simple Local Setup Script for Enterprise CRM Testing
Write-Host "🚀 Setting up Enterprise CRM Optimizations Locally..." -ForegroundColor Green

# Step 1: Install Node.js dependencies
Write-Host "📦 Installing enterprise dependencies..." -ForegroundColor Blue
npm install --save ioredis bull "@elastic/elasticsearch" react-window react-window-infinite-loader "@types/react-window"
npm install --save-dev "@types/bull"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 2: Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

# Step 3: Apply database migrations
Write-Host "🗄️ Applying database migrations..." -ForegroundColor Blue
npx prisma migrate dev --name add_enterprise_optimizations

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database migrations applied" -ForegroundColor Green
} else {
    Write-Host "⚠️ Database migrations may have issues, but continuing..." -ForegroundColor Yellow
}

# Step 4: Check Redis
Write-Host "🔍 Checking Redis..." -ForegroundColor Blue
try {
    $redisResult = redis-cli ping 2>$null
    if ($redisResult -eq "PONG") {
        Write-Host "✅ Redis is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Redis not responding" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Redis not installed. Install with: docker run -d -p 6379:6379 redis:latest" -ForegroundColor Yellow
}

# Step 5: Check Elasticsearch
Write-Host "🔍 Checking Elasticsearch..." -ForegroundColor Blue
try {
    $esResponse = Invoke-RestMethod -Uri "http://localhost:9200" -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Elasticsearch is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Elasticsearch not available. For 500K+ contacts, install with:" -ForegroundColor Yellow
    Write-Host "   docker run -d -p 9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false elasticsearch:8.11.0" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "1. Start dev server: npm run dev" -ForegroundColor White
Write-Host "2. Test at: http://localhost:3000" -ForegroundColor White
Write-Host "3. Check contact performance improvements" -ForegroundColor White
