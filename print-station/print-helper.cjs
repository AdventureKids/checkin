#!/usr/bin/env node
// ============================================
// ChurchCheck Local Print Helper
// ============================================
// Runs locally on the check-in station.
// Generates graphical PNG labels using canvas
// and prints via macOS lp / Windows PowerShell.
//
// Usage: node print-helper.cjs
// Runs on http://localhost:3100

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCanvas, loadImage } = require('canvas');

const PORT = process.env.PORT || 3100;
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const PRINTER_NAME = process.env.PRINTER_NAME || 'DYMO_LabelWriter_450_Turbo';
// Set NETWORK_MODE=true to allow iPad/tablet connections from local network
const NETWORK_MODE = process.env.NETWORK_MODE === 'true';

// Dymo 30256 Shipping Labels: 2.31" x 4" (59mm x 102mm)
// At 300 DPI: 693 x 1200 pixels (height x width)
const LABEL_WIDTH = 1200;
const LABEL_HEIGHT = 693;

// Avatar paths
const PUBLIC_PATH = path.join(__dirname, 'public');

// Avatar image cache
const avatarCache = {};

async function loadAvatarImage(gender) {
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f';
  const folder = isFemale ? 'girl-ranger' : 'boy-ranger';
  const prefix = isFemale ? 'girl-test' : 'boy-test';
  const avatarPath = path.join(PUBLIC_PATH, 'avatars', folder, `${prefix}-000.png`);

  if (avatarCache[folder]) return avatarCache[folder];

  try {
    const img = await loadImage(avatarPath);
    avatarCache[folder] = img;
    console.log(`🖼️ Loaded avatar from: ${avatarPath}`);
    return img;
  } catch (err) {
    console.error('Failed to load avatar:', err.message);
    return null;
  }
}

// ============================================
// LABEL GENERATION (Canvas-based, matching old server)
// ============================================

