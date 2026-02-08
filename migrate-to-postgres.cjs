/**
 * SQLite to PostgreSQL Migration Script
 * 
 * This script exports data from your local SQLite database
 * and generates SQL statements to import into PostgreSQL.
 * 
 * Usage: node migrate-to-postgres.cjs > migration-data.sql
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'kidcheck.db'));

// Helper to escape strings for SQL
const escape = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
};

// Helper to format value for SQL
const formatValue = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return escape(val);
};

console.log('-- ChurchCheck SQLite to PostgreSQL Migration');
console.log('-- Generated: ' + new Date().toISOString());
console.log('');
console.log('-- Run schema.sql first to create tables');
console.log('');

// Migrate organizations
console.log('-- Organizations');
const orgs = db.prepare('SELECT * FROM organizations').all();
if (orgs.length === 0) {
  console.log("INSERT INTO organizations (name, slug, email) VALUES ('Default Organization', 'default', 'admin@example.com');");
} else {
  for (const org of orgs) {
    console.log(`INSERT INTO organizations (id, name, slug, email, phone, address, city, state, zip, logo_url, subscription_status, subscription_plan) VALUES (${org.id}, ${formatValue(org.name)}, ${formatValue(org.slug)}, ${formatValue(org.email)}, ${formatValue(org.phone)}, ${formatValue(org.address)}, ${formatValue(org.city)}, ${formatValue(org.state)}, ${formatValue(org.zip)}, ${formatValue(org.logo_url)}, ${formatValue(org.subscription_status)}, ${formatValue(org.subscription_plan)}) ON CONFLICT (slug) DO NOTHING;`);
  }
}
console.log('');

// Migrate admin_users
console.log('-- Admin Users');
const admins = db.prepare('SELECT * FROM admin_users').all();
for (const admin of admins) {
  const orgId = admin.org_id || 1;
  console.log(`INSERT INTO admin_users (id, org_id, username, email, password, role) VALUES (${admin.id}, ${orgId}, ${formatValue(admin.username)}, ${formatValue(admin.email)}, ${formatValue(admin.password)}, ${formatValue(admin.role)}) ON CONFLICT (org_id, username) DO NOTHING;`);
}
console.log('');

// Migrate families
console.log('-- Families');
const families = db.prepare('SELECT * FROM families').all();
for (const f of families) {
  const orgId = f.org_id || 1;
  console.log(`INSERT INTO families (id, org_id, name, phone, email, parent_name, address, is_volunteer) VALUES (${f.id}, ${orgId}, ${formatValue(f.name)}, ${formatValue(f.phone)}, ${formatValue(f.email)}, ${formatValue(f.parent_name)}, ${formatValue(f.address)}, ${f.is_volunteer || 0}) ON CONFLICT DO NOTHING;`);
}
console.log('');

// Migrate children
console.log('-- Children');
const children = db.prepare('SELECT * FROM children').all();
for (const c of children) {
  const orgId = c.org_id || 1;
  console.log(`INSERT INTO children (id, org_id, family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, streak, badges, total_checkins, allergies, notes) VALUES (${c.id}, ${orgId}, ${c.family_id}, ${formatValue(c.first_name)}, ${formatValue(c.last_name)}, ${formatValue(c.name)}, ${c.age || 'NULL'}, ${formatValue(c.birthday)}, ${formatValue(c.gender)}, ${formatValue(c.pin)}, ${formatValue(c.avatar)}, ${c.streak || 0}, ${c.badges || 0}, ${c.total_checkins || 0}, ${formatValue(c.allergies)}, ${formatValue(c.notes)}) ON CONFLICT DO NOTHING;`);
}
console.log('');

// Migrate templates
console.log('-- Templates');
const templates = db.prepare('SELECT * FROM templates').all();
for (const t of templates) {
  const orgId = t.org_id || 1;
  console.log(`INSERT INTO templates (id, org_id, name, day_of_week, start_time, end_time, checkout_enabled, room_ids, is_active, streak_reset_days, track_streaks, print_volunteer_badges, label_settings) VALUES (${t.id}, ${orgId}, ${formatValue(t.name)}, ${formatValue(t.day_of_week)}, ${formatValue(t.start_time)}, ${formatValue(t.end_time)}, ${t.checkout_enabled || 0}, ${formatValue(t.room_ids)}, ${t.is_active || 0}, ${t.streak_reset_days || 7}, ${t.track_streaks || 1}, ${t.print_volunteer_badges || 1}, ${formatValue(t.label_settings)}) ON CONFLICT DO NOTHING;`);
}
console.log('');

// Migrate rooms
console.log('-- Rooms');
try {
  const rooms = db.prepare('SELECT * FROM rooms').all();
  for (const r of rooms) {
    const orgId = r.org_id || 1;
    console.log(`INSERT INTO rooms (id, org_id, name, age_range, capacity) VALUES (${r.id}, ${orgId}, ${formatValue(r.name)}, ${formatValue(r.age_range)}, ${r.capacity || 'NULL'}) ON CONFLICT DO NOTHING;`);
  }
} catch (e) {
  console.log('-- No rooms table or error reading rooms');
}
console.log('');

// Migrate rewards
console.log('-- Rewards');
try {
  const rewards = db.prepare('SELECT * FROM rewards').all();
  for (const r of rewards) {
    const orgId = r.org_id || 1;
    console.log(`INSERT INTO rewards (id, org_id, name, description, type, trigger_type, trigger_value, prize, icon, enabled, is_preset) VALUES (${r.id}, ${orgId}, ${formatValue(r.name)}, ${formatValue(r.description)}, ${formatValue(r.type)}, ${formatValue(r.trigger_type)}, ${r.trigger_value}, ${formatValue(r.prize)}, ${formatValue(r.icon)}, ${r.enabled || 1}, ${r.is_preset || 0}) ON CONFLICT DO NOTHING;`);
  }
} catch (e) {
  console.log('-- No rewards or error');
}
console.log('');

// Migrate checkins (recent only - last 90 days)
console.log('-- Recent Check-ins (last 90 days)');
try {
  const checkins = db.prepare(`
    SELECT * FROM checkins 
    WHERE checked_in_at > datetime('now', '-90 days')
    ORDER BY id
  `).all();
  for (const ch of checkins) {
    const orgId = ch.org_id || 1;
    console.log(`INSERT INTO checkins (id, org_id, child_id, family_id, template_id, room, pickup_code, checked_in_at, checked_out_at) VALUES (${ch.id}, ${orgId}, ${ch.child_id}, ${ch.family_id}, ${ch.template_id || 'NULL'}, ${formatValue(ch.room)}, ${formatValue(ch.pickup_code)}, ${formatValue(ch.checked_in_at)}, ${formatValue(ch.checked_out_at)}) ON CONFLICT DO NOTHING;`);
  }
  console.log(`-- Migrated ${checkins.length} check-ins`);
} catch (e) {
  console.log('-- Error migrating check-ins: ' + e.message);
}
console.log('');

// Reset sequences
console.log('-- Reset PostgreSQL sequences');
console.log("SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));");
console.log("SELECT setval('admin_users_id_seq', (SELECT MAX(id) FROM admin_users));");
console.log("SELECT setval('families_id_seq', (SELECT MAX(id) FROM families));");
console.log("SELECT setval('children_id_seq', (SELECT MAX(id) FROM children));");
console.log("SELECT setval('templates_id_seq', (SELECT MAX(id) FROM templates));");
console.log("SELECT setval('rooms_id_seq', (SELECT MAX(id) FROM rooms));");
console.log("SELECT setval('checkins_id_seq', (SELECT MAX(id) FROM checkins));");
console.log("SELECT setval('rewards_id_seq', (SELECT MAX(id) FROM rewards));");
console.log('');

console.log('-- Migration complete!');
console.log(`-- Migrated: ${families.length} families, ${children.length} children, ${templates.length} templates`);

db.close();

