// Video kelas: Bunny Stream.
// Konfigurasi: var BUNNY_LIBRARY_ID, secret BUNNY_API_KEY (API key library), secret BUNNY_TOKEN_KEY (Token authentication key).
import { now, json, fail, readJson, sha256Hex, cleanText } from './util.js';
import { requireUser, requireAdmin } from './auth.js';

const API = 'https://video.bunnycdn.com';
const TOPICS = ['Makhraj', 'Tajwid', 'Bacaan', 'Fardhu Ain', 'Lain-lain'];
const PLAY_TTL_S = 6 * 3600;      // pautan tonton sah 6 jam
const UPLOAD_TTL_S = 24 * 3600;   // tandatangan upload sah 24 jam

export const bunnyReady = (env) => !!(env.BUNNY_LIBRARY_ID && env.BUNNY_API_KEY);

async function bunny(env, method, path, body) {
  const r = await fetch(`${API}/library/${env.BUNNY_LIBRARY_ID}${path}`, {
    method,
    headers: { AccessKey: env.BUNNY_API_KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Bunny ${method} ${path} → ${r.status}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

async function uploadTicket(env, guid) {
  const expire = Math.floor(now() / 1000) + UPLOAD_TTL_S;
  return {
    endpoint: `${API}/tusupload`,
    libraryId: String(env.BUNNY_LIBRARY_ID),
    videoId: guid,
    expire,
    signature: await sha256Hex(`${env.BUNNY_LIBRARY_ID}${env.BUNNY_API_KEY}${expire}${guid}`),
  };
}

const STATUS_LABEL = { 0: 'Menunggu upload', 1: 'Dimuat naik', 2: 'Diproses', 3: 'Diproses', 4: 'Sedia', 5: 'Ralat', 6: 'Upload gagal', 7: 'Diproses', 8: 'Diproses' };

function adminVideo(v) {
  return {
    id: v.id, title: v.title, topic: v.topic, arabicLabel: v.arabic_label || '', classMonth: v.class_month || '',
    minutes: v.minutes, published: !!v.published, bunnyId: v.bunny_id,
    status: v.bunny_status ?? 0, statusLabel: STATUS_LABEL[v.bunny_status ?? 0] || 'Diproses', progress: v.encode_progress ?? 0,
    ready: v.bunny_status === 4, createdAt: v.created_at,
  };
}

async function refreshFromBunny(env, v) {
  if (!v.bunny_id) return v;
  try {
    const b = await bunny(env, 'GET', `/videos/${v.bunny_id}`);
    const minutes = Math.max(1, Math.round((b.length || 0) / 60));
    await env.DB.prepare('UPDATE videos SET bunny_status = ?, encode_progress = ?, minutes = ? WHERE id = ?')
      .bind(b.status, b.encodeProgress || 0, b.length ? minutes : v.minutes, v.id).run();
    return { ...v, bunny_status: b.status, encode_progress: b.encodeProgress || 0, minutes: b.length ? minutes : v.minutes };
  } catch (e) {
    console.error(e);
    return v;
  }
}

function readVideoInput(body) {
  const title = cleanText(body.title, 120);
  const topic = TOPICS.includes(body.topic) ? body.topic : 'Lain-lain';
  const arabic = cleanText(body.arabicLabel, 40);
  const month = /^\d{4}-\d{2}$/.test(String(body.classMonth || '')) ? body.classMonth : null;
  return { title, topic, arabic, month };
}

// ---------- admin ----------
export async function adminCreateVideo(env, request) {
  await requireAdmin(env, request);
  if (!bunnyReady(env)) return fail(503, 'Bunny Stream belum disambung. Tambah BUNNY_API_KEY di Cloudflare.');
  const { title, topic, arabic, month } = readVideoInput(await readJson(request));
  if (title.length < 3) return fail(400, 'Sila isi tajuk video.');
  const b = await bunny(env, 'POST', '/videos', { title });
  const res = await env.DB.prepare('INSERT INTO videos (title, topic, arabic_label, bunny_id, minutes, class_month, published, bunny_status, encode_progress, created_at) VALUES (?, ?, ?, ?, 0, ?, 0, 0, 0, ?)')
    .bind(title, topic, arabic || null, b.guid, month, now()).run();
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ ok: true, video: adminVideo(v), upload: await uploadTicket(env, b.guid) }, 201);
}

export async function adminUploadTicket(env, request, id) {
  await requireAdmin(env, request);
  const v = await env.DB.prepare('SELECT bunny_id FROM videos WHERE id = ?').bind(id).first();
  if (!v || !v.bunny_id) return fail(404, 'Video tidak dijumpai.');
  return json({ ok: true, upload: await uploadTicket(env, v.bunny_id) });
}

export async function adminListVideos(env, request) {
  await requireAdmin(env, request);
  const { results } = await env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  // Kemas kini status video yang masih diproses (maksimum 8 sekali panggil)
  let n = 0;
  const out = [];
  for (const v of results) {
    if (bunnyReady(env) && v.bunny_status !== 4 && v.bunny_status !== 5 && n < 8) { n++; out.push(await refreshFromBunny(env, v)); }
    else out.push(v);
  }
  return json({ ok: true, videos: out.map(adminVideo), topics: TOPICS, bunnyReady: bunnyReady(env), tokenReady: !!env.BUNNY_TOKEN_KEY });
}

export async function adminUpdateVideo(env, request, id) {
  await requireAdmin(env, request);
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  if (!v) return fail(404, 'Video tidak dijumpai.');
  const body = await readJson(request);
  const { title, topic, arabic, month } = readVideoInput({ ...adminVideo(v), ...body });
  if (title.length < 3) return fail(400, 'Sila isi tajuk video.');
  const published = body.published === undefined ? v.published : (body.published ? 1 : 0);
  if (published && v.bunny_status !== 4) return fail(400, 'Video belum siap diproses. Terbitkan selepas status "Sedia".');
  await env.DB.prepare('UPDATE videos SET title = ?, topic = ?, arabic_label = ?, class_month = ?, published = ? WHERE id = ?')
    .bind(title, topic, arabic || null, month, published, id).run();
  if (title !== v.title && v.bunny_id && bunnyReady(env)) { try { await bunny(env, 'POST', `/videos/${v.bunny_id}`, { title }); } catch (e) { console.error(e); } }
  const nv = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  return json({ ok: true, video: adminVideo(nv) });
}

export async function adminDeleteVideo(env, request, id) {
  await requireAdmin(env, request);
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  if (!v) return fail(404, 'Video tidak dijumpai.');
  if (v.bunny_id && bunnyReady(env)) {
    try { await bunny(env, 'DELETE', `/videos/${v.bunny_id}`); } catch (e) { console.error(e); }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id),
    env.DB.prepare('DELETE FROM watch_progress WHERE video_id = ?').bind(id),
  ]);
  return json({ ok: true });
}