async function generateChildLabel(data) {
  const {
    childName = 'Child',
    pickupCode = '0000',
    room = 'Room 101',
    parentName = '',
    allergies = '',
    streak = 0,
    badges = 0,
    rank = 1,
    gender = '',
    avatar = '',
    tier = null,
    isNewBadge = false,
    badgeName = null,
    // Label editor settings
    showAvatar = true,
    showName = true,
    showRoom = true,
    showStreak = true,
    showBadges = true,
    showRank = true,
    showPickupCode = true,
    showAllergies = true,
    showDate = true,
    nameSize = 110,
    roomSize = 44,
    borderStyle = 'pointed'
  } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Border
  const borderWidth = 12;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderWidth;

  if (borderStyle === 'none') {
    // No border
  } else if (tier === 'gold' || borderStyle === 'pointed') {
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
    if (tier === 'gold') {
      ctx.lineWidth = 3;
      ctx.strokeRect(borderWidth + 6, borderWidth + 6, LABEL_WIDTH - (borderWidth * 2) - 12, LABEL_HEIGHT - (borderWidth * 2) - 12);
    }
  } else if (tier === 'silver') {
    ctx.setLineDash([16, 8]);
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
    ctx.setLineDash([]);
  } else if (borderStyle === 'rounded') {
    ctx.beginPath();
    ctx.roundRect(borderWidth / 2, borderWidth / 2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth, 20);
    ctx.stroke();
  } else {
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
  }

  // LEFT SIDE: Avatar
  const avatarSize = 320;
  const avatarX = 45;
  const avatarY = (LABEL_HEIGHT - avatarSize) / 2;

  if (showAvatar) {
    const avatarImage = await loadAvatarImage(gender);
    if (avatarImage) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 28);
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 28);
      ctx.stroke();
    } else {
      // Fallback: initials
      ctx.fillStyle = '#e5e5e5';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 120px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(childName.substring(0, 2).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 40);
    }
  }

  // CENTER: Name, Room, Stats
  const contentX = showAvatar ? avatarX + avatarSize + 35 : 45;
  const contentWidth = showPickupCode ? 580 : LABEL_WIDTH - contentX - 40;

  // Tier badge
  if (tier) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${tier.toUpperCase()} TIER ★`, contentX, 60);
  }

  // Child name - BIG
  if (showName) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';

    let currentSize = Math.min(nameSize, 150);
    ctx.font = `bold ${currentSize}px Arial`;

    let nameWidth = ctx.measureText(childName).width;
    while (nameWidth > contentWidth && currentSize > 40) {
      currentSize -= 10;
      ctx.font = `bold ${currentSize}px Arial`;
      nameWidth = ctx.measureText(childName).width;
    }
    ctx.fillText(childName, contentX, tier ? 145 : 120);
  }

  // Room
  if (showRoom) {
    const roomFontSize = Math.min(roomSize, 80);
    ctx.font = `bold ${roomFontSize}px Arial`;
    ctx.fillText(room || 'Room 101', contentX, tier ? 205 : 180);
  }

  // Stats row
  const statsY = tier ? 310 : 290;
  const statItems = [];
  if (showStreak && streak > 0) statItems.push({ value: `${streak}`, label: 'STREAK' });
  if (showBadges) statItems.push({ value: `${badges || 0}`, label: 'BADGES' });
  if (showRank) statItems.push({ value: `#${rank || 1}`, label: 'RANK' });

  const statWidth = 150;
  statItems.forEach((stat, i) => {
    const statX = contentX + (i * statWidth);
    ctx.font = 'bold 64px Arial';
    ctx.fillText(stat.value, statX, statsY);
    ctx.font = 'bold 22px Arial';
    ctx.fillText(stat.label, statX, statsY + 30);
  });

  // New badge celebration
  if (isNewBadge && badgeName) {
    const badgeY = statsY + 60;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(contentX, badgeY, 440, 52, 10);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`★ NEW: ${badgeName} ★`, contentX + 220, badgeY + 35);
    ctx.textAlign = 'left';
  }

  // RIGHT SIDE: Pickup Code
  if (showPickupCode) {
    const separatorX = 1040;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(separatorX, 25);
    ctx.lineTo(separatorX, LABEL_HEIGHT - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText('✂', separatorX, LABEL_HEIGHT / 2 + 8);

    const codeX = separatorX + (LABEL_WIDTH - separatorX) / 2;

    ctx.font = 'bold 22px Arial';
    ctx.fillText('PICKUP', codeX, 120);
    ctx.fillText('CODE', codeX, 148);

    ctx.font = 'bold 52px monospace';
    ctx.fillText(pickupCode, codeX, 240);
  }

  // Allergies warning
  if (showAllergies && allergies) {
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`⚠ ALLERGY: ${allergies}`, contentX, LABEL_HEIGHT - 60);
  }

  // Footer with date
  if (showDate) {
    ctx.font = '20px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    const now = new Date();
    ctx.fillText(
      `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${parentName}`,
      showPickupCode ? 540 : LABEL_WIDTH / 2,
      LABEL_HEIGHT - 25
    );
  }

  return canvas.toBuffer('image/png');
}

