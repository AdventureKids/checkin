#!/bin/bash
# ============================================
# ChurchCheck Print Helper - Start
# ============================================
# Double-click to start the print helper.
# Keep this window open while using check-in.
# ============================================

cd "$(dirname "$0")"

clear
echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     ChurchCheck Print Helper v2.0         ║"
echo "  ╠═══════════════════════════════════════════╣"
echo "  ║  Keep this window open while checking in. ║"
echo "  ║  Labels print to your DYMO LabelWriter.   ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Check if already running
if lsof -i :3100 &> /dev/null; then
    echo "⚠️  Print helper is already running on port 3100."
    echo "   If you need to restart it, close this window first."
    echo ""
    read -p "Press Enter to exit..."
    exit 0
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please run Setup-Mac.command first."
    read -p "Press Enter to exit..."
    exit 1
fi

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 First run detected - installing dependencies..."
    npm install --production
fi

echo "🚀 Starting print helper..."
echo "   Press Ctrl+C to stop."
echo ""

node print-helper.cjs

