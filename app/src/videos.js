// Video kelas: Bunny Stream.
// Konfigurasi: var BUNNY_LIBRARY_ID, secret BUNNY_API_KEY (API key library), secret BUNNY_TOKEN_KEY (Token authentication key).
import { now, json, fail, readJson, sha256Hex, cleanText } from './util.js';
import { requireUser, requireAdmin } from './auth.js';
import { webBase, setWebUntilStmt } from './store.js';

const API = 'https://video.bunnycdn.com';
// Cadangan topik dalam borang admin (topik boleh ditaip bebas)
const TOPICS = ['Makhraj', 'Tajwid', 'Bacaan'];
// Kategori asal (dimasukkan sekali sahaja; admin boleh ubah/tambah/padam)
const SEED_CATS = [['Belajar Al-Quran', 'Learning the Quran'], ['Sirah', 'Sirah'], ['Kisah dari Al-Quran', 'Stories from the Quran'], ['Fardhu Ain', 'Fardhu Ain']];
const PLAY_TTL_S = 6 * 3600;      // pautan tonton sah 6 jam
const MAX_DONATE_CLIPS = 3;       // klip di halaman Sumbang
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

const catShape = c => ({ id: c.id, name: c.name, nameEn: c.name_en || '', sort: c.sort });

let catsSeeded = false;
// Kali pertama: cipta kategori asal dan susun video sedia ada mengikut topik lama
async function seedCategories(env) {
  if (catsSeeded) return;
  if (await env.DB.prepare("SELECT value FROM settings WHERE key = 'vcat_seeded'").first()) { catsSeeded = true; return; }
  const t = now();
  if (!(await env.DB.prepare('SELECT COUNT(*) AS n FROM video_categories').first()).n) {
    await env.DB.batch(SEED_CATS.map(([name, en], i) => env.DB.prepare('INSERT INTO video_categories (name, name_en, sort, created_at) VALUES (?, ?, ?, ?)').bind(name, en, (i + 1) * 10, t)));
    const { results } = await env.DB.prepare('SELECT id, name FROM video_categories').all();
    const id = n => (results.find(c => c.name === n) || {}).id || null;
    await env.DB.batch([
      env.DB.prepare("UPDATE videos SET category_id = ? WHERE category_id IS NULL AND topic IN ('Makhraj', 'Tajwid', 'Bacaan')").bind(id('Belajar Al-Quran')),
      env.DB.prepare("UPDATE videos SET category_id = ?, topic = '' WHERE category_id IS NULL AND topic = 'Sirah'").bind(id('Sirah')),
      env.DB.prepare("UPDATE videos SET category_id = ?, topic = '' WHERE category_id IS NULL AND topic = 'Fardhu Ain'").bind(id('Fardhu Ain')),
      env.DB.prepare("UPDATE videos SET topic = '' WHERE topic = 'Lain-lain'"),
    ]);
  }
  await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('vcat_seeded', '1', ?)").bind(t).run();
  catsSeeded = true;
}

async function listCategories(env) {
  await seedCategories(env);
  const { results } = await env.DB.prepare('SELECT * FROM video_categories ORDER BY sort, id').all();
  return results.map(catShape);
}

