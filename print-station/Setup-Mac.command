#!/bin/bash
# ============================================
# ChurchCheck Print Helper - Mac Setup
# ============================================
# Double-click this file to install everything.
# You only need to run this ONCE.
# ============================================

clear
echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║   ChurchCheck Print Helper - Mac Setup    ║"
echo "  ╠═══════════════════════════════════════════╣"
echo "  ║  This will install the print helper so    ║"
echo "  ║  your check-in station can print labels.  ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Navigate to the script's directory
cd "$(dirname "$0")"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo ""
    echo "Installing Node.js via Homebrew..."
    
    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        echo "Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install node
    
    if ! command -v node &> /dev/null; then
        echo ""
        echo "❌ Could not install Node.js automatically."
        echo "   Please install Node.js from: https://nodejs.org"
        echo "   Then run this setup again."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js ${NODE_VERSION} found"

# Install dependencies
echo ""
echo "📦 Installing print helper dependencies..."
npm install --production 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies."
    echo "   Try running: npm install --production"
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "✅ Dependencies installed!"

# Copy avatar files if main project exists nearby
if [ -d "../public/avatars" ]; then
    echo "📁 Copying avatar files..."
    mkdir -p public/avatars
    cp -r ../public/avatars/* public/avatars/ 2>/dev/null
    echo "✅ Avatars copied"
fi

# Detect DYMO printer
echo ""
echo "🖨️  Detecting printers..."
DYMO_PRINTER=$(lpstat -a 2>/dev/null | grep -i "dymo\|labelwriter" | head -1 | awk '{print $1}')

if [ -n "$DYMO_PRINTER" ]; then
    echo "✅ Found DYMO printer: ${DYMO_PRINTER}"
    
    # Update printer name in the script if different from default
    if [ "$DYMO_PRINTER" != "DYMO_LabelWriter_450_Turbo" ]; then
        echo "   Updating printer config to: ${DYMO_PRINTER}"
        sed -i '' "s/DYMO_LabelWriter_450_Turbo/${DYMO_PRINTER}/g" print-helper.cjs
    fi
else
    echo "⚠️  No DYMO printer detected."
    echo "   Make sure your DYMO LabelWriter is connected and powered on."
    echo "   You can set the printer name later in print-helper.cjs"
fi

# Create a LaunchAgent for auto-start (optional)
echo ""
read -p "Would you like the print helper to start automatically on login? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_FILE="$PLIST_DIR/com.churchcheck.printhelper.plist"
    SCRIPT_DIR="$(pwd)"
    
    mkdir -p "$PLIST_DIR"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.churchcheck.printhelper</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>${SCRIPT_DIR}/print-helper.cjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/print-helper.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/print-helper-error.log</string>
</dict>
</plist>
EOF
    
    launchctl load "$PLIST_FILE" 2>/dev/null
    echo "✅ Auto-start enabled! Print helper will start on login."
    echo "   To disable: launchctl unload $PLIST_FILE"
fi

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║          ✅ Setup Complete!               ║"
echo "  ╠═══════════════════════════════════════════╣"
echo "  ║                                           ║"
echo "  ║  To start the print helper:               ║"
echo "  ║  → Double-click 'Start-Mac.command'       ║"
echo "  ║                                           ║"
echo "  ║  Then open Chrome and go to:              ║"
echo "  ║  → churchcheck-api.onrender.com           ║"
echo "  ║                                           ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""
read -p "Press Enter to exit..."

