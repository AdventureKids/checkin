const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const Database = require('better-sqlite3');

// ============================================
// DEPLOYMENT CONFIGURATION
// ============================================
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for deployment
const NODE_ENV = process.env.NODE_ENV || 'development';
const DISABLE_PRINTING = process.env.DISABLE_PRINTING === 'true'; // Disable printing for remote deployment

// ============================================
// AVATAR SYSTEM - Single explorer character
// ============================================
const PUBLIC_PATH = process.env.PUBLIC_PATH || path.join(__dirname, 'public');
const AVATAR_STATIC_PATH = path.join(PUBLIC_PATH, 'avatars', 'boy-ranger', 'boy-test-000.png');
const DEFAULT_AVATAR = 'explorer';
console.log('📁 Public path:', PUBLIC_PATH);

// Get avatar URL - returns the static PNG for all avatars
function getAvatarUrl() {
  return '/avatars/boy-ranger/boy-test-000.png';
}

// Fetch avatar image for label printing - always uses the explorer PNG
let cachedAvatarImage = null;
async function fetchAvatarImage(avatarId) {
  if (cachedAvatarImage) {
    console.log(`🖼️ Avatar found in cache`);
    return cachedAvatarImage;
  }
  
  try {
    console.log(`🖼️ Loading avatar from: ${AVATAR_STATIC_PATH}`);
    cachedAvatarImage = await loadImage(AVATAR_STATIC_PATH);
    return cachedAvatarImage;
  } catch (err) {
    console.error('Failed to load avatar:', err);
    return null;
  }
}

const app = express();
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for large CSV imports
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================
// ADMIN AUTH CONFIG
// ============================================

// Default admin credentials (change these!)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'adventure123';

// Simple session tokens (in production, use JWT or proper session management)
const activeSessions = new Map();

function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ============================================
// DATABASE SETUP
// ============================================

// Use environment variable for database path (for Electron/Render) or default
// On Render, use persistent disk at /data
const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' && fs.existsSync('/data') ? '/data/kidcheck.db' : 'kidcheck.db');
console.log('📁 Database path:', DB_PATH);
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    parent_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    name TEXT NOT NULL,
    age INTEGER,
    birthday TEXT,
    gender TEXT,
    pin TEXT UNIQUE,
    avatar TEXT DEFAULT '🦊',
    streak INTEGER DEFAULT 0,
    badges INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    allergies TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id)
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    family_id INTEGER NOT NULL,
    template_id INTEGER,
    room TEXT,
    pickup_code TEXT,
    checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_out_at DATETIME,
    FOREIGN KEY (child_id) REFERENCES children(id),
    FOREIGN KEY (family_id) REFERENCES families(id),
    FOREIGN KEY (template_id) REFERENCES templates(id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age_range TEXT,
    capacity INTEGER
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'milestone',
    trigger_type TEXT NOT NULL DEFAULT 'checkin_count',
    trigger_value INTEGER NOT NULL DEFAULT 1,
    prize TEXT,
    icon TEXT DEFAULT '🎁',
    enabled INTEGER DEFAULT 1,
    is_preset INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS earned_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    prize_claimed INTEGER DEFAULT 0,
    FOREIGN KEY (child_id) REFERENCES children(id),
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    day_of_week TEXT,
    start_time TEXT,
    end_time TEXT,
    checkout_enabled INTEGER DEFAULT 0,
    room_ids TEXT,
    is_active INTEGER DEFAULT 0,
    streak_reset_days INTEGER DEFAULT 7,
    track_streaks INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS child_template_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    streak INTEGER DEFAULT 0,
    last_checkin_date TEXT,
    FOREIGN KEY (child_id) REFERENCES children(id),
    FOREIGN KEY (template_id) REFERENCES templates(id),
    UNIQUE(child_id, template_id)
  );

  CREATE TABLE IF NOT EXISTS child_accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    accessory_type TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_equipped INTEGER DEFAULT 0,
    FOREIGN KEY (child_id) REFERENCES children(id),
    UNIQUE(child_id, accessory_type, accessory_id)
  );

  CREATE TABLE IF NOT EXISTS avatar_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    accessory_type TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'checkin_count',
    trigger_value INTEGER NOT NULL DEFAULT 1,
    icon TEXT DEFAULT '🎁',
    enabled INTEGER DEFAULT 1,
    is_preset INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Run migrations for existing databases
try {
  // Add template_id to checkins if it doesn't exist
  const checkinColumns = db.prepare("PRAGMA table_info(checkins)").all();
  if (!checkinColumns.find(c => c.name === 'template_id')) {
    db.exec('ALTER TABLE checkins ADD COLUMN template_id INTEGER');
    console.log('✅ Migration: Added template_id to checkins table');
  }
  
  // Add streak_reset_days and track_streaks to templates if they don't exist
  const templateColumns = db.prepare("PRAGMA table_info(templates)").all();
  if (!templateColumns.find(c => c.name === 'streak_reset_days')) {
    db.exec('ALTER TABLE templates ADD COLUMN streak_reset_days INTEGER DEFAULT 7');
    console.log('✅ Migration: Added streak_reset_days to templates table');
  }
  if (!templateColumns.find(c => c.name === 'track_streaks')) {
    db.exec('ALTER TABLE templates ADD COLUMN track_streaks INTEGER DEFAULT 1');
    console.log('✅ Migration: Added track_streaks to templates table');
  }
  if (!templateColumns.find(c => c.name === 'print_volunteer_badges')) {
    db.exec('ALTER TABLE templates ADD COLUMN print_volunteer_badges INTEGER DEFAULT 1');
    console.log('✅ Migration: Added print_volunteer_badges to templates table');
  }
  if (!templateColumns.find(c => c.name === 'label_settings')) {
    db.exec('ALTER TABLE templates ADD COLUMN label_settings TEXT');
    console.log('✅ Migration: Added label_settings to templates table');
  }
  
  // Create child_template_streaks table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS child_template_streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      streak INTEGER DEFAULT 0,
      last_checkin_date TEXT,
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (template_id) REFERENCES templates(id),
      UNIQUE(child_id, template_id)
    )
  `);
  
  // Create pending_rewards table for admin-assigned rewards
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      reward_type TEXT NOT NULL DEFAULT 'accessory',
      reward_id INTEGER,
      accessory_type TEXT,
      accessory_id TEXT,
      custom_name TEXT,
      custom_description TEXT,
      custom_icon TEXT DEFAULT '🎁',
      assigned_by TEXT,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      awarded_at DATETIME,
      FOREIGN KEY (child_id) REFERENCES children(id)
    )
  `);
  console.log('✅ Created pending_rewards table');
  
  // Add address field to families if it doesn't exist
  const familyColumns = db.prepare("PRAGMA table_info(families)").all();
  if (!familyColumns.find(c => c.name === 'address')) {
    db.exec('ALTER TABLE families ADD COLUMN address TEXT');
    console.log('✅ Migration: Added address to families table');
  }
  
  // Create admin_users table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Created admin_users table');
  
  // Create volunteer_compliance table for tracking background checks and training
  db.exec(`
    CREATE TABLE IF NOT EXISTS volunteer_compliance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteer_id INTEGER NOT NULL UNIQUE,
      livescan_completed INTEGER DEFAULT 0,
      livescan_date TEXT,
      mandatory_reporting_completed INTEGER DEFAULT 0,
      mandatory_reporting_date TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (volunteer_id) REFERENCES children(id)
    )
  `);
  console.log('✅ Created volunteer_compliance table');
  
  // Create volunteer_details table for extended volunteer info
  db.exec(`
    CREATE TABLE IF NOT EXISTS volunteer_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteer_id INTEGER NOT NULL UNIQUE,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      dob TEXT,
      service_area TEXT,
      serving_frequency TEXT,
      start_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (volunteer_id) REFERENCES children(id)
    )
  `);
  console.log('✅ Created volunteer_details table');
  
  // Create custom_fields table for user-defined fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, field_name)
    )
  `);
  console.log('✅ Created custom_fields table');
  
  // Create custom_field_values table for storing custom field data
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      value TEXT,
      FOREIGN KEY (field_id) REFERENCES custom_fields(id),
      UNIQUE(entity_type, entity_id, field_id)
    )
  `);
  console.log('✅ Created custom_field_values table');
} catch (err) {
  console.log('Migration note:', err.message);
}

// Insert default rooms if none exist
const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
if (roomCount.count === 0) {
  const insertRoom = db.prepare('INSERT INTO rooms (name, age_range) VALUES (?, ?)');
  insertRoom.run('Room 100 - Nursery', '0-1');
  insertRoom.run('Room 101 - Toddlers', '2-3');
  insertRoom.run('Room 102 - Pre-K', '4-5');
  insertRoom.run('Room 103 - Elementary', '6-10');
}

