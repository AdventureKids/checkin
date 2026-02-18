#!/usr/bin/env node
// ============================================
// ChurchCheck Local Print Helper v3.0
// ============================================
// Runs locally on the check-in station.
// Generates SVG labels (no native dependencies!)
// and prints via macOS lp / Windows PowerShell.
//
// ZERO native modules — installs on any OS with
// just Node.js and npm install.
//
// Usage: node print-helper.cjs
// Runs on http://localhost:3100

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3100;
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const PRINTER_NAME = process.env.PRINTER_NAME || 'DYMO_LabelWriter_450_Turbo';
const NETWORK_MODE = process.env.NETWORK_MODE === 'true';

// Dymo 30256 Shipping Labels: 2.31" x 4" (59mm x 102mm)
// SVG coordinates in points (1pt = 1/72 inch)
// 4" wide x 2.31" tall = 288pt x 166pt
const LABEL_W = 288;
const LABEL_H = 166;

// Avatar paths
const PUBLIC_PATH = path.join(__dirname, 'public');

// Helper: escape XML special chars
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Load avatar as base64 data URI for embedding in SVG
function loadAvatarBase64(gender) {
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f';
  const folder = isFemale ? 'girl-ranger' : 'boy-ranger';
  const prefix = isFemale ? 'girl-test' : 'boy-test';
  const avatarPath = path.join(PUBLIC_PATH, 'avatars', folder, `${prefix}-000.png`);

  try {
    const buf = fs.readFileSync(avatarPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (err) {
    return null;
  }
}

// ============================================
// SVG LABEL GENERATION
// ============================================

function generateChildLabelSVG(data) {
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
    tier = null,
    isNewBadge = false,
    badgeName = null,
    showAvatar = true,
    showName = true,
    showRoom = true,
    showStreak = true,
    showBadges = true,
    showRank = true,
    showPickupCode = true,
    showAllergies = true,
    showDate = true,
    borderStyle = 'pointed'
  } = data;

  const avatarDataUri = showAvatar ? loadAvatarBase64(gender) : null;
  const avatarSize = 80; // points
  const avatarX = 12;
  const avatarY = (LABEL_H - avatarSize) / 2;

  const contentX = showAvatar ? avatarX + avatarSize + 10 : 12;
  const separatorX = showPickupCode ? 246 : LABEL_W;
  const codeX = separatorX + (LABEL_W - separatorX) / 2;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Dynamically size the name
  const nameLen = childName.length;
  const nameFontSize = nameLen > 14 ? 18 : nameLen > 10 ? 22 : 28;

  // Build stat items
  const stats = [];
  if (showStreak && streak > 0) stats.push({ value: `${streak}`, label: 'STREAK' });
  if (showBadges) stats.push({ value: `${badges || 0}`, label: 'BADGES' });
  if (showRank) stats.push({ value: `#${rank || 1}`, label: 'RANK' });

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}">
  <rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/>`;

  // Border
  if (borderStyle !== 'none') {
    if (tier === 'gold') {
      svg += `<rect x="2" y="2" width="${LABEL_W - 4}" height="${LABEL_H - 4}" fill="none" stroke="black" stroke-width="3"/>`;
      svg += `<rect x="5" y="5" width="${LABEL_W - 10}" height="${LABEL_H - 10}" fill="none" stroke="black" stroke-width="0.8"/>`;
    } else if (tier === 'silver') {
      svg += `<rect x="2" y="2" width="${LABEL_W - 4}" height="${LABEL_H - 4}" fill="none" stroke="black" stroke-width="3" stroke-dasharray="4,2"/>`;
    } else if (borderStyle === 'rounded') {
      svg += `<rect x="2" y="2" width="${LABEL_W - 4}" height="${LABEL_H - 4}" rx="5" fill="none" stroke="black" stroke-width="3"/>`;
    } else {
      svg += `<rect x="2" y="2" width="${LABEL_W - 4}" height="${LABEL_H - 4}" fill="none" stroke="black" stroke-width="3"/>`;
    }
  }

  // Avatar
  if (showAvatar && avatarDataUri) {
    svg += `
    <clipPath id="avatarClip"><rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7"/></clipPath>
    <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatarDataUri}" clip-path="url(#avatarClip)"/>
    <rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7" fill="none" stroke="black" stroke-width="1.2"/>`;
  } else if (showAvatar) {
    // Fallback: initials box
    svg += `
    <rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7" fill="#e5e5e5" stroke="black" stroke-width="1.2"/>
    <text x="${avatarX + avatarSize / 2}" y="${avatarY + avatarSize / 2 + 12}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="30" fill="black">${esc(childName.substring(0, 2).toUpperCase())}</text>`;
  }

  // Tier badge
  if (tier) {
    svg += `<text x="${contentX}" y="16" font-family="Arial" font-weight="bold" font-size="8" fill="black">★ ${esc(tier.toUpperCase())} TIER ★</text>`;
  }

  // Child name
  if (showName) {
    const nameY = tier ? 38 : 32;
    svg += `<text x="${contentX}" y="${nameY}" font-family="Arial" font-weight="bold" font-size="${nameFontSize}" fill="black">${esc(childName)}</text>`;
  }

  // Room
  if (showRoom) {
    const roomY = tier ? 52 : 46;
    svg += `<text x="${contentX}" y="${roomY}" font-family="Arial" font-weight="bold" font-size="11" fill="black">${esc(room)}</text>`;
  }

  // Stats row
  const statsY = tier ? 78 : 72;
  stats.forEach((stat, i) => {
    const statX = contentX + (i * 40);
    svg += `<text x="${statX}" y="${statsY}" font-family="Arial" font-weight="bold" font-size="16" fill="black">${esc(stat.value)}</text>`;
    svg += `<text x="${statX}" y="${statsY + 9}" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">${esc(stat.label)}</text>`;
  });

  // New badge celebration
  if (isNewBadge && badgeName) {
    const badgeY = statsY + 18;
    svg += `<rect x="${contentX}" y="${badgeY}" width="110" height="13" rx="2.5" fill="black"/>`;
    svg += `<text x="${contentX + 55}" y="${badgeY + 9.5}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="6.5" fill="white">★ NEW: ${esc(badgeName)} ★</text>`;
  }

  // Pickup code (right side)
  if (showPickupCode) {
    svg += `<line x1="${separatorX}" y1="6" x2="${separatorX}" y2="${LABEL_H - 6}" stroke="black" stroke-width="0.5" stroke-dasharray="2.5,1.5"/>`;
    svg += `<text x="${separatorX}" y="${LABEL_H / 2 + 2}" font-family="Arial" font-size="6" fill="black">✂</text>`;
    svg += `<text x="${codeX}" y="30" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">PICKUP</text>`;
    svg += `<text x="${codeX}" y="37" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">CODE</text>`;
    svg += `<text x="${codeX}" y="60" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="13" fill="black">${esc(pickupCode)}</text>`;
  }

  // Allergies
  if (showAllergies && allergies) {
    svg += `<text x="${contentX}" y="${LABEL_H - 18}" font-family="Arial" font-weight="bold" font-size="6" fill="#DC2626">⚠ ALLERGY: ${esc(allergies)}</text>`;
  }

  // Date footer
  if (showDate) {
    const footerCenterX = showPickupCode ? 130 : LABEL_W / 2;
    svg += `<text x="${footerCenterX}" y="${LABEL_H - 7}" text-anchor="middle" font-family="Arial" font-size="5" fill="#666">${esc(dateStr)} ${esc(timeStr)} • ${esc(parentName)}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

function generateParentLabelSVG(data) {
  const {
    familyName = 'Family',
    children = [],
    showFamilyName = true,
    showChildren = true,
    showPickupCodes = true,
    showRooms = true,
    showDate = true,
    showTime = true
  } = data;

  const now = new Date();

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}">
  <rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/>
  <rect x="1" y="1" width="${LABEL_W - 2}" height="${LABEL_H - 2}" fill="none" stroke="black" stroke-width="2"/>`;

  // Title
  svg += `<text x="${LABEL_W / 2}" y="17" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">PARENT PICKUP RECEIPT</text>`;
  svg += `<line x1="12" y1="22" x2="${LABEL_W - 12}" y2="22" stroke="black" stroke-width="0.5"/>`;

  let yPos = 38;

  if (showFamilyName && familyName) {
    svg += `<text x="${LABEL_W / 2}" y="${yPos}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">${esc(familyName)}</text>`;
    yPos += 16;
  }

  if (showChildren && children.length > 0) {
    const colWidth = 90;
    children.forEach((child, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const xPos = 16 + (col * colWidth);
      const rowY = yPos + (row * 46);

      svg += `<text x="${xPos}" y="${rowY}" font-family="Arial" font-weight="bold" font-size="9" fill="black">${esc(child.name || child.childName)}</text>`;

      if (showRooms) {
        svg += `<text x="${xPos}" y="${rowY + 10}" font-family="Arial" font-size="6" fill="black">${esc(child.room || 'Room 101')}</text>`;
      }

      if (showPickupCodes) {
        svg += `<text x="${xPos}" y="${rowY + 20}" font-family="Arial" font-size="5.5" fill="black">CODE:</text>`;
        svg += `<text x="${xPos}" y="${rowY + 34}" font-family="monospace" font-weight="bold" font-size="14" fill="black">${esc(child.pickupCode)}</text>`;
      }
    });
  }

  // Footer
  let footerText = 'Present this receipt at pickup';
  if (showDate && showTime) {
    footerText += ` • ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (showDate) {
    footerText += ` • ${now.toLocaleDateString()}`;
  }
  svg += `<text x="${LABEL_W / 2}" y="${LABEL_H - 7}" text-anchor="middle" font-family="Arial" font-size="5.5" fill="black">${esc(footerText)}</text>`;

  svg += `</svg>`;
  return svg;
}

function generateVolunteerLabelSVG(data) {
  const {
    childName = 'Volunteer',
    volunteerName,
    room = "Children's Ministry",
    serviceArea = ''
  } = data;

  const name = volunteerName || childName;
  const nameLen = name.length;
  const nameFontSize = nameLen > 14 ? 18 : nameLen > 10 ? 24 : 28;

  const now = new Date();

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}">
  <rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/>
  <rect x="2" y="2" width="${LABEL_W - 4}" height="${LABEL_H - 4}" fill="none" stroke="black" stroke-width="3"/>`;

  svg += `<text x="${LABEL_W / 2}" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">VOLUNTEER</text>`;
  svg += `<line x1="12" y1="27" x2="${LABEL_W - 12}" y2="27" stroke="black" stroke-width="0.8"/>`;

  svg += `<text x="${LABEL_W / 2}" y="72" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${nameFontSize}" fill="black">${esc(name)}</text>`;

  svg += `<text x="${LABEL_W / 2}" y="96" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="10" fill="black">${esc(serviceArea || room)}</text>`;

  svg += `<text x="${LABEL_W / 2}" y="${LABEL_H - 14}" text-anchor="middle" font-family="Arial" font-size="7" fill="#666">${esc(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</text>`;

  svg += `</svg>`;
  return svg;
}

function generateRewardLabelSVG(data) {
  const {
    childName = 'Child',
    rewardName = 'Achievement',
  } = data;

  const nameLen = childName.length;
  const nameFontSize = nameLen > 14 ? 18 : nameLen > 10 ? 22 : 20;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}">
  <rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/>
  <rect x="1" y="1" width="${LABEL_W - 2}" height="${LABEL_H - 2}" fill="none" stroke="black" stroke-width="2"/>
  <rect x="4" y="4" width="${LABEL_W - 8}" height="${LABEL_H - 8}" fill="none" stroke="black" stroke-width="0.8"/>`;

  svg += `<text x="${LABEL_W / 2}" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">REWARD EARNED!</text>`;

  svg += `<text x="${LABEL_W / 2}" y="62" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${nameFontSize}" fill="black">${esc(childName)}</text>`;

  svg += `<text x="${LABEL_W / 2}" y="90" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="11" fill="black">${esc(rewardName)}</text>`;

  svg += `<text x="${LABEL_W / 2}" y="112" text-anchor="middle" font-family="Arial" font-size="9" fill="black">★ ★ ★ ★ ★</text>`;

  svg += `<text x="${LABEL_W / 2}" y="${LABEL_H - 10}" text-anchor="middle" font-family="Arial" font-size="6" fill="#666">${esc(new Date().toLocaleDateString())}</text>`;

  svg += `</svg>`;
  return svg;
}

