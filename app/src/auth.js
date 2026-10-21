// Daftar, login PIN, sesi dan login admin.
import {
  now, json, fail, HttpError, readJson, randomToken, sha256Hex, hashSecret, newSalt, safeEqual,
  normalizePhone, displayPhone, checkPin, cleanText, validEmail, rateLimit, clientIp,
} from './util.js';

const USER_COOKIE = 'mo_sess';
const ADMIN_COOKIE = 'mo_admin';
const USER_SESSION_MS = 90 * 24 * 3600 * 1000;   // pelajar kekal login 90 hari
const ADMIN_SESSION_MS = 12 * 3600 * 1000;       // admin 12 jam
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const iterations = (env) => Number(env.HASH_ITERATIONS || 10000);

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function cookie(name, value, maxAgeMs, secure) {
  const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

const isSecure = (request) => new URL(request.url).protocol === 'https:';

async function createSession(env, request, kind, subjectId) {
  const token = randomToken();
  const ttl = kind === 'admin' ? ADMIN_SESSION_MS : USER_SESSION_MS;
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, kind, subject_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), kind, subjectId, t + ttl, t).run();
  return cookie(kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE, token, ttl, isSecure(request));
}

async function sessionSubject(env, request, kind) {
  const token = readCookie(request, kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare('SELECT subject_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?')
    .bind(await sha256Hex(token), kind).first();
  if (!row || row.expires_at < now()) return null;
  return row.subject_id;
}

export function publicUser(u) {
  const t = now();
  return {
    id: u.id,
    name: u.name,
    phone: displayPhone(u.phone),
    email: u.email || null,
    plan: u.plan || null,
    paidUntil: u.paid_until || null,
    active: !!(u.paid_until && u.paid_until > t),
  };
}

export async function requireUser(env, request) {
  const id = await sessionSubject(env, request, 'user');
  if (!id) throw new HttpError(401, 'Sila log masuk dahulu.');
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u) throw new HttpError(401, 'Sila log masuk dahulu.');
  return u;
}

export async function requireAdmin(env, request) {
  const id = await sessionSubject(env, request, 'admin');
  if (!id) throw new HttpError(401, 'Sila log masuk sebagai admin.');
  const a = await env.DB.prepare('SELECT id, email, name FROM admins WHERE id = ?').bind(id).first();
  if (!a) throw new HttpError(401, 'Sila log masuk sebagai admin.');
  return a;
}

// ---------- pelajar ----------
export async function register(env, request) {
  if (!(await rateLimit(env.DB, 'reg:' + clientIp(request), 10, 3600 * 1000)))
    return fail(429, 'Terlalu banyak cubaan. Cuba lagi dalam sejam.');
  const body = await readJson(request);
  const name = cleanText(body.name, 80);
  const phone = normalizePhone(body.phone);
  const email = cleanText(body.email, 254).toLowerCase();
  if (name.length < 2) return fail(400, 'Sila isi nama penuh.');
  if (!phone) return fail(400, 'No. telefon tidak sah. Contoh: 012-345 6789.');
  if (!email) return fail(400, 'Sila isi alamat emel. Ia digunakan untuk set semula PIN jika terlupa.');
  if (!validEmail(email)) return fail(400, 'Alamat emel tidak sah.');
  const pinErr = checkPin(body.pin);
  if (pinErr) return fail(400, pinErr);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
  if (exists) return fail(409, 'No. telefon ini sudah berdaftar. Sila log masuk.');

  const salt = newSalt();
  const hash = await hashSecret(String(body.pin), salt, iterations(env));
  const res = await env.DB.prepare('INSERT INTO users (name, phone, email, pin_hash, pin_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, phone, email || null, hash, salt, now()).run();
  const id = res.meta.last_row_id;
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  const setCookie = await createSession(env, request, 'user', id);
  return json({ ok: true, user: publicUser(user) }, 201, { 'set-cookie': setCookie });
}

export async function login(env, request) {
  if (!(await rateLimit(env.DB, 'login:' + clientIp(request), 20, 15 * 60 * 1000)))
    return fail(429, 'Terlalu banyak cubaan. Cuba lagi dalam 15 minit.');
  const body = await readJson(request);
  const phone = normalizePhone(body.phone);
  const pin = String(body.pin || '');
  if (!phone || !/^\d{6}$/.test(pin)) return fail(400, 'Masukkan no. telefon dan PIN 6 angka.');

  const u = await env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  const generic = 'No. telefon atau PIN salah.';
  if (!u) return fail(401, generic);
  const t = now();
  if (u.locked_until && u.locked_until > t) {
    const mins = Math.ceil((u.locked_until - t) / 60000);
    return fail(423, `Akaun dikunci sementara kerana PIN salah berulang kali. Cuba lagi dalam ${mins} minit, atau hubungi admin.`);
  }
  const hash = await hashSecret(pin, u.pin_salt, iterations(env));
  if (!safeEqual(hash, u.pin_hash)) {
    const fails = u.failed_logins + 1;
    const lock = fails >= MAX_FAILS ? t + LOCK_MS : null;
    await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .bind(lock ? 0 : fails, lock, u.id).run();
    if (lock) return fail(423, 'PIN salah 5 kali. Akaun dikunci 15 minit.');
    return fail(401, `${generic} Baki cubaan: ${MAX_FAILS - fails}.`);
  }
  await env.DB.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').bind(u.id).run();
  const setCookie = await createSession(env, request, 'user', u.id);
  return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': setCookie });
}

export async function logout(env, request, kind) {
  const name = kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
  const token = readCookie(request, name);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookie(name, '', 0, isSecure(request)) });
}