function generateParentLabel(data) {
  const {
    familyName = 'Family',
    children = [],
    showFamilyName = true,
    showChildren = true,
    showPickupCodes = true,
    showRooms = true,
    showDate = true,
    showTime = true,
    titleSize = 48,
    nameSize = 36
  } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, LABEL_WIDTH - 8, LABEL_HEIGHT - 8);

  // Title
  ctx.fillStyle = '#000000';
  const cappedTitleSize = Math.min(titleSize, 72);
  ctx.font = `bold ${cappedTitleSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('PARENT PICKUP RECEIPT', LABEL_WIDTH / 2, 60);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.lineTo(LABEL_WIDTH - 50, 80);
  ctx.stroke();

  let yPos = 130;
  if (showFamilyName && familyName) {
    ctx.font = `bold ${Math.min(nameSize + 10, 50)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(familyName, LABEL_WIDTH / 2, yPos);
    yPos += 50;
  }

  if (showChildren && children && children.length > 0) {
    ctx.textAlign = 'left';
    children.forEach((child, index) => {
      const xPos = 60 + (index % 3) * 380;
      const yOffset = Math.floor(index / 3) * 180;

      const cappedNameSize = Math.min(nameSize, 60);
      ctx.font = `bold ${cappedNameSize}px Arial`;
      ctx.fillText(child.name || child.childName, xPos, yPos + yOffset);

      if (showRooms) {
        ctx.font = `${Math.max(cappedNameSize - 14, 20)}px Arial`;
        ctx.fillText(child.room || 'Room 101', xPos, yPos + 35 + yOffset);
      }

      if (showPickupCodes) {
        ctx.font = '22px Arial';
        ctx.fillText('CODE:', xPos, yPos + 75 + yOffset);
        ctx.font = 'bold 56px monospace';
        ctx.fillText(child.pickupCode, xPos, yPos + 130 + yOffset);
      }
    });
  }

  ctx.textAlign = 'center';
  let footerText = 'Present this receipt at pickup';
  if (showDate || showTime) {
    const now = new Date();
    if (showDate && showTime) {
      footerText += ` • ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (showDate) {
      footerText += ` • ${now.toLocaleDateString()}`;
    }
  }
  ctx.font = '22px Arial';
  ctx.fillStyle = '#000000';
  ctx.fillText(footerText, LABEL_WIDTH / 2, LABEL_HEIGHT - 30);

  return canvas.toBuffer('image/png');
}

function generateVolunteerLabel(data) {
  const {
    childName = 'Volunteer',
    volunteerName,
    room = "Children's Ministry",
    serviceArea = ''
  } = data;

  const name = volunteerName || childName;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Bold border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, LABEL_WIDTH - 12, LABEL_HEIGHT - 12);

  // VOLUNTEER header
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('VOLUNTEER', LABEL_WIDTH / 2, 80);

  // Divider
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(50, 100);
  ctx.lineTo(LABEL_WIDTH - 50, 100);
  ctx.stroke();

  // Name - large
  let fontSize = 100;
  ctx.font = `bold ${fontSize}px Arial`;
  while (ctx.measureText(name).width > LABEL_WIDTH - 100 && fontSize > 40) {
    fontSize -= 10;
    ctx.font = `bold ${fontSize}px Arial`;
  }
  ctx.fillText(name, LABEL_WIDTH / 2, 280);

  // Service area / room
  ctx.font = 'bold 40px Arial';
  ctx.fillText(serviceArea || room, LABEL_WIDTH / 2, 380);

  // Date/time
  const now = new Date();
  ctx.font = '28px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText(
    `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
    LABEL_WIDTH / 2,
    LABEL_HEIGHT - 50
  );

  return canvas.toBuffer('image/png');
}

function generateRewardLabel(data) {
  const {
    childName = 'Child',
    rewardName = 'Achievement',
    rewardIcon = '🏆'
  } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Double border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, LABEL_WIDTH - 8, LABEL_HEIGHT - 8);
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, LABEL_WIDTH - 28, LABEL_HEIGHT - 28);

  // Title
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('REWARD EARNED!', LABEL_WIDTH / 2, 80);

  // Child name
  let fontSize = 80;
  ctx.font = `bold ${fontSize}px Arial`;
  while (ctx.measureText(childName).width > LABEL_WIDTH - 100 && fontSize > 40) {
    fontSize -= 10;
    ctx.font = `bold ${fontSize}px Arial`;
  }
  ctx.fillText(childName, LABEL_WIDTH / 2, 230);

  // Reward name
  ctx.font = 'bold 44px Arial';
  ctx.fillText(rewardName, LABEL_WIDTH / 2, 350);

  // Stars
  ctx.font = '36px Arial';
  ctx.fillText('★ ★ ★ ★ ★', LABEL_WIDTH / 2, 440);

  // Date
  ctx.font = '24px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText(new Date().toLocaleDateString(), LABEL_WIDTH / 2, LABEL_HEIGHT - 40);

  return canvas.toBuffer('image/png');
}