// Insert pre-made reward programs if none exist
const rewardCount = db.prepare('SELECT COUNT(*) as count FROM rewards').get();
if (rewardCount.count === 0) {
  const insertReward = db.prepare(`
    INSERT INTO rewards (name, description, type, trigger_type, trigger_value, prize, icon, enabled, is_preset) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Attendance milestone rewards
  insertReward.run(
    'First Timer',
    'Awarded on first ever check-in - welcome to Adventure Kids!',
    'milestone', 'checkin_count', 1,
    'Welcome sticker pack',
    '🌟', 1, 1
  );
  insertReward.run(
    'Getting Started',
    'Awarded after 5 check-ins - you\'re becoming a regular!',
    'milestone', 'checkin_count', 5,
    'Adventure Kids bookmark',
    '📚', 1, 1
  );
  insertReward.run(
    'Regular Explorer',
    'Awarded after 10 check-ins - you\'re part of the crew!',
    'milestone', 'checkin_count', 10,
    'Small toy from prize box',
    '🎮', 1, 1
  );
  insertReward.run(
    'Adventure Enthusiast',
    'Awarded after 25 check-ins - halfway to legend status!',
    'milestone', 'checkin_count', 25,
    'Adventure Kids t-shirt',
    '👕', 1, 1
  );
  insertReward.run(
    'Super Explorer',
    'Awarded after 50 check-ins - you\'re a true adventurer!',
    'milestone', 'checkin_count', 50,
    'Large prize from treasure chest',
    '🏆', 1, 1
  );
  insertReward.run(
    'Adventure Legend',
    'Awarded after 100 check-ins - legendary status achieved!',
    'milestone', 'checkin_count', 100,
    'Special gift bag + photo on Wall of Fame',
    '👑', 1, 1
  );
  
  // Streak-based rewards
  insertReward.run(
    'Consistent Kid',
    'Awarded for maintaining a 4-week streak',
    'milestone', 'streak', 4,
    'Bonus sticker sheet',
    '🔥', 1, 1
  );
  insertReward.run(
    'Streak Master',
    'Awarded for maintaining an 8-week streak',
    'milestone', 'streak', 8,
    'Choose a prize from the treasure box',
    '⚡', 1, 1
  );
  insertReward.run(
    'Unstoppable',
    'Awarded for maintaining a 12-week streak',
    'milestone', 'streak', 12,
    'Premium prize + ice cream coupon',
    '💎', 1, 1
  );

  console.log('✅ Pre-made reward programs created');
}

// Insert pre-made avatar accessory rewards if none exist
const avatarRewardCount = db.prepare('SELECT COUNT(*) as count FROM avatar_rewards').get();
if (avatarRewardCount.count === 0) {
  const insertAvatarReward = db.prepare(`
    INSERT INTO avatar_rewards (name, description, accessory_type, accessory_id, trigger_type, trigger_value, icon, enabled, is_preset) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Glasses rewards (unlocked by check-ins)
  insertAvatarReward.run(
    'Round Glasses',
    'Unlock stylish round glasses for your avatar!',
    'glasses', 'variant01',
    'checkin_count', 3,
    '👓', 1, 1
  );
  insertAvatarReward.run(
    'Square Glasses',
    'Unlock cool square glasses for your avatar!',
    'glasses', 'variant02',
    'checkin_count', 8,
    '🤓', 1, 1
  );
  insertAvatarReward.run(
    'Cat Eye Glasses',
    'Unlock fancy cat eye glasses for your avatar!',
    'glasses', 'variant03',
    'checkin_count', 15,
    '😎', 1, 1
  );
  insertAvatarReward.run(
    'Aviator Glasses',
    'Unlock awesome aviator glasses for your avatar!',
    'glasses', 'variant04',
    'checkin_count', 25,
    '🕶️', 1, 1
  );
  insertAvatarReward.run(
    'Heart Glasses',
    'Unlock adorable heart glasses for your avatar!',
    'glasses', 'variant05',
    'checkin_count', 40,
    '💕', 1, 1
  );
  
  // Earring rewards (unlocked by streaks)
  insertAvatarReward.run(
    'Stud Earrings',
    'Unlock sparkly stud earrings for your avatar!',
    'earrings', 'variant01',
    'streak', 2,
    '💎', 1, 1
  );
  insertAvatarReward.run(
    'Hoop Earrings',
    'Unlock trendy hoop earrings for your avatar!',
    'earrings', 'variant02',
    'streak', 4,
    '⭕', 1, 1
  );
  insertAvatarReward.run(
    'Drop Earrings',
    'Unlock elegant drop earrings for your avatar!',
    'earrings', 'variant03',
    'streak', 6,
    '💧', 1, 1
  );
  insertAvatarReward.run(
    'Star Earrings',
    'Unlock magical star earrings for your avatar!',
    'earrings', 'variant04',
    'streak', 8,
    '⭐', 1, 1
  );
  insertAvatarReward.run(
    'Moon Earrings',
    'Unlock celestial moon earrings for your avatar!',
    'earrings', 'variant05',
    'streak', 10,
    '🌙', 1, 1
  );
  
  // Feature rewards (special milestones)
  insertAvatarReward.run(
    'Rosy Cheeks',
    'Add cute rosy cheeks to your avatar!',
    'features', 'blush',
    'checkin_count', 5,
    '😊', 1, 1
  );
  insertAvatarReward.run(
    'Freckles',
    'Add adorable freckles to your avatar!',
    'features', 'freckles',
    'checkin_count', 12,
    '🌟', 1, 1
  );
  insertAvatarReward.run(
    'Birthmark',
    'Add a unique birthmark to your avatar!',
    'features', 'birthmark',
    'streak', 12,
    '🔵', 1, 1
  );

  console.log('✅ Pre-made avatar accessory rewards created');
}

// Insert default templates if none exist
const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get();
if (templateCount.count === 0) {
  // Get all room IDs for default templates
  const allRooms = db.prepare('SELECT id FROM rooms').all();
  const allRoomIds = JSON.stringify(allRooms.map(r => r.id));
  
  const insertTemplate = db.prepare(`
    INSERT INTO templates (name, day_of_week, start_time, end_time, checkout_enabled, room_ids, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Sunday Morning - all rooms, checkout enabled
  insertTemplate.run('Sunday Morning', 'sunday', '09:00', '12:00', 1, allRoomIds, 1);
  
  // Childcare - all rooms, no checkout
  insertTemplate.run('Childcare', null, null, null, 0, allRoomIds, 0);
  
  // VBS - all rooms, checkout enabled
  insertTemplate.run('VBS', null, '09:00', '12:00', 1, allRoomIds, 0);
  
  console.log('✅ Default templates created');
}

// Insert a test family if none exist
const familyCount = db.prepare('SELECT COUNT(*) as count FROM families').get();
if (familyCount.count === 0) {
  const insertFamily = db.prepare('INSERT INTO families (name, phone, email, parent_name) VALUES (?, ?, ?, ?)');
  const result = insertFamily.run('The Johnson Family', '5551234567', 'johnson@email.com', 'Mike Johnson');
  
  const insertChild = db.prepare('INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, streak, badges, total_checkins) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertChild.run(result.lastInsertRowid, 'Emma', 'Johnson', 'Emma', 8, '2016-03-15', 'female', '150316', 'emma-abc123', 6, 12, 45);
  insertChild.run(result.lastInsertRowid, 'Jake', 'Johnson', 'Jake', 5, '2019-07-22', 'male', '220719', 'jake-def456', 3, 5, 32);
  insertChild.run(result.lastInsertRowid, 'Lily', 'Johnson', 'Lily', 3, '2021-11-08', 'female', '081121', 'lily-ghi789', 1, 2, 18);
  
  console.log('✅ Test family created: phone 5551234567');
  console.log('   Kid PINs: Emma=150316, Jake=220719, Lily=081121');
}

// ============================================
// AUTH ENDPOINTS
// ============================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check master admin first
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateSessionToken();
    activeSessions.set(token, { username, role: 'superadmin', loginTime: Date.now() });
    
    // Clean up old sessions (older than 24 hours)
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [t, session] of activeSessions.entries()) {
      if (session.loginTime < dayAgo) {
        activeSessions.delete(t);
      }
    }
    
    return res.json({ success: true, token });
  }
  
  // Check database users
  try {
    const user = db.prepare('SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)').get(username);
    if (user && user.password === password) {
      const token = generateSessionToken();
      activeSessions.set(token, { username: user.username, role: user.role, loginTime: Date.now() });
      
      return res.json({ success: true, token });
    }
  } catch (err) {
    console.error('Login DB error:', err);
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});

// Verify token
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token && activeSessions.has(token)) {
    res.json({ valid: true, username: activeSessions.get(token).username });
  } else {
    res.status(401).json({ valid: false });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    activeSessions.delete(token);
  }
  
  res.json({ success: true });
});

// ============================================
// CUSTOM FIELDS ENDPOINTS
// ============================================

// Get custom fields for an entity type (family, child, volunteer)
app.get('/api/custom-fields/:entityType', (req, res) => {
  try {
    const fields = db.prepare('SELECT * FROM custom_fields WHERE entity_type = ? ORDER BY field_label').all(req.params.entityType);
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new custom field
app.post('/api/custom-fields', (req, res) => {
  const { entity_type, field_name, field_label, field_type } = req.body;
  
  if (!entity_type || !field_name || !field_label) {
    return res.status(400).json({ error: 'entity_type, field_name, and field_label are required' });
  }
  
  // Sanitize field_name to be database-safe
  const safeName = field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  
  try {
    const result = db.prepare('INSERT INTO custom_fields (entity_type, field_name, field_label, field_type) VALUES (?, ?, ?, ?)').run(
      entity_type,
      safeName,
      field_label,
      field_type || 'text'
    );
    res.json({ success: true, id: result.lastInsertRowid, field_name: safeName });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Field already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get custom field values for an entity
app.get('/api/custom-field-values/:entityType/:entityId', (req, res) => {
  try {
    const values = db.prepare(`
      SELECT cf.field_name, cf.field_label, cfv.value 
      FROM custom_field_values cfv
      JOIN custom_fields cf ON cfv.field_id = cf.id
      WHERE cfv.entity_type = ? AND cfv.entity_id = ?
    `).all(req.params.entityType, req.params.entityId);
    
    // Convert to object
    const result = {};
    values.forEach(v => { result[v.field_name] = v.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set custom field value
app.post('/api/custom-field-values', (req, res) => {
  const { entity_type, entity_id, field_id, value } = req.body;
  
  try {
    db.prepare(`
      INSERT INTO custom_field_values (entity_type, entity_id, field_id, value) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, field_id) DO UPDATE SET value = excluded.value
    `).run(entity_type, entity_id, field_id, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ============================================
// VOLUNTEER COMPLIANCE ENDPOINTS
// ============================================

// Get compliance status for a volunteer
app.get('/api/volunteer-compliance/:volunteerId', (req, res) => {
  try {
    let compliance = db.prepare('SELECT * FROM volunteer_compliance WHERE volunteer_id = ?').get(req.params.volunteerId);
    
    if (!compliance) {
      // Create default record if doesn't exist
      db.prepare('INSERT INTO volunteer_compliance (volunteer_id) VALUES (?)').run(req.params.volunteerId);
      compliance = {
        volunteer_id: parseInt(req.params.volunteerId),
        livescan_completed: 0,
        livescan_date: null,
        mandatory_reporting_completed: 0,
        mandatory_reporting_date: null,
        notes: null
      };
    }
    
    res.json({
      ...compliance,
      livescan_completed: Boolean(compliance.livescan_completed),
      mandatory_reporting_completed: Boolean(compliance.mandatory_reporting_completed)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update compliance status for a volunteer
app.put('/api/volunteer-compliance/:volunteerId', (req, res) => {
  const { livescan_completed, livescan_date, mandatory_reporting_completed, mandatory_reporting_date, notes } = req.body;
  
  try {
    // Upsert compliance record
    db.prepare(`
      INSERT INTO volunteer_compliance (volunteer_id, livescan_completed, livescan_date, mandatory_reporting_completed, mandatory_reporting_date, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(volunteer_id) DO UPDATE SET
        livescan_completed = excluded.livescan_completed,
        livescan_date = excluded.livescan_date,
        mandatory_reporting_completed = excluded.mandatory_reporting_completed,
        mandatory_reporting_date = excluded.mandatory_reporting_date,
        notes = excluded.notes,
        updated_at = datetime('now')
    `).run(
      req.params.volunteerId,
      livescan_completed ? 1 : 0,
      livescan_date || null,
      mandatory_reporting_completed ? 1 : 0,
      mandatory_reporting_date || null,
      notes || null
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all volunteers with compliance status
app.get('/api/volunteers-with-compliance', (req, res) => {
  try {
    const volunteers = db.prepare(`
      SELECT 
        c.id, c.first_name, c.last_name, c.total_checkins,
        f.id as family_id, f.phone, f.email, f.created_at,
        COALESCE(vc.livescan_completed, 0) as livescan_completed,
        vc.livescan_date,
        COALESCE(vc.mandatory_reporting_completed, 0) as mandatory_reporting_completed,
        vc.mandatory_reporting_date,
        vc.notes as compliance_notes
      FROM children c
      JOIN families f ON c.family_id = f.id
      LEFT JOIN volunteer_compliance vc ON c.id = vc.volunteer_id
      WHERE c.notes LIKE '%Volunteer%' OR f.name LIKE '%(Volunteer)%'
      ORDER BY c.last_name, c.first_name
    `).all();
    
    res.json(volunteers.map(v => ({
      ...v,
      livescan_completed: Boolean(v.livescan_completed),
      mandatory_reporting_completed: Boolean(v.mandatory_reporting_completed)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CSV IMPORT ENDPOINTS
// ============================================

// Import volunteers from CSV data
app.post('/api/import/volunteers', (req, res) => {
  const { data, columnMapping, customFields, valueMappings } = req.body;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }
  
  // Helper function to check if a value means "completed" based on value mappings
  const isCompletedValue = (fieldKey, value) => {
    if (!value) return false;
    const mapping = valueMappings?.[fieldKey];
    if (mapping && mapping.completedValues && mapping.completedValues.length > 0) {
      return mapping.completedValues.includes(value);
    }
    // Fallback: if no value mappings, treat any non-empty value as completed
    return !!value && String(value).trim() !== '';
  };
  
  // Helper to extract date if value is a date, otherwise return the value as-is or null
  const extractDateValue = (fieldKey, value) => {
    if (!value) return null;
    const mapping = valueMappings?.[fieldKey];
    if (mapping && mapping.treatAsDate) {
      // If it's a date field, return the value as the date
      return String(value).trim() || null;
    }
    // If completedValues exists and value is in it, it might be a status like "o" not a date
    if (mapping && mapping.completedValues && mapping.completedValues.includes(value)) {
      // Not a date, just a completion status - return today's date or null
      return null;
    }
    // Default: return the value if it looks like a date
    const v = String(value).trim();
    if (/\d/.test(v)) return v;
    return null;
  };
  
  let imported = 0;
  let updated = 0; // Existing parents marked as volunteers
  let skipped = 0;
  let errors = [];
  
  try {
    // First, create any new custom fields
    const customFieldIds = {};
    if (customFields && customFields.length > 0) {
      const insertField = db.prepare('INSERT OR IGNORE INTO custom_fields (entity_type, field_name, field_label, field_type) VALUES (?, ?, ?, ?)');
      const getField = db.prepare('SELECT id FROM custom_fields WHERE entity_type = ? AND field_name = ?');
      
      for (const cf of customFields) {
        const safeName = cf.field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        insertField.run('volunteer', safeName, cf.field_label, 'text');
        const field = getField.get('volunteer', safeName);
        if (field) customFieldIds[cf.csv_column] = field.id;
      }
    }
    
    // Prepared statements
    const checkPhone = db.prepare('SELECT id, name, parent_name FROM families WHERE phone = ?');
    const updateFamilyAsVolunteer = db.prepare('UPDATE families SET is_volunteer = 1 WHERE id = ?');
    const insertFamily = db.prepare('INSERT INTO families (name, phone, email, parent_name, is_volunteer) VALUES (?, ?, ?, ?, 1)');
    const insertChild = db.prepare('INSERT INTO children (family_id, first_name, last_name, name, notes, avatar) VALUES (?, ?, ?, ?, ?, ?)');
    const insertCustomValue = db.prepare('INSERT OR REPLACE INTO custom_field_values (entity_type, entity_id, field_id, value) VALUES (?, ?, ?, ?)');
    const getVolunteerChild = db.prepare('SELECT id FROM children WHERE family_id = ? AND notes LIKE ?');
    
    // Compliance with livescan and mandatory reporting dates
    const upsertCompliance = db.prepare(`
      INSERT INTO volunteer_compliance (volunteer_id, livescan_completed, livescan_date, mandatory_reporting_completed, mandatory_reporting_date)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(volunteer_id) DO UPDATE SET
        livescan_completed = COALESCE(excluded.livescan_completed, livescan_completed),
        livescan_date = COALESCE(excluded.livescan_date, livescan_date),
        mandatory_reporting_completed = COALESCE(excluded.mandatory_reporting_completed, mandatory_reporting_completed),
        mandatory_reporting_date = COALESCE(excluded.mandatory_reporting_date, mandatory_reporting_date),
        updated_at = datetime('now')
    `);
    
    // Volunteer details (address, DOB, service area, etc.)
    const upsertDetails = db.prepare(`
      INSERT INTO volunteer_details (volunteer_id, address, city, state, zip, dob, service_area, serving_frequency, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(volunteer_id) DO UPDATE SET
        address = COALESCE(excluded.address, address),
        city = COALESCE(excluded.city, city),
        state = COALESCE(excluded.state, state),
        zip = COALESCE(excluded.zip, zip),
        dob = COALESCE(excluded.dob, dob),
        service_area = COALESCE(excluded.service_area, service_area),
        serving_frequency = COALESCE(excluded.serving_frequency, serving_frequency),
        start_date = COALESCE(excluded.start_date, start_date),
        updated_at = datetime('now')
    `);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extract required mapped fields
        const firstName = row[columnMapping.first_name] || '';
        const lastName = row[columnMapping.last_name] || '';
        const phone = (row[columnMapping.phone] || '').replace(/\D/g, '');
        const email = row[columnMapping.email] || '';
        
        // Extract optional standard fields
        const address = row[columnMapping.address] || null;
        const city = row[columnMapping.city] || null;
        const state = row[columnMapping.state] || null;
        const zip = row[columnMapping.zip] || null;
        const dob = row[columnMapping.dob] || null;
        const serviceArea = row[columnMapping.service_area] || null;
        // Get raw values for compliance fields
        const livescanRawValue = row[columnMapping.livescan_date] || null;
        const mandatoryReporterRawValue = row[columnMapping.mandatory_reporter_date] || null;
        
        // Determine completion status based on value mappings
        const livescanCompleted = isCompletedValue('livescan_date', livescanRawValue);
        const mandatoryReporterCompleted = isCompletedValue('mandatory_reporter_date', mandatoryReporterRawValue);
        
        // Extract dates (if the values are actual dates)
        const livescanDate = extractDateValue('livescan_date', livescanRawValue);
        const mandatoryReporterDate = extractDateValue('mandatory_reporter_date', mandatoryReporterRawValue);
        const servingFrequency = row[columnMapping.serving_frequency] || null;
        const startDate = row[columnMapping.start_date] || null;
        
        if (!firstName || !phone) {
          skipped++;
          errors.push(`Row ${i + 2}: Missing required field (first name or phone)`);
          continue;
        }
        
        // Check if phone already exists (parent might already be in system)
        const existing = checkPhone.get(phone);
        let familyId;
        let volunteerId;
        
        if (existing) {
          // MERGE: Mark existing parent as a volunteer
          familyId = existing.id;
          updateFamilyAsVolunteer.run(familyId);
          
          // Check if a volunteer child record already exists for this family
          let volunteerChild = getVolunteerChild.get(familyId, '%Volunteer%');
          
          if (!volunteerChild) {
            // Create a volunteer child record linked to this parent
            const childResult = insertChild.run(
              familyId, 
              firstName, 
              lastName, 
              `${firstName} ${lastName}`.trim(), 
              'Volunteer (Parent)', 
              'explorer'
            );
            volunteerId = childResult.lastInsertRowid;
          } else {
            volunteerId = volunteerChild.id;
          }
          
          updated++;
        } else {
          // NEW: Create new volunteer-only family
          const familyName = `${firstName} ${lastName}`.trim();
          const familyResult = insertFamily.run(familyName, phone, email, familyName);
          familyId = familyResult.lastInsertRowid;
          
          // Create child entry (volunteer profile)
          const childResult = insertChild.run(
            familyId, 
            firstName, 
            lastName, 
            `${firstName} ${lastName}`.trim(), 
            'Volunteer', 
            'explorer'
          );
          volunteerId = childResult.lastInsertRowid;
          
          imported++;
        }
        
        // Save compliance data (livescan, mandatory reporter)
        // Use the completion status determined from value mappings
        upsertCompliance.run(
          volunteerId,
          livescanCompleted ? 1 : 0,
          livescanDate,
          mandatoryReporterCompleted ? 1 : 0,
          mandatoryReporterDate
        );
        
        // Save volunteer details (address, DOB, service area, etc.)
        upsertDetails.run(
          volunteerId,
          address,
          city,
          state,
          zip,
          dob,
          serviceArea,
          servingFrequency,
          startDate
        );
        
        // Save custom field values linked to the volunteer
        for (const [csvCol, fieldId] of Object.entries(customFieldIds)) {
          if (row[csvCol]) {
            insertCustomValue.run('volunteer', volunteerId, fieldId, row[csvCol]);
          }
        }
        
      } catch (rowErr) {
        errors.push(`Row ${i + 2}: ${rowErr.message}`);
      }
    }
    
    res.json({ 
      success: true, 
      imported, // New volunteer-only records created
      updated,  // Existing parents marked as volunteers
      skipped, 
      total: data.length,
      errors: errors.slice(0, 10) // Limit error messages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import families from CSV data
app.post('/api/import/families', (req, res) => {
  const { data, columnMapping, customFields } = req.body;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }
  
  let imported = 0;
  let skipped = 0;
  let errors = [];
  
  try {
    // First, create any new custom fields
    const customFieldIds = {};
    if (customFields && customFields.length > 0) {
      const insertField = db.prepare('INSERT OR IGNORE INTO custom_fields (entity_type, field_name, field_label, field_type) VALUES (?, ?, ?, ?)');
      const getField = db.prepare('SELECT id FROM custom_fields WHERE entity_type = ? AND field_name = ?');
      
      for (const cf of customFields) {
        const safeName = cf.field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        insertField.run('family', safeName, cf.field_label, 'text');
        const field = getField.get('family', safeName);
        if (field) customFieldIds[cf.csv_column] = field.id;
      }
    }
    
    const insertFamily = db.prepare('INSERT INTO families (name, phone, email, parent_name, address) VALUES (?, ?, ?, ?, ?)');
    const insertChild = db.prepare('INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertCustomValue = db.prepare('INSERT OR REPLACE INTO custom_field_values (entity_type, entity_id, field_id, value) VALUES (?, ?, ?, ?)');
    const checkPhone = db.prepare('SELECT id FROM families WHERE phone = ?');
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extract mapped fields
        const parentName = row[columnMapping.parent_name] || '';
        const phone = (row[columnMapping.phone] || '').replace(/\D/g, '');
        const email = row[columnMapping.email] || '';
        const address = row[columnMapping.address] || '';
        const childFirstName = row[columnMapping.child_first_name] || '';
        const childLastName = row[columnMapping.child_last_name] || '';
        const childBirthday = row[columnMapping.child_birthday] || '';
        const childGender = row[columnMapping.child_gender] || '';
        const childAllergies = row[columnMapping.child_allergies] || '';
        const childNotes = row[columnMapping.child_notes] || '';
        
        if (!phone) {
          skipped++;
          continue;
        }
        
        // Check if phone already exists
        const existing = checkPhone.get(phone);
        if (existing) {
          skipped++;
          continue;
        }
        
        // Build family name
        const nameParts = parentName.trim().split(' ');
        const familyLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
        const familyName = `The ${familyLastName} Family`;
        
        // Create family entry
        const familyResult = insertFamily.run(familyName, phone, email, parentName, address);
        const familyId = familyResult.lastInsertRowid;
        
        // Create child if child info provided
        if (childFirstName) {
          const childName = `${childFirstName} ${childLastName}`.trim();
          // Generate PIN from birthday or random
          let pin = '';
          if (childBirthday) {
            try {
              const bdate = new Date(childBirthday);
              pin = `${String(bdate.getMonth() + 1).padStart(2, '0')}${String(bdate.getDate()).padStart(2, '0')}${String(bdate.getFullYear()).slice(-2)}`;
            } catch {}
          }
          if (!pin) {
            pin = String(Math.floor(100000 + Math.random() * 900000));
          }
          
          // Calculate age
          let age = null;
          if (childBirthday) {
            try {
              const bdate = new Date(childBirthday);
              const today = new Date();
              age = today.getFullYear() - bdate.getFullYear();
            } catch {}
          }
          
          const childResult = insertChild.run(familyId, childFirstName, childLastName, childName, age, childBirthday, childGender, pin, 'explorer', childAllergies, childNotes);
          
          // Save custom field values for child
          for (const [csvCol, fieldId] of Object.entries(customFieldIds)) {
            if (row[csvCol]) {
              insertCustomValue.run('child', childResult.lastInsertRowid, fieldId, row[csvCol]);
            }
          }
        }
        
        // Save custom field values for family
        for (const [csvCol, fieldId] of Object.entries(customFieldIds)) {
          if (row[csvCol]) {
            insertCustomValue.run('family', familyId, fieldId, row[csvCol]);
          }
        }
        
        imported++;
      } catch (rowErr) {
        errors.push(`Row ${i + 1}: ${rowErr.message}`);
      }
    }
    
    res.json({ 
      success: true, 
      imported, 
      skipped, 
      total: data.length,
      errors: errors.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================

// Get all admin users
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, created_at FROM admin_users ORDER BY created_at DESC').all();
    // Add the master admin to the list
    const allUsers = [
      { id: 0, username: ADMIN_USERNAME, role: 'superadmin', created_at: null },
      ...users
    ];
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new admin user
app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  try {
    const existing = db.prepare('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?)').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // In production, you'd hash the password. For simplicity, storing as-is.
    // TODO: Add bcrypt password hashing
    const result = db.prepare('INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)').run(
      username.trim(),
      password,
      role || 'admin'
    );
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete admin user
app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (userId === 0) {
    return res.status(400).json({ error: 'Cannot delete the master admin' });
  }
  
  try {
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth middleware for protected routes
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token && activeSessions.has(token)) {
    req.user = activeSessions.get(token);
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// ============================================
// DATABASE API ENDPOINTS
// ============================================

// Get child by PIN (for kid login) - also works for volunteers
app.get('/api/child/pin/:pin', (req, res) => {
  const pin = req.params.pin;
  
  const child = db.prepare(`
    SELECT c.*, f.name as family_name, f.id as family_id,
           CASE WHEN c.notes LIKE '%Volunteer%' THEN 1 ELSE 0 END as is_volunteer
    FROM children c 
    JOIN families f ON c.family_id = f.id 
    WHERE c.pin = ?
  `).get(pin);
  
  if (!child) {
    return res.status(404).json({ error: 'PIN not found' });
  }
  
  // If this is a volunteer, get their details
  let volunteerDetails = null;
  if (child.is_volunteer) {
    volunteerDetails = db.prepare('SELECT * FROM volunteer_details WHERE volunteer_id = ?').get(child.id) || {};
  }
  
  // Get next upcoming reward for this child
  const earnedRewardIds = db.prepare('SELECT reward_id FROM earned_rewards WHERE child_id = ?')
    .all(child.id)
    .map(r => r.reward_id);
  
  const nextReward = db.prepare(`
    SELECT * FROM rewards 
    WHERE enabled = 1 
    AND id NOT IN (${earnedRewardIds.length > 0 ? earnedRewardIds.join(',') : '0'})
    AND (
      (trigger_type = 'checkin_count' AND trigger_value > ?) 
      OR (trigger_type = 'streak' AND trigger_value > ?)
    )
    ORDER BY trigger_value ASC
    LIMIT 1
  `).get(child.total_checkins, child.streak);
  
  // Get equipped accessories
  const equipped = db.prepare(`
    SELECT accessory_type, accessory_id
    FROM child_accessories
    WHERE child_id = ? AND is_equipped = 1
  `).all(child.id);
  
  const equippedAccessories = {};
  equipped.forEach(acc => {
    equippedAccessories[acc.accessory_type] = acc.accessory_id;
  });
  
  res.json({
    id: child.id,
    firstName: child.first_name,
    lastName: child.last_name,
    name: child.name || child.first_name,
    age: child.age,
    gender: child.gender,
    avatar: child.avatar,
    streak: child.streak,
    badges: child.badges,
    totalCheckins: child.total_checkins,
    familyId: child.family_id,
    familyName: child.family_name,
    equippedAccessories,
    nextReward: nextReward ? {
      name: nextReward.name,
      icon: nextReward.icon,
      prize: nextReward.prize,
      triggerType: nextReward.trigger_type,
      triggerValue: nextReward.trigger_value,
      progress: nextReward.trigger_type === 'checkin_count' 
        ? child.total_checkins 
        : child.streak
    } : null,
    // Volunteer-specific fields
    isVolunteer: !!child.is_volunteer,
    volunteerDetails: child.is_volunteer ? {
      serviceArea: volunteerDetails?.service_area || null,
      servingFrequency: volunteerDetails?.serving_frequency || null
    } : null
  });
});

// Get family by phone number
app.get('/api/family/:phone', (req, res) => {
  let phone = req.params.phone.replace(/\D/g, '');
  
  // Normalize phone - try with and without leading 1
  let family = db.prepare('SELECT * FROM families WHERE phone = ?').get(phone);
  
  // If not found and phone is 10 digits, try with leading 1
  if (!family && phone.length === 10) {
    family = db.prepare('SELECT * FROM families WHERE phone = ?').get('1' + phone);
  }
  
  // If not found and phone starts with 1 and is 11 digits, try without leading 1
  if (!family && phone.length === 11 && phone.startsWith('1')) {
    family = db.prepare('SELECT * FROM families WHERE phone = ?').get(phone.substring(1));
  }
  
  if (!family) {
    return res.status(404).json({ error: 'Family not found' });
  }
  
  const children = db.prepare('SELECT * FROM children WHERE family_id = ?').all(family.id);
  
  // Get equipped accessories for each child
  const childrenWithAccessories = children.map(c => {
    const equipped = db.prepare(`
      SELECT accessory_type, accessory_id
      FROM child_accessories
      WHERE child_id = ? AND is_equipped = 1
    `).all(c.id);
    
    const equippedAccessories = {};
    equipped.forEach(acc => {
      equippedAccessories[acc.accessory_type] = acc.accessory_id;
    });
    
    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      name: c.name || c.first_name,
      age: c.age,
      birthday: c.birthday,
      gender: c.gender,
      pin: c.pin,
      avatar: c.avatar,
      streak: c.streak,
      badges: c.badges,
      totalCheckins: c.total_checkins,
      allergies: c.allergies,
      notes: c.notes,
      equippedAccessories
    };
  });
  
  res.json({
    id: family.id,
    name: family.name,
    phone: family.phone,
    email: family.email,
    parent_name: family.parent_name,
    children: childrenWithAccessories
  });
});

// Register new family
app.post('/api/family', (req, res) => {
  const { name, phone, email, parentName, children } = req.body;
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Normalize to 10 digits (remove leading 1 if present)
  if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
    cleanPhone = cleanPhone.substring(1);
  }
  
  try {
    // Check if phone already exists (check both formats)
    let existing = db.prepare('SELECT id FROM families WHERE phone = ?').get(cleanPhone);
    if (!existing) {
      existing = db.prepare('SELECT id FROM families WHERE phone = ?').get('1' + cleanPhone);
    }
    if (existing) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }
    
    const address = req.body.address || '';
    const insertFamily = db.prepare('INSERT INTO families (name, phone, email, parent_name, address) VALUES (?, ?, ?, ?, ?)');
    const result = insertFamily.run(name, cleanPhone, email, parentName, address);
    const familyId = result.lastInsertRowid;
    
    const insertChild = db.prepare('INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    children.forEach((child) => {
      // Use provided avatar or generate a unique seed
      const avatarSeed = child.avatar || (child.firstName + '-' + Math.random().toString(36).substring(2, 8));
      // Full name for display
      const fullName = child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName;
      // Calculate age from birthday
      const age = calculateAgeFromBirthday(child.birthday);
      
      insertChild.run(
        familyId, 
        child.firstName, 
        child.lastName || '', 
        child.firstName, // Use first name as display name
        age, 
        child.birthday || '',
        child.gender || '',
        child.pin || null,
        avatarSeed, 
        child.allergies || '', 
        child.notes || ''
      );
    });
    
    res.json({ success: true, familyId });
  } catch (err) {
    console.error('Error creating family:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get today's check-ins
app.get('/api/checkins/today', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const checkins = db.prepare(`
      SELECT c.*, ch.name as child_name, ch.first_name, ch.last_name, f.name as family_name
      FROM checkins c
      LEFT JOIN children ch ON c.child_id = ch.id
      LEFT JOIN families f ON c.family_id = f.id
      WHERE date(c.checked_in_at) = date(?)
      ORDER BY c.checked_in_at DESC
    `).all(today);
    
    res.json(checkins);
  } catch (err) {
    console.error('Error getting today checkins:', err);
    res.status(500).json({ error: err.message });
  }
});

// Record check-in
app.post('/api/checkin', (req, res) => {
  const { childId, familyId, room, pickupCode, templateId } = req.body;
  
  try {
    // Get child info
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }
    
    // Get active template if not provided
    let activeTemplateId = templateId;
    let activeTemplate = null;
    if (!activeTemplateId) {
      activeTemplate = db.prepare('SELECT * FROM templates WHERE is_active = 1').get();
      activeTemplateId = activeTemplate?.id || null;
    } else {
      activeTemplate = db.prepare('SELECT * FROM templates WHERE id = ?').get(activeTemplateId);
    }
    
    // Check if already checked in today for this template (same calendar day)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const todayCheckin = db.prepare(`
      SELECT id FROM checkins 
      WHERE child_id = ? AND date(checked_in_at) = date(?) 
      ${activeTemplateId ? 'AND template_id = ?' : 'AND template_id IS NULL'}
    `).get(activeTemplateId ? [childId, today, activeTemplateId] : [childId, today]);
    
    const isDuplicateToday = !!todayCheckin;
    
    // Always insert check-in record (for tracking purposes)
    const insertCheckin = db.prepare('INSERT INTO checkins (child_id, family_id, template_id, room, pickup_code) VALUES (?, ?, ?, ?, ?)');
    insertCheckin.run(childId, familyId, activeTemplateId, room, pickupCode);
    
    // If duplicate today, don't update stats or give rewards
    if (isDuplicateToday) {
      console.log(`Duplicate check-in for child ${childId} on ${today} (template: ${activeTemplateId || 'none'}) - no rewards or stats update`);
      
      // Get template-specific streak for response
      let templateStreak = child.streak;
      if (activeTemplateId) {
        const templateStreakRow = db.prepare('SELECT streak FROM child_template_streaks WHERE child_id = ? AND template_id = ?').get(childId, activeTemplateId);
        templateStreak = templateStreakRow?.streak || 0;
      }
      
      return res.json({ 
        success: true, 
        isDuplicate: true,
        newStreak: templateStreak,
        globalStreak: child.streak,
        newBadges: child.badges,
        totalCheckins: child.total_checkins,
        earnedRewards: [],
        message: 'Already checked in today - no additional rewards'
      });
    }
    
    // Calculate template-specific streak if template tracks streaks
    let templateStreak = 0;
    let globalStreak = child.streak;
    
    if (activeTemplate && activeTemplate.track_streaks) {
      const streakResetDays = activeTemplate.streak_reset_days || 7;
      
      // Get or create template streak record
      let templateStreakRow = db.prepare('SELECT * FROM child_template_streaks WHERE child_id = ? AND template_id = ?').get(childId, activeTemplateId);
      
      if (!templateStreakRow) {
        // First check-in for this template
        db.prepare('INSERT INTO child_template_streaks (child_id, template_id, streak, last_checkin_date) VALUES (?, ?, 1, ?)').run(childId, activeTemplateId, today);
        templateStreak = 1;
      } else {
        const lastCheckinDate = templateStreakRow.last_checkin_date;
        if (lastCheckinDate) {
          const lastDate = new Date(lastCheckinDate);
          const todayDate = new Date(today);
          const daysSinceLastCheckin = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastCheckin <= streakResetDays) {
            templateStreak = templateStreakRow.streak + 1;
          } else {
            templateStreak = 1; // Reset streak - too long since last check-in
          }
        } else {
          templateStreak = 1;
        }
        
        db.prepare('UPDATE child_template_streaks SET streak = ?, last_checkin_date = ? WHERE child_id = ? AND template_id = ?')
          .run(templateStreak, today, childId, activeTemplateId);
      }
      
      // Use template streak as the main streak for display
      globalStreak = templateStreak;
    } else {
      // No template or template doesn't track streaks - use global streak logic
    const lastCheckin = db.prepare(`
      SELECT checked_in_at FROM checkins 
        WHERE child_id = ? AND date(checked_in_at) < date(?)
      ORDER BY checked_in_at DESC LIMIT 1
      `).get(childId, today);
    
    if (lastCheckin) {
        const lastCheckinDate = new Date(lastCheckin.checked_in_at);
        const todayDate = new Date(today);
        const daysSinceLastCheckin = Math.floor((todayDate - lastCheckinDate) / (1000 * 60 * 60 * 24));
        
      if (daysSinceLastCheckin <= 7) {
          globalStreak = child.streak + 1;
      } else {
          globalStreak = 1;
      }
    } else {
        globalStreak = 1;
      }
    }
    
    // Calculate badges based on the active streak
    let newBadges = child.badges;
    const streakForBadges = activeTemplate?.track_streaks ? templateStreak : globalStreak;
    if (streakForBadges === 4 || streakForBadges === 8 || streakForBadges === 12 || streakForBadges === 24 || streakForBadges === 52) {
      newBadges = child.badges + 1;
    }
    
    // Update child global stats (total checkins always increment, streak is the "best" or most recent active streak)
    db.prepare('UPDATE children SET streak = ?, badges = ?, total_checkins = total_checkins + 1 WHERE id = ?')
      .run(activeTemplate?.track_streaks ? templateStreak : globalStreak, newBadges, childId);
    
    // Check for newly earned rewards
    const earnedRewards = checkAndAwardRewards(childId);
    
    // Process admin-assigned pending rewards
    const pendingRewards = processPendingRewards(childId);
    
    res.json({ 
      success: true, 
      isDuplicate: false,
      newStreak: activeTemplate?.track_streaks ? templateStreak : globalStreak,
      templateStreak: activeTemplate?.track_streaks ? templateStreak : null,
      globalStreak: globalStreak,
      templateName: activeTemplate?.name || null,
      newBadges,
      totalCheckins: child.total_checkins + 1,
      earnedRewards: [
        ...earnedRewards.map(r => ({ name: r.name, icon: r.icon, prize: r.prize })),
        ...pendingRewards.rewards
      ]
    });
  } catch (err) {
    console.error('Error recording check-in:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all families (for admin)
app.get('/api/families', (req, res) => {
  // Exclude volunteers (families with "(Volunteer)" in name or children with notes = 'Volunteer')
  const families = db.prepare(`
    SELECT f.* FROM families f 
    WHERE f.name NOT LIKE '%(Volunteer)%'
    AND NOT EXISTS (
      SELECT 1 FROM children c WHERE c.family_id = f.id AND c.notes = 'Volunteer'
    )
    ORDER BY f.name
  `).all();
  
  const result = families.map(family => {
    const children = db.prepare('SELECT * FROM children WHERE family_id = ?').all(family.id);
    return {
      id: family.id,
      name: family.name,
      phone: family.phone,
      email: family.email,
      parent_name: family.parent_name,
      children: children.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        name: c.name || c.first_name,
        age: c.age,
        birthday: c.birthday,
        gender: c.gender,
        pin: c.pin,
        avatar: c.avatar,
        streak: c.streak,
        badges: c.badges,
        totalCheckins: c.total_checkins,
        allergies: c.allergies,
        notes: c.notes
      }))
    };
  });
  
  res.json(result);
});

// Get all volunteers
app.get('/api/volunteers', (req, res) => {
  // Get all families marked as volunteers (includes both volunteer-only and parent-volunteers)
  const volunteerFamilies = db.prepare(`
    SELECT f.*
    FROM families f 
    WHERE f.is_volunteer = 1
    ORDER BY f.name
  `).all();
  
  const result = volunteerFamilies.map(family => {
    const children = db.prepare('SELECT * FROM children WHERE family_id = ?').all(family.id);
    
    // Find the volunteer profile (child record with "Volunteer" in notes)
    const volunteerProfile = children.find(c => c.notes && c.notes.includes('Volunteer'));
    
    // Check if there are real children (notes is null or empty string = real child)
    const realChildren = children.filter(c => c.notes === null || c.notes === '');
    
    // Is also parent if:
    // 1. They have real children in the system, OR
    // 2. Their volunteer profile is marked as "Volunteer (Parent)"
    const isAlsoParent = realChildren.length > 0 || (volunteerProfile && volunteerProfile.notes === 'Volunteer (Parent)');
    
    // Use volunteer profile data if available
    const volunteer = volunteerProfile || {};
    
    // Get volunteer details (service area, serving frequency, etc.)
    let details = {};
    if (volunteer.id) {
      details = db.prepare('SELECT * FROM volunteer_details WHERE volunteer_id = ?').get(volunteer.id) || {};
    }
    
    return {
      id: family.id,
      name: family.name.replace(' (Volunteer)', ''),
      phone: family.phone,
      email: family.email,
      volunteer_name: volunteer.name || family.parent_name,
      first_name: volunteer.first_name || family.parent_name?.split(' ')[0] || '',
      last_name: volunteer.last_name || family.parent_name?.split(' ').slice(1).join(' ') || '',
      pin: volunteer.pin || '',
      totalCheckins: volunteer.total_checkins || 0,
      child_id: volunteer.id || null,
      is_also_parent: isAlsoParent,
      // Volunteer details
      service_area: details.service_area || null,
      serving_frequency: details.serving_frequency || null,
      start_date: details.start_date || null,
      address: details.address || null,
      city: details.city || null,
      state: details.state || null,
      zip: details.zip || null,
      dob: details.dob || null
    };
  });
  
  res.json(result);
});

// Get available avatars - now just returns the single explorer avatar
app.get('/api/avatars', (req, res) => {
  res.json([{
    id: DEFAULT_AVATAR,
    url: '/avatars/boy-ranger/boy-test-000.png'
  }]);
});

// Get all rooms
app.get('/api/rooms', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms').all();
  res.json(rooms);
});

// Create a new room
app.post('/api/rooms', (req, res) => {
  const { name, age_range, capacity } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  
  try {
    const result = db.prepare(
      'INSERT INTO rooms (name, age_range, capacity) VALUES (?, ?, ?)'
    ).run(name, age_range || null, capacity || null);
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
    res.json(room);
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update a room
app.put('/api/rooms/:id', (req, res) => {
  const { id } = req.params;
  const { name, age_range, capacity } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  
  try {
    db.prepare(
      'UPDATE rooms SET name = ?, age_range = ?, capacity = ? WHERE id = ?'
    ).run(name, age_range || null, capacity || null, id);
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    console.error('Error updating room:', err);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete a room
app.delete('/api/rooms/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const result = db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// =====================
// TEMPLATE ENDPOINTS
// =====================

// Get all templates
app.get('/api/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY name').all();
  // Parse room_ids and label_settings JSON for each template
  const parsed = templates.map(t => ({
    ...t,
    room_ids: t.room_ids ? JSON.parse(t.room_ids) : [],
    checkout_enabled: Boolean(t.checkout_enabled),
    is_active: Boolean(t.is_active),
    track_streaks: t.track_streaks !== 0,
    streak_reset_days: t.streak_reset_days || 7,
    print_volunteer_badges: t.print_volunteer_badges !== 0,
    label_settings: t.label_settings ? JSON.parse(t.label_settings) : null
  }));
  res.json(parsed);
});

// Get active template (auto-matches based on day/time or returns manually activated template)
app.get('/api/templates/active', (req, res) => {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // First, check for a manually activated template
  let template = db.prepare('SELECT * FROM templates WHERE is_active = 1').get();
  
  // If no manually activated template, try to auto-match based on day/time
  if (!template) {
    // Get all templates that match today's day of week
    const todayTemplates = db.prepare(`
      SELECT * FROM templates 
      WHERE LOWER(day_of_week) = ? 
      ORDER BY start_time ASC
    `).all(currentDay);
    
    // Find a template that matches the current time window
    for (const t of todayTemplates) {
      if (t.start_time && t.end_time) {
        // Check if current time is within the template's time window
        if (currentTime >= t.start_time && currentTime <= t.end_time) {
          template = t;
          break;
        }
      } else if (t.start_time && !t.end_time) {
        // If only start time is set, activate from that time until midnight
        if (currentTime >= t.start_time) {
          template = t;
          break;
        }
      } else {
        // No time set, just matches the day - use this template
        template = t;
        break;
      }
    }
  }
  
  if (!template) {
    return res.json(null);
  }
  
  res.json({
    ...template,
    room_ids: template.room_ids ? JSON.parse(template.room_ids) : [],
    checkout_enabled: Boolean(template.checkout_enabled),
    is_active: true,
    auto_matched: !template.is_active, // Flag to indicate if it was auto-matched
    track_streaks: template.track_streaks !== 0,
    streak_reset_days: template.streak_reset_days || 7,
    print_volunteer_badges: template.print_volunteer_badges !== 0,
    label_settings: template.label_settings ? JSON.parse(template.label_settings) : null
  });
});

// Create a new template
app.post('/api/templates', (req, res) => {
  const { name, day_of_week, start_time, end_time, checkout_enabled, room_ids, streak_reset_days, track_streaks, print_volunteer_badges, label_settings } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO templates (name, day_of_week, start_time, end_time, checkout_enabled, room_ids, is_active, streak_reset_days, track_streaks, print_volunteer_badges, label_settings)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      name,
      day_of_week || null,
      start_time || null,
      end_time || null,
      checkout_enabled ? 1 : 0,
      JSON.stringify(room_ids || []),
      streak_reset_days || 7,
      track_streaks !== false ? 1 : 0,
      print_volunteer_badges !== false ? 1 : 0,
      label_settings ? JSON.stringify(label_settings) : null
    );
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      ...template,
      room_ids: template.room_ids ? JSON.parse(template.room_ids) : [],
      checkout_enabled: Boolean(template.checkout_enabled),
      is_active: Boolean(template.is_active),
      track_streaks: Boolean(template.track_streaks),
      streak_reset_days: template.streak_reset_days || 7,
      print_volunteer_badges: template.print_volunteer_badges !== 0,
      label_settings: template.label_settings ? JSON.parse(template.label_settings) : null
    });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update a template
app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const { name, day_of_week, start_time, end_time, checkout_enabled, room_ids, streak_reset_days, track_streaks, print_volunteer_badges, label_settings } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  
  try {
    db.prepare(`
      UPDATE templates 
      SET name = ?, day_of_week = ?, start_time = ?, end_time = ?, checkout_enabled = ?, room_ids = ?, streak_reset_days = ?, track_streaks = ?, print_volunteer_badges = ?, label_settings = ?
      WHERE id = ?
    `).run(
      name,
      day_of_week || null,
      start_time || null,
      end_time || null,
      checkout_enabled ? 1 : 0,
      JSON.stringify(room_ids || []),
      streak_reset_days || 7,
      track_streaks !== false ? 1 : 0,
      print_volunteer_badges !== false ? 1 : 0,
      label_settings ? JSON.stringify(label_settings) : null,
      id
    );
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({
      ...template,
      room_ids: template.room_ids ? JSON.parse(template.room_ids) : [],
      checkout_enabled: Boolean(template.checkout_enabled),
      is_active: Boolean(template.is_active),
      track_streaks: Boolean(template.track_streaks),
      streak_reset_days: template.streak_reset_days || 7,
      print_volunteer_badges: template.print_volunteer_badges !== 0,
      label_settings: template.label_settings ? JSON.parse(template.label_settings) : null
    });
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Get default label settings structure
app.get('/api/label-settings/defaults', (req, res) => {
  const defaults = {
    // Kid Check-in Label
    kidLabel: {
      enabled: true,
      showAvatar: true,
      showName: true,
      showRoom: true,
      showStreak: true,
      showBadges: true,
      showRank: true,
      showPickupCode: true,
      showAllergies: true,
      showDate: true,
      nameSize: 110,
      roomSize: 44,
      accentColor: '#10B981', // emerald
      borderStyle: 'pointed', // pointed, rounded, none
    },
    // Parent Receipt Label
    parentLabel: {
      enabled: true,
      showLogo: false,
      showFamilyName: true,
      showChildren: true,
      showPickupCodes: true,
      showRooms: true,
      showDate: true,
      showTime: true,
      titleSize: 48,
      nameSize: 36,
      accentColor: '#3B82F6', // blue
    },
    // Volunteer Badge Label
    volunteerLabel: {
      enabled: true,
      showInitials: true,
      showName: true,
      showServiceArea: true,
      showDate: true,
      nameSize: 154,
      serviceAreaSize: 62,
      dateSize: 50,
      accentColor: '#4F46E5', // indigo
    }
  };
  res.json(defaults);
});

// Generate label preview image
app.post('/api/label-preview', async (req, res) => {
  const { labelType, settings, sampleData } = req.body;
  
  try {
    let imageBuffer;
    
    if (labelType === 'kid') {
      imageBuffer = await generateLabelImage({
        childName: sampleData?.name || 'Sample Child',
        avatar: 'explorer',
        pickupCode: 'ABC1',
        room: sampleData?.room || 'Kids Room',
        streak: 5,
        rank: 1,
        badges: 3,
        tier: 'bronze',
        allergies: sampleData?.allergies || '',
        ...settings
      });
    } else if (labelType === 'parent') {
      imageBuffer = await generateParentLabelImage({
        familyName: sampleData?.familyName || 'Sample Family',
        children: sampleData?.children || [
          { name: 'Child One', pickupCode: 'ABC1', room: 'Room 1' },
          { name: 'Child Two', pickupCode: 'DEF2', room: 'Room 2' }
        ],
        ...settings
      });
    } else if (labelType === 'volunteer') {
      imageBuffer = await generateVolunteerBadgeImage({
        volunteerName: sampleData?.name || 'Sample Volunteer',
        serviceArea: sampleData?.serviceArea || 'Kids Ministry',
        date: new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        }),
        ...settings
      });
    } else {
      return res.status(400).json({ error: 'Invalid label type' });
    }
    
    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    console.error('Error generating label preview:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Activate a template (deactivates all others)
app.put('/api/templates/:id/activate', (req, res) => {
  const { id } = req.params;
  
  try {
    // Deactivate all templates first
    db.prepare('UPDATE templates SET is_active = 0').run();
    
    // Activate the selected template
    db.prepare('UPDATE templates SET is_active = 1 WHERE id = ?').run(id);
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({
      ...template,
      room_ids: template.room_ids ? JSON.parse(template.room_ids) : [],
      checkout_enabled: Boolean(template.checkout_enabled),
      is_active: true
    });
  } catch (err) {
    console.error('Error activating template:', err);
    res.status(500).json({ error: 'Failed to activate template' });
  }
});

// Deactivate all templates
app.put('/api/templates/deactivate', (req, res) => {
  try {
    db.prepare('UPDATE templates SET is_active = 0').run();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deactivating templates:', err);
    res.status(500).json({ error: 'Failed to deactivate templates' });
  }
});

// Delete a template
app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Get attendance stats
app.get('/api/stats', (req, res) => {
  const totalFamilies = db.prepare('SELECT COUNT(*) as count FROM families').get().count;
  const totalKids = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
  const totalCheckins = db.prepare('SELECT COUNT(*) as count FROM checkins').get().count;
  
  // Get check-ins by date (last 6 weeks)
  const attendance = db.prepare(`
    SELECT DATE(checked_in_at) as date, COUNT(*) as count 
    FROM checkins 
    WHERE checked_in_at >= datetime('now', '-42 days')
    GROUP BY DATE(checked_in_at)
    ORDER BY date DESC
    LIMIT 10
  `).all();
  
  // Get top streaks
  const topStreaks = db.prepare(`
    SELECT c.*, f.name as family_name 
    FROM children c 
    JOIN families f ON c.family_id = f.id 
    ORDER BY c.streak DESC 
    LIMIT 5
  `).all();
  
  res.json({
    totalFamilies,
    totalKids,
    totalCheckins,
    attendance,
    topStreaks: topStreaks.map(k => ({
      id: k.id,
      name: k.name,
      avatar: k.avatar,
      streak: k.streak,
      badges: k.badges,
      familyName: k.family_name
    }))
  });
});

// Reports API - Custom query endpoint for report builder
app.post('/api/reports/query', (req, res) => {
  const { reportType, filters = {}, columns = [] } = req.body;
  
  try {
    let query = '';
    let params = [];
    
    switch (reportType) {
      case 'families':
        query = `
          SELECT 
            f.id,
            f.name as family_name,
            f.phone,
            f.email,
            f.parent_name,
            f.address,
            f.created_at,
            COUNT(DISTINCT c.id) as child_count,
            SUM(c.total_checkins) as total_checkins
          FROM families f
          LEFT JOIN children c ON f.id = c.family_id
          GROUP BY f.id
          ORDER BY f.name
        `;
        break;
        
      case 'children':
        query = `
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            c.name,
            c.age,
            c.birthday,
            c.gender,
            c.allergies,
            c.notes,
            c.streak,
            c.total_checkins,
            c.badges,
            f.name as family_name,
            f.phone as family_phone,
            f.email as family_email
          FROM children c
          JOIN families f ON c.family_id = f.id
          ORDER BY c.last_name, c.first_name
        `;
        break;
        
      case 'checkins':
        const startDate = filters.startDate || '2020-01-01';
        const endDate = filters.endDate || '2099-12-31';
        query = `
          SELECT 
            ch.id,
            ch.checked_in_at,
            ch.checked_out_at,
            ch.room,
            ch.pickup_code,
            c.first_name,
            c.last_name,
            c.age,
            f.name as family_name,
            f.phone as family_phone,
            t.name as template_name
          FROM checkins ch
          JOIN children c ON ch.child_id = c.id
          JOIN families f ON ch.family_id = f.id
          LEFT JOIN templates t ON ch.template_id = t.id
          WHERE DATE(ch.checked_in_at) >= ? AND DATE(ch.checked_in_at) <= ?
          ORDER BY ch.checked_in_at DESC
        `;
        params = [startDate, endDate];
        break;
        
      case 'attendance_summary':
        query = `
          SELECT 
            DATE(checked_in_at) as date,
            COUNT(*) as total_checkins,
            COUNT(DISTINCT child_id) as unique_children,
            COUNT(DISTINCT family_id) as unique_families
          FROM checkins
          GROUP BY DATE(checked_in_at)
          ORDER BY date DESC
        `;
        break;
        
      case 'rewards':
        query = `
          SELECT 
            er.id,
            er.earned_at,
            er.prize_claimed,
            r.name as reward_name,
            r.description,
            r.prize,
            r.icon,
            c.first_name,
            c.last_name,
            f.name as family_name
          FROM earned_rewards er
          JOIN rewards r ON er.reward_id = r.id
          JOIN children c ON er.child_id = c.id
          JOIN families f ON c.family_id = f.id
          ORDER BY er.earned_at DESC
        `;
        break;
        
      case 'volunteers':
        query = `
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            c.total_checkins,
            f.phone,
            f.email,
            f.created_at
          FROM children c
          JOIN families f ON c.family_id = f.id
          WHERE c.notes LIKE '%Volunteer%' OR f.name LIKE '%(Volunteer)%'
          ORDER BY c.last_name, c.first_name
        `;
        break;
        
      case 'birthdays':
        const month = filters.month || (new Date().getMonth() + 1);
        query = `
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            c.birthday,
            c.age,
            f.name as family_name,
            f.phone,
            f.email
          FROM children c
          JOIN families f ON c.family_id = f.id
          WHERE CAST(strftime('%m', c.birthday) AS INTEGER) = ?
          ORDER BY CAST(strftime('%d', c.birthday) AS INTEGER)
        `;
        params = [month];
        break;
        
      case 'allergies':
        query = `
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            c.allergies,
            c.notes,
            f.name as family_name,
            f.phone
          FROM children c
          JOIN families f ON c.family_id = f.id
          WHERE c.allergies IS NOT NULL AND c.allergies != '' AND c.allergies != 'None'
          ORDER BY c.last_name, c.first_name
        `;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    const results = db.prepare(query).all(...params);
    res.json({ data: results, count: results.length });
  } catch (err) {
    console.error('Report query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get available report fields for custom queries
app.get('/api/reports/schema', (req, res) => {
  res.json({
    tables: {
      families: ['id', 'name', 'phone', 'email', 'parent_name', 'address', 'created_at'],
      children: ['id', 'family_id', 'first_name', 'last_name', 'name', 'age', 'birthday', 'gender', 'pin', 'avatar', 'streak', 'badges', 'total_checkins', 'allergies', 'notes'],
      checkins: ['id', 'child_id', 'family_id', 'template_id', 'room', 'pickup_code', 'checked_in_at', 'checked_out_at'],
      rewards: ['id', 'name', 'description', 'type', 'trigger_type', 'trigger_value', 'prize', 'icon', 'enabled'],
      earned_rewards: ['id', 'child_id', 'reward_id', 'earned_at', 'prize_claimed']
    },
    savedReports: [
      { id: 'families', name: 'All Families', description: 'Complete list of registered families with contact info' },
      { id: 'children', name: 'All Children', description: 'Complete list of children with family info' },
      { id: 'checkins', name: 'Check-in History', description: 'Detailed check-in records with date filters' },
      { id: 'attendance_summary', name: 'Attendance Summary', description: 'Daily attendance totals' },
      { id: 'rewards', name: 'Earned Rewards', description: 'All rewards earned by children' },
      { id: 'volunteers', name: 'Volunteers', description: 'List of all volunteers' },
      { id: 'birthdays', name: 'Birthdays by Month', description: 'Children with birthdays in selected month' },
      { id: 'allergies', name: 'Allergy Report', description: 'Children with allergies or special notes' }
    ]
  });
});

// Update family
app.put('/api/family/:id', (req, res) => {
  const { name, phone, email, parentName, address } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    db.prepare('UPDATE families SET name = ?, phone = ?, email = ?, parent_name = ?, address = ? WHERE id = ?')
      .run(name, cleanPhone, email, parentName, address || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete family
app.delete('/api/family/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM children WHERE family_id = ?').run(req.params.id);
    db.prepare('DELETE FROM checkins WHERE family_id = ?').run(req.params.id);
    db.prepare('DELETE FROM families WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update child avatar
app.put('/api/child/:id/avatar', (req, res) => {
  const { avatar } = req.body;
  
  try {
    db.prepare('UPDATE children SET avatar = ? WHERE id = ?').run(avatar, req.params.id);
    res.json({ success: true, avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a child's full info
// Helper to calculate age from birthday
function calculateAgeFromBirthday(birthday) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

app.put('/api/child/:id', (req, res) => {
  const { first_name, last_name, birthday, gender, pin, avatar, allergies, notes } = req.body;
  const name = last_name ? `${first_name} ${last_name}` : first_name;
  const age = calculateAgeFromBirthday(birthday);
  
  try {
    // Check if PIN is unique (if provided)
    if (pin) {
      const existingPin = db.prepare('SELECT id FROM children WHERE pin = ? AND id != ?').get(pin, req.params.id);
      if (existingPin) {
        return res.status(400).json({ error: 'PIN already in use by another child' });
      }
    }
    
    db.prepare(`
      UPDATE children 
      SET first_name = ?, last_name = ?, name = ?, age = ?, birthday = ?, gender = ?, pin = ?, avatar = ?, allergies = ?, notes = ?
      WHERE id = ?
    `).run(first_name, last_name || null, name, age, birthday || null, gender || null, pin || null, avatar || null, allergies || null, notes || null, req.params.id);
    
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id);
    res.json(child);
  } catch (err) {
    console.error('Error updating child:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a child to a family
app.post('/api/family/:familyId/child', (req, res) => {
  const { familyId } = req.params;
  const { first_name, last_name, birthday, gender, pin, avatar, allergies, notes } = req.body;
  const name = last_name ? `${first_name} ${last_name}` : first_name;
  const age = calculateAgeFromBirthday(birthday);
  
  try {
    // Check if PIN is unique (if provided)
    if (pin) {
      const existingPin = db.prepare('SELECT id FROM children WHERE pin = ?').get(pin);
      if (existingPin) {
        return res.status(400).json({ error: 'PIN already in use by another child' });
      }
    }
    
    const result = db.prepare(`
      INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(familyId, first_name, last_name || null, name, age, birthday || null, gender || null, pin || null, avatar || 'felix', allergies || null, notes || null);
    
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(result.lastInsertRowid);
    res.json(child);
  } catch (err) {
    console.error('Error adding child:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a child
app.delete('/api/child/:id', (req, res) => {
  try {
    // Delete related check-ins first
    db.prepare('DELETE FROM checkins WHERE child_id = ?').run(req.params.id);
    // Delete earned rewards
    db.prepare('DELETE FROM earned_rewards WHERE child_id = ?').run(req.params.id);
    // Delete the child
    const result = db.prepare('DELETE FROM children WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting child:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get available avatar seeds (for picker)
app.get('/api/avatar-options', (req, res) => {
  // Generate a set of fun, consistent avatar options
  const options = [
    'felix', 'luna', 'max', 'coco', 'buddy', 'daisy', 'charlie', 'bella',
    'rocky', 'molly', 'jack', 'sadie', 'duke', 'maggie', 'bear', 'sophie',
    'tucker', 'chloe', 'cooper', 'lily', 'murphy', 'zoey', 'jake', 'lola',
    'oliver', 'penny', 'leo', 'gracie', 'milo', 'ruby', 'oscar', 'rosie',
    'finn', 'ellie', 'henry', 'stella', 'teddy', 'ginger', 'louie', 'willow'
  ];
  res.json(options);
});

// ============================================
// AVATAR ACCESSORY API ENDPOINTS
// ============================================

// Get all avatar accessory rewards
app.get('/api/avatar-rewards', (req, res) => {
  try {
    const rewards = db.prepare('SELECT * FROM avatar_rewards ORDER BY trigger_value ASC').all();
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get child's unlocked accessories
app.get('/api/child/:id/accessories', (req, res) => {
  try {
    const accessories = db.prepare(`
      SELECT accessory_type, accessory_id, is_equipped, unlocked_at
      FROM child_accessories
      WHERE child_id = ?
    `).all(req.params.id);
    res.json(accessories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get child's equipped accessories (for avatar rendering)
app.get('/api/child/:id/equipped-accessories', (req, res) => {
  try {
    const accessories = db.prepare(`
      SELECT accessory_type, accessory_id
      FROM child_accessories
      WHERE child_id = ? AND is_equipped = 1
    `).all(req.params.id);
    
    const equipped = {};
    accessories.forEach(acc => {
      equipped[acc.accessory_type] = acc.accessory_id;
    });
    res.json(equipped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Equip/unequip an accessory
app.put('/api/child/:id/accessories/:type', (req, res) => {
  try {
    const { accessoryId } = req.body;
    const childId = req.params.id;
    const accessoryType = req.params.type;
    
    // First, unequip any currently equipped accessory of this type
    db.prepare(`
      UPDATE child_accessories 
      SET is_equipped = 0 
      WHERE child_id = ? AND accessory_type = ?
    `).run(childId, accessoryType);
    
    if (accessoryId) {
      // Equip the new accessory
      db.prepare(`
        UPDATE child_accessories 
        SET is_equipped = 1 
        WHERE child_id = ? AND accessory_type = ? AND accessory_id = ?
      `).run(childId, accessoryType, accessoryId);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle avatar reward enabled/disabled
app.put('/api/avatar-rewards/:id/toggle', (req, res) => {
  try {
    const reward = db.prepare('SELECT enabled FROM avatar_rewards WHERE id = ?').get(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Avatar reward not found' });
    }
    
    const newEnabled = reward.enabled ? 0 : 1;
    db.prepare('UPDATE avatar_rewards SET enabled = ? WHERE id = ?').run(newEnabled, req.params.id);
    res.json({ enabled: newEnabled === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process admin-assigned pending rewards for a child (called during check-in)
function processPendingRewards(childId) {
  const pending = db.prepare(`
    SELECT * FROM pending_rewards 
    WHERE child_id = ? AND awarded_at IS NULL
  `).all(childId);
  
  const awardedRewards = [];
  const now = new Date().toISOString();
  
  for (const reward of pending) {
    // Custom reward
    awardedRewards.push({
      name: reward.custom_name || 'Special Reward',
      icon: reward.custom_icon || '🎁',
      prize: reward.custom_description || 'A special prize from your teacher!'
    });
    
    // Mark as awarded
    db.prepare('UPDATE pending_rewards SET awarded_at = ? WHERE id = ?').run(now, reward.id);
  }
  
  return { rewards: awardedRewards };
}

// ============================================
// REWARDS API ENDPOINTS
// ============================================

// Get all rewards
app.get('/api/rewards', (req, res) => {
  try {
    const rewards = db.prepare('SELECT * FROM rewards ORDER BY trigger_value ASC').all();
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle reward enabled/disabled
app.put('/api/rewards/:id/toggle', (req, res) => {
  try {
    const reward = db.prepare('SELECT enabled FROM rewards WHERE id = ?').get(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }
    
    const newEnabled = reward.enabled ? 0 : 1;
    db.prepare('UPDATE rewards SET enabled = ? WHERE id = ?').run(newEnabled, req.params.id);
    res.json({ success: true, enabled: newEnabled === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update reward
app.put('/api/rewards/:id', (req, res) => {
  const { name, description, prize, icon, trigger_value } = req.body;
  
  try {
    db.prepare(`
      UPDATE rewards 
      SET name = ?, description = ?, prize = ?, icon = ?, trigger_value = ?
      WHERE id = ?
    `).run(name, description, prize, icon, trigger_value, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create custom reward
app.post('/api/rewards', (req, res) => {
  const { name, description, type, trigger_type, trigger_value, prize, icon } = req.body;
  
  try {
    const result = db.prepare(`
      INSERT INTO rewards (name, description, type, trigger_type, trigger_value, prize, icon, enabled, is_preset)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(name, description, type || 'milestone', trigger_type || 'checkin_count', trigger_value, prize, icon || '🎁');
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete custom reward (only non-preset)
app.delete('/api/rewards/:id', (req, res) => {
  try {
    const reward = db.prepare('SELECT is_preset FROM rewards WHERE id = ?').get(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }
    if (reward.is_preset) {
      return res.status(400).json({ error: 'Cannot delete preset rewards. You can disable them instead.' });
    }
    
    db.prepare('DELETE FROM rewards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get earned rewards for a child
app.get('/api/child/:id/rewards', (req, res) => {
  try {
    const earned = db.prepare(`
      SELECT er.*, r.name, r.description, r.prize, r.icon
      FROM earned_rewards er
      JOIN rewards r ON er.reward_id = r.id
      WHERE er.child_id = ?
      ORDER BY er.earned_at DESC
    `).all(req.params.id);
    res.json(earned);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending rewards for a child (admin-assigned)
app.get('/api/child/:id/pending-rewards', (req, res) => {
  try {
    const pending = db.prepare(`
      SELECT * FROM pending_rewards
      WHERE child_id = ? AND awarded_at IS NULL
      ORDER BY assigned_at DESC
    `).all(req.params.id);
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a pending reward to a child (admin assigns reward for next check-in)
app.post('/api/child/:id/pending-rewards', (req, res) => {
  const childId = req.params.id;
  const { reward_type, reward_id, accessory_type, accessory_id, custom_name, custom_description, custom_icon, assigned_by } = req.body;
  
  try {
    const result = db.prepare(`
      INSERT INTO pending_rewards (child_id, reward_type, reward_id, accessory_type, accessory_id, custom_name, custom_description, custom_icon, assigned_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      childId,
      reward_type || 'accessory',
      reward_id || null,
      accessory_type || null,
      accessory_id || null,
      custom_name || null,
      custom_description || null,
      custom_icon || '🎁',
      assigned_by || 'Admin'
    );
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a pending reward
app.delete('/api/child/:id/pending-rewards/:rewardId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM pending_rewards WHERE id = ? AND child_id = ?').run(req.params.rewardId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pending reward not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reward stats
app.get('/api/rewards/stats', (req, res) => {
  try {
    const totalEarned = db.prepare('SELECT COUNT(*) as count FROM earned_rewards').get().count;
    const unclaimed = db.prepare('SELECT COUNT(*) as count FROM earned_rewards WHERE prize_claimed = 0').get().count;
    const recentEarned = db.prepare(`
      SELECT er.*, r.name, r.icon, c.name as child_name, c.avatar
      FROM earned_rewards er
      JOIN rewards r ON er.reward_id = r.id
      JOIN children c ON er.child_id = c.id
      ORDER BY er.earned_at DESC
      LIMIT 10
    `).all();
    
    res.json({ totalEarned, unclaimed, recentEarned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check and award rewards for a child (called during check-in)
function checkAndAwardRewards(childId) {
  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
  if (!child) return [];
  
  const enabledRewards = db.prepare('SELECT * FROM rewards WHERE enabled = 1').all();
  const earnedRewardIds = db.prepare('SELECT reward_id FROM earned_rewards WHERE child_id = ?')
    .all(childId)
    .map(r => r.reward_id);
  
  const newlyEarned = [];
  
  for (const reward of enabledRewards) {
    // Skip if already earned
    if (earnedRewardIds.includes(reward.id)) continue;
    
    let qualified = false;
    
    if (reward.trigger_type === 'checkin_count' && child.total_checkins >= reward.trigger_value) {
      qualified = true;
    } else if (reward.trigger_type === 'streak' && child.streak >= reward.trigger_value) {
      qualified = true;
    }
    
    if (qualified) {
      db.prepare('INSERT INTO earned_rewards (child_id, reward_id) VALUES (?, ?)')
        .run(childId, reward.id);
      newlyEarned.push(reward);
    }
  }
  
  return newlyEarned;
}

// ============================================
// LABEL PRINTING (existing code)
// ============================================

// Dymo 30256 Shipping Labels: 2.31" x 4" (59mm x 102mm)
// At 300 DPI: 693 x 1200 pixels (height x width)
// Label orientation: landscape (4" wide, 2.31" tall)
const LABEL_WIDTH = 1200;  // 4 inches at 300 DPI
const LABEL_HEIGHT = 693;  // 2.31 inches at 300 DPI

async function generateLabelImage(data) {
  const { 
    childName, 
    avatar, 
    pickupCode, 
    room, 
    streak, 
    rank, 
    badges,
    isNewBadge,
    badgeName,
    tier,
    allergies,
    // Settings from label editor (with defaults)
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
    accentColor = '#10B981',
    borderStyle = 'pointed'
  } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Border based on style setting or tier
  const borderWidth = 12;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderWidth;
  
  if (borderStyle === 'none') {
    // No border
  } else if (tier === 'gold' || borderStyle === 'pointed') {
    ctx.strokeRect(borderWidth/2, borderWidth/2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
    if (tier === 'gold') {
      ctx.lineWidth = 3;
      ctx.strokeRect(borderWidth + 6, borderWidth + 6, LABEL_WIDTH - (borderWidth*2) - 12, LABEL_HEIGHT - (borderWidth*2) - 12);
    }
  } else if (tier === 'silver') {
    ctx.setLineDash([16, 8]);
    ctx.strokeRect(borderWidth/2, borderWidth/2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
    ctx.setLineDash([]);
  } else if (borderStyle === 'rounded') {
    ctx.beginPath();
    ctx.roundRect(borderWidth/2, borderWidth/2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth, 20);
    ctx.stroke();
  } else {
    ctx.strokeRect(borderWidth/2, borderWidth/2, LABEL_WIDTH - borderWidth, LABEL_HEIGHT - borderWidth);
  }

  // ============================================
  // LEFT SIDE: Avatar (big!)
  // ============================================
  
  const avatarSize = 320;
  const avatarX = 45;
  const avatarY = (LABEL_HEIGHT - avatarSize) / 2;
  
  if (showAvatar) {
    // Load Park Ranger avatar image
    const avatarSeed = avatar || childName;
    const avatarImage = await fetchAvatarImage(avatarSeed);
    
    if (avatarImage) {
      // Draw avatar with rounded corners (no background - SVG has its own)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 28);
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      
      // Border around avatar
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 28);
      ctx.stroke();
    } else {
      // Fallback: draw initials with light gray background
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
      ctx.fillText(childName.substring(0, 2).toUpperCase(), avatarX + avatarSize/2, avatarY + avatarSize/2 + 40);
    }
  }

  // ============================================
  // CENTER: Name, Room, and Stats
  // ============================================
  
  const contentX = showAvatar ? avatarX + avatarSize + 35 : 45;
  const contentWidth = showPickupCode ? 580 : LABEL_WIDTH - contentX - 40;
  
  // Tier badge (if applicable)
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
    
    // Use nameSize setting, with auto-shrink if too long
    let currentSize = Math.min(nameSize, 150); // Cap at 150
    ctx.font = `bold ${currentSize}px Arial`;
    
    // Shrink font if name is too long
    let nameWidth = ctx.measureText(childName).width;
    while (nameWidth > contentWidth && currentSize > 40) {
      currentSize -= 10;
      ctx.font = `bold ${currentSize}px Arial`;
      nameWidth = ctx.measureText(childName).width;
    }
    ctx.fillText(childName, contentX, tier ? 145 : 120);
  }

  // Room - larger
  if (showRoom) {
    const roomFontSize = Math.min(roomSize, 80); // Cap at 80
    ctx.font = `bold ${roomFontSize}px Arial`;
    ctx.fillText(room || 'Room 101', contentX, tier ? 205 : 180);
  }
  
  // Stats row - larger and properly spaced
  const statsY = tier ? 310 : 290;
  
  // Calculate stat positions with proper spacing
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

  // ============================================
  // RIGHT SIDE: Pickup Code (compact tear-off)
  // ============================================
  
  if (showPickupCode) {
    // Dashed separator line
    const separatorX = 1040;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(separatorX, 25);
    ctx.lineTo(separatorX, LABEL_HEIGHT - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scissors icon
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✂', separatorX, LABEL_HEIGHT / 2 + 8);
    
    // Pickup code - centered in remaining space
    const codeX = separatorX + (LABEL_WIDTH - separatorX) / 2;
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('PICKUP', codeX, 120);
    ctx.fillText('CODE', codeX, 148);
    
    // The code itself
    ctx.font = 'bold 52px monospace';
    ctx.fillText(pickupCode, codeX, 240);
  }

  // ============================================
  // FOOTER
  // ============================================

  if (showDate) {
    ctx.font = '20px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('ADVENTURE KIDS CHECK-IN', LABEL_WIDTH / 2, LABEL_HEIGHT - 25);
  }

  return canvas.toBuffer('image/png');
}

function generateParentLabelImage(data) {
  const { 
    familyName, 
    children,
    // Settings from label editor (with defaults)
    showLogo = false,
    showFamilyName = true,
    showChildren = true,
    showPickupCodes = true,
    showRooms = true,
    showDate = true,
    showTime = true,
    titleSize = 48,
    nameSize = 36,
    accentColor = '#3B82F6'
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
  const cappedTitleSize = Math.min(titleSize, 72); // Cap at 72
  ctx.font = `bold ${cappedTitleSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('PARENT PICKUP RECEIPT', LABEL_WIDTH / 2, 60);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.lineTo(LABEL_WIDTH - 50, 80);
  ctx.stroke();

  // Family name (if enabled)
  let yPos = 130;
  if (showFamilyName && familyName) {
    ctx.font = `bold ${Math.min(nameSize + 10, 50)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${familyName} Family`, LABEL_WIDTH / 2, yPos);
    yPos += 50;
  }

  // Children list
  if (showChildren && children && children.length > 0) {
    ctx.textAlign = 'left';
    
    children.forEach((child, index) => {
      const xPos = 60 + (index % 3) * 380;
      const yOffset = Math.floor(index / 3) * 180;
      
      // Child name
      const cappedNameSize = Math.min(nameSize, 60); // Cap at 60
      ctx.font = `bold ${cappedNameSize}px Arial`;
      ctx.fillText(child.name, xPos, yPos + yOffset);
      
      // Room
      if (showRooms) {
        ctx.font = `${Math.max(cappedNameSize - 14, 20)}px Arial`;
        ctx.fillText(child.room || 'Room 101', xPos, yPos + 35 + yOffset);
      }
      
      // Pickup code
      if (showPickupCodes) {
        ctx.font = '22px Arial';
        ctx.fillText('CODE:', xPos, yPos + 75 + yOffset);
        
        ctx.font = 'bold 56px monospace';
        ctx.fillText(child.pickupCode, xPos, yPos + 130 + yOffset);
      }
    });
  }

  // Footer with date/time
  ctx.textAlign = 'center';
  let footerText = 'Present this receipt at pickup';
  if (showDate || showTime) {
    const now = new Date();
    if (showDate && showTime) {
      footerText += ` • ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else if (showDate) {
      footerText += ` • ${now.toLocaleDateString()}`;
    } else if (showTime) {
      footerText += ` • ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
  }
  ctx.font = '22px Arial';
  ctx.fillText(footerText, LABEL_WIDTH / 2, LABEL_HEIGHT - 30);

  return canvas.toBuffer('image/png');
}

app.post('/print', async (req, res) => {
  const labelData = req.body;
  
  try {
    const imageBuffer = await generateLabelImage(labelData);
    const tempPath = path.join(__dirname, 'temp-label.png');
    
    fs.writeFileSync(tempPath, imageBuffer);
    console.log('Label image generated:', tempPath);
    
    // Skip actual printing if disabled (remote deployment)
    if (DISABLE_PRINTING) {
      console.log('Printing disabled - label saved but not printed');
      return res.json({ success: true, message: 'Label generated (printing disabled on server)', printDisabled: true });
    }
    
    const printerName = 'DYMO_LabelWriter_450_Turbo';
    
    const printCmd = `lp -d "${printerName}" -o fit-to-page -o orientation-requested=4 "${tempPath}"`;
    
    exec(printCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('Print error:', err);
        console.error('stderr:', stderr);
        return res.status(500).json({ error: 'Failed to print', details: stderr });
      }
      
      console.log('Print success:', stdout);
      res.json({ success: true, message: 'Label printed!', output: stdout });
    });
  } catch (err) {
    console.error('Error generating label:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print-parent', async (req, res) => {
  const labelData = req.body;
  
  try {
    const imageBuffer = generateParentLabelImage(labelData);
    const tempPath = path.join(__dirname, 'temp-parent-label.png');
    
    fs.writeFileSync(tempPath, imageBuffer);
    console.log('Parent label image generated:', tempPath);
    
    // Skip actual printing if disabled (remote deployment)
    if (DISABLE_PRINTING) {
      console.log('Printing disabled - parent label saved but not printed');
      return res.json({ success: true, message: 'Parent receipt generated (printing disabled on server)', printDisabled: true });
    }
    
    const printerName = 'DYMO_LabelWriter_450_Turbo';
    
    const printCmd = `lp -d "${printerName}" -o fit-to-page -o orientation-requested=4 "${tempPath}"`;
    
    exec(printCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('Print error:', err);
        return res.status(500).json({ error: 'Failed to print', details: stderr });
      }
      
      console.log('Parent receipt printed:', stdout);
      res.json({ success: true, message: 'Parent receipt printed!' });
    });
  } catch (err) {
    console.error('Error generating parent label:', err);
    res.status(500).json({ error: err.message });
  }
});

// Print volunteer badge
app.post('/print-volunteer', async (req, res) => {
  const labelData = req.body;
  
  try {
    const imageBuffer = await generateVolunteerBadgeImage(labelData);
    const tempPath = path.join(__dirname, 'temp-volunteer-label.png');
    
    fs.writeFileSync(tempPath, imageBuffer);
    console.log('Volunteer badge generated:', tempPath);
    
    // Skip actual printing if disabled (remote deployment)
    if (DISABLE_PRINTING) {
      console.log('Printing disabled - volunteer badge saved but not printed');
      return res.json({ success: true, message: 'Volunteer badge generated (printing disabled on server)', printDisabled: true });
    }
    
    const printerName = 'DYMO_LabelWriter_450_Turbo';
    
    const printCmd = `lp -d "${printerName}" -o fit-to-page -o orientation-requested=4 "${tempPath}"`;
    
    exec(printCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('Print error:', err);
        return res.status(500).json({ error: 'Failed to print', details: stderr });
      }
      
      console.log('Volunteer badge printed:', stdout);
      res.json({ success: true, message: 'Volunteer badge printed!' });
    });
  } catch (err) {
    console.error('Error generating volunteer badge:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate volunteer badge label
async function generateVolunteerBadgeImage(data) {
  const { 
    volunteerName, 
    serviceArea, 
    date, 
    photoPath,
    // Settings from label editor (with defaults)
    showInitials = true,
    showName = true,
    showServiceArea = true,
    showDate = true,
    nameSize = 154,
    serviceAreaSize = 62,
    dateSize = 50,
    accentColor = '#4F46E5'
  } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // ============================================
  // LEFT SIDE: Logo/Photo (same size as kid avatar)
  // ============================================
  
  const logoSize = 320;
  const logoX = 45;
  const logoY = (LABEL_HEIGHT - logoSize) / 2;

  if (showInitials) {
    // Try to load volunteer photo or fall back to Adventure Kids logo
    let imageLoaded = false;
    try {
      let imagePath;
      if (photoPath && fs.existsSync(photoPath)) {
        imagePath = photoPath;
      } else {
        // Use Adventure Kids logo from public folder
        imagePath = path.join(publicPath, 'adventure-kids-logo.png');
        if (!fs.existsSync(imagePath)) {
          // Fall back to explorer avatar if logo doesn't exist
          imagePath = path.join(publicPath, 'avatars', 'explorer.png');
        }
      }
      
      if (fs.existsSync(imagePath)) {
        const img = await loadImage(imagePath);
        
        // Draw with rounded corners like kid avatar
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(logoX, logoY, logoSize, logoSize, 28);
        ctx.clip();
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        ctx.restore();
        
        // Border around logo
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(logoX, logoY, logoSize, logoSize, 28);
        ctx.stroke();
        
        imageLoaded = true;
      }
    } catch (imgErr) {
      console.log('❌ Could not load volunteer photo:', imgErr.message);
    }

    // Draw initials placeholder if no image loaded
    if (!imageLoaded) {
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoSize, logoSize, 28);
      ctx.fill();
      
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoSize, logoSize, 28);
      ctx.stroke();
      
      // Get first and last name initials
      const nameParts = volunteerName.trim().split(' ');
      const firstInitial = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() : '';
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0).toUpperCase() : '';
      const initials = firstInitial + lastInitial;
      
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 140px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(initials, logoX + logoSize/2, logoY + logoSize/2 + 50);
    }
  }

  // ============================================
  // RIGHT SIDE: Name, Service Area, Date
  // ============================================
  
  const contentX = showInitials ? logoX + logoSize + 35 : 45;
  const contentWidth = LABEL_WIDTH - contentX - 40;
  
  // Shift everything down by ~25px (quarter inch at ~100dpi)
  const yOffset = 25;

  // "VOLUNTEER" label at top
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 50px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('VOLUNTEER', contentX, 85 + yOffset);

  // Volunteer name - BIG (cap at 200px max, auto-shrink if too wide)
  if (showName) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    // Cap the name size at reasonable bounds
    let currentSize = Math.min(Math.max(nameSize, 60), 200);
    ctx.font = `bold ${currentSize}px Arial`;
    
    // Shrink font if name is too long for available width
    let nameWidth = ctx.measureText(volunteerName).width;
    while (nameWidth > contentWidth && currentSize > 50) {
      currentSize -= 8;
      ctx.font = `bold ${currentSize}px Arial`;
      nameWidth = ctx.measureText(volunteerName).width;
    }
    ctx.fillText(volunteerName, contentX, 200 + yOffset);
  }

  // Service area (cap at 100px)
  if (showServiceArea && serviceArea) {
    ctx.fillStyle = '#000000';
    const cappedServiceSize = Math.min(Math.max(serviceAreaSize, 24), 100);
    ctx.font = `bold ${cappedServiceSize}px Arial`;
    
    // Also shrink if too wide
    let areaWidth = ctx.measureText(serviceArea).width;
    let areaSize = cappedServiceSize;
    while (areaWidth > contentWidth && areaSize > 24) {
      areaSize -= 4;
      ctx.font = `bold ${areaSize}px Arial`;
      areaWidth = ctx.measureText(serviceArea).width;
    }
    ctx.fillText(serviceArea, contentX, 280 + yOffset);
  }

  // Date (cap at 72px to prevent overflow)
  if (showDate) {
    const displayDate = date || new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    ctx.fillStyle = '#666666';
    const cappedDateSize = Math.min(Math.max(dateSize, 20), 72);
    ctx.font = `bold ${cappedDateSize}px Arial`;
    
    // Shrink if too wide
    let dateWidth = ctx.measureText(displayDate).width;
    let dateSz = cappedDateSize;
    while (dateWidth > contentWidth && dateSz > 20) {
      dateSz -= 4;
      ctx.font = `bold ${dateSz}px Arial`;
      dateWidth = ctx.measureText(displayDate).width;
    }
    ctx.fillText(displayDate, contentX, 360 + yOffset);
  }

  // ============================================
  // LEFT ACCENT BAR (like volunteer branding)
  // ============================================
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 15, LABEL_HEIGHT);

  return canvas.toBuffer('image/png');
}

// Print reward certificate
app.post('/print-reward', async (req, res) => {
  const { childName, avatar, rewardName, rewardIcon, prize } = req.body;
  
  try {
    const imageBuffer = await generateRewardLabelImage({ childName, avatar, rewardName, rewardIcon, prize });
    const tempPath = path.join(__dirname, 'temp-reward-label.png');
    
    fs.writeFileSync(tempPath, imageBuffer);
    console.log('Reward label generated:', tempPath);
    
    // Skip actual printing if disabled (remote deployment)
    if (DISABLE_PRINTING) {
      console.log('Printing disabled - reward label saved but not printed');
      return res.json({ success: true, message: 'Reward certificate generated (printing disabled on server)', printDisabled: true });
    }
    
    const printerName = 'DYMO_LabelWriter_450_Turbo';
    const printCmd = `lp -d "${printerName}" -o fit-to-page -o orientation-requested=4 "${tempPath}"`;
    
    exec(printCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('Print error:', err);
        return res.status(500).json({ error: 'Failed to print', details: stderr });
      }
      
      console.log('Reward label printed:', stdout);
      res.json({ success: true, message: 'Reward printed!' });
    });
  } catch (err) {
    console.error('Error generating reward label:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate reward certificate label
async function generateRewardLabelImage(data) {
  const { childName, avatar, rewardName, rewardIcon, prize } = data;

  const canvas = createCanvas(LABEL_WIDTH, LABEL_HEIGHT);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

  // Festive border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, LABEL_WIDTH - 12, LABEL_HEIGHT - 12);
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, LABEL_WIDTH - 36, LABEL_HEIGHT - 36);

  // Stars decoration at top
  ctx.font = '36px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('★ ★ ★ REWARD EARNED ★ ★ ★', LABEL_WIDTH / 2, 60);

  // Avatar
  const avatarSize = 200;
  const avatarX = 80;
  const avatarY = 120;
  
  const avatarSeed = avatar || childName;
  const avatarImage = await fetchAvatarImage(avatarSeed);
  
  if (avatarImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Child name
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(childName, 320, 180);

  // Reward name with icon
  ctx.font = 'bold 48px Arial';
  ctx.fillText(`${rewardIcon} ${rewardName}`, 320, 260);

  // Prize box
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(320, 300, 550, 80, 12);
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('YOUR PRIZE:', 595, 335);
  ctx.font = 'bold 32px Arial';
  ctx.fillText(prize || 'See a volunteer!', 595, 370);

  // Instructions
  ctx.fillStyle = '#000000';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Present this to a volunteer to claim your prize!', LABEL_WIDTH / 2, 450);

  // Footer
  ctx.font = '20px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText('ADVENTURE KIDS CHECK-IN', LABEL_WIDTH / 2, LABEL_HEIGHT - 30);

  return canvas.toBuffer('image/png');
}

app.get('/preview', async (req, res) => {
  const labelData = {
    childName: "Emma",
    avatar: "emma-abc123",
    pickupCode: "X7K2",
    room: "Room 101",
    streak: 6,
    rank: 3,
    badges: 12,
    tier: "gold",
    isNewBadge: true,
    badgeName: "Gold Legend"
  };
  
  try {
    const imageBuffer = await generateLabelImage(labelData);
    res.type('image/png').send(imageBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/preview-parent', (req, res) => {
  const labelData = {
    familyName: 'Johnson Family',
    children: [
      { name: 'Emma', pickupCode: 'X7K2', room: 'Room 101' },
      { name: 'Jake', pickupCode: 'M3P9', room: 'Room 102' },
      { name: 'Lily', pickupCode: 'Q5W1', room: 'Room 100' }
    ]
  };
  
  try {
    const imageBuffer = generateParentLabelImage(labelData);
    res.type('image/png').send(imageBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test', (req, res) => {
  res.json({ status: 'Print server running!' });
});

app.get('/printers', (req, res) => {
  exec('lpstat -p', (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ printers: stdout });
  });
});

// ============================================
// STATIC FILE SERVING (Production)
// ============================================
// Serve the built frontend in production
// Use environment variable for dist path (for Electron) or default
const distPath = process.env.DIST_PATH || path.join(__dirname, 'dist');
console.log('📁 Dist path:', distPath);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/print')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  console.log('📦 Serving static files from dist/');
} else {
  console.log('⚠️ Dist path not found:', distPath);
}

// ============================================
// START SERVER
// ============================================
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 Adventure Kids Check-In Server');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  if (DISABLE_PRINTING) {
    console.log('🖨️  Printing: DISABLED (remote mode)');
  } else {
    console.log('🖨️  Printing: ENABLED');
  }
  console.log('');
  console.log('📊 API Endpoints:');
  console.log(`   - GET  /api/family/:phone`);
  console.log(`   - POST /api/family`);
  console.log(`   - GET  /api/families`);
  console.log(`   - GET  /api/stats`);
  console.log('');
  if (fs.existsSync(distPath)) {
    console.log('🌐 Frontend: Serving from dist/');
  } else {
    console.log('⚠️  Frontend: Run "npm run build" to enable static serving');
  }
  console.log('═══════════════════════════════════════');
});