#!/usr/bin/env node
// ============================================
// ChurchCheck Local Print Helper v3.1
// ============================================
// Runs locally on the check-in station.
// - Mac: SVG labels printed via CUPS (lp command)
// - Windows: PowerShell System.Drawing bitmaps
//   printed directly (zero external tools needed)
//
// ZERO native modules — installs on any OS with
// just Node.js. No npm install required.
//
// Usage: node print-helper.cjs
// Runs on http://localhost:3100

const http = require('http');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3100;
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const PRINTER_NAME = process.env.PRINTER_NAME || 'DYMO_LabelWriter_450_Turbo';
const NETWORK_MODE = process.env.NETWORK_MODE === 'true';

// Dymo 30256 Shipping Labels: 2.31" x 4" (59mm x 102mm)
// SVG coordinates in points for Mac (1pt = 1/72 inch): 288pt x 166pt
const LABEL_W = 288;
const LABEL_H = 166;

// Windows bitmap size (300 DPI): 1200 x 693 pixels
const BMP_W = 1200;
const BMP_H = 693;

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

// Helper: escape PowerShell string
function psEsc(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "''").replace(/`/g, '``');
}

// Load avatar as base64 for embedding in SVG (Mac)
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

// Get avatar file path (Windows needs file path, not data URI)
function getAvatarPath(gender) {
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f';
  const folder = isFemale ? 'girl-ranger' : 'boy-ranger';
  const prefix = isFemale ? 'girl-test' : 'boy-test';
  const avatarPath = path.join(PUBLIC_PATH, 'avatars', folder, `${prefix}-000.png`);
  return fs.existsSync(avatarPath) ? avatarPath : null;
}

// ============================================
// SVG LABEL GENERATION (for macOS)
// ============================================

function generateChildLabelSVG(data) {
  const {
    childName = 'Child', pickupCode = '0000', room = 'Room 101',
    parentName = '', allergies = '', streak = 0, badges = 0, rank = 1,
    gender = '', tier = null, isNewBadge = false, badgeName = null,
    showAvatar = true, showName = true, showRoom = true,
    showStreak = true, showBadges = true, showRank = true,
    showPickupCode = true, showAllergies = true, showDate = true,
    borderStyle = 'pointed'
  } = data;

  const avatarDataUri = showAvatar ? loadAvatarBase64(gender) : null;
  const avatarSize = 80;
  const avatarX = 12;
  const avatarY = (LABEL_H - avatarSize) / 2;
  const contentX = showAvatar ? avatarX + avatarSize + 10 : 12;
  const separatorX = showPickupCode ? 246 : LABEL_W;
  const codeX = separatorX + (LABEL_W - separatorX) / 2;
  const now = new Date();
  const nameLen = childName.length;
  const nameFontSize = nameLen > 14 ? 18 : nameLen > 10 ? 22 : 28;

  const stats = [];
  if (showStreak && streak > 0) stats.push({ value: `${streak}`, label: 'STREAK' });
  if (showBadges) stats.push({ value: `${badges || 0}`, label: 'BADGES' });
  if (showRank) stats.push({ value: `#${rank || 1}`, label: 'RANK' });

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}">
  <rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/>`;

  if (borderStyle !== 'none') {
    if (tier === 'gold') {
      svg += `<rect x="2" y="2" width="${LABEL_W-4}" height="${LABEL_H-4}" fill="none" stroke="black" stroke-width="3"/>`;
      svg += `<rect x="5" y="5" width="${LABEL_W-10}" height="${LABEL_H-10}" fill="none" stroke="black" stroke-width="0.8"/>`;
    } else if (tier === 'silver') {
      svg += `<rect x="2" y="2" width="${LABEL_W-4}" height="${LABEL_H-4}" fill="none" stroke="black" stroke-width="3" stroke-dasharray="4,2"/>`;
    } else if (borderStyle === 'rounded') {
      svg += `<rect x="2" y="2" width="${LABEL_W-4}" height="${LABEL_H-4}" rx="5" fill="none" stroke="black" stroke-width="3"/>`;
    } else {
      svg += `<rect x="2" y="2" width="${LABEL_W-4}" height="${LABEL_H-4}" fill="none" stroke="black" stroke-width="3"/>`;
    }
  }

  if (showAvatar && avatarDataUri) {
    svg += `<clipPath id="ac"><rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7"/></clipPath>`;
    svg += `<image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatarDataUri}" clip-path="url(#ac)"/>`;
    svg += `<rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7" fill="none" stroke="black" stroke-width="1.2"/>`;
  } else if (showAvatar) {
    svg += `<rect x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" rx="7" fill="#e5e5e5" stroke="black" stroke-width="1.2"/>`;
    svg += `<text x="${avatarX+avatarSize/2}" y="${avatarY+avatarSize/2+12}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="30" fill="black">${esc(childName.substring(0,2).toUpperCase())}</text>`;
  }

  if (tier) svg += `<text x="${contentX}" y="16" font-family="Arial" font-weight="bold" font-size="8" fill="black">★ ${esc(tier.toUpperCase())} TIER ★</text>`;
  if (showName) svg += `<text x="${contentX}" y="${tier?38:32}" font-family="Arial" font-weight="bold" font-size="${nameFontSize}" fill="black">${esc(childName)}</text>`;
  if (showRoom) svg += `<text x="${contentX}" y="${tier?52:46}" font-family="Arial" font-weight="bold" font-size="11" fill="black">${esc(room)}</text>`;

  const statsY = tier ? 78 : 72;
  stats.forEach((stat, i) => {
    const statX = contentX + (i * 40);
    svg += `<text x="${statX}" y="${statsY}" font-family="Arial" font-weight="bold" font-size="16" fill="black">${esc(stat.value)}</text>`;
    svg += `<text x="${statX}" y="${statsY+9}" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">${esc(stat.label)}</text>`;
  });

  if (isNewBadge && badgeName) {
    const badgeY = statsY + 18;
    svg += `<rect x="${contentX}" y="${badgeY}" width="110" height="13" rx="2.5" fill="black"/>`;
    svg += `<text x="${contentX+55}" y="${badgeY+9.5}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="6.5" fill="white">★ NEW: ${esc(badgeName)} ★</text>`;
  }

  if (showPickupCode) {
    svg += `<line x1="${separatorX}" y1="6" x2="${separatorX}" y2="${LABEL_H-6}" stroke="black" stroke-width="0.5" stroke-dasharray="2.5,1.5"/>`;
    svg += `<text x="${codeX}" y="30" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">PICKUP</text>`;
    svg += `<text x="${codeX}" y="37" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="5.5" fill="black">CODE</text>`;
    svg += `<text x="${codeX}" y="60" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="13" fill="black">${esc(pickupCode)}</text>`;
  }

  if (showAllergies && allergies) svg += `<text x="${contentX}" y="${LABEL_H-18}" font-family="Arial" font-weight="bold" font-size="6" fill="#DC2626">⚠ ALLERGY: ${esc(allergies)}</text>`;
  if (showDate) svg += `<text x="${showPickupCode?130:LABEL_W/2}" y="${LABEL_H-7}" text-anchor="middle" font-family="Arial" font-size="5" fill="#666">${esc(now.toLocaleDateString())} ${esc(now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))} • ${esc(parentName)}</text>`;

  svg += `</svg>`;
  return svg;
}

