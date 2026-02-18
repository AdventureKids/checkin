#!/bin/bash
# ============================================
# ChurchCheck Print Helper - Mac Setup
# ============================================
# Double-click this file ONE TIME to install.
# The print helper will run automatically in
# the background from now on — even after reboot.
# ============================================

clear
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   ChurchCheck Print Helper - One-Time Setup   ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║  After setup, the print helper runs silently  ║"
echo "  ║  in the background — even after restarting.   ║"
echo "  ║  You'll never need to touch this again.       ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

# ---- Step 1: Check for Node.js ----
echo "Step 1: Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js is not installed."
    echo ""
    echo "  Installing Node.js via Homebrew..."
    
    if ! command -v brew &> /dev/null; then
        echo "  Installing Homebrew first (this may take a minute)..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add brew to path for Apple Silicon Macs
        eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)"
    fi
    
    brew install node
    
    if ! command -v node &> /dev/null; then
        echo ""
        echo "  ❌ Could not install Node.js automatically."
        echo "     Please install from: https://nodejs.org"
        echo "     Then run this setup again."
        echo ""
        read -p "  Press Enter to exit..."
        exit 1
    fi
fi

NODE_VERSION=$(node --version)
NODE_PATH=$(which node)
echo "  ✅ Node.js ${NODE_VERSION} at ${NODE_PATH}"

# ---- Step 2: Install dependencies ----
echo ""
echo "Step 2: Installing dependencies..."
npm install --production 2>&1 | tail -1

if [ $? -ne 0 ]; then
    echo "  ❌ Failed to install. Try running: npm install --production"
    read -p "  Press Enter to exit..."
    exit 1
fi
echo "  ✅ Dependencies installed"

# ---- Step 3: Copy avatars from main project if available ----
if [ -d "../public/avatars" ] && [ ! -d "public/avatars/boy-ranger" ]; then
    echo ""
    echo "Step 3: Copying avatar files..."
    mkdir -p public/avatars
    cp -r ../public/avatars/boy-ranger public/avatars/ 2>/dev/null
    cp -r ../public/avatars/girl-ranger public/avatars/ 2>/dev/null
    echo "  ✅ Avatars copied"
fi

# ---- Step 4: Detect DYMO printer ----
echo ""
echo "Step 4: Detecting DYMO printer..."
DYMO_PRINTER=$(lpstat -a 2>/dev/null | grep -i "dymo\|labelwriter" | head -1 | awk '{print $1}')

if [ -n "$DYMO_PRINTER" ]; then
    echo "  ✅ Found: ${DYMO_PRINTER}"
    
    # Update printer name in script if different
    if [ "$DYMO_PRINTER" != "DYMO_LabelWriter_450_Turbo" ]; then
        sed -i '' "s/DYMO_LabelWriter_450_Turbo/${DYMO_PRINTER}/g" print-helper.cjs
        echo "  ✅ Updated printer config"
    fi
else
    echo "  ⚠️  No DYMO printer found right now."
    echo "     Make sure it's plugged in and powered on."
    echo "     The helper will still start — it'll find the printer later."
fi

# ---- Step 5: Kill any existing instance ----
echo ""
echo "Step 5: Installing as background service..."

# Stop existing service if running
launchctl unload "$HOME/Library/LaunchAgents/com.churchcheck.printhelper.plist" 2>/dev/null
# Also kill any manual instances
pkill -f "node.*print-helper" 2>/dev/null
sleep 1

# ---- Step 6: Install LaunchAgent (auto-start on login, runs in background) ----
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/com.churchcheck.printhelper.plist"
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
        <string>${NODE_PATH}</string>
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
    <key>ThrottleInterval</key>
    <integer>5</integer>
</dict>
</plist>
EOF

launchctl load "$PLIST_FILE" 2>/dev/null

echo "  ✅ Background service installed"

# ---- Step 7: Verify it's running ----
echo ""
echo "Step 6: Verifying..."
sleep 2

if curl -s http://localhost:3100/status > /dev/null 2>&1; then
    echo "  ✅ Print helper is running on http://localhost:3100"
else
    echo "  ⚠️  Waiting for startup..."
    sleep 3
    if curl -s http://localhost:3100/status > /dev/null 2>&1; then
        echo "  ✅ Print helper is running on http://localhost:3100"
    else
        echo "  ❌ Print helper didn't start. Check print-helper-error.log"
    fi
fi

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║            ✅ Setup Complete!                 ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║                                               ║"
echo "  ║  The print helper is now running in the       ║"
echo "  ║  background and will auto-start on login.     ║"
echo "  ║                                               ║"
echo "  ║  You can close this window.                   ║"
echo "  ║                                               ║"
echo "  ║  Just open Chrome and go to:                  ║"
echo "  ║  → churchcheck-api.onrender.com               ║"
echo "  ║                                               ║"
echo "  ║  You should see 🖨️ Printer Ready              ║"
echo "  ║                                               ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║  To uninstall later, run Uninstall-Mac.command║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
read -p "  Press Enter to close..."
