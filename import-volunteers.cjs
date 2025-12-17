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

// Load existing PINs from database
const existingPins = db.prepare('SELECT pin FROM children WHERE pin IS NOT NULL').all();
for (const row of existingPins) {
  usedPins.add(row.pin);
}
console.log(`Loaded ${usedPins.size} existing PINs from database`);

function generateRandomPin() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (usedPins.has(pin));
  usedPins.add(pin);
  return pin;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.length === 10 ? digits : (digits.length >= 7 ? digits : null);
}

function capitalize(str) {
  if (!str) return '';
  str = str.trim();
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Read and parse CSV
const csvPath = '/Users/christiankopeny/Downloads/People_Export.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Parse header
const header = parseCSVLine(lines[0]);

// Find column indices
const cols = {
  id: header.indexOf('ID'),
  firstName: header.indexOf('FirstName'),
  lastName: header.indexOf('LastName'),
  email: header.indexOf('PrimaryEmail'),
  cellPhone: header.indexOf('CellPhone'),
  birthdate: header.indexOf('Birthdate'),
  gender: header.indexOf('Gender'),
  isGuardian: header.indexOf('IsGuardian'),
  guardianId: header.indexOf('GuardianID')
};

// Parse all records - handle multi-line fields
const records = [];
let currentRecord = [];
let inMultiLine = false;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  if (!inMultiLine) {
    currentRecord = [line];
    const quoteCount = (line.match(/"/g) || []).length;
    inMultiLine = quoteCount % 2 !== 0;
  } else {
    currentRecord.push(line);
    const fullLine = currentRecord.join('\n');
    const quoteCount = (fullLine.match(/"/g) || []).length;
    inMultiLine = quoteCount % 2 !== 0;
  }
  
  if (!inMultiLine) {
    const fullLine = currentRecord.join('\n');
    const fields = parseCSVLine(fullLine);
    if (fields.length >= 10) {
      records.push(fields);
    }
    currentRecord = [];
  }
}

console.log(`Parsed ${records.length} records from CSV`);

// Find all guardian IDs that have children
const guardianIdsWithChildren = new Set();
for (const fields of records) {
  const isGuardian = fields[cols.isGuardian]?.toLowerCase() === 'true';
  const guardianId = fields[cols.guardianId];
  
  if (!isGuardian && guardianId) {
    guardianIdsWithChildren.add(guardianId);
  }
}

console.log(`Found ${guardianIdsWithChildren.size} guardians with children`);

// Find guardians WITHOUT children (volunteers)
const volunteers = [];
for (const fields of records) {
  const isGuardian = fields[cols.isGuardian]?.toLowerCase() === 'true';
  const id = fields[cols.id];
  
  if (isGuardian && !guardianIdsWithChildren.has(id)) {
    const phone = normalizePhone(fields[cols.cellPhone]);
    if (phone) {
      volunteers.push({
        id,
        firstName: capitalize(fields[cols.firstName] || ''),
        lastName: capitalize(fields[cols.lastName] || ''),
        email: fields[cols.email] || '',
        phone,
        gender: fields[cols.gender] === 'Male' ? 'male' : (fields[cols.gender] === 'Female' ? 'female' : '')
      });
    }
  }
}

console.log(`Found ${volunteers.length} volunteers (guardians without children, with phone)`);

// Prepare database statements
const checkFamily = db.prepare('SELECT id FROM families WHERE phone = ?');
const insertFamily = db.prepare(`
  INSERT INTO families (name, phone, email, parent_name)
  VALUES (?, ?, ?, ?)
`);
const insertChild = db.prepare(`
  INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes, streak, badges, total_checkins)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
`);

let importedVolunteers = 0;
let skippedVolunteers = 0;

console.log('\n📦 Importing volunteers...\n');

for (const vol of volunteers) {
  // Check if already exists
  const existing = checkFamily.get(vol.phone);
  if (existing) {
    skippedVolunteers++;
    continue;
  }
  
  const familyName = `${vol.firstName} ${vol.lastName} (Volunteer)`;
  const parentName = `${vol.firstName} ${vol.lastName}`;
  const displayName = `${vol.firstName} ${vol.lastName}`;
  
  try {
    // Create a "family" for the volunteer
    const result = insertFamily.run(familyName, vol.phone, vol.email, parentName);
    const familyId = result.lastInsertRowid;
    
    // Add the volunteer as their own "child" so they can check in
    const pin = generateRandomPin();
    const avatar = getRandomAvatar();
    
    insertChild.run(
      familyId,
      vol.firstName,
      vol.lastName,
      displayName,
      null, // age
      null, // birthday
      vol.gender,
      pin,
      avatar,
      '',
      'Volunteer'
    );
    
    importedVolunteers++;
    if (importedVolunteers % 25 === 0) {
      console.log(`  ✅ Imported ${importedVolunteers} volunteers...`);
    }
  } catch (err) {
    console.error(`❌ Error importing volunteer ${vol.firstName} ${vol.lastName}:`, err.message);
  }
}

console.log(`\n========================================`);
console.log(`📊 Volunteer Import complete!`);
console.log(`   ✅ Volunteers imported: ${importedVolunteers}`);
console.log(`   ⏭️  Skipped (existing): ${skippedVolunteers}`);
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