// ============================================
// PRINT FUNCTION (SVG → print)
// ============================================

function printSVG(svgString) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `churchcheck-label-${Date.now()}.svg`);
    fs.writeFileSync(tmpFile, svgString);

    if (IS_WINDOWS) {
      // Windows: Convert SVG to a temporary HTML file and use PowerShell to print
      const htmlContent = `<!DOCTYPE html><html><head><style>@page{size:4in 2.31in;margin:0}body{margin:0;padding:0}img{width:4in;height:2.31in}</style></head><body><img src="file:///${tmpFile.replace(/\\/g, '/')}"/></body></html>`;
      const htmlFile = path.join(os.tmpdir(), `churchcheck-label-${Date.now()}.html`);
      fs.writeFileSync(htmlFile, htmlContent);

      // Use PowerShell to send to printer via Start-Process with print verb
      // First try direct SVG printing via built-in handler, fallback to mspaint
      const psScript = `
try {
  # Try printing HTML via Internet Explorer COM object
  $ie = New-Object -ComObject InternetExplorer.Application
  $ie.Navigate("file:///${htmlFile.replace(/\\/g, '/')}")
  while ($ie.Busy) { Start-Sleep -Milliseconds 100 }
  Start-Sleep -Seconds 1
  $ie.ExecWB(6, 2)  # OLECMDID_PRINT, OLECMDEXECOPT_DONTPROMPTUSER
  Start-Sleep -Seconds 3
  $ie.Quit()
} catch {
  # Fallback: Use mspaint /p for SVG or convert to BMP
  Start-Process -FilePath "mspaint" -ArgumentList "/p","${tmpFile.replace(/\\/g, '\\\\')}" -Wait -NoNewWindow
}
`;
      const tempPs = path.join(os.tmpdir(), `print-${Date.now()}.ps1`);
      fs.writeFileSync(tempPs, psScript);
      exec(`powershell -ExecutionPolicy Bypass -File "${tempPs}"`, { timeout: 30000 }, (err) => {
        try { fs.unlinkSync(tempPs); } catch (e) { }
        try { fs.unlinkSync(htmlFile); } catch (e) { }
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (e) { } }, 5000);
        if (err) {
          console.error('Windows print error, trying fallback...', err.message);
          // Last resort fallback: notepad /p
          exec(`notepad /p "${tmpFile}"`, { timeout: 15000 }, (err2) => {
            setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (e) { } }, 5000);
            if (err2) return reject(err2);
            resolve({ success: true });
          });
          return;
        }
        resolve({ success: true });
      });
    } else {
      // macOS: lp can print SVG files directly (via CUPS → filters)
      // Use -o fit-to-page to scale properly, landscape orientation
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
// HTTP SERVER (no express dependency needed)
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
    res.end(JSON.stringify({ running: true, printer: PRINTER_NAME, version: '3.0' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type || 'child';
        let svgContent;

        switch (type) {
          case 'child':
            svgContent = generateChildLabelSVG(data);
            break;
          case 'parent':
            svgContent = generateParentLabelSVG(data);
            break;
          case 'volunteer':
            svgContent = generateVolunteerLabelSVG(data);
            break;
          case 'reward':
            svgContent = generateRewardLabelSVG(data);
            break;
          default:
            svgContent = generateChildLabelSVG(data);
        }

        const result = await printSVG(svgContent);
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

  // Preview endpoint - returns SVG
  if (req.method === 'POST' && req.url === '/preview') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type || 'child';
        let svgContent;

        switch (type) {
          case 'child':
            svgContent = generateChildLabelSVG(data);
            break;
          case 'parent':
            svgContent = generateParentLabelSVG(data);
            break;
          case 'volunteer':
            svgContent = generateVolunteerLabelSVG(data);
            break;
          case 'reward':
            svgContent = generateRewardLabelSVG(data);
            break;
          default:
            svgContent = generateChildLabelSVG(data);
        }

        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svgContent);
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
  const netInterfaces = os.networkInterfaces();
  const localIP = NETWORK_MODE
    ? Object.values(netInterfaces).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'unknown'
    : 'localhost';

  console.log(`
🖨️  ChurchCheck Print Helper v3.0
═══════════════════════════════════════
📍 Running on http://${HOST === '0.0.0.0' ? localIP : 'localhost'}:${PORT}
🖨️  Printer: ${PRINTER_NAME}
📐 Label size: 4" x 2.31" (30256 Shipping)
📁 Avatars: ${path.join(PUBLIC_PATH, 'avatars')}
💡 Zero native dependencies!
${NETWORK_MODE ? `🌐 Network mode: ON (iPads can connect at http://${localIP}:${PORT})` : '🔒 Local only (set NETWORK_MODE=true for iPad access)'}
═══════════════════════════════════════

Endpoints:
  GET  /status   - Check if running
  POST /print    - Print a label
  POST /preview  - Get label as SVG preview
  `);
});