function generateParentLabelSVG(data) {
  const { familyName = 'Family', children = [], showFamilyName = true, showChildren = true, showPickupCodes = true, showRooms = true, showDate = true, showTime = true } = data;
  const now = new Date();
  let svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}"><rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/><rect x="1" y="1" width="${LABEL_W-2}" height="${LABEL_H-2}" fill="none" stroke="black" stroke-width="2"/>`;
  svg += `<text x="${LABEL_W/2}" y="17" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">PARENT PICKUP RECEIPT</text>`;
  svg += `<line x1="12" y1="22" x2="${LABEL_W-12}" y2="22" stroke="black" stroke-width="0.5"/>`;
  let yPos = 38;
  if (showFamilyName) { svg += `<text x="${LABEL_W/2}" y="${yPos}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">${esc(familyName)}</text>`; yPos += 16; }
  if (showChildren && children.length > 0) {
    children.forEach((child, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const xPos = 16 + (col * 90), rowY = yPos + (row * 46);
      svg += `<text x="${xPos}" y="${rowY}" font-family="Arial" font-weight="bold" font-size="9" fill="black">${esc(child.name||child.childName)}</text>`;
      if (showRooms) svg += `<text x="${xPos}" y="${rowY+10}" font-family="Arial" font-size="6" fill="black">${esc(child.room||'Room 101')}</text>`;
      if (showPickupCodes) { svg += `<text x="${xPos}" y="${rowY+20}" font-family="Arial" font-size="5.5" fill="black">CODE:</text>`; svg += `<text x="${xPos}" y="${rowY+34}" font-family="monospace" font-weight="bold" font-size="14" fill="black">${esc(child.pickupCode)}</text>`; }
    });
  }
  let footer = 'Present this receipt at pickup';
  if (showDate && showTime) footer += ` • ${now.toLocaleDateString()} ${now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
  else if (showDate) footer += ` • ${now.toLocaleDateString()}`;
  svg += `<text x="${LABEL_W/2}" y="${LABEL_H-7}" text-anchor="middle" font-family="Arial" font-size="5.5" fill="black">${esc(footer)}</text>`;
  svg += `</svg>`;
  return svg;
}

function generateVolunteerLabelSVG(data) {
  const { childName = 'Volunteer', volunteerName, room = "Children's Ministry", serviceArea = '' } = data;
  const name = volunteerName || childName;
  const nameFS = name.length > 14 ? 18 : name.length > 10 ? 24 : 28;
  const now = new Date();
  let svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}"><rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/><rect x="2" y="2" width="${LABEL_W-4}" height="${LABEL_H-4}" fill="none" stroke="black" stroke-width="3"/>`;
  svg += `<text x="${LABEL_W/2}" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">VOLUNTEER</text>`;
  svg += `<line x1="12" y1="27" x2="${LABEL_W-12}" y2="27" stroke="black" stroke-width="0.8"/>`;
  svg += `<text x="${LABEL_W/2}" y="72" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${nameFS}" fill="black">${esc(name)}</text>`;
  svg += `<text x="${LABEL_W/2}" y="96" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="10" fill="black">${esc(serviceArea||room)}</text>`;
  svg += `<text x="${LABEL_W/2}" y="${LABEL_H-14}" text-anchor="middle" font-family="Arial" font-size="7" fill="#666">${esc(now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))}</text>`;
  svg += `</svg>`;
  return svg;
}

