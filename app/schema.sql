-- Madrasah Online: skema database (Cloudflare D1 / SQLite)
-- Jalankan: npx wrangler d1 execute madrasah-db --file=schema.sql (tambah --remote untuk database sebenar)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL UNIQUE,          -- format 60123456789
  email         TEXT,
  pin_hash      TEXT    NOT NULL,
  pin_salt      TEXT    NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER,                          -- epoch ms
  plan          TEXT,                             -- 'kad_bulanan' | 'fpx_bulanan' | 'fpx_tahunan'
  paid_until    INTEGER,                          -- epoch ms; akses aktif jika > sekarang
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  pass_hash     TEXT    NOT NULL,
  pass_salt     TEXT    NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER,
  created_at    INTEGER NOT NULL
);

-- Sesi login. Token disimpan sebagai hash SHA-256 supaya kebocoran DB tak dedahkan sesi.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT    PRIMARY KEY,
  kind        TEXT    NOT NULL,                   -- 'user' | 'admin'
  subject_id  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(kind, subject_id);

CREATE TABLE IF NOT EXISTS videos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  topic         TEXT    NOT NULL,                 -- 'Makhraj' | 'Tajwid' | 'Bacaan' | ...
  arabic_label  TEXT,
  bunny_id      TEXT,                             -- GUID video di Bunny Stream
  minutes       INTEGER NOT NULL DEFAULT 0,
  class_month   TEXT,                             -- contoh '2026-10'
  published     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_progress (
  user_id     INTEGER NOT NULL,
  video_id    INTEGER NOT NULL,
  seconds     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  zoom_url    TEXT,
  class_at    INTEGER,                            -- epoch ms, untuk butang Masuk Kelas
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  video_id    INTEGER,                            -- NULL = soalan umum
  body        TEXT    NOT NULL,
  answer      TEXT,
  answered_by INTEGER,
  answered_at INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_video ON questions(video_id);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,                          -- NULL untuk penderma tanpa akaun
  purpose       TEXT    NOT NULL,                 -- 'langganan' | 'sumbangan'
  plan          TEXT,
  amount_sen    INTEGER NOT NULL,
  provider      TEXT    NOT NULL DEFAULT 'hitpay',
  provider_ref  TEXT    UNIQUE,                   -- payment_request id / recurring billing id
  status        TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  donor_name    TEXT,
  donation_use  TEXT,                             -- 'taja' | 'umum'
  recurring     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  completed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- Had cubaan per IP untuk daftar/login (lindung daripada serangan teka PIN)
CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT    PRIMARY KEY,
  count       INTEGER NOT NULL,
  window_ends INTEGER NOT NULL
);

-- Kod set semula PIN melalui emel (satu kod aktif setiap pelajar)
CREATE TABLE IF NOT EXISTS pin_resets (
  user_id     INTEGER PRIMARY KEY,
  code_hash   TEXT    NOT NULL,
  tries       INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
