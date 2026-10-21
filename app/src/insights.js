// Statistik untuk ustaz/admin: tontonan video, pelajar perlu follow up, dan eksport senarai pelajar.
import { now, json, displayPhone } from './util.js';
import { requireAdmin } from './auth.js';

const DAY = 864e5;

export async function adminInsights(env, request) {
  await requireAdmin(env, request);
  const t = now();
  const [videos, expiring, idle] = await env.DB.batch([
    // Setiap video yang diterbitkan: berapa pelajar mula tonton, berapa habis (≥ 90%)
    env.DB.prepare(`SELECT v.id, v.title, v.topic, v.minutes,
        COUNT(w.user_id) AS viewers,
        SUM(CASE WHEN v.minutes > 0 AND w.seconds >= v.minutes * 60 * 0.9 THEN 1 ELSE 0 END) AS finished
      FROM videos v LEFT JOIN watch_progress w ON w.video_id = v.id AND w.seconds >= 30
      WHERE v.published = 1 GROUP BY v.id ORDER BY viewers DESC, v.created_at DESC LIMIT 50`),
    // Langganan tamat dalam 7 hari dan tiada auto-renew
    env.DB.prepare(`SELECT id, name, phone, paid_until FROM users
      WHERE paid_until > ? AND paid_until <= ? AND NOT (auto_renew = 1 AND chip_token IS NOT NULL)
      ORDER BY paid_until LIMIT 50`).bind(t, t + 7 * DAY),
    // Pelanggan aktif yang tidak menonton video 14 hari (atau belum pernah)
    env.DB.prepare(`SELECT u.id, u.name, u.phone, u.created_at, MAX(w.updated_at) AS last_watch FROM users u
      LEFT JOIN watch_progress w ON w.user_id = u.id
      WHERE u.paid_until > ? AND u.created_at < ?
      GROUP BY u.id HAVING last_watch IS NULL OR last_watch < ?
      ORDER BY COALESCE(last_watch, 0) LIMIT 50`).bind(t, t - 7 * DAY, t - 14 * DAY),
  ]);
  return json({
    ok: true,
    videos: videos.results.map(v => ({ id: v.id, title: v.title, topic: v.topic, viewers: v.viewers, finished: v.finished || 0 })),
    expiring: expiring.results.map(u => ({ id: u.id, name: u.name, phone: displayPhone(u.phone), wa: u.phone, paidUntil: u.paid_until })),
    idle: idle.results.map(u => ({ id: u.id, name: u.name, phone: displayPhone(u.phone), wa: u.phone, lastWatch: u.last_watch || null })),
  });
}

// CSV untuk Excel (UTF-8 dengan BOM supaya huruf Arab/Melayu dipapar betul)
const cell = v => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // elak formula Excel berbahaya
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const ymd = ms => ms ? new Date(ms + 8 * 3600e3).toISOString().slice(0, 10) : '';

export async function adminExportUsers(env, request) {
  await requireAdmin(env, request);
  const t = now();
  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at').all();
  const rows = [['Nama', 'No. telefon', 'Emel', 'Status', 'Langganan hingga', 'Auto-renew', 'Pakej', 'Tarikh daftar']];
  for (const u of results) {
    const status = !u.paid_until ? 'Belum bayar' : u.paid_until > t ? 'Aktif' : 'Tamat';
    rows.push([u.name, displayPhone(u.phone), u.email || '', status, ymd(u.paid_until), u.auto_renew && u.chip_token ? 'Ya' : 'Tidak', u.plan || '', ymd(u.created_at)]);
  }
  const csv = '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="pelajar-madrasah-online-${ymd(t)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
