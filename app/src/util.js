// Fungsi bantu: respons JSON, kripto, nombor telefon, had cubaan.

export const now = () => Date.now();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const fail = (status, message, extra = {}) => json({ ok: false, error: message, ...extra }, status);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Format permintaan tidak sah.');
  try { return await request.json(); } catch { throw new HttpError(400, 'Data permintaan tidak sah.'); }
}

// ---------- kripto ----------
const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2-SHA256. Bilangan pusingan sederhana supaya muat had CPU pelan percuma Cloudflare;
// keselamatan PIN 6 angka bergantung pada had cubaan + kunci akaun, bukan pusingan hash.
export async function hashSecret(secret, saltB64, iterations) {
  const salt = Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return b64url(new Uint8Array(bits));
}

export const newSalt = () => b64url(crypto.getRandomValues(new Uint8Array(16)));

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- input ----------
// Terima "012-345 6789", "+6012 3456789", "60123456789" → "60123456789"
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '6' + d;
  if (!/^601\d{8,9}$/.test(d)) return null;
  return d;
}

export function displayPhone(p) {
  const local = '0' + p.slice(2);
  return local.slice(0, 3) + '-' + local.slice(3, local.length - 4) + ' ' + local.slice(-4);
}

export function checkPin(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) return 'PIN mesti 6 angka.';
  const p = String(pin);
  if (/^(\d)\1{5}$/.test(p)) return 'PIN terlalu mudah diteka. Elakkan nombor yang sama berulang.';
  if ('0123456789'.includes(p) || '9876543210'.includes(p)) return 'PIN terlalu mudah diteka. Elakkan nombor berturutan.';
  return null;
}

export function cleanText(v, max) {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function validEmail(e) {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
}

// ---------- had cubaan ----------
// Kira cubaan dalam tetingkap masa; pulangkan true jika masih dibenarkan.
export async function rateLimit(db, key, max, windowMs) {
  const t = now();
  const row = await db.prepare('SELECT count, window_ends FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || row.window_ends < t) {
    await db.prepare('INSERT INTO rate_limits (key, count, window_ends) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_ends = excluded.window_ends')
      .bind(key, t + windowMs).run();
    return true;
  }
  if (row.count >= max) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'local';
