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

function generatePinFromBirthday(birthday, firstName) {
  let pin;
  if (!birthday) {
    // Generate random 6-digit PIN
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (usedPins.has(pin));
  } else {
    const date = new Date(birthday);
    if (isNaN(date.getTime())) {
      do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
      } while (usedPins.has(pin));
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      pin = `${month}${day}${year}`;
      
      // If PIN already used, append incrementing digit
      if (usedPins.has(pin)) {
        let counter = 1;
        let newPin = pin.slice(0, 5) + counter;
        while (usedPins.has(newPin)) {
          counter++;
          newPin = pin.slice(0, 5) + counter;
        }
        pin = newPin;
      }
    }
  }
  usedPins.add(pin);
  return pin;
}

function calculateAge(birthday) {
  if (!birthday) return null;
  const date = new Date(birthday);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

// Parse DD/MM/YYYY format to YYYY-MM-DD
function parseBirthday(bdayStr) {
  if (!bdayStr || bdayStr.trim() === '') return null;
  
  // Handle DD/MM/YYYY format
  const parts = bdayStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
      const date = new Date(fullYear, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try standard date parsing as fallback
  const date = new Date(bdayStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
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
console.log('CSV Headers:', header.join(', '));

// Find column indices
const cols = {
  id: header.indexOf('ID'),
  firstName: header.indexOf('FirstName'),
  lastName: header.indexOf('LastName'),
  email: header.indexOf('PrimaryEmail'),
  cellPhone: header.indexOf('CellPhone'),
  birthdate: header.indexOf('Birthdate'),
  gender: header.indexOf('Gender'),
  medicalInfo: header.indexOf('MedicalInfo'),
  isGuardian: header.indexOf('IsGuardian'),
  guardianId: header.indexOf('GuardianID')
};

console.log('Column indices:', cols);

// Parse all records - handle multi-line fields
const records = [];
let currentRecord = [];
let inMultiLine = false;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  if (!inMultiLine) {
    currentRecord = [line];
    // Check if we have an unclosed quote
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

// Separate guardians and children
const guardians = new Map(); // ID -> guardian data
const children = []; // children with guardian references

for (const fields of records) {
  const isGuardian = fields[cols.isGuardian]?.toLowerCase() === 'true';
  const id = fields[cols.id];
  const firstName = fields[cols.firstName] || '';
  const lastName = fields[cols.lastName] || '';
  const email = fields[cols.email] || '';
  const cellPhone = normalizePhone(fields[cols.cellPhone]);
  const birthdate = parseBirthday(fields[cols.birthdate]);
  const gender = fields[cols.gender] || '';
  const medicalInfo = fields[cols.medicalInfo] || '';
  const guardianId = fields[cols.guardianId] || '';
  
  if (isGuardian) {
    guardians.set(id, {
      id,
      firstName: capitalize(firstName),
      lastName: capitalize(lastName),
      email,
      phone: cellPhone,
      children: []
    });
  } else {
    children.push({
      firstName: capitalize(firstName),
      lastName: capitalize(lastName),
      birthdate,
      gender: gender === 'Male' ? 'male' : (gender === 'Female' ? 'female' : ''),
      medicalInfo,
      guardianId
    });
  }
}

console.log(`Found ${guardians.size} guardians and ${children.length} children`);

// Link children to guardians
for (const child of children) {
  const guardian = guardians.get(child.guardianId);
  if (guardian) {
    guardian.children.push(child);
  }
}

// Filter guardians with phone numbers and children
const validFamilies = Array.from(guardians.values()).filter(g => g.phone && g.children.length > 0);
console.log(`Found ${validFamilies.length} valid families (with phone and children)`);

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

let importedFamilies = 0;
let importedChildren = 0;
let skippedFamilies = 0;

console.log('\n📦 Starting import...\n');

for (const family of validFamilies) {
  // Check if family already exists
  const existing = checkFamily.get(family.phone);
  if (existing) {
    skippedFamilies++;
    continue;
  }
  
  const familyName = `The ${family.lastName} Family`;
  const parentName = `${family.firstName} ${family.lastName}`;
  
  try {
    const result = insertFamily.run(familyName, family.phone, family.email, parentName);
    const familyId = result.lastInsertRowid;
    
    for (const child of family.children) {
      const displayName = `${child.firstName} ${child.lastName}`;
      const age = calculateAge(child.birthdate);
      const pin = generatePinFromBirthday(child.birthdate, child.firstName);
      const avatar = getRandomAvatar();
      
      try {
        insertChild.run(
          familyId,
          child.firstName,
          child.lastName,
          displayName,
          age,
          child.birthdate,
          child.gender,
          pin,
          avatar,
          child.medicalInfo,
          ''
        );
        importedChildren++;
      } catch (err) {
        console.error(`  ❌ Error adding child ${displayName}:`, err.message);
      }
    }
    
    importedFamilies++;
    if (importedFamilies % 50 === 0) {
      console.log(`  ✅ Imported ${importedFamilies} families...`);
    }
  } catch (err) {
    console.error(`❌ Error importing ${familyName}:`, err.message);
  }
}

console.log(`\n========================================`);
console.log(`📊 Import complete!`);
console.log(`   ✅ Families imported: ${importedFamilies}`);
console.log(`   👶 Children imported: ${importedChildren}`);
console.log(`   ⏭️  Skipped (existing): ${skippedFamilies}`);
console.log(`========================================`);

// Show total counts
const totalFamilies = db.prepare('SELECT COUNT(*) as count FROM families').get();
const totalChildren = db.prepare('SELECT COUNT(*) as count FROM children').get();
console.log(`\n📈 Database totals:`);
console.log(`   Families: ${totalFamilies.count}`);
console.log(`   Children: ${totalChildren.count}`);

db.close();