export async function me(env, request) {
  const u = await requireUser(env, request);
  return json({ ok: true, user: publicUser(u) });
}

// ---------- admin ----------
export async function adminLogin(env, request) {
  if (!(await rateLimit(env.DB, 'alogin:' + clientIp(request), 10, 15 * 60 * 1000)))
    return fail(429, 'Terlalu banyak cubaan. Cuba lagi dalam 15 minit.');
  const body = await readJson(request);
  const email = cleanText(body.email, 254).toLowerCase();
  const password = String(body.password || '');
  const a = await env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first();
  const generic = 'Emel atau kata laluan salah.';
  if (!a) return fail(401, generic);
  const t = now();
  if (a.locked_until && a.locked_until > t) return fail(423, 'Akaun admin dikunci sementara. Cuba lagi dalam 15 minit.');
  const hash = await hashSecret(password, a.pass_salt, iterations(env));
  if (!safeEqual(hash, a.pass_hash)) {
    const fails = a.failed_logins + 1;
    const lock = fails >= MAX_FAILS ? t + LOCK_MS : null;
    await env.DB.prepare('UPDATE admins SET failed_logins = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock, a.id).run();
    return fail(401, generic);
  }
  await env.DB.prepare('UPDATE admins SET failed_logins = 0, locked_until = NULL WHERE id = ?').bind(a.id).run();
  const setCookie = await createSession(env, request, 'admin', a.id);
  return json({ ok: true, admin: { id: a.id, email: a.email, name: a.name } }, 200, { 'set-cookie': setCookie });
}

export async function adminMe(env, request) {
  const a = await requireAdmin(env, request);
  return json({ ok: true, admin: a });
}

// Cipta akaun admin. Pertama kali: guna header X-Setup-Key = SETUP_KEY (rahsia Cloudflare).
// Selepas itu: hanya admin yang sudah login boleh tambah admin lain.
export async function createAdmin(env, request) {
  const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first()).n;
  if (count === 0) {
    // Mesej terperinci hanya wujud sebelum admin pertama dicipta, untuk bantu persediaan.
    const key = (request.headers.get('x-setup-key') || '').trim();
    const expected = String(env.SETUP_KEY || '').trim();
    if (!expected) return fail(403, 'SETUP_KEY belum ditetapkan di Cloudflare. Tambah sebagai Secret dalam Settings → Variables and Secrets.');
    if (expected.length < 16) return fail(403, 'SETUP_KEY di Cloudflare terlalu pendek. Tetapkan semula dengan sekurang-kurangnya 16 aksara.');
    if (!safeEqual(key, expected)) return fail(403, 'Kunci setup tidak sama dengan SETUP_KEY di Cloudflare.');
  } else {
    await requireAdmin(env, request);
  }
  const body = await readJson(request);
  const email = cleanText(body.email, 254).toLowerCase();
  const name = cleanText(body.name, 80);
  const password = String(body.password || '');
  if (!validEmail(email)) return fail(400, 'Alamat emel tidak sah.');
  if (name.length < 2) return fail(400, 'Sila isi nama admin.');
  if (password.length < 10) return fail(400, 'Kata laluan admin mesti sekurang-kurangnya 10 aksara.');
  const salt = newSalt();
  const hash = await hashSecret(password, salt, iterations(env));
  try {
    await env.DB.prepare('INSERT INTO admins (email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(email, name, hash, salt, now()).run();
  } catch {
    return fail(409, 'Emel admin ini sudah wujud.');
  }
  return json({ ok: true }, 201);
}

// Lupa PIN (versi 1): admin tetapkan PIN sementara, pelajar diberitahu melalui WhatsApp.
export async function adminResetPin(env, request, userId) {
  await requireAdmin(env, request);
  const body = await readJson(request);
  const pinErr = checkPin(body.pin);
  if (pinErr) return fail(400, pinErr);
  const salt = newSalt();
  const hash = await hashSecret(String(body.pin), salt, iterations(env));
  const r = await env.DB.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ?')
    .bind(hash, salt, userId).run();
  if (!r.meta.changes) return fail(404, 'Pelajar tidak dijumpai.');
  await env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").bind(userId).run();
  return json({ ok: true });
}

// Pelajar tukar PIN sendiri selepas login.
export async function changePin(env, request) {
  const u = await requireUser(env, request);
  const body = await readJson(request);
  const oldHash = await hashSecret(String(body.oldPin || ''), u.pin_salt, iterations(env));
  if (!safeEqual(oldHash, u.pin_hash)) return fail(401, 'PIN lama salah.');
  const pinErr = checkPin(body.newPin);
  if (pinErr) return fail(400, pinErr);
  const salt = newSalt();
  const hash = await hashSecret(String(body.newPin), salt, iterations(env));
  await env.DB.prepare('UPDATE users SET pin_hash = ?, pin_salt = ? WHERE id = ?').bind(hash, salt, u.id).run();
  return json({ ok: true });
}

// Panel admin: adakah admin pertama perlu dicipta?
export async function setupStatus(env) {
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first()).n;
  return json({ ok: true, needsSetup: n === 0 });
}