// ---------- pelajar ----------
export async function listVideos(env, request) {
  const u = await requireUser(env, request);
  const { results } = await env.DB.prepare(
    `SELECT v.id, v.title, v.topic, v.arabic_label, v.minutes, v.class_month, v.created_at,
            p.seconds AS watched, p.updated_at AS watched_at
       FROM videos v LEFT JOIN watch_progress p ON p.video_id = v.id AND p.user_id = ?
      WHERE v.published = 1 ORDER BY COALESCE(v.class_month, '') DESC, v.created_at DESC`).bind(u.id).all();
  const videos = results.map(v => ({
    id: v.id, title: v.title, topic: v.topic, arabicLabel: v.arabic_label || '', minutes: v.minutes, classMonth: v.class_month,
    watchedSeconds: v.watched || 0, watchedAt: v.watched_at || null,
  }));
  const last = videos.filter(v => v.watchedAt && v.watchedSeconds < v.minutes * 60 - 30).sort((a, b) => b.watchedAt - a.watchedAt)[0] || null;
  return json({ ok: true, videos, continueId: last ? last.id : null });
}

export async function playVideo(env, request, id) {
  const u = await requireUser(env, request);
  if (!(u.paid_until && u.paid_until > now())) return fail(402, 'Langganan anda tidak aktif. Langgan untuk tonton video.');
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ? AND published = 1').bind(id).first();
  if (!v || !v.bunny_id) return fail(404, 'Video tidak dijumpai.');
  if (!env.BUNNY_LIBRARY_ID) return fail(503, 'Video belum boleh dimainkan. Sila cuba lagi nanti.');
  let url = `https://player.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${v.bunny_id}`;
  const params = new URLSearchParams({ autoplay: 'false', preload: 'true', responsive: 'true' });
  if (env.BUNNY_TOKEN_KEY) {
    const expires = Math.floor(now() / 1000) + PLAY_TTL_S;
    params.set('token', await sha256Hex(`${env.BUNNY_TOKEN_KEY}${v.bunny_id}${expires}`));
    params.set('expires', String(expires));
  }
  const p = await env.DB.prepare('SELECT seconds FROM watch_progress WHERE user_id = ? AND video_id = ?').bind(u.id, id).first();
  return json({ ok: true, embedUrl: `${url}?${params}`, resumeAt: p ? p.seconds : 0, watermark: u.name });
}

export async function saveProgress(env, request, id) {
  const u = await requireUser(env, request);
  const body = await readJson(request);
  const seconds = Math.max(0, Math.min(6 * 3600, Math.floor(Number(body.seconds) || 0)));
  await env.DB.prepare('INSERT INTO watch_progress (user_id, video_id, seconds, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, video_id) DO UPDATE SET seconds = excluded.seconds, updated_at = excluded.updated_at')
    .bind(u.id, id, seconds, now()).run();
  return json({ ok: true });
}

// ---------- langganan manual (admin) ----------
// Untuk pelajar ditaja, bayaran tunai/pindahan, atau sebelum HitPay siap.
export async function adminSetSubscription(env, request, userId) {
  await requireAdmin(env, request);
  const body = await readJson(request);
  const u = await env.DB.prepare('SELECT id, paid_until FROM users WHERE id = ?').bind(userId).first();
  if (!u) return fail(404, 'Pelajar tidak dijumpai.');
  let until;
  if (body.action === 'tamat') until = now() - 1000;
  else {
    const months = Number(body.months);
    if (![1, 3, 6, 12].includes(months)) return fail(400, 'Pilih 1, 3, 6 atau 12 bulan.');
    const base = new Date(Math.max(now(), u.paid_until || 0));
    base.setMonth(base.getMonth() + months);
    until = base.getTime();
  }
  await env.DB.prepare('UPDATE users SET paid_until = ?, plan = COALESCE(plan, ?) WHERE id = ?').bind(until, 'manual', userId).run();
  return json({ ok: true, paidUntil: until, active: until > now() });
}
