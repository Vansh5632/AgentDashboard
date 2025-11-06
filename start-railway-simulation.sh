#!/bin/bash

# Railway Simulation Startup Script
# This script simulates a Railway deployment environment

set -e

echo "🚀 Starting Railway Simulation Environment..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install docker-compose."
    exit 1
fi

# Clean up any existing containers
print_status "Cleaning up existing containers..."
docker-compose -f docker-compose.railway.yml down --volumes --remove-orphans 2>/dev/null || true

# Build all services
print_status "Building all services (API, Worker, Web)..."
docker-compose -f docker-compose.railway.yml build --no-cache

# Start the infrastructure services first (database and redis)
print_status "Starting infrastructure services (PostgreSQL, Redis)..."
docker-compose -f docker-compose.railway.yml up -d postgres redis

# Wait for infrastructure to be healthy
print_status "Waiting for infrastructure services to be healthy..."
timeout=60
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose -f docker-compose.railway.yml ps postgres | grep "healthy" > /dev/null && \
       docker-compose -f docker-compose.railway.yml ps redis | grep "healthy" > /dev/null; then
        print_success "Infrastructure services are healthy!"
        break
    fi
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    print_error "Infrastructure services failed to become healthy within $timeout seconds"
    docker-compose -f docker-compose.railway.yml logs postgres redis
    exit 1
fi

# Run database migrations
print_status "Running database migrations..."
docker cp ./migrate.sh $(docker-compose -f docker-compose.railway.yml ps -q postgres):/tmp/migrate.sh 2>/dev/null || true
docker-compose -f docker-compose.railway.yml run --rm api sh -c "
    echo '🔍 Checking Prisma CLI availability...'
    if [ -f './node_modules/.pnpm/node_modules/.bin/prisma' ]; then
        PRISMA_CLI='./node_modules/.pnpm/node_modules/.bin/prisma'
        echo '✅ Found Prisma CLI at: \$PRISMA_CLI'
    elif [ -f './node_modules/.bin/prisma' ]; then
        PRISMA_CLI='./node_modules/.bin/prisma'
        echo '✅ Found Prisma CLI at: \$PRISMA_CLI'
    else
        echo '❌ Prisma CLI not found!'
        exit 1
    fi
    echo '🚀 Running database migrations...'
    \$PRISMA_CLI migrate deploy --schema=./schema.prisma
    echo '✅ Database migrations completed successfully!'
" || {
    print_error "Database migrations failed"
    docker-compose -f docker-compose.railway.yml logs api
    exit 1
}

print_success "Database migrations completed!"

# Start the application services
print_status "Starting application services (API, Worker, Web)..."
docker-compose -f docker-compose.railway.yml up -d api worker web

# Wait for all services to be healthy
print_status "Waiting for all services to be healthy..."
timeout=120
counter=0

while [ $counter -lt $timeout ]; do
    api_healthy=$(docker-compose -f docker-compose.railway.yml ps api | grep "healthy" || echo "")
    web_healthy=$(docker-compose -f docker-compose.railway.yml ps web | grep "healthy" || echo "")
    worker_healthy=$(docker-compose -f docker-compose.railway.yml ps worker | grep "healthy" || echo "")
    
    if [ -n "$api_healthy" ] && [ -n "$web_healthy" ] && [ -n "$worker_healthy" ]; then
        print_success "All services are healthy!"
        break
    fi
    echo -n "."
    sleep 3
    counter=$((counter + 3))
done

if [ $counter -ge $timeout ]; then
    print_warning "Some services may not be fully healthy yet. Checking status..."
    docker-compose -f docker-compose.railway.yml ps
fi

echo ""
echo "🎉 Railway Simulation Environment is running!"
echo "=============================================="
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.railway.yml ps
echo ""
echo "🌐 Access Points:"
echo "   • Web Dashboard: http://localhost:3000"
echo "   • API Service:   http://localhost:3001"
echo "   • PostgreSQL:    localhost:5432"
echo "   • Redis:         localhost:6379"
echo ""
echo "🔍 Useful Commands:"
echo "   • View logs:     docker-compose -f docker-compose.railway.yml logs [service]"
echo "   • Stop all:      docker-compose -f docker-compose.railway.yml down"
echo "   • Restart:       docker-compose -f docker-compose.railway.yml restart [service]"
echo ""
echo "🧪 Test Commands:"
echo "   • Test API Health:    curl http://localhost:3001/api/health"
echo "   • Test Web Health:    curl http://localhost:3000/api/health"
echo "   • Test Database:      docker-compose -f docker-compose.railway.yml exec postgres psql -U postgres -d aiagent_db -c '\\dt'"
echo "   • Test Redis:         docker-compose -f docker-compose.railway.yml exec redis redis-cli ping"
echo ""

print_success "Environment setup complete! All services should be accessible."