// Pelajar padam akaun sendiri (syarat Play Store / App Store). Sahkan dengan PIN.
export async function deleteAccount(env, request) {
  const u = await requireUser(env, request);
  const body = await readJson(request);
  const hash = await hashSecret(String(body.pin || ''), u.pin_salt, iterations(env));
  if (!safeEqual(hash, u.pin_hash)) return fail(401, 'PIN salah. Akaun tidak dipadam.');
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").bind(u.id),
    env.DB.prepare('DELETE FROM watch_progress WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM questions WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM push_jobs WHERE sub_id IN (SELECT id FROM push_subs WHERE user_id = ?)').bind(u.id),
    env.DB.prepare('DELETE FROM push_subs WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(u.id),
    // Rekod bayaran disimpan untuk akaun kewangan, tetapi tidak lagi dikaitkan dengan pelajar.
    env.DB.prepare('UPDATE payments SET user_id = NULL WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': cookie(USER_COOKIE, '', 0, isSecure(request)) });
}

// Admin tukar kata laluan sendiri.
export async function adminChangePassword(env, request) {
  const a = await requireAdmin(env, request);
  const row = await env.DB.prepare('SELECT pass_hash, pass_salt FROM admins WHERE id = ?').bind(a.id).first();
  const body = await readJson(request);
  const oldHash = await hashSecret(String(body.oldPassword || ''), row.pass_salt, iterations(env));
  if (!safeEqual(oldHash, row.pass_hash)) return fail(401, 'Kata laluan lama salah.');
  const pw = String(body.newPassword || '');
  if (pw.length < 10) return fail(400, 'Kata laluan baharu mesti sekurang-kurangnya 10 aksara.');
  const salt = newSalt();
  const hash = await hashSecret(pw, salt, iterations(env));
  await env.DB.prepare('UPDATE admins SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(hash, salt, a.id).run();
  return json({ ok: true });
}
