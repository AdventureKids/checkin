#!/bin/bash

# Adventure Kids Check-In - Deployment Script
# ============================================

echo "🚀 Adventure Kids Check-In - Deployment"
echo "========================================"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --production=false

# Build frontend
echo ""
echo "🔨 Building frontend..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not created"
    exit 1
fi

echo "✅ Frontend built successfully"

# Create systemd service file for reference
echo ""
echo "📝 Creating systemd service file (kidcheck.service)..."

cat > kidcheck.service << 'EOF'
[Unit]
Description=Adventure Kids Check-In Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kidcheck
ExecStart=/usr/bin/node print-server.cjs
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DISABLE_PRINTING=true

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created"

echo ""
echo "========================================"
echo "🎉 Build complete!"
echo ""
echo "To deploy to your server:"
echo ""
echo "1. Copy these files to your server:"
echo "   - dist/ (frontend build)"
echo "   - print-server.cjs"
echo "   - package.json"
echo "   - package-lock.json"
echo "   - kidcheck.service (optional, for systemd)"
echo ""
echo "2. On the server, run:"
echo "   npm install --production"
echo ""
echo "3. Start the server:"
echo "   NODE_ENV=production DISABLE_PRINTING=true node print-server.cjs"
echo ""
echo "4. Or use systemd (recommended):"
echo "   sudo cp kidcheck.service /etc/systemd/system/"
echo "   sudo systemctl enable kidcheck"
echo "   sudo systemctl start kidcheck"
echo ""
echo "5. Set up nginx as a reverse proxy (optional but recommended)"
echo ""
echo "========================================"


