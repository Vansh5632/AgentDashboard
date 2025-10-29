#!/bin/bash

# ============================================================================
# Docker Services Status Check
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}         CHECKING DOCKER SERVICES STATUS${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop or Docker daemon${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check PostgreSQL
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if docker ps --format '{{.Names}}' | grep -q postgres; then
    POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres)
    echo -e "${GREEN}✅ PostgreSQL is running in container: ${POSTGRES_CONTAINER}${NC}"
    docker exec "$POSTGRES_CONTAINER" pg_isready 2>/dev/null && echo -e "${GREEN}   PostgreSQL is accepting connections${NC}"
else
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    echo -e "${YELLOW}Start it with: docker-compose up -d postgres${NC}"
fi
echo ""

# Check Redis
echo -e "${YELLOW}Checking Redis...${NC}"
if docker ps --format '{{.Names}}' | grep -q redis; then
    REDIS_CONTAINER=$(docker ps --format '{{.Names}}' | grep redis)
    echo -e "${GREEN}✅ Redis is running in container: ${REDIS_CONTAINER}${NC}"
    docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null && echo -e "${GREEN}   Redis is responding to PING${NC}"
else
    echo -e "${RED}❌ Redis container is not running${NC}"
    echo -e "${YELLOW}Start it with: docker-compose up -d redis${NC}"
fi
echo ""

# Check API Server
echo -e "${YELLOW}Checking API Server (port 3001)...${NC}"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Server is running and healthy${NC}"
    RESPONSE=$(curl -s http://localhost:3001/health)
    echo -e "   Response: ${RESPONSE}"
else
    echo -e "${RED}❌ API Server is not responding on port 3001${NC}"
    echo -e "${YELLOW}Start it with: cd apps/api && pnpm dev${NC}"
fi
echo ""

# Check Worker Service
echo -e "${YELLOW}Checking Worker Service...${NC}"
if pgrep -f "worker.ts" > /dev/null || pgrep -f "dist/worker.js" > /dev/null; then
    WORKER_PID=$(pgrep -f "worker.ts" || pgrep -f "dist/worker.js")
    echo -e "${GREEN}✅ Worker service is running (PID: ${WORKER_PID})${NC}"
else
    echo -e "${RED}❌ Worker service is not running${NC}"
    echo -e "${YELLOW}Start it with: cd apps/worker && pnpm dev${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}         SUMMARY${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

ALL_GOOD=true

# Docker check
docker info > /dev/null 2>&1 || ALL_GOOD=false

# PostgreSQL check
docker ps --format '{{.Names}}' | grep -q postgres || ALL_GOOD=false

# Redis check  
docker ps --format '{{.Names}}' | grep -q redis || ALL_GOOD=false

# API check
curl -s http://localhost:3001/health > /dev/null 2>&1 || ALL_GOOD=false

# Worker check (optional)
if ! (pgrep -f "worker.ts" > /dev/null || pgrep -f "dist/worker.js" > /dev/null); then
    echo -e "${YELLOW}⚠️  Worker is not running (you should start it)${NC}"
fi

if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All core services are running!${NC}"
    echo -e "${GREEN}You can now run the test script:${NC}"
    echo -e "${BLUE}   ./test-meeting-system.sh${NC}"
else
    echo -e "${RED}❌ Some services are not running${NC}"
    echo -e "${YELLOW}Please start the missing services before running tests${NC}"
    echo ""
    echo -e "${YELLOW}Quick start all services:${NC}"
    echo -e "${BLUE}   # Terminal 1: Start Docker containers${NC}"
    echo -e "   docker-compose up -d"
    echo ""
    echo -e "${BLUE}   # Terminal 2: Start API${NC}"
    echo -e "   cd apps/api && pnpm dev"
    echo ""
    echo -e "${BLUE}   # Terminal 3: Start Worker${NC}"
    echo -e "   cd apps/worker && pnpm dev"
fi
echo ""
