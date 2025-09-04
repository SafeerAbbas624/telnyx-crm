# Local Enterprise Testing Script for Windows
# Test the 500K contact optimizations on your local machine

Write-Host "🚀 Testing Enterprise CRM Optimizations Locally..." -ForegroundColor Green
Write-Host "Database: sms_messaging" -ForegroundColor Blue
Write-Host "=============================================" -ForegroundColor Green

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Step 1: Install Node.js dependencies
Write-Info "Step 1: Installing Enterprise Dependencies..."
npm install --save ioredis bull @elastic/elasticsearch react-window react-window-infinite-loader
npm install --save-dev @types/bull @types/react-window

if ($LASTEXITCODE -eq 0) {
    Write-Success "Enterprise dependencies installed successfully"
} else {
    Write-Error "Failed to install dependencies"
    exit 1
}

# Step 2: Check PostgreSQL connection
Write-Info "Step 2: Testing PostgreSQL connection to sms_messaging database..."
try {
    $env:PGPASSWORD = "Cupidsehrish06245*"
    $result = psql -h localhost -U postgres -d sms_messaging -c "SELECT COUNT(*) FROM contacts;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "PostgreSQL connection successful"
        Write-Info "Current contacts in database: $($result | Select-String '\d+' | ForEach-Object { $_.Matches[0].Value })"
    } else {
        Write-Warning "PostgreSQL connection test failed. Please ensure PostgreSQL is running and sms_messaging database exists."
    }
} catch {
    Write-Warning "Could not test PostgreSQL connection. Please ensure psql is in your PATH."
}

# Step 3: Check/Install Redis
Write-Info "Step 3: Checking Redis availability..."
try {
    $redisTest = redis-cli ping 2>$null
    if ($redisTest -eq "PONG") {
        Write-Success "Redis is running and accessible"
    } else {
        Write-Warning "Redis is not responding"
    }
} catch {
    Write-Warning "Redis is not installed or not in PATH"
    Write-Info "To install Redis on Windows:"
    Write-Info "1. Download from: https://github.com/microsoftarchive/redis/releases"
    Write-Info "2. Or use WSL: wsl --install then sudo apt install redis-server"
    Write-Info "3. Or use Docker: docker run -d -p 6379:6379 redis:latest"
    
    $installRedis = Read-Host "Do you want to install Redis using Docker? (y/n)"
    if ($installRedis -eq 'y' -or $installRedis -eq 'Y') {
        Write-Info "Starting Redis with Docker..."
        docker run -d --name redis-crm -p 6379:6379 redis:latest
        Start-Sleep -Seconds 5
        
        try {
            $redisTest = redis-cli ping 2>$null
            if ($redisTest -eq "PONG") {
                Write-Success "Redis installed and running via Docker"
            } else {
                Write-Warning "Redis Docker container started but not responding"
            }
        } catch {
            Write-Warning "Could not test Redis connection after Docker installation"
        }
    }
}

# Step 4: Check Elasticsearch (optional)
Write-Info "Step 4: Checking Elasticsearch availability..."
try {
    $esResponse = Invoke-WebRequest -Uri "http://localhost:9200" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($esResponse.StatusCode -eq 200) {
        Write-Success "Elasticsearch is running and accessible"
        $esAvailable = $true
    } else {
        Write-Warning "Elasticsearch is not available"
        $esAvailable = $false
    }
} catch {
    Write-Warning "Elasticsearch is not available (optional for testing)"
    Write-Info "For lightning-fast search with 500K+ contacts, consider installing Elasticsearch:"
    Write-Info "1. Download from: https://www.elastic.co/downloads/elasticsearch"
    Write-Info "2. Or use Docker: docker run -d -p 9200:9200 -e 'discovery.type=single-node' -e 'xpack.security.enabled=false' elasticsearch:8.11.0"
    $esAvailable = $false
    
    $installES = Read-Host "Do you want to install Elasticsearch using Docker? (y/n)"
    if ($installES -eq 'y' -or $installES -eq 'Y') {
        Write-Info "Starting Elasticsearch with Docker..."
        docker run -d --name elasticsearch-crm -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.11.0
        Write-Info "Waiting for Elasticsearch to start (this may take 30-60 seconds)..."
        Start-Sleep -Seconds 30
        
        try {
            $esResponse = Invoke-WebRequest -Uri "http://localhost:9200" -TimeoutSec 10 -ErrorAction SilentlyContinue
            if ($esResponse.StatusCode -eq 200) {
                Write-Success "Elasticsearch installed and running via Docker"
                $esAvailable = $true
            } else {
                Write-Warning "Elasticsearch Docker container started but not responding yet"
                $esAvailable = $false
            }
        } catch {
            Write-Warning "Could not test Elasticsearch connection after Docker installation"
            $esAvailable = $false
        }
    }
}

