// Bayaran manual (di luar CHIP: tunai, pindahan bank, DuitNow terus kepada ustaz) + data kutipan ikut tempoh.
// Rekod manual disimpan dalam jadual payments (provider 'manual', status 'completed'), jadi graf kutipan,
// KPI dan "Bayaran terkini" mengira jualan ini sama seperti bayaran CHIP. Batal = status 'batal' (tidak dipadam).
import { now, json, fail, readJson, cleanText } from './util.js';
import { requireAdmin } from './auth.js';
import { getPlans } from './billing.js';

const DAY = 864e5;
const MYT = 8 * 3600e3;
export const PAY_METHODS = { tunai: 'Tunai', bank: 'Pindahan bank', duitnow: 'DuitNow', lain: 'Lain-lain' };
const MONTHS_OK = [1, 3, 6, 12];

// Harga cadangan untuk setiap tempoh: harga pakej jika ada, jika tidak bulanan × bulan
export async function suggestedPrices(env) {
  const plans = await getPlans(env);
  const monthly = (plans.find(p => p.id === 'bulanan') || { priceSen: 3000 }).priceSen;
  const out = {};
  for (const m of MONTHS_OK) {
    const p = plans.find(x => x.months === m && x.active !== false);
    out[m] = p ? p.priceSen : m * monthly;
  }
  return out;
}

// Baca & sahkan butiran bayaran manual daripada borang admin
export function readManualPayment(p, months) {
  if (!p || typeof p !== 'object') return { error: 'Butiran bayaran tidak lengkap.' };
  if (!MONTHS_OK.includes(months)) return { error: 'Pilih 1, 3, 6 atau 12 bulan.' };
  const amountSen = Math.round(Number(p.amountSen));
  if (!Number.isFinite(amountSen) || amountSen < 100 || amountSen > 1000000) return { error: 'Jumlah bayaran mesti antara RM1 dan RM10,000.' };
  const method = String(p.method || '');
  if (!PAY_METHODS[method]) return { error: 'Sila pilih cara bayar.' };
  const t = now();
  let paidAt = t;
  if (p.paidOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.paidOn))) return { error: 'Tarikh bayar tidak sah.' };
    const d = Date.parse(p.paidOn + 'T12:00:00+08:00');
    const today = Date.parse(new Date(t + MYT).toISOString().slice(0, 10) + 'T12:00:00+08:00');
    if (!Number.isFinite(d) || d > today) return { error: 'Tarikh bayar tidak boleh selepas hari ini.' };
    if (d < t - 400 * DAY) return { error: 'Tarikh bayar terlalu lama (lebih setahun).' };
    // hari ini = masa sekarang; tarikh lepas = tengah hari tarikh itu (waktu Malaysia)
    paidAt = d === today ? t : d;
  }
  return { amountSen, method, paidAt, note: cleanText(p.note, 120) || null };
}

export function manualPaymentStmt(env, userId, months, p) {
  return env.DB.prepare(`INSERT INTO payments (user_id, purpose, plan, months, amount_sen, provider, status, pay_method, message, created_at, completed_at)
    VALUES (?, 'langganan', 'manual', ?, ?, 'manual', 'completed', ?, ?, ?, ?)`)
    .bind(userId, months, p.amountSen, p.method, p.note, now(), p.paidAt);
}

// Rekod bayaran sahaja (tanpa tambah tempoh) — untuk pelajar yang dah diaktifkan manual sebelum ini
export async function adminRecordPayment(env, request, userId) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  const u = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!u) return fail(404, 'Pelajar tidak dijumpai.');
  const p = readManualPayment(b, Number(b.months));
  if (p.error) return fail(400, p.error);
  await manualPaymentStmt(env, userId, Number(b.months), p).run();
  return json({ ok: true });
}

export async function adminCancelPayment(env, request, id) {
  await requireAdmin(env, request);
  const p = await env.DB.prepare('SELECT id, provider, status FROM payments WHERE id = ?').bind(id).first();
  if (!p) return fail(404, 'Rekod bayaran tidak dijumpai.');
  if (p.provider !== 'manual') return fail(400, 'Hanya rekod bayaran manual boleh dibatalkan di sini.');
  if (p.status !== 'completed') return fail(400, 'Rekod ini sudah dibatalkan.');
  await env.DB.prepare("UPDATE payments SET status = 'batal' WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

const payOut = p => ({
  id: p.id, plan: p.plan, months: p.months, amountSen: p.amount_sen, status: p.status, auto: p.recurring > 0,
  manual: p.provider === 'manual', method: p.pay_method || null, note: p.provider === 'manual' ? p.message || null : null,
  paidAt: p.completed_at || p.created_at,
});

// Sejarah bayaran seorang pelajar + harga cadangan (borang langganan manual)
export async function adminUserPayments(env, request, userId) {
  await requireAdmin(env, request);
  const { results } = await env.DB.prepare(`SELECT * FROM payments WHERE user_id = ? AND purpose = 'langganan' AND status IN ('completed', 'semak', 'batal')
      ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 20`).bind(userId).all();
  return json({ ok: true, payments: results.map(payOut), prices: await suggestedPrices(env) });
}

// ---------- kutipan ikut tempoh (papan pemuka) ----------
const dayStart = ymd => Date.parse(ymd + 'T00:00:00+08:00');
const ymdOf = ms => new Date(ms + MYT).toISOString().slice(0, 10);
const isYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(dayStart(s));

// Tempoh banding: bulan kalendar penuh → bulan sebelumnya (tempoh berlalu yang sama);
// selain itu → tempoh sama panjang sejurus sebelum. Tempoh yang belum habis dibanding setakat hari ini sahaja.
export function compareRange(start, end, t) {
  const effEnd = Math.min(end, t);
  const s = new Date(start + MYT), e = new Date(end - 1 + MYT);
  const fullMonth = s.getUTCDate() === 1 && s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()
    && new Date(end + MYT).getUTCDate() === 1;
  if (fullMonth) {
    const pStart = dayStart(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1)).toISOString().slice(0, 10));
    return [pStart, Math.min(start, pStart + Math.max(0, effEnd - start))];
  }
  const len = end - start;
  return [start - len, start - len + Math.max(0, effEnd - start)];
}

