// Log aktiviti admin: rekod setiap perubahan dan muat turun data yang dibuat dari panel admin,
// serta cubaan login admin (berjaya dan gagal). Kata laluan, PIN dan kunci tidak pernah disimpan.
import { now, json, clientIp } from './util.js';
import { requireAdmin, adminOf } from './auth.js';

const KEEP_MS = 365 * 864e5;
const SECRET = /pass|pin|token|key|secret|code/i;

const ACTIONS = [
  [/^\/api\/admin\/login$/, 'Log masuk admin'],
  [/^\/api\/admin\/password$/, 'Tukar kata laluan sendiri'],
  [/^\/api\/admin\/admins$/, 'Tambah admin'],
  [/^\/api\/admin\/users\/\d+\/pin$/, 'Set semula PIN pelajar'],
  [/^\/api\/admin\/users\/\d+\/subscription$/, 'Ubah langganan pelajar'],
  [/^\/api\/admin\/users\/\d+\/sponsor$/, 'Taja pelajar dari dana'],
  [/^\/api\/admin\/videos\/import$/, 'Import video dari Bunny'],
  [/^\/api\/admin\/videos\/\d+\/delete$/, 'Padam video'],
  [/^\/api\/admin\/videos\/\d+\/upload-ticket$/, 'Muat naik fail video'],
  [/^\/api\/admin\/videos\/\d+$/, 'Ubah video'],
  [/^\/api\/admin\/videos$/, 'Tambah video'],
  [/^\/api\/admin\/announcements\/\d+\/delete$/, 'Padam hebahan'],
  [/^\/api\/admin\/announcements\/\d+$/, 'Ubah hebahan'],
  [/^\/api\/admin\/announcements$/, 'Hantar hebahan'],
  [/^\/api\/admin\/settings$/, 'Ubah maklumat pengendali'],
  [/^\/api\/admin\/questions\/\d+\/answer$/, 'Jawab soalan'],
  [/^\/api\/admin\/questions\/\d+\/hide$/, 'Sembunyi soalan'],
  [/^\/api\/admin\/plans$/, 'Ubah pakej langganan'],
  [/^\/api\/admin\/donors\/\d+\/stop$/, 'Hentikan sumbangan bulanan'],
  [/^\/api\/admin\/doas\/\d+\/delete$/, 'Padam doa'],
  [/^\/api\/admin\/doas\/\d+$/, 'Ubah doa'],
  [/^\/api\/admin\/doas$/, 'Tambah doa'],
  [/^\/api\/admin\/export\/pelajar\.csv$/, 'Muat turun senarai pelajar (CSV)'],
  [/^\/api\/admin\/export\/sumbangan\.csv$/, 'Muat turun rekod sumbangan (CSV)'],
];

// Permintaan admin yang direkod: semua POST (kecuali logout) dan muat turun CSV
export function shouldLog(method, path) {
  if (!path.startsWith('/api/admin/') || path === '/api/admin/logout') return false;
  return method === 'POST' || /^\/api\/admin\/export\//.test(path);
}

function redact(v, depth = 0) {
  if (v === null || typeof v !== 'object') return typeof v === 'string' ? v.slice(0, 120) : v;
  if (depth > 2) return '…';
  if (Array.isArray(v)) return v.slice(0, 10).map(x => redact(x, depth + 1));
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = SECRET.test(k) ? '•••' : redact(x, depth + 1);
  return out;
}

// Baca isi permintaan sebelum handler (salinan), buang medan sulit
export async function readDetail(request) {
  if (request.method !== 'POST') return null;
  if (Number(request.headers.get('content-length') || 0) > 20000) return null;
  try {
    const text = await request.clone().text();
    if (!text) return null;
    return JSON.stringify(redact(JSON.parse(text))).slice(0, 600);
  } catch { return null; }
}

async function targetOf(env, path) {
  let m = path.match(/^\/api\/admin\/users\/(\d+)\//);
  if (m) {
    const u = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(Number(m[1])).first();
    return u ? `${u.name} (#${m[1]})` : `Pelajar #${m[1]}`;
  }
  m = path.match(/^\/api\/admin\/videos\/(\d+)/);
  if (m) {
    const v = await env.DB.prepare('SELECT title FROM videos WHERE id = ?').bind(Number(m[1])).first();
    return v ? `${v.title} (#${m[1]})` : `Video #${m[1]}`;
  }
  m = path.match(/^\/api\/admin\/doas\/(\d+)/);
  if (m) {
    const d = await env.DB.prepare('SELECT title FROM doas WHERE id = ?').bind(Number(m[1])).first();
    return d ? `${d.title} (#${m[1]})` : `Doa #${m[1]}`;
  }
  m = path.match(/^\/api\/admin\/(announcements|questions|donors)\/(\d+)/);
  if (m) return `#${m[2]}`;
  return null;
}

export async function writeLog(env, request, path, detail, status) {
  const a = adminOf(request);
  if (!a && path !== '/api/admin/login') return;
  const action = (ACTIONS.find(([re]) => re.test(path)) || [, path])[1];
  await env.DB.prepare(`INSERT INTO admin_log (admin_id, admin_name, method, path, action, target, detail, status, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(a ? a.id : null, a ? a.name : null, request.method, path, action, await targetOf(env, path), detail, status, clientIp(request), now()).run();
}

export async function adminListLog(env, request) {
  await requireAdmin(env, request);
  const url = new URL(request.url);
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const { results } = await env.DB.prepare('SELECT * FROM admin_log WHERE id < ? ORDER BY id DESC LIMIT 100').bind(before).all();
  return json({
    ok: true,
    log: results.map(r => ({
      id: r.id, at: r.created_at, admin: r.admin_name, action: r.action, target: r.target,
      detail: r.detail, failed: r.status >= 400, ip: r.ip,
    })),
  });
}

export const cleanAdminLog = (env, t) => env.DB.prepare('DELETE FROM admin_log WHERE created_at < ?').bind(t - KEEP_MS);