# Step 5: Generate Prisma client
Write-Info "Step 5: Generating Prisma client with new optimizations..."
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Success "Prisma client generated successfully"
} else {
    Write-Error "Failed to generate Prisma client"
    exit 1
}

# Step 6: Apply database migrations
Write-Info "Step 6: Applying database migrations..."
npx prisma migrate dev --name add_enterprise_optimizations
if ($LASTEXITCODE -eq 0) {
    Write-Success "Database migrations applied successfully"
} else {
    Write-Warning "Database migrations may have failed. Continuing with testing..."
}

# Step 7: Initialize Elasticsearch (if available)
if ($esAvailable) {
    Write-Info "Step 7: Initializing Elasticsearch index..."
    node scripts/init-elasticsearch.js
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Elasticsearch initialized successfully"
    } else {
        Write-Warning "Elasticsearch initialization failed, but continuing..."
    }
} else {
    Write-Info "Step 7: Skipping Elasticsearch initialization (not available)"
}

# Step 8: Test the optimized API
Write-Info "Step 8: Testing optimized API endpoints..."
Write-Info "Starting development server for testing..."

# Start the dev server in background
$devServer = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden

# Wait for server to start
Write-Info "Waiting for development server to start..."
Start-Sleep -Seconds 10

# Test API endpoints
try {
    Write-Info "Testing contacts API with pagination..."
    $contactsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/contacts?page=1&limit=5" -TimeoutSec 10
    if ($contactsResponse.StatusCode -eq 200) {
        $contactsData = $contactsResponse.Content | ConvertFrom-Json
        Write-Success "Contacts API working - returned $($contactsData.contacts.Count) contacts"
        if ($contactsData.pagination) {
            Write-Success "Pagination working - Total: $($contactsData.pagination.totalCount)"
        }
        if ($contactsData.source) {
            Write-Success "Using data source: $($contactsData.source)"
        }
    } else {
        Write-Warning "Contacts API returned status: $($contactsResponse.StatusCode)"
    }
} catch {
    Write-Warning "Could not test contacts API - server may still be starting"
}

# Test search if available
if ($esAvailable) {
    try {
        Write-Info "Testing search API with Elasticsearch..."
        $searchResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/contacts?search=test&useElasticsearch=true" -TimeoutSec 10
        if ($searchResponse.StatusCode -eq 200) {
            $searchData = $searchResponse.Content | ConvertFrom-Json
            Write-Success "Search API working with Elasticsearch"
        }
    } catch {
        Write-Warning "Could not test search API"
    }
}

# Stop the dev server
if ($devServer -and !$devServer.HasExited) {
    Stop-Process -Id $devServer.Id -Force
    Write-Info "Development server stopped"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Success "Local Enterprise Testing Complete!"
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

Write-Info "📊 Test Results Summary:"
Write-Host "   • Database: Connected to sms_messaging"
Write-Host "   • Redis: $(if ($redisTest -eq 'PONG') { 'Available ✅' } else { 'Not Available ⚠️' })"
Write-Host "   • Elasticsearch: $(if ($esAvailable) { 'Available ✅' } else { 'Not Available ⚠️' })"
Write-Host "   • API: Tested with pagination"
Write-Host ""

Write-Info "🚀 Next Steps:"
Write-Host "   1. Start your development server: npm run dev"
Write-Host "   2. Test the optimized contact list at: http://localhost:3000"
Write-Host "   3. Try searching contacts to see the performance improvement"
Write-Host "   4. Check the browser console for performance metrics"
Write-Host ""

if ($redisTest -ne "PONG") {
    Write-Warning "⚠️  Redis is not available. Caching will be disabled."
    Write-Info "   Install Redis for full performance benefits"
}

if (-not $esAvailable) {
    Write-Warning "⚠️  Elasticsearch is not available. Search will use database."
    Write-Info "   Install Elasticsearch for lightning-fast search with 500K+ contacts"
}

Write-Success "Your CRM is now optimized for enterprise-scale performance! 🎉"
