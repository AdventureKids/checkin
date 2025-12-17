const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'kidcheck.db'));

// Park Ranger avatars
const RANGER_AVATARS = [
  'ParkRanger-001', 'ParkRanger-002', 'ParkRanger-003', 'ParkRanger-004', 'ParkRanger-005',
  'ParkRanger-006', 'ParkRanger-007', 'ParkRanger-008', 'ParkRanger-009', 'ParkRanger-010',
  'ParkRanger-011', 'ParkRanger-012', 'ParkRanger-013', 'ParkRanger-014', 'ParkRanger-015',
  'ParkRanger-016', 'ParkRanger-017', 'ParkRanger-018'
];

function getRandomAvatar() {
  return RANGER_AVATARS[Math.floor(Math.random() * RANGER_AVATARS.length)];
}

// Track used PINs
const usedPins = new Set();

// Load existing PINs from non-volunteer children
const existingPins = db.prepare("SELECT pin FROM children WHERE pin IS NOT NULL AND notes != 'Volunteer'").all();
for (const row of existingPins) {
  usedPins.add(row.pin);
}
console.log(`Loaded ${usedPins.size} existing PINs from database (non-volunteers)`);

function generatePinFromBirthday(month, day, year) {
  let pin;
  
  // Convert month name to number
  const monthMap = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const monthNum = monthMap[month?.toLowerCase()?.trim()];
  const dayNum = day ? String(day).padStart(2, '0') : null;
  const yearNum = year ? String(year).slice(-2) : null;
  
  if (monthNum && dayNum && yearNum) {
    pin = `${monthNum}${dayNum}${yearNum}`;
    
    // If PIN already used, add random suffix
    if (usedPins.has(pin)) {
      let counter = 1;
      let newPin = pin.slice(0, 5) + counter;
      while (usedPins.has(newPin)) {
        counter++;
        newPin = pin.slice(0, 5) + counter;
      }
      pin = newPin;
    }
  } else {
    // Generate random 6-digit PIN
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (usedPins.has(pin));
  }
  
  usedPins.add(pin);
  return pin;
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Remove "Don't text" and similar notes
  phone = phone.replace(/don'?t\s*text/gi, '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.length === 10 ? digits : (digits.length >= 7 ? digits : null);
}

function capitalize(str) {
  if (!str) return '';
  str = str.trim();
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function parseBirthday(month, day, year) {
  if (!month || !day || !year) return null;
  
  const monthMap = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
    'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
    'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };
  
  const monthNum = monthMap[month?.toLowerCase()?.trim()];
  if (!monthNum) return null;
  
  let fullYear = parseInt(year);
  if (fullYear < 100) {
    fullYear = fullYear > 50 ? 1900 + fullYear : 2000 + fullYear;
  }
  
  const date = new Date(fullYear, monthNum - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;
  
  return date.toISOString().split('T')[0];
}

// Step 1: Remove old volunteer data
console.log('\n🗑️  Removing old volunteer data...');

// Get all volunteer family IDs
const oldVolunteerFamilies = db.prepare(`
  SELECT DISTINCT f.id FROM families f 
  LEFT JOIN children c ON c.family_id = f.id
  WHERE f.name LIKE '%(Volunteer)%' OR c.notes = 'Volunteer'
`).all();

console.log(`   Found ${oldVolunteerFamilies.length} old volunteer families to remove`);

// Delete children first (foreign key constraint)
const deleteChildren = db.prepare("DELETE FROM children WHERE notes = 'Volunteer'");
const deletedChildren = deleteChildren.run();
console.log(`   Deleted ${deletedChildren.changes} volunteer children records`);

// Delete volunteer families
const deleteFamilies = db.prepare("DELETE FROM families WHERE name LIKE '%(Volunteer)%'");
const deletedFamilies = deleteFamilies.run();
console.log(`   Deleted ${deletedFamilies.changes} volunteer family records`);

// Step 2: Read and parse CSV
console.log('\n📖 Reading volunteer roster...');
const csvPath = '/Users/christiankopeny/Downloads/volunteer export - Sheet1.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Skip header
const volunteers = [];
const seenPhones = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Parse CSV (handle quoted fields)
  const parts = line.split(',');
  if (parts.length < 4) continue;
  
  const lastName = parts[0]?.trim();
  const firstName = parts[1]?.trim();
  const phone = normalizePhone(parts[2]);
  const email = parts[3]?.trim();
  const birthMonth = parts[4]?.trim();
  const birthDay = parts[5]?.trim();
  const birthYear = parts[6]?.trim();
  
  // Skip empty rows or rows without names
  if (!lastName || !firstName || lastName === '*indicates minor') continue;
  
  // Skip if no valid phone
  if (!phone) {
    console.log(`   ⚠️ Skipping ${firstName} ${lastName} - no valid phone`);
    continue;
  }
  
  // Skip duplicates (same phone number)
  if (seenPhones.has(phone)) {
    continue;
  }
  seenPhones.add(phone);
  
  volunteers.push({
    firstName: capitalize(firstName.replace(/['"()]/g, '')),
    lastName: capitalize(lastName),
    phone,
    email: email || '',
    birthMonth,
    birthDay,
    birthYear
  });
}

console.log(`   Found ${volunteers.length} unique volunteers`);

// Step 3: Check which volunteers are already in the system as parents
const checkFamily = db.prepare('SELECT id, name FROM families WHERE phone = ?');

let existingParents = 0;
let newVolunteers = 0;

// Prepare statements
const insertFamily = db.prepare(`
  INSERT INTO families (name, phone, email, parent_name)
  VALUES (?, ?, ?, ?)
`);

const insertChild = db.prepare(`
  INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes, streak, badges, total_checkins)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
`);

console.log('\n📦 Importing volunteers...');

for (const vol of volunteers) {
  const existingFamily = checkFamily.get(vol.phone);
  
  if (existingFamily) {
    // This volunteer is already a parent in the system
    // We could add an is_volunteer flag here, but for now we'll skip
    existingParents++;
    continue;
  }
  
  // Create new volunteer
  const familyName = `${vol.firstName} ${vol.lastName} (Volunteer)`;
  const displayName = `${vol.firstName} ${vol.lastName}`;
  const birthday = parseBirthday(vol.birthMonth, vol.birthDay, vol.birthYear);
  const pin = generatePinFromBirthday(vol.birthMonth, vol.birthDay, vol.birthYear);
  const avatar = getRandomAvatar();
  
  try {
    const result = insertFamily.run(familyName, vol.phone, vol.email, displayName);
    const familyId = result.lastInsertRowid;
    
    insertChild.run(
      familyId,
      vol.firstName,
      vol.lastName,
      displayName,
      null, // age
      birthday,
      null, // gender
      pin,
      avatar,
      '',
      'Volunteer'
    );
    
    newVolunteers++;
  } catch (err) {
    console.error(`   ❌ Error importing ${vol.firstName} ${vol.lastName}:`, err.message);
  }
}

console.log(`\n========================================`);
console.log(`📊 Volunteer Import complete!`);
console.log(`   ✅ New volunteers imported: ${newVolunteers}`);
console.log(`   ⏭️  Already parents (skipped): ${existingParents}`);
console.log(`========================================`);

// Show total counts
const totalFamilies = db.prepare('SELECT COUNT(*) as count FROM families').get();
const totalChildren = db.prepare('SELECT COUNT(*) as count FROM children').get();
const volunteerCount = db.prepare("SELECT COUNT(*) as count FROM children WHERE notes = 'Volunteer'").get();

console.log(`\n📈 Database totals:`);
console.log(`   Families: ${totalFamilies.count}`);
console.log(`   Children/People: ${totalChildren.count}`);
console.log(`   Volunteers: ${volunteerCount.count}`);

db.close();