function generateRewardLabelSVG(data) {
  const { childName = 'Child', rewardName = 'Achievement' } = data;
  const nameFS = childName.length > 14 ? 18 : childName.length > 10 ? 22 : 20;
  let svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}" height="${LABEL_H}" viewBox="0 0 ${LABEL_W} ${LABEL_H}"><rect width="${LABEL_W}" height="${LABEL_H}" fill="white"/><rect x="1" y="1" width="${LABEL_W-2}" height="${LABEL_H-2}" fill="none" stroke="black" stroke-width="2"/><rect x="4" y="4" width="${LABEL_W-8}" height="${LABEL_H-8}" fill="none" stroke="black" stroke-width="0.8"/>`;
  svg += `<text x="${LABEL_W/2}" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="black">REWARD EARNED!</text>`;
  svg += `<text x="${LABEL_W/2}" y="62" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${nameFS}" fill="black">${esc(childName)}</text>`;
  svg += `<text x="${LABEL_W/2}" y="90" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="11" fill="black">${esc(rewardName)}</text>`;
  svg += `<text x="${LABEL_W/2}" y="112" text-anchor="middle" font-family="Arial" font-size="9" fill="black">* * * * *</text>`;
  svg += `<text x="${LABEL_W/2}" y="${LABEL_H-10}" text-anchor="middle" font-family="Arial" font-size="6" fill="#666">${esc(new Date().toLocaleDateString())}</text>`;
  svg += `</svg>`;
  return svg;
}

// ============================================
// WINDOWS: PowerShell System.Drawing label generation
// Draws directly to a bitmap using built-in Windows APIs
// ============================================

