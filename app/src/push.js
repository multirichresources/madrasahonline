// Notifikasi telefon (Web Push) tanpa servis luar berbayar.
//
// Reka bentuk: "ping tanpa muatan". Server hanya menghantar isyarat kosong kepada
// servis push (Google/Apple/Mozilla). Service worker di telefon kemudian mengambil
// mesej sebenar dari /api/push/inbox menggunakan sesi log masuk pelajar.
// Kelebihan: tiada penyulitan mesej (ringan untuk had CPU Cloudflare), dan mesej
// tidak pernah melalui servis pihak ketiga.
//
// Kunci VAPID dijana sendiri kali pertama digunakan dan disimpan dalam jadual settings,
// jadi tiada secret tambahan perlu ditetapkan.
import { now, json, fail, readJson, b64url, cleanText } from './util.js';
import { requireUser } from './auth.js';

const enc = new TextEncoder();
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
const MAX_SUBS_PER_USER = 10;
const BATCH = 40; // had subrequest pelan percuma = 50 setiap jemputan

function validEndpoint(env, endpoint) {
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (env.PUSH_ALLOW_HTTP === '1' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return true; // ujian tempatan sahaja
  if (u.protocol !== 'https:') return false;
  return PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
}

// ---------- kunci VAPID ----------
async function getVapid(env, origin) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first();
  if (row && row.value) return JSON.parse(row.value);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const v = {
    publicKey: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
    privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
    appUrl: origin || '',
  };
  // INSERT OR IGNORE: jika dua permintaan serentak, yang pertama menang
  await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('vapid', ?, ?)").bind(JSON.stringify(v), now()).run();
  const again = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first();
  return JSON.parse(again.value);
}

async function vapidSigner(env) {
  const v = await getVapid(env);
  const key = await crypto.subtle.importKey('jwk', v.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const email = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'contact_email'").first())?.value;
  const sub = email ? 'mailto:' + email : (v.appUrl || 'mailto:noreply@madrasah-online.app');
  const cache = new Map();
  return async (endpoint) => {
    const aud = new URL(endpoint).origin;
    if (!cache.has(aud)) {
      const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
      const body = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(now() / 1000) + 12 * 3600, sub })));
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
      cache.set(aud, `vapid t=${head}.${body}.${b64url(new Uint8Array(sig))}, k=${v.publicKey}`);
    }
    return cache.get(aud);
  };
}

// ---------- hantar ----------
// Sasaran: { kind: 'user', userId } | { kind: 'active' } (pelanggan aktif) | { kind: 'all' }
function audienceSql(target, t) {
  if (target.kind === 'user') return { where: 'u.id = ?', args: [target.userId] };
  if (target.kind === 'active') return { where: 'u.paid_until > ?', args: [t] };
  return { where: '1 = 1', args: [] };
}