export async function adminRange(env, request) {
  await requireAdmin(env, request);
  const q = new URL(request.url).searchParams;
  const from = q.get('from'), to = q.get('to');
  if (!isYmd(from) || !isYmd(to) || from > to) return fail(400, 'Tarikh tempoh tidak sah.');
  const start = dayStart(from), end = dayStart(to) + DAY;
  if (end - start > 731 * DAY) return fail(400, 'Tempoh maksimum 2 tahun.');
  const t = now();
  const [pStart, pEnd] = compareRange(start, end, t);
  const lo = Math.min(start, pStart);
  const [pays, users, pUsers] = await Promise.all([
    env.DB.prepare(`SELECT purpose, provider, amount_sen, completed_at FROM payments WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`).bind(lo, end).all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ?').bind(start, end).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ?').bind(pStart, pEnd).first(),
  ]);
  const blank = () => ({ langganan: 0, langgananChip: 0, langgananManual: 0, sumbangan: 0, subs: 0 });
  const cur = blank(), prev = blank();
  // Lajur: harian (≤ 62 hari) atau bulanan
  const byMonth = end - start > 62 * DAY;
  const keyOf = ms => byMonth ? ymdOf(ms).slice(0, 7) : ymdOf(ms);
  const buckets = new Map();
  for (let d = start; d < end; d += DAY) { const k = keyOf(d); if (!buckets.has(k)) buckets.set(k, { key: k, langganan: 0, sumbangan: 0 }); }
  for (const p of pays.results) {
    const at = p.completed_at;
    const into = at >= start && at < end ? cur : at >= pStart && at < pEnd ? prev : null;
    if (!into) continue;
    if (p.purpose === 'langganan') {
      into.langganan += p.amount_sen; into.subs++;
      if (p.provider === 'manual') into.langgananManual += p.amount_sen; else into.langgananChip += p.amount_sen;
    } else if (p.purpose === 'sumbangan') into.sumbangan += p.amount_sen;
    if (into === cur) { const b = buckets.get(keyOf(at)); if (b) b[p.purpose === 'langganan' ? 'langganan' : 'sumbangan'] += p.amount_sen; }
  }
  cur.newUsers = users.n; prev.newUsers = pUsers.n;
  return json({ ok: true, from, to, unit: byMonth ? 'month' : 'day', prevFrom: ymdOf(pStart), prevTo: ymdOf(Math.max(pStart, pEnd - 1)),
    current: cur, previous: prev, buckets: [...buckets.values()] });
}

// ---------- eksport kutipan (CSV) ikut tempoh ----------
const cell = v => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export async function adminExportPayments(env, request) {
  await requireAdmin(env, request);
  const q = new URL(request.url).searchParams;
  const from = q.get('from'), to = q.get('to');
  if (!isYmd(from) || !isYmd(to) || from > to) return fail(400, 'Tarikh tempoh tidak sah.');
  const { results } = await env.DB.prepare(`SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.status = 'completed' AND p.completed_at >= ? AND p.completed_at < ? ORDER BY p.completed_at`).bind(dayStart(from), dayStart(to) + DAY).all();
  const rows = [['Tarikh', 'Jenis', 'Nama', 'Tempoh (bulan)', 'Jumlah (RM)', 'Sumber', 'Cara bayar', 'Rujukan', 'Nota']];
  for (const p of results) {
    const lang = p.purpose === 'langganan';
    const name = lang ? (p.user_name || '(akaun dipadam)') : p.anonymous ? `${p.donor_name || ''} (tanpa nama)` : (p.donor_name || '');
    rows.push([ymdOf(p.completed_at), lang ? 'Langganan' : 'Sumbangan', name, lang ? p.months || '' : '', (p.amount_sen / 100).toFixed(2),
      p.provider === 'manual' ? 'Manual' : 'CHIP', p.provider === 'manual' ? PAY_METHODS[p.pay_method] || '' : '', p.provider === 'manual' ? '' : p.provider_ref || '', p.message || '']);
  }
  const csv = '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="kutipan-${from}-hingga-${to}.csv"`, 'cache-control': 'no-store' } });
}
