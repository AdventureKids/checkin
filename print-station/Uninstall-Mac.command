#!/bin/bash
# ============================================
# ChurchCheck Print Helper - Uninstall (Mac)
# ============================================

clear
echo ""
echo "  Uninstalling ChurchCheck Print Helper..."
echo ""

# Stop the service
launchctl unload "$HOME/Library/LaunchAgents/com.churchcheck.printhelper.plist" 2>/dev/null
echo "  ✅ Service stopped"

# Remove the LaunchAgent
rm -f "$HOME/Library/LaunchAgents/com.churchcheck.printhelper.plist"
echo "  ✅ Auto-start removed"

# Kill any running instances
pkill -f "node.*print-helper" 2>/dev/null
echo "  ✅ Process stopped"

echo ""
echo "  ✅ Print helper has been uninstalled."
echo "     You can delete this folder to remove all files."
echo ""
read -p "  Press Enter to close..."

