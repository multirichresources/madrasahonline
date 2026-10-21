// Maklumat pengendali (untuk halaman polisi & bantuan) dan pengumuman / kelas Zoom.
import { now, json, fail, readJson, cleanText, cleanMultiline as cleanBody, validEmail, normalizePhone } from './util.js';
import { requireUser, requireAdmin } from './auth.js';
import { notify, processJobs, classWhen } from './push.js';

// ---------- maklumat pengendali ----------
const ORG_KEYS = ['org_name', 'org_reg', 'contact_email', 'contact_whatsapp', 'address'];

export async function getOrg(env) {
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${ORG_KEYS.map(() => '?').join(',')})`).bind(...ORG_KEYS).all();
  const m = Object.fromEntries(results.map(r => [r.key, r.value || '']));
  return {
    name: m.org_name || '',
    reg: m.org_reg || '',
    email: m.contact_email || '',
    whatsapp: m.contact_whatsapp || '',
    address: m.address || '',
  };
}

export async function adminGetSettings(env, request) {
  await requireAdmin(env, request);
  return json({ ok: true, org: await getOrg(env) });
}

export async function adminSaveSettings(env, request) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  const name = cleanText(b.name, 120);
  const reg = cleanText(b.reg, 60);
  const email = cleanText(b.email, 254).toLowerCase();
  const address = cleanText(b.address, 300);
  let whatsapp = '';
  if (cleanText(b.whatsapp, 30)) {
    whatsapp = normalizePhone(b.whatsapp);
    if (!whatsapp) return fail(400, 'No. WhatsApp tidak sah. Contoh: 012-345 6789.');
  }
  if (email && !validEmail(email)) return fail(400, 'Alamat emel tidak sah.');
  const vals = { org_name: name, org_reg: reg, contact_email: email, contact_whatsapp: whatsapp, address };
  const t = now();
  await env.DB.batch(Object.entries(vals).map(([k, v]) =>
    env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(k, v, t)));
  return json({ ok: true, org: await getOrg(env) });
}

// ---------- pengumuman & kelas Zoom ----------
const JOIN_BEFORE = 30 * 60 * 1000;      // butang Masuk Kelas dibuka 30 minit sebelum
const CLASS_LENGTH = 3 * 3600 * 1000;    // dianggap berlangsung hingga 3 jam selepas mula

function cleanUrl(v) {
  const s = cleanText(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

function shape(a, user, t) {
  const isClass = !!a.class_at;
  const locked = isClass && !!a.members_only && !(user.paid_until > t);
  const joinOpen = isClass && t >= a.class_at - JOIN_BEFORE && t <= a.class_at + CLASS_LENGTH;
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    classAt: a.class_at || null,
    membersOnly: !!a.members_only,
    createdAt: a.created_at,
    hasZoom: !!a.zoom_url,
    locked,
    joinOpen,
    // Pautan Zoom hanya diberi pada waktu kelas, kepada yang layak, supaya tak tersebar awal
    zoomUrl: joinOpen && !locked && a.zoom_url ? a.zoom_url : null,
    joinOpensAt: isClass ? a.class_at - JOIN_BEFORE : null,
  };
}

export async function listAnnouncements(env, request) {
  const u = await requireUser(env, request);
  const t = now();
  const [next, recent] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM announcements WHERE class_at IS NOT NULL AND class_at >= ? ORDER BY class_at ASC LIMIT 1').bind(t - CLASS_LENGTH),
    env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 30'),
  ]);
  const n = next.results[0];
  return json({
    ok: true,
    now: t,
    nextClass: n ? shape(n, u, t) : null,
    announcements: recent.results.map(a => shape(a, u, t)),
  });
}

function adminShape(a) {
  return { id: a.id, title: a.title, body: a.body, classAt: a.class_at || null, zoomUrl: a.zoom_url || '', membersOnly: !!a.members_only, createdAt: a.created_at };
}

function readAnnouncement(b) {
  const title = cleanText(b.title, 120);
  const body = cleanBody(b.body, 2000);
  if (!title) return { error: 'Sila isi tajuk.' };
  if (!body) return { error: 'Sila isi mesej.' };
  const isClass = !!b.isClass;
  let classAt = null, zoomUrl = '';
  if (isClass) {
    classAt = Number(b.classAt);
    if (!Number.isFinite(classAt) || classAt < Date.UTC(2024, 0, 1) || classAt > Date.UTC(2100, 0, 1)) return { error: 'Sila pilih tarikh dan masa kelas.' };
    const z = cleanUrl(b.zoomUrl);
    if (z === null) return { error: 'Pautan Zoom tidak sah. Salin pautan penuh yang bermula dengan https://' };
    if (!z) return { error: 'Sila masukkan pautan Zoom.' };
    zoomUrl = z;
  }
  return { title, body, classAt, zoomUrl, membersOnly: isClass ? (b.membersOnly === false ? 0 : 1) : 0 };
}

export async function adminListAnnouncements(env, request) {
  await requireAdmin(env, request);
  const { results } = await env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100').all();
  return json({ ok: true, announcements: results.map(adminShape) });
}

export async function adminCreateAnnouncement(env, request, ctx) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  const a = readAnnouncement(b);
  if (a.error) return fail(400, a.error);
  const row = await env.DB.prepare('INSERT INTO announcements (title, body, zoom_url, class_at, members_only, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *')
    .bind(a.title, a.body, a.zoomUrl || null, a.classAt, a.membersOnly, now()).first();
  let notified = 0;
  if (b.notify !== false) {
    notified = await notify(env, { kind: a.membersOnly ? 'active' : 'all' }, a.classAt
      ? { ms: { title: `Kelas Zoom: ${a.title}`, body: `${classWhen(a.classAt)}. Butang Masuk Kelas dibuka 30 minit sebelum kelas.` },
          en: { title: `Zoom class: ${a.title}`, body: `${classWhen(a.classAt, 'en')}. The Join Class button opens 30 minutes before class.` }, url: '/' }
      : { title: a.title, body: a.body.replace(/\s+/g, ' ').slice(0, 140), url: '/?k=pengumuman' });
    if (notified && ctx) ctx.waitUntil(processJobs(env));
  }
  return json({ ok: true, announcement: adminShape(row), notified }, 201);
}

export async function adminUpdateAnnouncement(env, request, id) {
  await requireAdmin(env, request);
  const a = readAnnouncement(await readJson(request));
  if (a.error) return fail(400, a.error);
  // Jika masa kelas diubah, peringatan automatik dihantar semula mengikut masa baharu
  const row = await env.DB.prepare(`UPDATE announcements SET title = ?, body = ?, zoom_url = ?, members_only = ?,
      reminded_day = CASE WHEN class_at IS ? THEN reminded_day ELSE 0 END,
      reminded_soon = CASE WHEN class_at IS ? THEN reminded_soon ELSE 0 END,
      class_at = ? WHERE id = ? RETURNING *`)
    .bind(a.title, a.body, a.zoomUrl || null, a.membersOnly, a.classAt, a.classAt, a.classAt, id).first();
  if (!row) return fail(404, 'Pengumuman tidak dijumpai.');
  return json({ ok: true, announcement: adminShape(row) });
}

export async function adminDeleteAnnouncement(env, request, id) {
  await requireAdmin(env, request);
  await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