// ---------- bab dalam video ----------
// Admin taip satu bab sebaris: "05:30 Hukum mad" (atau 1:05:30). Disimpan sebagai JSON [{s, title}].
const MAX_CHAPTERS = 50;
export const fmtTime = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60, p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
};
export function parseChapters(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim());
  const list = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    const m = lines[i].match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*[-–—.:)]?\s*(.*)$/);
    if (!m) return { error: `Bab baris ${i + 1}: mula dengan masa, cth. "05:30 Hukum mad".` };
    const [, h, mm, ss, rest] = m;
    if (Number(ss) > 59 || (h && Number(mm) > 59)) return { error: `Bab baris ${i + 1}: masa tidak sah.` };
    const title = cleanText(rest, 80);
    if (!title) return { error: `Bab baris ${i + 1}: tulis tajuk bab selepas masa.` };
    list.push({ s: Number(h || 0) * 3600 + Number(mm) * 60 + Number(ss), title });
  }
  if (list.length > MAX_CHAPTERS) return { error: `Maksimum ${MAX_CHAPTERS} bab untuk satu video.` };
  list.sort((a, b) => a.s - b.s);
  return { list };
}
const readChapters = v => { try { const a = JSON.parse(v.chapters || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

function adminVideo(v) {
  const chapters = readChapters(v);
  return {
    id: v.id, title: v.title, topic: v.topic || '', categoryId: v.category_id || null, arabicLabel: v.arabic_label || '', classMonth: v.class_month || '',
    minutes: v.minutes, published: !!v.published, bunnyId: v.bunny_id,
    status: v.bunny_status ?? 0, statusLabel: STATUS_LABEL[v.bunny_status ?? 0] || 'Diproses', progress: v.encode_progress ?? 0,
    ready: v.bunny_status === 4, thumbUrl: v.thumb_url || null, createdAt: v.created_at,
    chapterCount: chapters.length, chaptersText: chapters.map(c => `${fmtTime(c.s)} ${c.title}`).join('\n'),
    donateClip: !!v.donate_clip,
  };
}

// URL gambar kecil dari jawapan Bunny (hanya bila video dah siap diproses)
function thumbFrom(b) {
  const u = b && b.status === 4 && typeof b.thumbnailUrl === 'string' ? b.thumbnailUrl : '';
  return /^https:\/\//.test(u) ? u : null;
}

async function refreshFromBunny(env, v) {
  if (!v.bunny_id) return v;
  try {
    const b = await bunny(env, 'GET', `/videos/${v.bunny_id}`);
    const minutes = Math.max(1, Math.round((b.length || 0) / 60));
    const thumb = thumbFrom(b) || v.thumb_url || null;
    await env.DB.prepare('UPDATE videos SET bunny_status = ?, encode_progress = ?, minutes = ?, thumb_url = ? WHERE id = ?')
      .bind(b.status, b.encodeProgress || 0, b.length ? minutes : v.minutes, thumb, v.id).run();
    return { ...v, bunny_status: b.status, encode_progress: b.encodeProgress || 0, minutes: b.length ? minutes : v.minutes, thumb_url: thumb };
  } catch (e) {
    console.error(e);
    return v;
  }
}

function readVideoInput(body) {
  const title = cleanText(body.title, 120);
  const topic = cleanText(body.topic, 40);
  const arabic = cleanText(body.arabicLabel, 40);
  const month = /^\d{4}-\d{2}$/.test(String(body.classMonth || '')) ? body.classMonth : null;
  const categoryId = Number(body.categoryId) > 0 ? Number(body.categoryId) : null;
  return { title, topic, arabic, month, categoryId };
}

// Kategori mesti wujud (atau tiada kategori)
async function checkCategory(env, id) {
  if (!id) return null;
  const c = await env.DB.prepare('SELECT id FROM video_categories WHERE id = ?').bind(id).first();
  return c ? c.id : undefined;
}

// ---------- admin ----------
export async function adminCreateVideo(env, request) {
  await requireAdmin(env, request);
  if (!bunnyReady(env)) return fail(503, 'Bunny Stream belum disambung. Tambah BUNNY_API_KEY di Cloudflare.');
  const { title, topic, arabic, month, categoryId } = readVideoInput(await readJson(request));
  if (title.length < 3) return fail(400, 'Sila isi tajuk video.');
  const cat = await checkCategory(env, categoryId);
  if (cat === undefined) return fail(400, 'Kategori tidak dijumpai.');
  const b = await bunny(env, 'POST', '/videos', { title });
  const res = await env.DB.prepare('INSERT INTO videos (title, topic, category_id, arabic_label, bunny_id, minutes, class_month, published, bunny_status, encode_progress, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, ?)')
    .bind(title, topic, cat, arabic || null, b.guid, month, now()).run();
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
  const categories = await listCategories(env);
  const { results } = await env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  // Kemas kini status video yang masih diproses (maksimum 8 sekali panggil)
  let n = 0;
  const out = [];
  for (const v of results) {
    if (bunnyReady(env) && ((v.bunny_status !== 4 && v.bunny_status !== 5) || (v.bunny_status === 4 && !v.thumb_url)) && n < 8) { n++; out.push(await refreshFromBunny(env, v)); }
    else out.push(v);
  }
  const topics = [...new Set([...TOPICS, ...results.map(v => v.topic).filter(Boolean)])];
  return json({ ok: true, videos: out.map(adminVideo), topics, categories, bunnyReady: bunnyReady(env), tokenReady: !!env.BUNNY_TOKEN_KEY });
}

export async function adminUpdateVideo(env, request, id) {
  await requireAdmin(env, request);
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  if (!v) return fail(404, 'Video tidak dijumpai.');
  const body = await readJson(request);
  const { title, topic, arabic, month, categoryId } = readVideoInput({ ...adminVideo(v), ...body });
  if (title.length < 3) return fail(400, 'Sila isi tajuk video.');
  const cat = await checkCategory(env, categoryId);
  if (cat === undefined) return fail(400, 'Kategori tidak dijumpai.');
  const published = body.published === undefined ? v.published : (body.published ? 1 : 0);
  if (published && v.bunny_status !== 4) return fail(400, 'Video belum siap diproses. Terbitkan selepas status "Sedia".');
  const donateClip = body.donateClip === undefined ? (v.donate_clip ? 1 : 0) : (body.donateClip ? 1 : 0);
  if (donateClip && !v.donate_clip) {
    if (v.bunny_status !== 4) return fail(400, 'Video belum siap diproses. Papar di halaman Sumbang selepas status "Sedia".');
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM videos WHERE donate_clip = 1 AND id != ?').bind(id).first();
    if (c.n >= MAX_DONATE_CLIPS) return fail(400, `Maksimum ${MAX_DONATE_CLIPS} klip di halaman Sumbang. Buang satu klip dahulu.`);
  }
  let chapters = v.chapters || null;
  if (body.chapters !== undefined) {
    const c = parseChapters(body.chapters);
    if (c.error) return fail(400, c.error);
    chapters = c.list.length ? JSON.stringify(c.list) : null;
  }
  await env.DB.prepare('UPDATE videos SET title = ?, topic = ?, category_id = ?, arabic_label = ?, class_month = ?, published = ?, chapters = ?, donate_clip = ? WHERE id = ?')
    .bind(title, topic, cat, arabic || null, month, published, chapters, donateClip, id).run();
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
  const categories = await listCategories(env);
  const { results } = await env.DB.prepare(
    `SELECT v.id, v.title, v.topic, v.category_id, v.arabic_label, v.minutes, v.class_month, v.created_at, v.thumb_url,
            p.seconds AS watched, p.updated_at AS watched_at
       FROM videos v LEFT JOIN watch_progress p ON p.video_id = v.id AND p.user_id = ?
      WHERE v.published = 1 ORDER BY COALESCE(v.class_month, '') DESC, v.created_at DESC`).bind(u.id).all();
  const videos = results.map(v => ({
    id: v.id, title: v.title, topic: v.topic || '', categoryId: v.category_id || null, arabicLabel: v.arabic_label || '', minutes: v.minutes, classMonth: v.class_month, thumbUrl: v.thumb_url || null,
    watchedSeconds: v.watched || 0, watchedAt: v.watched_at || null,
  }));
  const last = videos.filter(v => v.watchedAt && v.watchedSeconds < v.minutes * 60 - 30).sort((a, b) => b.watchedAt - a.watchedAt)[0] || null;
  return json({ ok: true, videos, categories, continueId: last ? last.id : null });
}

// Pautan embed Bunny (bertoken jika Token Authentication dihidupkan)
async function embedUrl(env, guid, autoplay) {
  const params = new URLSearchParams({ autoplay: autoplay ? 'true' : 'false', preload: 'true', responsive: 'true' });
  if (env.BUNNY_TOKEN_KEY) {
    const expires = Math.floor(now() / 1000) + PLAY_TTL_S;
    params.set('token', await sha256Hex(`${env.BUNNY_TOKEN_KEY}${guid}${expires}`));
    params.set('expires', String(expires));
  }
  return `https://player.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${guid}?${params}`;
}

// Klip pendek untuk halaman Sumbang (awam, tanpa log masuk). Tak bergantung pada status terbit.
export async function donateClips(env) {
  if (!env.BUNNY_LIBRARY_ID) return [];
  const { results } = await env.DB.prepare(
    `SELECT id, title, bunny_id, minutes, thumb_url FROM videos
      WHERE donate_clip = 1 AND bunny_status = 4 AND bunny_id IS NOT NULL ORDER BY created_at DESC LIMIT ?`).bind(MAX_DONATE_CLIPS).all();
  return Promise.all(results.map(async v => ({ id: v.id, title: v.title, minutes: v.minutes, thumbUrl: v.thumb_url || null, embedUrl: await embedUrl(env, v.bunny_id, true) })));
}

export async function playVideo(env, request, id) {
  const u = await requireUser(env, request);
  if (!(u.paid_until && u.paid_until > now())) return fail(402, 'Langganan anda tidak aktif. Langgan untuk tonton video.');
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ? AND published = 1').bind(id).first();
  if (!v || !v.bunny_id) return fail(404, 'Video tidak dijumpai.');
  if (!env.BUNNY_LIBRARY_ID) return fail(503, 'Video belum boleh dimainkan. Sila cuba lagi nanti.');
  const url = await embedUrl(env, v.bunny_id, false);
  const p = await env.DB.prepare('SELECT seconds FROM watch_progress WHERE user_id = ? AND video_id = ?').bind(u.id, id).first();
  return json({ ok: true, embedUrl: url, resumeAt: p ? p.seconds : 0, watermark: u.name, chapters: readChapters(v) });
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
  const u = await env.DB.prepare('SELECT id, paid_until, web_paid_until FROM users WHERE id = ?').bind(userId).first();
  if (!u) return fail(404, 'Pelajar tidak dijumpai.');
  let until;
  if (body.action === 'tamat') until = now() - 1000;
  else {
    const months = Number(body.months);
    if (![1, 3, 6, 12].includes(months)) return fail(400, 'Pilih 1, 3, 6 atau 12 bulan.');
    const base = new Date(Math.max(now(), webBase(u)));
    base.setMonth(base.getMonth() + months);
    until = base.getTime();
  }
  await setWebUntilStmt(env, userId, until, 'plan = COALESCE(plan, ?)', ['manual']).run();
  // Langganan Google Play / App Store yang masih sah tetap kekal (diurus oleh store)
  const fresh = await env.DB.prepare('SELECT paid_until FROM users WHERE id = ?').bind(userId).first();
  return json({ ok: true, paidUntil: fresh.paid_until, active: fresh.paid_until > now(), storeActive: fresh.paid_until > until });
}

// ---------- import video yang di-upload terus di Bunny ----------
export async function adminBunnyVideos(env, request) {
  await requireAdmin(env, request);
  if (!bunnyReady(env)) return fail(503, 'Bunny Stream belum disambung. Tambah BUNNY_API_KEY di Cloudflare.');
  const data = await bunny(env, 'GET', '/videos?page=1&itemsPerPage=100&orderBy=date');
  const { results } = await env.DB.prepare('SELECT bunny_id FROM videos WHERE bunny_id IS NOT NULL').all();
  const known = new Set(results.map(r => r.bunny_id));
  const items = (data.items || []).filter(v => !known.has(v.guid)).map(v => ({
    guid: v.guid, title: v.title, minutes: Math.max(1, Math.round((v.length || 0) / 60)),
    status: v.status, statusLabel: STATUS_LABEL[v.status] || 'Diproses', progress: v.encodeProgress || 0, ready: v.status === 4,
  }));
  return json({ ok: true, items });
}

export async function adminImportVideo(env, request) {
  await requireAdmin(env, request);
  if (!bunnyReady(env)) return fail(503, 'Bunny Stream belum disambung.');
  const body = await readJson(request);
  const guid = String(body.guid || '');
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return fail(400, 'ID video tidak sah.');
  const exists = await env.DB.prepare('SELECT id FROM videos WHERE bunny_id = ?').bind(guid).first();
  if (exists) return fail(409, 'Video ini sudah ada dalam app.');
  let b;
  try { b = await bunny(env, 'GET', `/videos/${guid}`); } catch { return fail(404, 'Video tidak dijumpai di Bunny.'); }
  const { title, topic, arabic, month, categoryId } = readVideoInput({ ...body, title: body.title || b.title });
  if (title.length < 3) return fail(400, 'Sila isi tajuk video.');
  const cat = await checkCategory(env, categoryId);
  if (cat === undefined) return fail(400, 'Kategori tidak dijumpai.');
  const minutes = b.length ? Math.max(1, Math.round(b.length / 60)) : 0;
  const res = await env.DB.prepare('INSERT INTO videos (title, topic, category_id, arabic_label, bunny_id, minutes, class_month, published, bunny_status, encode_progress, thumb_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)')
    .bind(title, topic, cat, arabic || null, guid, minutes, month, b.status, b.encodeProgress || 0, thumbFrom(b), now()).run();
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ ok: true, video: adminVideo(v) }, 201);
}

// ---------- kategori video (admin) ----------
function readCategory(b) {
  const name = cleanText(b.name, 40), nameEn = cleanText(b.nameEn, 40);
  if (!name) return { error: 'Sila isi nama kategori.' };
  return { name, nameEn };
}

export async function adminCreateCategory(env, request) {
  await requireAdmin(env, request);
  await seedCategories(env);
  const c = readCategory(await readJson(request));
  if (c.error) return fail(400, c.error);
  const sort = ((await env.DB.prepare('SELECT MAX(sort) AS s FROM video_categories').first()).s || 0) + 10;
  const row = await env.DB.prepare('INSERT INTO video_categories (name, name_en, sort, created_at) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(c.name, c.nameEn || null, sort, now()).first();
  return json({ ok: true, category: catShape(row), categories: await listCategories(env) }, 201);
}

export async function adminUpdateCategory(env, request, id) {
  await requireAdmin(env, request);
  const c = readCategory(await readJson(request));
  if (c.error) return fail(400, c.error);
  const row = await env.DB.prepare('UPDATE video_categories SET name = ?, name_en = ? WHERE id = ? RETURNING *').bind(c.name, c.nameEn || null, id).first();
  if (!row) return fail(404, 'Kategori tidak dijumpai.');
  return json({ ok: true, category: catShape(row), categories: await listCategories(env) });
}

// Naik / turun dalam susunan (tukar tempat dengan jiran)
export async function adminMoveCategory(env, request, id) {
  await requireAdmin(env, request);
  const dir = Number((await readJson(request)).dir) < 0 ? -1 : 1;
  const list = await listCategories(env);
  const i = list.findIndex(c => c.id === id), j = i + dir;
  if (i < 0) return fail(404, 'Kategori tidak dijumpai.');
  if (j >= 0 && j < list.length) {
    const ordered = list.slice(); [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    await env.DB.batch(ordered.map((c, k) => env.DB.prepare('UPDATE video_categories SET sort = ? WHERE id = ?').bind((k + 1) * 10, c.id)));
  }
  return json({ ok: true, categories: await listCategories(env) });
}

// Padam kategori: video di dalamnya kekal, cuma jadi "tiada kategori"
export async function adminDeleteCategory(env, request, id) {
  await requireAdmin(env, request);
  await env.DB.batch([
    env.DB.prepare('UPDATE videos SET category_id = NULL WHERE category_id = ?').bind(id),
    env.DB.prepare('DELETE FROM video_categories WHERE id = ?').bind(id),
  ]);
  return json({ ok: true, categories: await listCategories(env) });
}