function generateWindowsPrintScript(data, type) {
  const printerName = PRINTER_NAME.replace(/_/g, ' ');
  const avatarPath = getAvatarPath(data.gender);

  // Build PowerShell drawing commands based on label type
  let drawCommands = '';

  if (type === 'child') {
    const {
      childName = 'Child', pickupCode = '0000', room = 'Room 101',
      parentName = '', allergies = '', streak = 0, badges = 0, rank = 1,
      tier = null, isNewBadge = false, badgeName = null,
      showAvatar = true, showName = true, showRoom = true,
      showStreak = true, showBadges = true, showRank = true,
      showPickupCode = true, showAllergies = true, showDate = true,
      borderStyle = 'pointed'
    } = data;

    const now = new Date();
    const dateStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    const avatarSize = 320;
    const avatarX = 45;
    const avatarY = Math.round((BMP_H - avatarSize) / 2);
    const contentX = showAvatar ? avatarX + avatarSize + 35 : 45;

    // Border
    if (borderStyle !== 'none') {
      if (tier === 'gold') {
        drawCommands += `$pen = New-Object Drawing.Pen([Drawing.Color]::Black, 12)\n$g.DrawRectangle($pen, 6, 6, ${BMP_W-12}, ${BMP_H-12})\n`;
        drawCommands += `$pen2 = New-Object Drawing.Pen([Drawing.Color]::Black, 3)\n$g.DrawRectangle($pen2, 18, 18, ${BMP_W-36}, ${BMP_H-36})\n`;
      } else if (tier === 'silver') {
        drawCommands += `$pen = New-Object Drawing.Pen([Drawing.Color]::Black, 12)\n$pen.DashStyle = [Drawing.Drawing2D.DashStyle]::Dash\n$g.DrawRectangle($pen, 6, 6, ${BMP_W-12}, ${BMP_H-12})\n`;
      } else {
        drawCommands += `$pen = New-Object Drawing.Pen([Drawing.Color]::Black, 12)\n$g.DrawRectangle($pen, 6, 6, ${BMP_W-12}, ${BMP_H-12})\n`;
      }
    }

    // Avatar
    if (showAvatar && avatarPath) {
      const winPath = avatarPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
      drawCommands += `
try {
  $avatar = [Drawing.Image]::FromFile('${winPath}')
  $g.SetClip((New-Object Drawing.Drawing2D.GraphicsPath))
  $clipPath = New-Object Drawing.Drawing2D.GraphicsPath
  $clipPath.AddRectangle((New-Object Drawing.Rectangle(${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})))
  $g.SetClip($clipPath)
  $g.DrawImage($avatar, ${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})
  $g.ResetClip()
  $avatar.Dispose()
  $avatarPen = New-Object Drawing.Pen([Drawing.Color]::Black, 5)
  $g.DrawRectangle($avatarPen, ${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})
} catch { }
`;
    } else if (showAvatar) {
      drawCommands += `$g.FillRectangle([Drawing.Brushes]::LightGray, ${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})\n`;
      drawCommands += `$g.DrawRectangle((New-Object Drawing.Pen([Drawing.Color]::Black, 5)), ${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})\n`;
      drawCommands += `$initFont = New-Object Drawing.Font('Arial', 120, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$sf = New-Object Drawing.StringFormat\n$sf.Alignment = [Drawing.StringAlignment]::Center\n$sf.LineAlignment = [Drawing.StringAlignment]::Center\n`;
      drawCommands += `$g.DrawString('${psEsc(childName.substring(0,2).toUpperCase())}', $initFont, [Drawing.Brushes]::Black, (New-Object Drawing.RectangleF(${avatarX}, ${avatarY}, ${avatarSize}, ${avatarSize})), $sf)\n`;
    }

    // Tier badge
    if (tier) {
      drawCommands += `$tierFont = New-Object Drawing.Font('Arial', 32, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('* ${psEsc(tier.toUpperCase())} TIER *', $tierFont, [Drawing.Brushes]::Black, ${contentX}, 20)\n`;
    }

    // Child name
    if (showName) {
      const nameY = tier ? 75 : 45;
      // Auto-size name
      drawCommands += `
$nameSize = 110
do {
  $nameFont = New-Object Drawing.Font('Arial', $nameSize, [Drawing.FontStyle]::Bold)
  $nameWidth = $g.MeasureString('${psEsc(childName)}', $nameFont).Width
  if ($nameWidth -gt 580) { $nameSize -= 10 } else { break }
} while ($nameSize -gt 40)
$g.DrawString('${psEsc(childName)}', $nameFont, [Drawing.Brushes]::Black, ${contentX}, ${nameY})
`;
    }

    // Room
    if (showRoom) {
      const roomY = tier ? 195 : 165;
      drawCommands += `$roomFont = New-Object Drawing.Font('Arial', 44, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('${psEsc(room)}', $roomFont, [Drawing.Brushes]::Black, ${contentX}, ${roomY})\n`;
    }

    // Stats
    const statsY = tier ? 290 : 260;
    let statIndex = 0;
    if (showStreak && streak > 0) {
      drawCommands += `$statFont = New-Object Drawing.Font('Arial', 64, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('${streak}', $statFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY})\n`;
      drawCommands += `$labelFont = New-Object Drawing.Font('Arial', 22, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('STREAK', $labelFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY + 70})\n`;
      statIndex++;
    }
    if (showBadges) {
      drawCommands += `$statFont = New-Object Drawing.Font('Arial', 64, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('${badges || 0}', $statFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY})\n`;
      drawCommands += `$labelFont = New-Object Drawing.Font('Arial', 22, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('BADGES', $labelFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY + 70})\n`;
      statIndex++;
    }
    if (showRank) {
      drawCommands += `$statFont = New-Object Drawing.Font('Arial', 64, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('#${rank || 1}', $statFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY})\n`;
      drawCommands += `$labelFont = New-Object Drawing.Font('Arial', 22, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('RANK', $labelFont, [Drawing.Brushes]::Black, ${contentX + statIndex * 150}, ${statsY + 70})\n`;
    }

    // New badge
    if (isNewBadge && badgeName) {
      const badgeY = statsY + 110;
      drawCommands += `$g.FillRectangle([Drawing.Brushes]::Black, ${contentX}, ${badgeY}, 440, 52)\n`;
      drawCommands += `$badgeFont = New-Object Drawing.Font('Arial', 26, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$bsf = New-Object Drawing.StringFormat\n$bsf.Alignment = [Drawing.StringAlignment]::Center\n$bsf.LineAlignment = [Drawing.StringAlignment]::Center\n`;
      drawCommands += `$g.DrawString('* NEW: ${psEsc(badgeName)} *', $badgeFont, [Drawing.Brushes]::White, (New-Object Drawing.RectangleF(${contentX}, ${badgeY}, 440, 52)), $bsf)\n`;
    }

    // Pickup code
    if (showPickupCode) {
      const sepX = 1040;
      drawCommands += `$dashPen = New-Object Drawing.Pen([Drawing.Color]::Black, 2)\n$dashPen.DashStyle = [Drawing.Drawing2D.DashStyle]::Dash\n`;
      drawCommands += `$g.DrawLine($dashPen, ${sepX}, 25, ${sepX}, ${BMP_H - 25})\n`;
      const codeX = sepX + (BMP_W - sepX) / 2;
      drawCommands += `$csf = New-Object Drawing.StringFormat\n$csf.Alignment = [Drawing.StringAlignment]::Center\n`;
      drawCommands += `$pickupLbl = New-Object Drawing.Font('Arial', 22, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('PICKUP', $pickupLbl, [Drawing.Brushes]::Black, ${codeX}, 90, $csf)\n`;
      drawCommands += `$g.DrawString('CODE', $pickupLbl, [Drawing.Brushes]::Black, ${codeX}, 118, $csf)\n`;
      drawCommands += `$codeFont = New-Object Drawing.Font('Consolas', 52, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('${psEsc(pickupCode)}', $codeFont, [Drawing.Brushes]::Black, ${codeX}, 200, $csf)\n`;
    }

    // Allergies
    if (showAllergies && allergies) {
      drawCommands += `$allergyFont = New-Object Drawing.Font('Arial', 24, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$allergyBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(220, 38, 38))\n`;
      drawCommands += `$g.DrawString('WARNING: ${psEsc(allergies)}', $allergyFont, $allergyBrush, ${contentX}, ${BMP_H - 80})\n`;
    }

    // Date footer
    if (showDate) {
      drawCommands += `$dateFont = New-Object Drawing.Font('Arial', 20, [Drawing.FontStyle]::Regular)\n`;
      drawCommands += `$dateBrush = New-Object Drawing.SolidBrush([Drawing.Color]::Gray)\n`;
      drawCommands += `$dsf = New-Object Drawing.StringFormat\n$dsf.Alignment = [Drawing.StringAlignment]::Center\n`;
      drawCommands += `$g.DrawString('${psEsc(dateStr)} - ${psEsc(parentName)}', $dateFont, $dateBrush, ${showPickupCode ? 540 : BMP_W / 2}, ${BMP_H - 35}, $dsf)\n`;
    }

  } else if (type === 'parent') {
    const { familyName = 'Family', children = [], showFamilyName = true, showChildren = true, showPickupCodes = true, showRooms = true, showDate = true, showTime = true } = data;
    const now = new Date();

    drawCommands += `$borderPen = New-Object Drawing.Pen([Drawing.Color]::Black, 8)\n$g.DrawRectangle($borderPen, 4, 4, ${BMP_W-8}, ${BMP_H-8})\n`;
    drawCommands += `$titleFont = New-Object Drawing.Font('Arial', 48, [Drawing.FontStyle]::Bold)\n`;
    drawCommands += `$csf = New-Object Drawing.StringFormat\n$csf.Alignment = [Drawing.StringAlignment]::Center\n`;
    drawCommands += `$g.DrawString('PARENT PICKUP RECEIPT', $titleFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 15, $csf)\n`;
    drawCommands += `$g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::Black, 2)), 50, 80, ${BMP_W-50}, 80)\n`;

    let yPos = 110;
    if (showFamilyName) {
      drawCommands += `$famFont = New-Object Drawing.Font('Arial', 46, [Drawing.FontStyle]::Bold)\n`;
      drawCommands += `$g.DrawString('${psEsc(familyName)}', $famFont, [Drawing.Brushes]::Black, ${BMP_W/2}, ${yPos}, $csf)\n`;
      yPos += 60;
    }

    if (showChildren && children.length > 0) {
      children.forEach((child, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const xPos = 60 + (col * 380);
        const rowY = yPos + (row * 180);
        drawCommands += `$childFont = New-Object Drawing.Font('Arial', 36, [Drawing.FontStyle]::Bold)\n`;
        drawCommands += `$g.DrawString('${psEsc(child.name || child.childName)}', $childFont, [Drawing.Brushes]::Black, ${xPos}, ${rowY})\n`;
        if (showRooms) {
          drawCommands += `$roomFont2 = New-Object Drawing.Font('Arial', 22)\n`;
          drawCommands += `$g.DrawString('${psEsc(child.room || 'Room 101')}', $roomFont2, [Drawing.Brushes]::Black, ${xPos}, ${rowY + 40})\n`;
        }
        if (showPickupCodes) {
          drawCommands += `$codeLbl = New-Object Drawing.Font('Arial', 22)\n`;
          drawCommands += `$g.DrawString('CODE:', $codeLbl, [Drawing.Brushes]::Black, ${xPos}, ${rowY + 75})\n`;
          drawCommands += `$codeFont2 = New-Object Drawing.Font('Consolas', 56, [Drawing.FontStyle]::Bold)\n`;
          drawCommands += `$g.DrawString('${psEsc(child.pickupCode)}', $codeFont2, [Drawing.Brushes]::Black, ${xPos}, ${rowY + 100})\n`;
        }
      });
    }

    let footer = 'Present this receipt at pickup';
    if (showDate && showTime) footer += ` - ${now.toLocaleDateString()} ${now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    drawCommands += `$footFont = New-Object Drawing.Font('Arial', 22)\n`;
    drawCommands += `$g.DrawString('${psEsc(footer)}', $footFont, [Drawing.Brushes]::Black, ${BMP_W/2}, ${BMP_H-40}, $csf)\n`;

  } else if (type === 'volunteer') {
    const { childName = 'Volunteer', volunteerName, room = "Children's Ministry", serviceArea = '' } = data;
    const name = volunteerName || childName;
    const now = new Date();

    drawCommands += `$borderPen = New-Object Drawing.Pen([Drawing.Color]::Black, 12)\n$g.DrawRectangle($borderPen, 6, 6, ${BMP_W-12}, ${BMP_H-12})\n`;
    drawCommands += `$csf = New-Object Drawing.StringFormat\n$csf.Alignment = [Drawing.StringAlignment]::Center\n`;
    drawCommands += `$hdrFont = New-Object Drawing.Font('Arial', 48, [Drawing.FontStyle]::Bold)\n`;
    drawCommands += `$g.DrawString('VOLUNTEER', $hdrFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 20, $csf)\n`;
    drawCommands += `$g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::Black, 3)), 50, 80, ${BMP_W-50}, 80)\n`;
    drawCommands += `
