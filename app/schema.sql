-- Madrasah Online: skema database (Cloudflare D1 / SQLite)
-- Jalankan: npx wrangler d1 execute madrasah-db --file=schema.sql (tambah --remote untuk database sebenar)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL UNIQUE,          -- format 60123456789
  email         TEXT,
  pin_hash      TEXT    NOT NULL,
  pin_salt      TEXT    NOT NULL,
  pin_iter      INTEGER,                          -- pusingan PBKDF2 hash ini (NULL = 10000)
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER,                          -- epoch ms
  plan          TEXT,                             -- 'kad_bulanan' | 'fpx_bulanan' | 'fpx_tahunan'
  paid_until    INTEGER,                          -- epoch ms; akses aktif jika > sekarang
  auto_renew    INTEGER NOT NULL DEFAULT 0,       -- 1 = caj kad automatik bila tamat
  chip_token    TEXT,                             -- id Purchase CHIP yang menyimpan token kad
  renew_fails   INTEGER NOT NULL DEFAULT 0,
  renew_attempt_at INTEGER,
  lang          TEXT,                             -- 'ms' | 'en' (bahasa notifikasi)
  solat_zone    TEXT,                             -- zon JAKIM, cth. WLY01
  azan          TEXT,                             -- waktu yang mahu dinotifikasi, cth. 'fajr,dhuhr,asr,maghrib,isha'
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  pass_hash     TEXT    NOT NULL,
  pass_salt     TEXT    NOT NULL,
  pass_iter     INTEGER,                          -- pusingan PBKDF2 hash ini (NULL = 10000)
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
  bunny_status  INTEGER NOT NULL DEFAULT 0,       -- 4 = sedia ditonton (status Bunny)
  encode_progress INTEGER NOT NULL DEFAULT 0,
  thumb_url     TEXT,                             -- gambar kecil dari Bunny
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
  members_only INTEGER NOT NULL DEFAULT 0,        -- 1 = pautan Zoom untuk pelajar yang melanggan sahaja
  reminded_day  INTEGER NOT NULL DEFAULT 0,       -- peringatan sehari sebelum sudah dihantar
  reminded_soon INTEGER NOT NULL DEFAULT 0,       -- peringatan 30 minit sebelum sudah dihantar
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_class ON announcements(class_at);

-- Tetapan umum (maklumat pengendali untuk halaman polisi, no. WhatsApp admin, dll.)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT    PRIMARY KEY,
  value       TEXT,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  video_id    INTEGER,                            -- NULL = soalan umum
  body        TEXT    NOT NULL,
  answer      TEXT,
  answered_by INTEGER,
  answered_at INTEGER,
  hidden      INTEGER NOT NULL DEFAULT 0,         -- 1 = disembunyikan oleh admin
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_video ON questions(video_id);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,                          -- NULL untuk penderma tanpa akaun
  purpose       TEXT    NOT NULL,                 -- 'langganan' | 'sumbangan'
  plan          TEXT,
  months        INTEGER,                          -- tempoh langganan yang dibeli
  amount_sen    INTEGER NOT NULL,
  provider      TEXT    NOT NULL DEFAULT 'hitpay',
  provider_ref  TEXT    UNIQUE,                   -- payment_request id / recurring billing id
  status        TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'semak' (jumlah tak sepadan)
  donor_name    TEXT,
  donation_use  TEXT,                             -- 'taja' | 'umum'
  donor_email   TEXT,
  donor_phone   TEXT,
  anonymous     INTEGER NOT NULL DEFAULT 0,       -- 1 = papar sebagai "Hamba Allah"
  message       TEXT,                             -- mesej / doa penyumbang
  donor_id      INTEGER,                          -- penyumbang bulanan (jadual donors)
  access_hash   TEXT,                             -- token halaman terima kasih (penyumbang tiada login)
  recurring     INTEGER NOT NULL DEFAULT 0,         -- 0 sekali bayar, 1 daftar auto-renew, 2 caj auto-renew
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

-- Notifikasi telefon (Web Push). Satu baris setiap peranti yang dihidupkan.
CREATE TABLE IF NOT EXISTS push_subs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  endpoint    TEXT    NOT NULL UNIQUE,
  fails       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subs(user_id);

-- Peti masuk notifikasi; service worker ambil dari sini bila menerima ping.
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  url         TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);

-- Baris gilir ping (satu baris setiap peranti yang perlu dikejutkan)
CREATE TABLE IF NOT EXISTS push_jobs (
  sub_id      INTEGER PRIMARY KEY,
  created_at  INTEGER NOT NULL
);

-- Penyumbang bulanan (kad, auto). Tiada akaun; urus melalui pautan rahsia /sumbang?urus=TOKEN.
CREATE TABLE IF NOT EXISTS donors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT,
  email          TEXT    NOT NULL,
  phone          TEXT,
  anonymous      INTEGER NOT NULL DEFAULT 0,
  donation_use   TEXT    NOT NULL,                -- 'taja' | 'umum'
  amount_sen     INTEGER NOT NULL,
  active         INTEGER NOT NULL DEFAULT 0,      -- 1 selepas bayaran pertama berjaya
  chip_token     TEXT,
  next_charge_at INTEGER,
  attempt_at     INTEGER,
  fails          INTEGER NOT NULL DEFAULT 0,
  manage_hash    TEXT    NOT NULL,
  stopped_at     INTEGER,
  created_at     INTEGER NOT NULL
);

-- Penggunaan dana taja: langganan pelajar yang ditaja oleh admin
CREATE TABLE IF NOT EXISTS sponsorships (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  months      INTEGER NOT NULL,
  amount_sen  INTEGER NOT NULL,
  admin_id    INTEGER,
  note        TEXT,
  created_at  INTEGER NOT NULL
);

-- Waktu solat JAKIM (disimpan sebulan setiap kali ambil). Masa dalam epoch ms.
CREATE TABLE IF NOT EXISTS prayer_times (
  zone        TEXT    NOT NULL,
  date        TEXT    NOT NULL,                   -- YYYY-MM-DD (waktu Malaysia)
  hijri       TEXT,
  imsak       INTEGER,
  fajr        INTEGER NOT NULL,
  syuruk      INTEGER,
  dhuhr       INTEGER NOT NULL,
  asr         INTEGER NOT NULL,
  maghrib     INTEGER NOT NULL,
  isha        INTEGER NOT NULL,
  source      TEXT,                               -- 'jakim' | 'waktusolat'
  fetched_at  INTEGER NOT NULL,
  PRIMARY KEY (zone, date)
);

-- Elak notifikasi azan berganda
CREATE TABLE IF NOT EXISTS azan_sent (
  zone     TEXT NOT NULL,
  date     TEXT NOT NULL,
  prayer   TEXT NOT NULL,
  sent_at  INTEGER NOT NULL,
  PRIMARY KEY (zone, date, prayer)
);

-- Log aktiviti admin: siapa buat apa, bila (disimpan 1 tahun)
CREATE TABLE IF NOT EXISTS admin_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  admin_name  TEXT,
  method      TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  action      TEXT    NOT NULL,                   -- huraian, cth. 'Ubah langganan pelajar'
  target      TEXT,                               -- cth. nama pelajar / tajuk video
  detail      TEXT,                               -- isi permintaan (kata laluan / PIN dibuang)
  status      INTEGER NOT NULL,                   -- kod HTTP jawapan (401 = login admin gagal)
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_log_time ON admin_log(created_at);
