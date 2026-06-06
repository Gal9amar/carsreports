import { createClient } from '@libsql/client'

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      avatar_url TEXT,
      provider TEXT NOT NULL DEFAULT 'email',
      searches_done INTEGER NOT NULL DEFAULT 0,
      searches_quota INTEGER NOT NULL DEFAULT 10,
      quota_expires TEXT,
      referred_by TEXT,
      blocked INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_plate TEXT
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS codes (
      code TEXT PRIMARY KEY,
      searches INTEGER NOT NULL DEFAULT 0,
      unlimited INTEGER NOT NULL DEFAULT 0,
      single_use INTEGER NOT NULL DEFAULT 1,
      expires TEXT,
      used_by TEXT,
      used_at TEXT,
      created TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_codes (
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      PRIMARY KEY (user_id, code)
    );

    CREATE TABLE IF NOT EXISTS grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      searches INTEGER NOT NULL,
      note TEXT,
      granted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plate TEXT NOT NULL,
      searched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      searches INTEGER NOT NULL,
      price REAL NOT NULL,
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pending_payments (
      id TEXT PRIMARY KEY,
      ref TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      searches INTEGER NOT NULL,
      price REAL NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      full_name TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      sender_id TEXT NOT NULL,
      sender_name TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referee_id TEXT NOT NULL,
      bonus INTEGER NOT NULL DEFAULT 10,
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES
      ('maintenance', '0'),
      ('free_searches', '10'),
      ('referral_bonus', '10'),
      ('promo_searches', '0'),
      ('promo_start', ''),
      ('promo_end', ''),
      ('paypal_me', ''),
      ('admin_email', '');

    INSERT OR IGNORE INTO user_groups (id, name) VALUES
      ('subscribers', 'מנויים'),
      ('admins', 'מנהלים');

    INSERT OR IGNORE INTO packages (id, label, searches, price) VALUES
      ('pkg_50',  '🔍 50 חיפושים',   50,  10),
      ('pkg_100', '🔍 100 חיפושים', 100,  20),
      ('pkg_200', '🔍 200 חיפושים', 200,  30),
      ('pkg_sub', '♾️ מנוי חודשי',   -1,  25);
  `)
}
