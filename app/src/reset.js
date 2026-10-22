// Lupa PIN melalui kod emel, dan kemas kini emel pelajar.
import { now, json, fail, readJson, sha256Hex, hashSecret, newSalt, safeEqual, normalizePhone, checkPin, cleanText, validEmail, rateLimit, clientIp, hashIter, LEGACY_ITER } from './util.js';
import { mailReady, sendMail, resetCodeEmail } from './mail.js';
import { requireUser } from './auth.js';
import { getOrg } from './content.js';

const CODE_TTL = 15 * 60 * 1000;
const MAX_CODE_TRIES = 5;
const iterations = hashIter;

function sixDigits() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
}

// Sembunyikan sebahagian emel: rohana@gmail.com → ro****@gmail.com
function maskEmail(e) {
  const [u, d] = e.split('@');
  return u.slice(0, 2) + '****@' + d;
}

export async function publicConfig(env) {
  const o = await getOrg(env);
  // Hanya maklumat hubungan awam; dipaparkan di skrin Lupa PIN dan halaman polisi
  return json({ ok: true, emailReset: mailReady(env), org: { name: o.name, email: o.email, whatsapp: o.whatsapp } });
}

// Langkah 1: minta kod. Jawapan sentiasa sama sama ada akaun wujud atau tidak,
// supaya orang luar tak boleh guna borang ini untuk semak no. telefon siapa berdaftar.
export async function forgotPin(env, request) {
  if (!mailReady(env)) return fail(503, 'Set semula PIN melalui emel belum dibuka. Sila hubungi admin.');
  if (!(await rateLimit(env.DB, 'forgot:' + clientIp(request), 60, 3600 * 1000)))
    return fail(429, 'Terlalu banyak permintaan. Cuba lagi dalam sejam.');
  const body = await readJson(request);
  const phone = normalizePhone(body.phone);
  if (!phone) return fail(400, 'No. telefon tidak sah. Contoh: 012-345 6789.');
  const generic = { ok: true, message: 'Jika no. telefon ini berdaftar dengan emel, kod 6 angka telah dihantar ke emel tersebut. Semak juga folder Spam.' };

  const u = await env.DB.prepare('SELECT id, name, email FROM users WHERE phone = ?').bind(phone).first();
  if (!u || !u.email) return json(generic);
  if (!(await rateLimit(env.DB, 'forgot-user:' + u.id, 3, 3600 * 1000))) return json(generic);

  const code = sixDigits();
  const t = now();
  await env.DB.prepare('INSERT INTO pin_resets (user_id, code_hash, tries, expires_at, created_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, tries = 0, expires_at = excluded.expires_at, created_at = excluded.created_at')
    .bind(u.id, await sha256Hex(u.id + ':' + code), t + CODE_TTL, t).run();
  try {
    await sendMail(env, { to: u.email, ...resetCodeEmail(u.name, code) });
  } catch (err) {
    console.error('emel gagal', err);
    return fail(502, 'Emel tidak dapat dihantar sekarang. Cuba lagi sebentar, atau hubungi admin.');
  }
  return json({ ...generic, hint: maskEmail(u.email) });
}

// Langkah 2: masukkan kod + PIN baharu.
export async function resetPin(env, request) {
  if (!(await rateLimit(env.DB, 'reset:' + clientIp(request), 200, 3600 * 1000)))
    return fail(429, 'Terlalu banyak cubaan. Cuba lagi dalam sejam.');
  const body = await readJson(request);
  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').trim();
  const wrong = 'Kod salah atau sudah tamat tempoh. Minta kod baharu.';
  if (!phone || !/^\d{6}$/.test(code)) return fail(400, 'Masukkan no. telefon dan kod 6 angka.');
  const pinErr = checkPin(body.pin);
  if (pinErr) return fail(400, pinErr);

  const u = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
  if (!u) return fail(400, wrong);
  const r = await env.DB.prepare('SELECT code_hash, tries, expires_at FROM pin_resets WHERE user_id = ?').bind(u.id).first();
  if (!r || r.expires_at < now() || r.tries >= MAX_CODE_TRIES) return fail(400, wrong);
  if (!safeEqual(await sha256Hex(u.id + ':' + code), r.code_hash)) {
    await env.DB.prepare('UPDATE pin_resets SET tries = tries + 1 WHERE user_id = ?').bind(u.id).run();
    return fail(400, wrong);
  }
  const salt = newSalt();
  const hash = await hashSecret(String(body.pin), salt, iterations(env));
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iter = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').bind(hash, salt, iterations(env), u.id),
    env.DB.prepare('DELETE FROM pin_resets WHERE user_id = ?').bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").bind(u.id),
  ]);
  return json({ ok: true });
}

// Pelajar tambah / tukar emel (perlu PIN).
export async function updateEmail(env, request) {
  const u = await requireUser(env, request);
  const body = await readJson(request);
  const ok = await hashSecret(String(body.pin || ''), u.pin_salt, u.pin_iter || LEGACY_ITER);
  if (!safeEqual(ok, u.pin_hash)) return fail(401, 'PIN salah.');
  const email = cleanText(body.email, 254).toLowerCase();
  if (!validEmail(email)) return fail(400, 'Alamat emel tidak sah.');
  await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, u.id).run();
  return json({ ok: true, email });
}
