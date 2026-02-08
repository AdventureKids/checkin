-- ChurchCheck PostgreSQL Schema
-- Multi-tenant cloud database

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    logo_url TEXT,
    subscription_status TEXT DEFAULT 'trial',
    subscription_plan TEXT DEFAULT 'basic',
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users (organization admins)
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, username)
);

-- Families
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    parent_name TEXT,
    address TEXT,
    is_volunteer INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, phone)
);

-- Children (includes volunteers as child records with notes='Volunteer')
CREATE TABLE IF NOT EXISTS children (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    name TEXT NOT NULL,
    age INTEGER,
    birthday TEXT,
    gender TEXT,
    pin TEXT,
    avatar TEXT DEFAULT 'explorer',
    streak INTEGER DEFAULT 0,
    badges INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    allergies TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, pin)
);

-- Check-in templates (services/events)
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    day_of_week TEXT,
    start_time TEXT,
    end_time TEXT,
    checkout_enabled INTEGER DEFAULT 0,
    room_ids TEXT,
    is_active INTEGER DEFAULT 0,
    streak_reset_days INTEGER DEFAULT 7,
    track_streaks INTEGER DEFAULT 1,
    print_volunteer_badges INTEGER DEFAULT 1,
    label_settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age_range TEXT,
    capacity INTEGER
);

-- Check-ins
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES templates(id),
    room TEXT,
    pickup_code TEXT,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMP
);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'milestone',
    trigger_type TEXT NOT NULL DEFAULT 'checkin_count',
    trigger_value INTEGER NOT NULL DEFAULT 1,
    prize TEXT,
    icon TEXT DEFAULT '🎁',
    enabled INTEGER DEFAULT 1,
    is_preset INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Earned rewards
CREATE TABLE IF NOT EXISTS earned_rewards (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prize_claimed INTEGER DEFAULT 0
);

-- Avatar rewards
CREATE TABLE IF NOT EXISTS avatar_rewards (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    accessory_type TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'checkin_count',
    trigger_value INTEGER NOT NULL DEFAULT 1,
    icon TEXT DEFAULT '🎁',
    enabled INTEGER DEFAULT 1,
    is_preset INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Child accessories (unlocked avatar items)
CREATE TABLE IF NOT EXISTS child_accessories (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    accessory_type TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_equipped INTEGER DEFAULT 0,
    UNIQUE(child_id, accessory_type, accessory_id)
);

-- Child template streaks (per-service streaks)
CREATE TABLE IF NOT EXISTS child_template_streaks (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    streak INTEGER DEFAULT 0,
    last_checkin_date TEXT,
    UNIQUE(child_id, template_id)
);

-- Pending rewards (assigned but not yet awarded)
CREATE TABLE IF NOT EXISTS pending_rewards (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL DEFAULT 'accessory',
    reward_id INTEGER,
    accessory_type TEXT,
    accessory_id TEXT,
    custom_name TEXT,
    custom_description TEXT,
    custom_icon TEXT DEFAULT '🎁',
    assigned_by TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    awarded_at TIMESTAMP
);

-- Custom fields
CREATE TABLE IF NOT EXISTS custom_fields (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, entity_type, field_name)
);

-- Custom field values
CREATE TABLE IF NOT EXISTS custom_field_values (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    UNIQUE(entity_type, entity_id, field_id)
);

-- Volunteer compliance tracking
CREATE TABLE IF NOT EXISTS volunteer_compliance (
    id SERIAL PRIMARY KEY,
    volunteer_id INTEGER NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
    livescan_completed INTEGER DEFAULT 0,
    livescan_date TEXT,
    mandatory_reporting_completed INTEGER DEFAULT 0,
    mandatory_reporting_date TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer details
CREATE TABLE IF NOT EXISTS volunteer_details (
    id SERIAL PRIMARY KEY,
    volunteer_id INTEGER NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    dob TEXT,
    service_area TEXT,
    serving_frequency TEXT,
    start_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_families_org ON families(org_id);
CREATE INDEX IF NOT EXISTS idx_families_phone ON families(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_children_org ON children(org_id);
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_children_pin ON children(org_id, pin);
CREATE INDEX IF NOT EXISTS idx_checkins_org ON checkins(org_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_checkins_child ON checkins(child_id);
CREATE INDEX IF NOT EXISTS idx_templates_org ON templates(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_org ON admin_users(org_id);

-- Insert default organization for migration
INSERT INTO organizations (name, slug, email) 
VALUES ('Default Organization', 'default', 'admin@example.com')
ON CONFLICT (slug) DO NOTHING;