$volNameSize = 100
do {
  $volFont = New-Object Drawing.Font('Arial', $volNameSize, [Drawing.FontStyle]::Bold)
  $volWidth = $g.MeasureString('${psEsc(name)}', $volFont).Width
  if ($volWidth -gt ${BMP_W - 100}) { $volNameSize -= 10 } else { break }
} while ($volNameSize -gt 40)
$g.DrawString('${psEsc(name)}', $volFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 200, $csf)
`;
    drawCommands += `$areaFont = New-Object Drawing.Font('Arial', 40, [Drawing.FontStyle]::Bold)\n`;
    drawCommands += `$g.DrawString('${psEsc(serviceArea || room)}', $areaFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 360, $csf)\n`;
    drawCommands += `$dateFont = New-Object Drawing.Font('Arial', 28)\n`;
    drawCommands += `$dateBrush = New-Object Drawing.SolidBrush([Drawing.Color]::Gray)\n`;
    drawCommands += `$g.DrawString('${psEsc(now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))}', $dateFont, $dateBrush, ${BMP_W/2}, ${BMP_H-60}, $csf)\n`;

  } else if (type === 'reward') {
    const { childName = 'Child', rewardName = 'Achievement' } = data;

    drawCommands += `$borderPen = New-Object Drawing.Pen([Drawing.Color]::Black, 8)\n$g.DrawRectangle($borderPen, 4, 4, ${BMP_W-8}, ${BMP_H-8})\n`;
    drawCommands += `$borderPen2 = New-Object Drawing.Pen([Drawing.Color]::Black, 3)\n$g.DrawRectangle($borderPen2, 14, 14, ${BMP_W-28}, ${BMP_H-28})\n`;
    drawCommands += `$csf = New-Object Drawing.StringFormat\n$csf.Alignment = [Drawing.StringAlignment]::Center\n`;
    drawCommands += `$hdrFont = New-Object Drawing.Font('Arial', 48, [Drawing.FontStyle]::Bold)\n`;
    drawCommands += `$g.DrawString('REWARD EARNED!', $hdrFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 30, $csf)\n`;
    drawCommands += `