// ============================================
// PRINT FUNCTION
// ============================================

function printImage(imageBuffer) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `churchcheck-label-${Date.now()}.png`);
    fs.writeFileSync(tmpFile, imageBuffer);

    if (IS_WINDOWS) {
      // Windows: PowerShell printing
      const psScript = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${tmpFile.replace(/\\/g, '\\\\').replace(/'/g, "''")}')
$printDoc = New-Object System.Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = '${PRINTER_NAME.replace(/_/g, ' ').replace(/'/g, "''")}'
$printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$printDoc.add_PrintPage({
  param($sender, $e)
  $e.Graphics.DrawImage($img, 0, 0, $e.PageBounds.Width, $e.PageBounds.Height)
})
$printDoc.Print()
$img.Dispose()
`;
      const tempPs = path.join(os.tmpdir(), `print-${Date.now()}.ps1`);
      fs.writeFileSync(tempPs, psScript);
      exec(`powershell -ExecutionPolicy Bypass -File "${tempPs}"`, { timeout: 30000 }, (err, stdout) => {
        try { fs.unlinkSync(tempPs); } catch (e) { }
        try { fs.unlinkSync(tmpFile); } catch (e) { }
        if (err) return reject(err);
        resolve({ success: true });
      });
    } else {
      // macOS: lp command
      const cmd = `lp -d "${PRINTER_NAME}" -o fit-to-page -o orientation-requested=4 "${tmpFile}"`;
      exec(cmd, { timeout: 10000 }, (err, stdout) => {
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (e) { } }, 5000);
        if (err) return reject(err);
        console.log(`🖨️  Printed: ${stdout.trim()}`);
        resolve({ success: true });
      });
    }
  });
}

// ============================================
// HTTP SERVER
// ============================================

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: true, printer: PRINTER_NAME }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type || 'child';
        let imageBuffer;

        switch (type) {
          case 'child':
            imageBuffer = await generateChildLabel(data);
            break;
          case 'parent':
            imageBuffer = generateParentLabel(data);
            break;
          case 'volunteer':
            imageBuffer = generateVolunteerLabel(data);
            break;
          case 'reward':
            imageBuffer = generateRewardLabel(data);
            break;
          default:
            imageBuffer = await generateChildLabel(data);
        }

        const result = await printImage(imageBuffer);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Print error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Preview endpoint - returns PNG image
  if (req.method === 'POST' && req.url === '/preview') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type || 'child';
        let imageBuffer;

        switch (type) {
          case 'child':
            imageBuffer = await generateChildLabel(data);
            break;
          case 'parent':
            imageBuffer = generateParentLabel(data);
            break;
          case 'volunteer':
            imageBuffer = generateVolunteerLabel(data);
            break;
          case 'reward':
            imageBuffer = generateRewardLabel(data);
            break;
          default:
            imageBuffer = await generateChildLabel(data);
        }

        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(imageBuffer);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const HOST = NETWORK_MODE ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, HOST, () => {
  const os = require('os');
  const localIP = NETWORK_MODE
    ? Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'unknown'
    : 'localhost';

  console.log(`
🖨️  ChurchCheck Print Helper v2.0
═══════════════════════════════════════
📍 Running on http://${HOST === '0.0.0.0' ? localIP : 'localhost'}:${PORT}
🖨️  Printer: ${PRINTER_NAME}
🎨 Label size: ${LABEL_WIDTH}x${LABEL_HEIGHT} (30256 Shipping)
📁 Avatars: ${path.join(PUBLIC_PATH, 'avatars')}
${NETWORK_MODE ? `🌐 Network mode: ON (iPads can connect at http://${localIP}:${PORT})` : '🔒 Local only (set NETWORK_MODE=true for iPad access)'}
═══════════════════════════════════════

Endpoints:
  GET  /status   - Check if running
  POST /print    - Print a label
  POST /preview  - Get label as PNG image
  `);
});
