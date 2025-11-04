
#!/bin/bash
# test-build.sh - Local build verification script

echo "🔧 Testing monorepo build process..."

# Clean any existing dist directories
echo "🧹 Cleaning previous builds..."
rm -rf packages/db/dist
rm -rf apps/api/dist
rm -rf apps/worker/dist

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build in correct order
echo "🔨 Building packages in order..."

# 1. Generate Prisma Client
echo "1. Generating Prisma Client..."
cd packages/db && pnpm exec prisma generate
cd ../..

# 2. Build DB package
echo "2. Building DB package..."
cd packages/db && pnpm build
cd ../..

# 3. Verify DB package
echo "3. Verifying DB package..."
if [ -f "packages/db/dist/index.js" ]; then
    echo "✅ DB package built successfully"
    echo "Contents:"
    cat packages/db/dist/index.js
else
    echo "❌ DB package build failed - dist/index.js not found"
    exit 1
fi

# 4. Test importing DB package
echo "4. Testing DB package import..."
node -e "
try {
    const db = require('./packages/db');
    console.log('✅ DB package imports successfully');
    console.log('Exports:', Object.keys(db));
} catch (error) {
    console.error('❌ DB package import failed:', error.message);
    process.exit(1);
}
"

# 5. Build API service
echo "5. Building API service..."
cd apps/api && pnpm build
cd ../..

# 6. Build Worker service
echo "6. Building Worker service..."
cd apps/worker && pnpm build
cd ../..

echo "✅ All builds completed successfully!"
echo ""
echo "📁 Build artifacts:"
echo "  - packages/db/dist/index.js"
echo "  - packages/db/dist/index.d.ts"
echo "  - apps/api/dist/"
echo "  - apps/worker/dist/"