$rwdNameSize = 80
do {
  $rwdFont = New-Object Drawing.Font('Arial', $rwdNameSize, [Drawing.FontStyle]::Bold)
  $rwdWidth = $g.MeasureString('${psEsc(childName)}', $rwdFont).Width
  if ($rwdWidth -gt ${BMP_W - 100}) { $rwdNameSize -= 10 } else { break }
} while ($rwdNameSize -gt 40)
$g.DrawString('${psEsc(childName)}', $rwdFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 170, $csf)
`;
    drawCommands += `$rwdNameFont = New-Object Drawing.Font('Arial', 44, [Drawing.FontStyle]::Bold)\n`;
    drawCommands += `$g.DrawString('${psEsc(rewardName)}', $rwdNameFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 330, $csf)\n`;
    drawCommands += `$starFont = New-Object Drawing.Font('Arial', 36)\n`;
    drawCommands += `$g.DrawString('* * * * *', $starFont, [Drawing.Brushes]::Black, ${BMP_W/2}, 420, $csf)\n`;
    drawCommands += `$dateFont = New-Object Drawing.Font('Arial', 24)\n`;
    drawCommands += `$dateBrush = New-Object Drawing.SolidBrush([Drawing.Color]::Gray)\n`;
    drawCommands += `$g.DrawString('${psEsc(new Date().toLocaleDateString())}', $dateFont, $dateBrush, ${BMP_W/2}, ${BMP_H-50}, $csf)\n`;
  }

  // Full PowerShell script: create bitmap, draw, print, cleanup
  return `
