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

// Read volunteer CSV
const csvPath = '/Users/christiankopeny/Downloads/volunteer export - Sheet1.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Get unique volunteer phone numbers
const volunteerPhones = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const parts = line.split(',');
  if (parts.length < 3) continue;
  
  const phone = normalizePhone(parts[2]);
  if (phone) {
    volunteerPhones.add(phone);
  }
}

console.log(`Found ${volunteerPhones.size} unique volunteer phone numbers`);

// Mark families that match volunteer phones
const updateFamily = db.prepare('UPDATE families SET is_volunteer = 1 WHERE phone = ?');

let markedCount = 0;
for (const phone of volunteerPhones) {
  const result = updateFamily.run(phone);
  if (result.changes > 0) {
    markedCount++;
  }
}

console.log(`Marked ${markedCount} existing families as volunteers`);

// Also mark families that have "(Volunteer)" in name
const markVolunteerFamilies = db.prepare("UPDATE families SET is_volunteer = 1 WHERE name LIKE '%(Volunteer)%'");
const volFamilies = markVolunteerFamilies.run();
console.log(`Marked ${volFamilies.changes} volunteer-only families`);

// Count totals
const totalVolunteers = db.prepare('SELECT COUNT(*) as count FROM families WHERE is_volunteer = 1').get();
console.log(`\nTotal families marked as volunteers: ${totalVolunteers.count}`);

db.close();


