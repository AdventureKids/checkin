/**
 * ChurchCheck Cloud API Server
 * PostgreSQL-based multi-tenant server for Render deployment
 * 
 * This server handles:
 * - Multi-tenant authentication (organizations)
 * - Family/child/volunteer management
 * - Check-in processing
 * - Sync endpoints for Electron clients
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err));

// Helper for async queries
const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows;
};

const queryOne = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows[0];
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (for web admin)
const distPath = process.env.DIST_PATH || path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Serve avatar images
const publicPath = process.env.PUBLIC_PATH || path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Token storage (in production, use Redis or JWT)
const tokens = new Map();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const session = tokens.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.orgId = session.orgId;
  req.userId = session.userId;
  req.userRole = session.role;
  next();
};

// Optional auth - allows unauthenticated requests but adds org context if authenticated
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = tokens.get(token);
    if (session) {
      req.orgId = session.orgId;
      req.userId = session.userId;
    }
  }
  // Also check for org_id query param (for kiosk mode)
  if (!req.orgId && req.query.org_id) {
    req.orgId = parseInt(req.query.org_id);
  }
  // Default to org 1 for backwards compatibility
  if (!req.orgId) {
    req.orgId = 1;
  }
  next();
};

// ============================================
// AUTH ENDPOINTS
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, orgSlug } = req.body;

    // Find organization
    let org;
    if (orgSlug) {
      org = await queryOne('SELECT * FROM organizations WHERE slug = $1', [orgSlug]);
    } else {
      // Default to first org for backwards compatibility
      org = await queryOne('SELECT * FROM organizations ORDER BY id LIMIT 1');
    }

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Find user - try with org_id first, then fallback to any matching username
    let user = await queryOne(
      'SELECT * FROM admin_users WHERE org_id = $1 AND username = $2',
      [org.id, username]
    );
    
    // Fallback: find user by username only (for initial setup/migration)
    if (!user) {
      user = await queryOne(
        'SELECT * FROM admin_users WHERE username = $1',
        [username]
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword && user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken();
    tokens.set(token, {
      orgId: org.id,
      userId: user.id,
      role: user.role,
      username: user.username
    });

    res.json({
      token,
      orgId: org.id,
      orgName: org.name,
      username: user.username,
      role: user.role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
  const org = await queryOne('SELECT * FROM organizations WHERE id = $1', [req.orgId]);
  res.json({
    valid: true,
    orgId: req.orgId,
    orgName: org?.name,
    userId: req.userId,
    role: req.userRole
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    tokens.delete(token);
  }
  res.json({ success: true });
});

// ============================================
// ORGANIZATION ENDPOINTS
// ============================================

app.get('/api/organizations', async (req, res) => {
  try {
    const orgs = await query('SELECT id, name, slug FROM organizations ORDER BY name');
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FAMILY ENDPOINTS
// ============================================

// Get family by phone
app.get('/api/family/:phone', optionalAuth, async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const family = await queryOne(
      'SELECT * FROM families WHERE org_id = $1 AND phone = $2',
      [req.orgId, phone]
    );

    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const children = await query(
      'SELECT * FROM children WHERE family_id = $1 ORDER BY name',
      [family.id]
    );

    res.json({ ...family, children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all families
app.get('/api/families', optionalAuth, async (req, res) => {
  try {
    const families = await query(
      `SELECT * FROM families 
       WHERE org_id = $1 
       AND name NOT LIKE '%(Volunteer)%'
       AND NOT EXISTS (
         SELECT 1 FROM children c WHERE c.family_id = families.id AND c.notes = 'Volunteer'
       )
       ORDER BY name`,
      [req.orgId]
    );

    const result = await Promise.all(families.map(async (family) => {
      const children = await query('SELECT * FROM children WHERE family_id = $1', [family.id]);
      return { ...family, children };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create family
app.post('/api/family', optionalAuth, async (req, res) => {
  try {
    const { phone, parentName, email, address, children } = req.body;
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if family exists
    let family = await queryOne(
      'SELECT * FROM families WHERE org_id = $1 AND phone = $2',
      [req.orgId, cleanPhone]
    );

    if (family) {
      return res.status(400).json({ error: 'Family with this phone already exists' });
    }

    // Create family
    const familyResult = await queryOne(
      `INSERT INTO families (org_id, name, phone, parent_name, email, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.orgId, parentName, cleanPhone, parentName, email, address]
    );

    family = familyResult;

    // Create children
    const childRecords = [];
    for (const child of children) {
      const age = child.birthday ? calculateAge(child.birthday) : null;
      const name = child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName;
      
      const childResult = await queryOne(
        `INSERT INTO children (org_id, family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [req.orgId, family.id, child.firstName, child.lastName, name, age, child.birthday, child.gender, child.pin, child.avatar || 'explorer', child.allergies, child.notes]
      );
      childRecords.push(childResult);
    }

    res.json({ ...family, children: childRecords });
  } catch (err) {
    console.error('Create family error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CHILDREN ENDPOINTS
// ============================================

// Update child
app.put('/api/children/:id', optionalAuth, async (req, res) => {
  try {
    const { first_name, last_name, birthday, gender, pin, avatar, allergies, notes } = req.body;
    const name = last_name ? `${first_name} ${last_name}` : first_name;
    const age = birthday ? calculateAge(birthday) : null;

    await pool.query(
      `UPDATE children 
       SET first_name = $1, last_name = $2, name = $3, age = $4, birthday = $5, 
           gender = $6, pin = $7, avatar = $8, allergies = $9, notes = $10
       WHERE id = $11`,
      [first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes, req.params.id]
    );

    const child = await queryOne('SELECT * FROM children WHERE id = $1', [req.params.id]);
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CHILD PIN LOOKUP
// ============================================

// Get child by PIN (for kid login) - also works for volunteers
app.get('/api/child/pin/:pin', optionalAuth, async (req, res) => {
  try {
    const pin = req.params.pin;

    const child = await queryOne(
      `SELECT c.*, f.name as family_name, f.id as family_id,
              CASE WHEN c.notes LIKE '%Volunteer%' THEN true ELSE false END as is_volunteer
       FROM children c
       JOIN families f ON c.family_id = f.id
       WHERE c.pin = $1 AND c.org_id = $2`,
      [pin, req.orgId]
    );

    if (!child) {
      return res.status(404).json({ error: 'PIN not found' });
    }

    // If this is a volunteer, get their details
    let volunteerDetails = null;
    if (child.is_volunteer) {
      volunteerDetails = await queryOne(
        'SELECT * FROM volunteer_details WHERE volunteer_id = $1', [child.id]
      ) || {};
    }

    // Get next upcoming reward
    const earnedRewards = await query(
      'SELECT reward_id FROM earned_rewards WHERE child_id = $1', [child.id]
    );
    const earnedRewardIds = earnedRewards.map(r => r.reward_id);

    let nextReward = null;
    if (earnedRewardIds.length > 0) {
      nextReward = await queryOne(
        `SELECT * FROM rewards
         WHERE enabled = true
         AND id NOT IN (${earnedRewardIds.join(',')})
         AND (
           (trigger_type = 'checkin_count' AND trigger_value > $1)
           OR (trigger_type = 'streak' AND trigger_value > $2)
         )
         ORDER BY trigger_value ASC
         LIMIT 1`,
        [child.total_checkins, child.streak]
      );
    } else {
      nextReward = await queryOne(
        `SELECT * FROM rewards
         WHERE enabled = true
         AND (
           (trigger_type = 'checkin_count' AND trigger_value > $1)
           OR (trigger_type = 'streak' AND trigger_value > $2)
         )
         ORDER BY trigger_value ASC
         LIMIT 1`,
        [child.total_checkins, child.streak]
      );
    }

    // Get equipped accessories
    const equipped = await query(
      `SELECT accessory_type, accessory_id
       FROM child_accessories
       WHERE child_id = $1 AND is_equipped = true`,
      [child.id]
    );

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
      isVolunteer: !!child.is_volunteer,
      volunteerDetails: child.is_volunteer ? {
        serviceArea: volunteerDetails?.service_area || null,
        servingFrequency: volunteerDetails?.serving_frequency || null
      } : null
    });
  } catch (err) {
    console.error('PIN lookup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CHECK-IN ENDPOINTS
// ============================================

// Process check-in
app.post('/api/checkin', optionalAuth, async (req, res) => {
  try {
    const { childId, familyId, room, templateId } = req.body;
    const pickupCode = generatePickupCode();

    // Create check-in record
    const checkin = await queryOne(
      `INSERT INTO checkins (org_id, child_id, family_id, room, pickup_code, template_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.orgId, childId, familyId, room, pickupCode, templateId]
    );

    // Update child stats
    await pool.query(
      'UPDATE children SET total_checkins = total_checkins + 1 WHERE id = $1',
      [childId]
    );

    // Get child info for response
    const child = await queryOne('SELECT * FROM children WHERE id = $1', [childId]);

    res.json({
      checkin,
      child,
      pickupCode
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get today's check-ins
app.get('/api/checkins/today', optionalAuth, async (req, res) => {
  try {
    const checkins = await query(
      `SELECT ch.*, c.name as child_name, c.gender, f.name as family_name
       FROM checkins ch
       JOIN children c ON ch.child_id = c.id
       JOIN families f ON ch.family_id = f.id
       WHERE ch.org_id = $1 AND DATE(ch.checked_in_at) = CURRENT_DATE
       ORDER BY ch.checked_in_at DESC`,
      [req.orgId]
    );
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TEMPLATES ENDPOINTS
// ============================================

app.get('/api/templates', optionalAuth, async (req, res) => {
  try {
    const templates = await query(
      'SELECT * FROM templates WHERE org_id = $1 ORDER BY name',
      [req.orgId]
    );
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/templates/active', optionalAuth, async (req, res) => {
  try {
    const template = await queryOne(
      'SELECT * FROM templates WHERE org_id = $1 AND is_active = 1',
      [req.orgId]
    );
    res.json(template || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROOMS ENDPOINTS
// ============================================

app.get('/api/rooms', optionalAuth, async (req, res) => {
  try {
    const rooms = await query(
      'SELECT * FROM rooms WHERE org_id = $1 ORDER BY name',
      [req.orgId]
    );
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STATS ENDPOINTS
// ============================================

app.get('/api/stats', optionalAuth, async (req, res) => {
  try {
    const totalFamilies = (await queryOne(
      'SELECT COUNT(*) as count FROM families WHERE org_id = $1',
      [req.orgId]
    )).count;

    const totalKids = (await queryOne(
      'SELECT COUNT(*) as count FROM children WHERE org_id = $1',
      [req.orgId]
    )).count;

    const totalCheckins = (await queryOne(
      'SELECT COUNT(*) as count FROM checkins WHERE org_id = $1',
      [req.orgId]
    )).count;

    const topStreaks = await query(
      `SELECT c.*, f.name as family_name 
       FROM children c 
       JOIN families f ON c.family_id = f.id 
       WHERE c.org_id = $1
       ORDER BY c.streak DESC 
       LIMIT 5`,
      [req.orgId]
    );

    res.json({
      totalFamilies: parseInt(totalFamilies),
      totalKids: parseInt(totalKids),
      totalCheckins: parseInt(totalCheckins),
      topStreaks: topStreaks.map(k => ({
        id: k.id,
        name: k.name,
        avatar: k.avatar,
        gender: k.gender,
        streak: k.streak,
        badges: k.badges,
        familyName: k.family_name
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SYNC ENDPOINTS (for Electron clients)
// ============================================

// Full data sync for offline support
app.get('/api/sync/full', authMiddleware, async (req, res) => {
  try {
    const families = await query('SELECT * FROM families WHERE org_id = $1', [req.orgId]);
    const children = await query('SELECT * FROM children WHERE org_id = $1', [req.orgId]);
    const templates = await query('SELECT * FROM templates WHERE org_id = $1', [req.orgId]);
    const rooms = await query('SELECT * FROM rooms WHERE org_id = $1', [req.orgId]);
    const rewards = await query('SELECT * FROM rewards WHERE org_id = $1', [req.orgId]);

    res.json({
      timestamp: new Date().toISOString(),
      data: { families, children, templates, rooms, rewards }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incremental sync (changes since timestamp)
app.get('/api/sync/since/:timestamp', authMiddleware, async (req, res) => {
  try {
    const since = req.params.timestamp;
    // For now, return full data - can optimize later with change tracking
    const families = await query('SELECT * FROM families WHERE org_id = $1', [req.orgId]);
    const children = await query('SELECT * FROM children WHERE org_id = $1', [req.orgId]);

    res.json({
      timestamp: new Date().toISOString(),
      data: { families, children }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// VOLUNTEERS ENDPOINTS
// ============================================

app.get('/api/volunteers', optionalAuth, async (req, res) => {
  try {
    const volunteerFamilies = await query(
      `SELECT * FROM families 
       WHERE org_id = $1 AND is_volunteer = 1
       ORDER BY name`,
      [req.orgId]
    );

    const result = await Promise.all(volunteerFamilies.map(async (family) => {
      const children = await query('SELECT * FROM children WHERE family_id = $1', [family.id]);
      const volunteer = children.find(c => c.notes === 'Volunteer') || children[0];
      
      return {
        id: family.id,
        name: family.name,
        phone: family.phone,
        email: family.email,
        volunteer: volunteer ? {
          id: volunteer.id,
          name: volunteer.name,
          pin: volunteer.pin
        } : null
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateAge(birthday) {
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

function generatePickupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// ============================================
// PRINT HELPER DOWNLOAD
// ============================================

app.get('/api/download/print-helper', (req, res) => {
  const printStationDir = path.join(__dirname, 'print-station');
  
  // Check if print-station directory exists
  if (!fs.existsSync(printStationDir)) {
    return res.status(404).json({ error: 'Print helper package not found on server' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="ChurchCheck-PrintHelper.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.status(500).end();
  });
  archive.pipe(res);

  // Add the core files
  const files = [
    'print-helper.cjs',
    'package.json',
    'Setup-Mac.command',
    'Start-Mac.command',
    'Setup-Windows.bat',
    'Start-Windows.bat'
  ];

  files.forEach(file => {
    const filePath = path.join(printStationDir, file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: `ChurchCheck-PrintHelper/${file}` });
    }
  });

  // Add only frame 000 of each avatar (all that's needed for label printing)
  const avatarDir = path.join(printStationDir, 'public', 'avatars');
  ['boy-ranger', 'girl-ranger'].forEach(folder => {
    const folderPath = path.join(avatarDir, folder);
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('-000.png'));
      files.forEach(file => {
        archive.file(path.join(folderPath, file), { 
          name: `ChurchCheck-PrintHelper/public/avatars/${folder}/${file}` 
        });
      });
    }
  });

  archive.finalize();
});

// ============================================
// FALLBACK TO SPA
// ============================================

app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 ChurchCheck Cloud API Server
═══════════════════════════════════════
📍 Running on http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🗄️  Database: PostgreSQL

📊 API Endpoints:
   - POST /api/auth/login
   - GET  /api/family/:phone
   - POST /api/checkin
   - GET  /api/sync/full
═══════════════════════════════════════
  `);
});

module.exports = app;