Add-Type -AssemblyName System.Drawing

$bmp = New-Object Drawing.Bitmap(${BMP_W}, ${BMP_H})
$g = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAlias
$g.Clear([Drawing.Color]::White)

${drawCommands}

$g.Dispose()

# Print the bitmap
$printDoc = New-Object Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = '${psEsc(printerName)}'
$printDoc.DefaultPageSettings.Landscape = $true
$printDoc.DefaultPageSettings.Margins = New-Object Drawing.Printing.Margins(0, 0, 0, 0)

$script:labelBmp = $bmp
$printDoc.add_PrintPage({
  param($sender, $e)
  $e.Graphics.DrawImage($script:labelBmp, 0, 0, $e.PageBounds.Width, $e.PageBounds.Height)
})

$printDoc.Print()
$bmp.Dispose()

Write-Output 'PRINT_SUCCESS'
`;
}

// ============================================
// PRINT FUNCTIONS
// ============================================

function printMac(svgString) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `churchcheck-label-${Date.now()}.svg`);
    fs.writeFileSync(tmpFile, svgString);
    const cmd = `lp -d "${PRINTER_NAME}" -o fit-to-page -o orientation-requested=4 "${tmpFile}"`;
    exec(cmd, { timeout: 10000 }, (err, stdout) => {
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (e) { } }, 5000);
      if (err) return reject(err);
      console.log(`🖨️  Printed: ${stdout.trim()}`);
      resolve({ success: true });
    });
  });
}

function printWindows(psScript) {
  return new Promise((resolve, reject) => {
    const tempPs = path.join(os.tmpdir(), `churchcheck-print-${Date.now()}.ps1`);
    fs.writeFileSync(tempPs, psScript);
    exec(`powershell -ExecutionPolicy Bypass -File "${tempPs}"`, { timeout: 30000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempPs); } catch (e) { }
      if (err) {
        console.error('PowerShell print error:', err.message);
        if (stderr) console.error('stderr:', stderr);
        return reject(new Error(`Print failed: ${err.message}`));
      }
      if (stdout.includes('PRINT_SUCCESS')) {
        console.log('🖨️  Printed via PowerShell System.Drawing');
        resolve({ success: true });
      } else {
        console.log('PowerShell output:', stdout);
        resolve({ success: true }); // Assume success if no error
      }
    });
  });
}

// ============================================
// HTTP SERVER
// ============================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: true, printer: PRINTER_NAME, version: '3.1', os: IS_WINDOWS ? 'windows' : IS_MAC ? 'mac' : 'linux' }));
    return;
  }

  if (req.method === 'POST' && (req.url === '/print' || req.url === '/preview')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type || 'child';
        const isPreview = req.url === '/preview';

        if (isPreview || IS_MAC) {
          // Mac: use SVG for both printing and preview
          let svgContent;
          switch (type) {
            case 'parent': svgContent = generateParentLabelSVG(data); break;
            case 'volunteer': svgContent = generateVolunteerLabelSVG(data); break;
            case 'reward': svgContent = generateRewardLabelSVG(data); break;
            default: svgContent = generateChildLabelSVG(data);
          }

          if (isPreview) {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
            res.end(svgContent);
          } else {
            const result = await printMac(svgContent);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        } else {
          // Windows: use PowerShell System.Drawing
          const psScript = generateWindowsPrintScript(data, type);
          const result = await printWindows(psScript);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      } catch (err) {
        console.error('Print error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
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
🖨️  ChurchCheck Print Helper v3.1
═══════════════════════════════════════
📍 Running on http://${HOST === '0.0.0.0' ? localIP : 'localhost'}:${PORT}
🖨️  Printer: ${PRINTER_NAME}
📐 Label: 4" x 2.31" (30256 Shipping)
💻 Platform: ${IS_WINDOWS ? 'Windows (PowerShell System.Drawing)' : IS_MAC ? 'macOS (SVG + lp)' : 'Linux (SVG + lp)'}
💡 Zero native dependencies!
${NETWORK_MODE ? `🌐 Network mode: ON (http://${localIP}:${PORT})` : '🔒 Local only'}
═══════════════════════════════════════
  `);
});
