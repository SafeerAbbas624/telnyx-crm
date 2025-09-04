#!/bin/bash

# Install Enterprise Dependencies for 500K+ Contact Optimization
echo "🚀 Installing Enterprise Dependencies for 500K+ Contact CRM..."

# Install Node.js dependencies
echo "📦 Installing Node.js packages..."
npm install --save \
  ioredis@5.3.2 \
  bull@4.12.2 \
  @elastic/elasticsearch@8.11.0 \
  react-window@1.8.8 \
  react-window-infinite-loader@1.0.9 \
  @types/react-window@1.8.8

npm install --save-dev \
  @types/bull@4.10.0

echo "✅ Node.js dependencies installed"

# Install system dependencies (Ubuntu/Debian)
if command -v apt-get &> /dev/null; then
    echo "🔧 Installing system dependencies (Ubuntu/Debian)..."
    
    # Update package list
    sudo apt-get update
    
    # Install Redis
    if ! command -v redis-server &> /dev/null; then
        echo "Installing Redis..."
        sudo apt-get install -y redis-server
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
        echo "✅ Redis installed and started"
    else
        echo "✅ Redis already installed"
    fi
    
    # Install Elasticsearch (optional)
    read -p "Do you want to install Elasticsearch for lightning-fast search? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! command -v elasticsearch &> /dev/null; then
            echo "Installing Elasticsearch..."
            
            # Import Elasticsearch GPG key
            wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
            
            # Add Elasticsearch repository
            echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
            
            # Update and install
            sudo apt-get update
            sudo apt-get install -y elasticsearch
            
            # Configure Elasticsearch for single-node
            sudo tee -a /etc/elasticsearch/elasticsearch.yml > /dev/null <<EOF

# Single-node configuration for CRM
cluster.name: crm-cluster
node.name: crm-node-1
network.host: localhost
http.port: 9200
discovery.type: single-node
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
EOF
            
            # Start Elasticsearch
            sudo systemctl enable elasticsearch
            sudo systemctl start elasticsearch
            
            # Wait for Elasticsearch to start
            echo "Waiting for Elasticsearch to start..."
            sleep 30
            
            # Test connection
            if curl -s "http://localhost:9200" > /dev/null; then
                echo "✅ Elasticsearch installed and running"
            else
                echo "⚠️ Elasticsearch installed but may need manual configuration"
            fi
        else
            echo "✅ Elasticsearch already installed"
        fi
    else
        echo "⚠️ Skipping Elasticsearch installation. Search will use database (slower for 500K+ contacts)"
    fi

# Install system dependencies (CentOS/RHEL)
elif command -v yum &> /dev/null; then
    echo "🔧 Installing system dependencies (CentOS/RHEL)..."
    
    # Install Redis
    if ! command -v redis-server &> /dev/null; then
        echo "Installing Redis..."
        sudo yum install -y epel-release
        sudo yum install -y redis
        sudo systemctl enable redis
        sudo systemctl start redis
        echo "✅ Redis installed and started"
    else
        echo "✅ Redis already installed"
    fi
    
    # Elasticsearch installation for CentOS/RHEL would be similar but with yum
    echo "⚠️ For Elasticsearch on CentOS/RHEL, please follow: https://www.elastic.co/guide/en/elasticsearch/reference/current/rpm.html"

else
    echo "⚠️ Unsupported package manager. Please install Redis and Elasticsearch manually:"
    echo "   Redis: https://redis.io/docs/getting-started/installation/"
    echo "   Elasticsearch: https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html"
fi

# Configure Redis for production
echo "🔧 Configuring Redis for production..."
sudo tee -a /etc/redis/redis.conf > /dev/null <<EOF

# Production optimizations for CRM
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

sudo systemctl restart redis-server 2>/dev/null || sudo systemctl restart redis

# Test connections
echo "🧪 Testing connections..."

# Test Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
fi

# Test Elasticsearch (if installed)
if curl -s "http://localhost:9200" > /dev/null 2>&1; then
    echo "✅ Elasticsearch connection successful"
else
    echo "⚠️ Elasticsearch not available (optional for search optimization)"
fi

# Test PostgreSQL
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL available"
else
    echo "⚠️ PostgreSQL not found. Please ensure it's installed and configured."
fi

echo ""
echo "🎉 Enterprise dependencies installation complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update your .env file with Redis and Elasticsearch configuration"
echo "2. Run database migrations: npx prisma migrate deploy"
echo "3. Initialize Elasticsearch index: node scripts/init-elasticsearch.js"
echo "4. Start the application with PM2 for production"
echo ""
echo "📊 Your CRM is now optimized for 500K+ contacts with:"
echo "   • Redis caching for lightning-fast responses"
echo "   • Elasticsearch for instant search (if installed)"
echo "   • Background job processing for bulk operations"
echo "   • Virtual scrolling for smooth UI performance"
echo ""
echo "🚀 Ready for enterprise-scale performance!"
