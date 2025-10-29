#!/bin/bash

# Phase 2 Quick Start Script
# This script helps you get started with the background job processing system

set -e

echo "🚀 Phase 2 - Background Job Processing Setup"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file from .env.example and fill in the required values:"
    echo "  cp .env.example .env"
    echo ""
    echo "Required variables:"
    echo "  - OPENAI_API_KEY"
    echo "  - PINECONE_API_KEY"
    echo "  - PINECONE_INDEX_NAME"
    echo "  - DATABASE_URL"
    echo "  - JWT_SECRET"
    echo "  - ENCRYPTION_KEY"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check if Redis is running
echo "🔍 Checking Redis..."
if ! docker ps | grep -q ai-redis; then
    echo "📦 Starting Redis container..."
    docker run --name ai-redis -p 6379:6379 -d redis:7-alpine
    echo "✅ Redis started on port 6379"
else
    echo "✅ Redis is already running"
fi
echo ""

# Check if dependencies are installed
echo "🔍 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
else
    echo "✅ Dependencies installed"
fi
echo ""

# Check Prisma Client
echo "🔍 Checking Prisma Client..."
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "📦 Generating Prisma Client..."
    pnpm -F db exec prisma generate
else
    echo "✅ Prisma Client generated"
fi
echo ""

# Prompt for database migration
echo "📊 Database Setup"
read -p "Do you want to run database migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running migrations..."
    pnpm -F db exec prisma migrate dev
    echo "✅ Migrations complete"
fi
echo ""

echo "=============================================="
echo "✅ Setup Complete!"
echo "=============================================="
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Start the Worker (in one terminal):"
echo "   pnpm -F worker dev"
echo ""
echo "2. Start the API (in another terminal):"
echo "   pnpm -F api dev"
echo ""
echo "3. Test with a webhook:"
echo "   curl -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"data\": {...}}'"
echo ""
echo "📖 For detailed instructions, see PHASE2_GUIDE.md"
echo ""
