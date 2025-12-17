const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'kidcheck.db'));

function normalizePhone(phone) {
  if (!phone) return null;
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

// Read volunteer CSV
console.log('📖 Reading volunteer roster...');
const csvPath = '/Users/christiankopeny/Downloads/volunteer export - Sheet1.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Build phone -> volunteer name mapping
const volunteerMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const parts = line.split(',');
  if (parts.length < 4) continue;
  
  const lastName = capitalize(parts[0]?.trim());
  const firstName = capitalize(parts[1]?.trim().replace(/['"()]/g, ''));
  const phone = normalizePhone(parts[2]);
  const email = parts[3]?.trim();
  
  if (!lastName || !firstName || lastName === '*Indicates Minor') continue;
  if (!phone) continue;
  
  volunteerMap.set(phone, { firstName, lastName, email });
}

console.log(`Found ${volunteerMap.size} volunteers in CSV`);

// Get all parent-volunteers (those marked is_volunteer=1 but not volunteer-only)
const parentVolunteers = db.prepare(`
  SELECT id, name, phone, parent_name, email 
  FROM families 
  WHERE is_volunteer = 1 AND name NOT LIKE '%(Volunteer)%'
`).all();

console.log(`Found ${parentVolunteers.length} parent-volunteers to check`);

// Update parent_name for those that don't match
const updateFamily = db.prepare(`
  UPDATE families 
  SET parent_name = ?, email = COALESCE(NULLIF(?, ''), email)
  WHERE id = ?
`);

let updated = 0;
for (const family of parentVolunteers) {
  const volunteer = volunteerMap.get(family.phone);
  if (!volunteer) continue;
  
  const fullName = `${volunteer.firstName} ${volunteer.lastName}`;
  
  // Check if parent_name needs updating
  if (family.parent_name !== fullName) {
    console.log(`   Updating family ${family.id}: "${family.parent_name}" → "${fullName}"`);
    updateFamily.run(fullName, volunteer.email, family.id);
    updated++;
  }
}

console.log(`\n✅ Updated ${updated} parent-volunteer names`);

// Show current volunteer counts
const totalVolunteers = db.prepare('SELECT COUNT(*) as count FROM families WHERE is_volunteer = 1').get();
const volunteerOnly = db.prepare("SELECT COUNT(*) as count FROM families WHERE name LIKE '%(Volunteer)%'").get();
const parentVolunteerCount = totalVolunteers.count - volunteerOnly.count;

console.log(`\n📊 Volunteer Summary:`);
console.log(`   Total volunteers: ${totalVolunteers.count}`);
console.log(`   Volunteer-only: ${volunteerOnly.count}`);
console.log(`   Parent + Volunteer: ${parentVolunteerCount}`);

db.close();