// Simpan mesej dalam peti masuk setiap pelajar yang ada langganan notifikasi, dan baris gilir ping.
export async function notify(env, target, { title, body, url }) {
  const t = now();
  const a = audienceSql(target, t);
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO notifications (user_id, title, body, url, created_at)
      SELECT DISTINCT u.id, ?, ?, ?, ? FROM push_subs ps JOIN users u ON u.id = ps.user_id WHERE ${a.where}`)
      .bind(cleanText(title, 80), cleanText(body, 200), url || '/', t, ...a.args),
    env.DB.prepare(`INSERT OR IGNORE INTO push_jobs (sub_id, created_at)
      SELECT ps.id, ? FROM push_subs ps JOIN users u ON u.id = ps.user_id WHERE ${a.where}`)
      .bind(t, ...a.args),
  ]);
  return res[0].meta.changes || 0;
}

// Hantar ping kepada sebahagian baris gilir. Selebihnya diteruskan oleh cron setiap 5 minit.
export async function processJobs(env, limit = BATCH) {
  const { results } = await env.DB.prepare('SELECT j.sub_id, s.endpoint FROM push_jobs j JOIN push_subs s ON s.id = j.sub_id ORDER BY j.created_at LIMIT ?').bind(limit).all();
  if (!results.length) {
    await env.DB.prepare('DELETE FROM push_jobs WHERE sub_id NOT IN (SELECT id FROM push_subs)').run();
    return { sent: 0, failed: 0 };
  }
  const sign = await vapidSigner(env);
  let sent = 0, failed = 0;
  const gone = [], bad = [];
  await Promise.all(results.map(async (j) => {
    try {
      const r = await fetch(j.endpoint, {
        method: 'POST',
        headers: { TTL: '86400', Urgency: 'high', Authorization: await sign(j.endpoint), 'Content-Length': '0' },
      });
      if (r.status >= 200 && r.status < 300) sent++;
      else if (r.status === 404 || r.status === 410) { gone.push(j.sub_id); failed++; }
      else { bad.push(j.sub_id); failed++; console.warn('push', r.status, (await r.text()).slice(0, 200)); }
    } catch (e) { bad.push(j.sub_id); failed++; console.warn('push ralat', String(e)); }
  }));
  const ids = results.map(j => j.sub_id);
  const stmts = [env.DB.prepare(`DELETE FROM push_jobs WHERE sub_id IN (${ids.map(() => '?').join(',')})`).bind(...ids)];
  if (gone.length) stmts.push(env.DB.prepare(`DELETE FROM push_subs WHERE id IN (${gone.map(() => '?').join(',')})`).bind(...gone));
  if (bad.length) stmts.push(env.DB.prepare(`UPDATE push_subs SET fails = fails + 1 WHERE id IN (${bad.map(() => '?').join(',')})`).bind(...bad));
  stmts.push(env.DB.prepare('DELETE FROM push_subs WHERE fails >= 5'));
  const okIds = ids.filter(i => !gone.includes(i) && !bad.includes(i));
  if (okIds.length) stmts.push(env.DB.prepare(`UPDATE push_subs SET fails = 0 WHERE id IN (${okIds.map(() => '?').join(',')})`).bind(...okIds));
  await env.DB.batch(stmts);
  return { sent, failed };
}

// ---------- API pelajar ----------
export async function pushKey(env, request) {
  await requireUser(env, request);
  const v = await getVapid(env, new URL(request.url).origin);
  return json({ ok: true, publicKey: v.publicKey });
}

export async function pushSubscribe(env, request) {
  const u = await requireUser(env, request);
  const b = await readJson(request);
  const endpoint = String(b.endpoint || '');
  if (endpoint.length > 1000 || !validEndpoint(env, endpoint)) return fail(400, 'Langganan notifikasi tidak sah.');
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO push_subs (user_id, endpoint, fails, created_at) VALUES (?, ?, 0, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, fails = 0')
      .bind(u.id, endpoint, t),
    // Simpan paling banyak 10 peranti setiap pelajar
    env.DB.prepare(`DELETE FROM push_subs WHERE user_id = ? AND id NOT IN (SELECT id FROM push_subs WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MAX_SUBS_PER_USER})`).bind(u.id, u.id),
  ]);
  const last = await env.DB.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM notifications WHERE user_id = ?').bind(u.id).first();
  return json({ ok: true, latestId: last.id });
}

export async function pushUnsubscribe(env, request) {
  const u = await requireUser(env, request);
  const b = await readJson(request);
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(b.endpoint || ''), u.id).run();
  return json({ ok: true });
}

export async function pushTest(env, request) {
  const u = await requireUser(env, request);
  const n = await notify(env, { kind: 'user', userId: u.id }, { title: 'Peringatan sudah aktif', body: 'Alhamdulillah. Anda akan menerima peringatan kelas di telefon ini.', url: '/' });
  if (!n) return fail(400, 'Telefon ini belum dihidupkan untuk notifikasi.');
  const r = await processJobs(env, 10);
  return json({ ok: true, ...r });
}

// Dipanggil oleh service worker bila menerima ping.
export async function pushInbox(env, request) {
  const u = await requireUser(env, request);
  const since = Math.max(0, Number(new URL(request.url).searchParams.get('since')) || 0);
  const t = now();
  const sql = since
    ? 'SELECT id, title, body, url FROM notifications WHERE user_id = ? AND id > ? AND created_at > ? ORDER BY id ASC LIMIT 5'
    : 'SELECT id, title, body, url FROM notifications WHERE user_id = ? AND id > ? AND created_at > ? ORDER BY id DESC LIMIT 1';
  const { results } = await env.DB.prepare(sql).bind(u.id, since, t - 3 * 864e5).all();
  return json({ ok: true, items: results });
}

// ---------- peringatan kelas automatik (cron) ----------
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BLN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
// Waktu Malaysia (UTC+8) tanpa bergantung pada zon masa pelayan
function myTime(ms) {
  const d = new Date(ms + 8 * 3600e3), h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
  const part = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam';
  return { day: HARI[d.getUTCDay()], date: `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}`, time: `${h % 12 || 12}.${m} ${part}` };
}
export const classWhen = ms => { const w = myTime(ms); return `${w.day}, ${w.date} · ${w.time}`; };

export async function sendClassReminders(env) {
  const t = now();
  const soon = await env.DB.prepare('SELECT * FROM announcements WHERE class_at IS NOT NULL AND reminded_soon = 0 AND class_at > ? AND class_at <= ?')
    .bind(t - 10 * 60e3, t + 35 * 60e3).all();
  for (const a of soon.results) {
    await env.DB.prepare('UPDATE announcements SET reminded_soon = 1, reminded_day = 1 WHERE id = ?').bind(a.id).run();
    const w = myTime(a.class_at);
    await notify(env, { kind: a.members_only ? 'active' : 'all' }, {
      title: 'Kelas bermula sekejap lagi',
      body: `${a.title}, ${w.time}. Tekan untuk buka app dan Masuk Kelas.`,
      url: '/',
    });
  }
  const day = await env.DB.prepare('SELECT * FROM announcements WHERE class_at IS NOT NULL AND reminded_day = 0 AND class_at > ? AND class_at <= ?')
    .bind(t + 2 * 3600e3, t + 24 * 3600e3).all();
  for (const a of day.results) {
    await env.DB.prepare('UPDATE announcements SET reminded_day = 1 WHERE id = ?').bind(a.id).run();
    const w = myTime(a.class_at);
    await notify(env, { kind: a.members_only ? 'active' : 'all' }, {
      title: `Peringatan kelas: ${a.title}`,
      body: `${w.day}, ${w.date}, ${w.time}. Butang Masuk Kelas dibuka 30 minit sebelum kelas.`,
      url: '/',
    });
  }
  return soon.results.length + day.results.length;
}
