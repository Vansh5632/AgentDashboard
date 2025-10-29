#!/bin/bash

# Production Environment Setup Script
# Run this locally to verify your environment variables before deployment

echo "🔍 Checking environment variables for production deployment..."
echo ""

# Load .env file
if [ -f .env ]; then
    source .env
else
    echo "❌ .env file not found!"
    exit 1
fi

# Function to check variable
check_var() {
    if [ -z "${!1}" ]; then
        echo "❌ $1 is not set"
        return 1
    else
        echo "✅ $1 is set"
        return 0
    fi
}

# Required for API
echo "📡 API Service Variables:"
check_var "DATABASE_URL"
check_var "REDIS_HOST"
check_var "REDIS_PORT"
check_var "JWT_SECRET"
check_var "ENCRYPTION_KEY"
check_var "ELEVENLABS_API_KEY"

# Check JWT_SECRET length
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  WARNING: JWT_SECRET should be at least 32 characters"
fi

# Check ENCRYPTION_KEY length
if [ ${#ENCRYPTION_KEY} -ne 32 ]; then
    echo "⚠️  WARNING: ENCRYPTION_KEY should be exactly 32 characters"
fi

echo ""
echo "🤖 Worker Service Variables:"
check_var "OPENAI_API_KEY"
check_var "PINECONE_API_KEY"
check_var "PINECONE_INDEX_NAME"

echo ""
echo "🌐 Frontend Variables:"
check_var "NEXT_PUBLIC_API_URL"

echo ""
echo "🔒 Optional Variables:"
if [ -n "$CALCOM_API_KEY" ]; then
    echo "✅ CALCOM_API_KEY is set"
else
    echo "⚠️  CALCOM_API_KEY not set (optional)"
fi

if [ -n "$GHL_API_KEY" ]; then
    echo "✅ GHL_API_KEY is set"
else
    echo "⚠️  GHL_API_KEY not set (optional)"
fi

if [ -n "$CORS_ORIGINS" ]; then
    echo "✅ CORS_ORIGINS is set: $CORS_ORIGINS"
else
    echo "⚠️  CORS_ORIGINS not set (will default to localhost)"
fi

echo ""
echo "📊 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test database connection
echo ""
echo "🗄️  Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
    fi
else
    echo "⚠️  psql not installed, skipping database test"
fi

# Test Redis connection
echo ""
echo "🔴 Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        echo "✅ Redis connection successful"
    else
        echo "❌ Redis connection failed"
    fi
else
    echo "⚠️  redis-cli not installed, skipping Redis test"
fi

echo ""
echo "✨ Pre-deployment check complete!"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub"
echo "2. Follow DEPLOYMENT_GUIDE.md to deploy to Railway and Vercel"
echo "3. Update environment variables in Railway and Vercel dashboards"
