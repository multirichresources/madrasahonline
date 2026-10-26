// Bayaran langganan melalui CHIP Collect (chip-in.asia).
//
// Aliran:
//  1. Pelajar pilih pakej → /api/pay/checkout cipta Purchase di CHIP → pelajar dibawa ke halaman bayaran CHIP.
//  2. Selepas bayar, CHIP panggil /api/pay/callback dan pelajar kembali ke /?bayar=berjaya.
//     Kedua-duanya hanya mencetuskan semakan; status SEBENAR sentiasa diambil semula dari API CHIP
//     menggunakan secret key kita, jadi callback palsu tidak boleh mengaktifkan langganan.
//  3. Auto-renew (kad sahaja): CHIP simpan token kad. Cron kita caj token sehari sebelum tamat.
//
// Secret yang diperlukan (Cloudflare → Settings → Variables and Secrets):
//   CHIP_SECRET_KEY  — dari portal CHIP → Developers → API keys
//   CHIP_BRAND_ID    — dari portal CHIP → Developers → Brands
import { now, json, fail, readJson, cleanText, rateLimit } from './util.js';
import { requireUser, requireAdmin } from './auth.js';
import { notify, processJobs } from './push.js';
import { chargeDonors } from './donations.js';
import { webBase, setWebUntilStmt, googleReady, appleReady } from './store.js';

export const CARD_METHODS = ['visa', 'mastercard', 'maestro'];
const MAX_RENEW_FAILS = 3;

export const billingReady = (env) => !!(env.CHIP_SECRET_KEY && env.CHIP_BRAND_ID);
const apiBase = (env) => env.CHIP_API_BASE || 'https://gate.chip-in.asia/api/v1';

export async function chip(env, method, path, body) {
  const r = await fetch(apiBase(env) + path, {
    method,
    headers: { authorization: `Bearer ${env.CHIP_SECRET_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!r.ok) {
    const err = new Error(`CHIP ${method} ${path} ${r.status}: ${text.slice(0, 300)}`);
    err.status = r.status; err.data = data;
    throw err;
  }
  return data;
}

// ---------- pakej ----------
const DEFAULT_PLANS = [
  { id: 'bulanan', label: 'Bulanan', months: 1, priceSen: 1000, active: true },
  { id: '3bulan', label: '3 Bulan', months: 3, priceSen: 3000, active: false },
  { id: '6bulan', label: '6 Bulan', months: 6, priceSen: 5500, active: false },
  { id: 'tahunan', label: 'Setahun', months: 12, priceSen: 11000, active: false },
];

// Bayaran kad (auto-renew & sumbangan bulanan) dibuka oleh admin selepas CHIP meluluskan kad.
// Lalai: tutup (hanya FPX / DuitNow / e-wallet). Caj auto-renew sedia ada (cron) tidak terjejas.
export async function cardEnabled(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'card_enabled'").first();
  return !!row && row.value === '1';
}
export const CARD_OFF_MSG = 'Bayaran kad belum dibuka. Sila pilih FPX, DuitNow QR atau e-wallet.';

export async function getPlans(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'plans'").first();
  if (!row || !row.value) return DEFAULT_PLANS;
  try {
    const saved = JSON.parse(row.value);
    return DEFAULT_PLANS.map(d => ({ ...d, ...(saved.find(p => p.id === d.id) || {}), id: d.id, months: d.months }));
  } catch { return DEFAULT_PLANS; }
}

export async function adminGetPlans(env, request) {
  await requireAdmin(env, request);
  return json({ ok: true, plans: await getPlans(env), billingReady: billingReady(env), cardEnabled: await cardEnabled(env) });
}

export async function adminSavePlans(env, request) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  const list = Array.isArray(b.plans) ? b.plans : [];
  const out = [];
  for (const d of DEFAULT_PLANS) {
    const p = list.find(x => x && x.id === d.id) || d;
    const priceSen = Math.round(Number(p.priceSen));
    if (!Number.isInteger(priceSen) || priceSen < 100 || priceSen > 100000) return fail(400, `Harga pakej ${d.label} tidak sah (RM1 hingga RM1,000).`);
    out.push({ id: d.id, label: cleanText(p.label, 30) || d.label, priceSen, active: !!p.active });
  }
  if (!out.some(p => p.active)) return fail(400, 'Sekurang-kurangnya satu pakej mesti dibuka.');
  const upsert = "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at";
  const stmts = [env.DB.prepare(upsert).bind('plans', JSON.stringify(out), now())];
  if (typeof b.cardEnabled === 'boolean') stmts.push(env.DB.prepare(upsert).bind('card_enabled', b.cardEnabled ? '1' : '0', now()));
  await env.DB.batch(stmts);
  return json({ ok: true, plans: await getPlans(env), cardEnabled: await cardEnabled(env) });
}

export async function publicPlans(env, request) {
  await requireUser(env, request);
  // productId = ID produk langganan dalam Play Console / App Store Connect (cth. madrasah.bulanan)
  const plans = (await getPlans(env)).filter(p => p.active).map(p => ({ id: p.id, label: p.label, months: p.months, priceSen: p.priceSen, productId: `madrasah.${p.id}` }));
  return json({ ok: true, billingReady: billingReady(env), cardEnabled: await cardEnabled(env), storeReady: { google: googleReady(env), apple: appleReady(env) }, plans });
}

// ---------- tambah tempoh langganan (idempotent) ----------
export function addMonths(fromMs, months) {
  const d = new Date(fromMs);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

// Tandakan bayaran selesai dan panjangkan langganan. Selamat dipanggil berulang kali
// (callback, redirect, cron) — hanya panggilan pertama yang mengubah apa-apa.
async function fulfil(env, pay, purchase) {
  const t = now();
  const upd = await env.DB.prepare("UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'completed'").bind(t, pay.id).run();
  if (!upd.meta.changes) return false;
  if (pay.purpose === 'sumbangan') {
    // Sumbangan bulanan pertama: simpan token kad dan jadualkan caj seterusnya
    if (pay.donor_id && purchase && purchase.is_recurring_token) {
      await env.DB.prepare('UPDATE donors SET active = 1, chip_token = ?, next_charge_at = ?, fails = 0 WHERE id = ? AND chip_token IS NULL')
        .bind(purchase.id, addMonths(t, 1), pay.donor_id).run();
    }
    return true;
  }
  if (!pay.user_id) return true;
  const u = await env.DB.prepare('SELECT paid_until, web_paid_until FROM users WHERE id = ?').bind(pay.user_id).first();
  if (!u) return true;
  const until = addMonths(Math.max(t, webBase(u)), pay.months || 1);
  const tokenSaved = !!(purchase && purchase.is_recurring_token);
  if (tokenSaved) {
    await setWebUntilStmt(env, pay.user_id, until, 'plan = ?, auto_renew = 1, chip_token = ?, renew_fails = 0, renew_attempt_at = NULL', [pay.plan, purchase.id]).run();
  } else {
    await setWebUntilStmt(env, pay.user_id, until, 'plan = ?, renew_fails = 0, renew_attempt_at = NULL', [pay.plan]).run();
  }
  return true;
}

// Ambil status sebenar dari CHIP dan kemas kini rekod.
export async function syncPayment(env, pay) {
  const p = await chip(env, 'GET', `/purchases/${encodeURIComponent(pay.provider_ref)}/`);
  const total = p.purchase && (p.purchase.total ?? p.purchase.total_override);
  if (p.status === 'paid') {
    if (total != null && Number(total) !== pay.amount_sen) {
      console.error('Jumlah tidak sepadan', pay.id, total, pay.amount_sen);
      await env.DB.prepare("UPDATE payments SET status = 'semak' WHERE id = ?").bind(pay.id).run();
      return 'semak';
    }
    await fulfil(env, pay, p);
    return 'completed';
  }
  if (['error', 'cancelled', 'expired', 'blocked', 'refunded'].includes(p.status)) {
    await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'").bind(pay.id).run();
    return 'failed';
  }
  return 'pending';
}

// ---------- API pelajar ----------
export async function checkout(env, request) {
  const u = await requireUser(env, request);
  if (!billingReady(env)) return fail(503, 'Sistem bayaran belum dibuka. Admin akan maklumkan bila sedia.');
  if (!(await rateLimit(env.DB, 'checkout:' + u.id, 10, 3600e3))) return fail(429, 'Terlalu banyak cubaan. Cuba lagi sebentar.');
  if (!u.email) return fail(400, 'Sila tambah emel anda dahulu di menu Akaun. Resit bayaran akan dihantar ke emel tersebut.');
  const b = await readJson(request);
  const plan = (await getPlans(env)).find(p => p.id === b.planId && p.active);
  if (!plan) return fail(400, 'Sila pilih pakej.');
  const auto = !!b.auto;
  if (auto && !(await cardEnabled(env))) return fail(400, CARD_OFF_MSG);
  if (auto && u.auto_renew && u.chip_token && u.paid_until > now()) return fail(400, 'Auto-renew anda sudah aktif.');
  const origin = new URL(request.url).origin;
  const t = now();
  // Simpan alamat app untuk callback auto-renew (cron tiada URL permintaan)
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('app_origin', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(origin, t).run();
  const pay = await env.DB.prepare("INSERT INTO payments (user_id, purpose, plan, months, amount_sen, provider, status, recurring, created_at) VALUES (?, 'langganan', ?, ?, ?, 'chip', 'pending', ?, ?) RETURNING *")
    .bind(u.id, plan.id, plan.months, plan.priceSen, auto ? 1 : 0, t).first();
  let p;
  try {
    p = await chip(env, 'POST', '/purchases/', {
      brand_id: env.CHIP_BRAND_ID,
      client: { email: u.email, full_name: u.name.slice(0, 128), phone: '+' + u.phone },
      purchase: { currency: 'MYR', products: [{ name: `Langganan Madrasah Online (${plan.label})`, price: plan.priceSen, quantity: 1 }] },
      reference: `MO-${pay.id}`,
      send_receipt: true,
      force_recurring: auto,
      ...(auto ? { payment_method_whitelist: CARD_METHODS } : {}),
      success_redirect: `${origin}/?bayar=berjaya&p=${pay.id}`,
      failure_redirect: `${origin}/?bayar=gagal&p=${pay.id}`,
      cancel_redirect: `${origin}/?bayar=batal&p=${pay.id}`,
      success_callback: `${origin}/api/pay/callback`,
      platform: 'web',
      creator_agent: 'MadrasahOnline/1.0',
    });
  } catch (e) {
    console.error('checkout', String(e));
    await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").bind(pay.id).run();
    return fail(502, 'Tidak dapat menyambung ke sistem bayaran. Cuba lagi sebentar.');
  }
  await env.DB.prepare('UPDATE payments SET provider_ref = ? WHERE id = ?').bind(p.id, pay.id).run();
  return json({ ok: true, checkoutUrl: p.checkout_url, paymentId: pay.id });
}

// Dipanggil selepas pelajar kembali dari halaman CHIP.
export async function confirmPayment(env, request) {
  const u = await requireUser(env, request);
  const b = await readJson(request);
  const pay = await env.DB.prepare('SELECT * FROM payments WHERE id = ? AND user_id = ?').bind(Number(b.paymentId), u.id).first();
  if (!pay || !pay.provider_ref) return fail(404, 'Rekod bayaran tidak dijumpai.');
  let status = pay.status;
  if (status === 'pending' && billingReady(env)) {
    try { status = await syncPayment(env, pay); } catch (e) { console.error('confirm', String(e)); }
  }
  const fresh = await env.DB.prepare('SELECT paid_until, auto_renew FROM users WHERE id = ?').bind(u.id).first();
  // 'payStatus' (bukan 'status') supaya tidak bertembung dengan kod HTTP dalam api() di pelayar
  return json({ ok: true, payStatus: status, paidUntil: fresh.paid_until, autoRenew: !!fresh.auto_renew });
}

// Callback dari CHIP (tanpa login). Kita hanya guna id Purchase, kemudian semak dengan CHIP sendiri.
export async function chipCallback(env, request) {
  let id = null;
  try { id = (await request.json()).id; } catch {}
  if (!id || !billingReady(env)) return json({ ok: true });
  const pay = await env.DB.prepare('SELECT * FROM payments WHERE provider_ref = ?').bind(String(id)).first();
  if (pay && pay.status !== 'completed') {
    try { await syncPayment(env, pay); } catch (e) { console.error('callback', String(e)); }
  }
  return json({ ok: true });
}

export async function stopAutoRenew(env, request) {
  const u = await requireUser(env, request);
  await cancelToken(env, u);
  await env.DB.prepare('UPDATE users SET auto_renew = 0, chip_token = NULL WHERE id = ?').bind(u.id).run();
  return json({ ok: true });
}

// Padam token kad di CHIP (cubaan terbaik; tidak menggagalkan proses jika CHIP tak dapat dihubungi)
export async function cancelToken(env, u) {
  if (!u.chip_token || !billingReady(env)) return;
  try { await chip(env, 'POST', `/purchases/${encodeURIComponent(u.chip_token)}/delete_recurring_token/`); }
  catch (e) { console.warn('padam token', String(e)); }
}

export async function myPayments(env, request) {
  const u = await requireUser(env, request);
  const { results } = await env.DB.prepare("SELECT id, plan, months, amount_sen, status, recurring, created_at, completed_at FROM payments WHERE user_id = ? AND status IN ('completed', 'semak') ORDER BY created_at DESC LIMIT 24").bind(u.id).all();
  return json({ ok: true, payments: results.map(p => ({ id: p.id, plan: p.plan, months: p.months, amountSen: p.amount_sen, status: p.status, auto: !!p.recurring, paidAt: p.completed_at || p.created_at })) });
}

// ---------- cron: auto-renew & semakan bayaran tergantung ----------
export async function runBilling(env) {
  if (!billingReady(env)) return;
  const t = now();
  // 1. Semak semula bayaran yang masih "pending" (callback mungkin tak sampai)
  const pend = await env.DB.prepare("SELECT * FROM payments WHERE status = 'pending' AND provider_ref IS NOT NULL AND created_at < ? AND created_at > ? ORDER BY created_at LIMIT 8")
    .bind(t - 5 * 60e3, t - 3 * 864e5).all();
  for (const pay of pend.results) {
    try { await syncPayment(env, pay); } catch (e) { console.warn('semak bayaran', String(e)); }
  }
  // Sumbangan bulanan (kad) yang tiba masanya
  try { await chargeDonors(env, t); } catch (e) { console.error('sumbangan bulanan', e); }
  // 2. Bayaran yang terlalu lama tergantung → gagal
  await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE status = 'pending' AND created_at < ?").bind(t - 3 * 864e5).run();

  // 3. Auto-renew: caj sehari sebelum tamat; cuba semula setiap 24 jam, paling banyak 3 kali
  const due = await env.DB.prepare(`SELECT * FROM users WHERE auto_renew = 1 AND chip_token IS NOT NULL
      AND paid_until IS NOT NULL AND paid_until <= ? AND (renew_attempt_at IS NULL OR renew_attempt_at < ?)
      ORDER BY paid_until LIMIT 6`).bind(t + 864e5, t - 23 * 3600e3).all();
  const plans = await getPlans(env);
  const appOrigin = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_origin'").first())?.value;
  let notified = false;
  for (const u of due.results) {
    // Elak caj berganda: jika ada bayaran auto-renew yang masih diproses, tunggu
    const inflight = await env.DB.prepare("SELECT id FROM payments WHERE user_id = ? AND recurring = 2 AND status = 'pending' AND created_at > ?").bind(u.id, t - 864e5).first();
    if (inflight) continue;
    await env.DB.prepare('UPDATE users SET renew_attempt_at = ? WHERE id = ?').bind(t, u.id).run();
    const plan = plans.find(p => p.id === u.plan) || plans.find(p => p.id === 'bulanan');
    const pay = await env.DB.prepare("INSERT INTO payments (user_id, purpose, plan, months, amount_sen, provider, status, recurring, created_at) VALUES (?, 'langganan', ?, ?, ?, 'chip', 'pending', 2, ?) RETURNING *")
      .bind(u.id, plan.id, plan.months, plan.priceSen, t).first();
    let result = 'gagal', reason = '';
    try {
      const p = await chip(env, 'POST', '/purchases/', {
        brand_id: env.CHIP_BRAND_ID,
        client: { email: u.email, full_name: u.name.slice(0, 128) },
        purchase: { currency: 'MYR', products: [{ name: `Langganan Madrasah Online (${plan.label}, auto-renew)`, price: plan.priceSen, quantity: 1 }] },
        reference: `MO-${pay.id}`,
        send_receipt: true,
        ...(appOrigin ? { success_callback: `${appOrigin}/api/pay/callback` } : {}),
        platform: 'api',
        creator_agent: 'MadrasahOnline/1.0',
      });
      await env.DB.prepare('UPDATE payments SET provider_ref = ? WHERE id = ?').bind(p.id, pay.id).run();
      const c = await chip(env, 'POST', `/purchases/${encodeURIComponent(p.id)}/charge/`, { recurring_token: u.chip_token });
      if (c.status === 'paid') { await fulfil(env, { ...pay, provider_ref: p.id }, null); result = 'ok'; }
      else result = 'pending'; // pending_charge: callback / cron seterusnya akan sahkan
    } catch (e) {
      const code = e.data && (e.data.__all__?.[0]?.code || e.data.code);
      reason = code === 'invalid_recurring_token' ? 'token' : 'caj';
      console.warn('auto-renew', u.id, String(e));
      await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").bind(pay.id).run();
    }
    if (result === 'gagal') {
      const fails = (u.renew_fails || 0) + 1;
      const stop = reason === 'token' || fails >= MAX_RENEW_FAILS;
      await env.DB.prepare(`UPDATE users SET renew_fails = ?${stop ? ', auto_renew = 0, chip_token = NULL' : ''} WHERE id = ?`).bind(fails, u.id).run();
      await notify(env, { kind: 'user', userId: u.id }, stop
        ? { ms: { title: 'Auto-renew dihentikan', body: 'Kad anda tidak dapat dicaj. Sila langgan semula di menu Akaun untuk terus menonton video kelas.' },
            en: { title: 'Auto-renew stopped', body: 'Your card could not be charged. Please subscribe again in the Account menu to keep watching class videos.' }, url: '/' }
        : { ms: { title: 'Bayaran automatik tidak berjaya', body: 'Kami akan cuba lagi esok. Pastikan kad anda aktif dan ada baki mencukupi.' },
            en: { title: 'Automatic payment failed', body: "We'll try again tomorrow. Please make sure your card is active and has enough balance." }, url: '/' });
      notified = true;
    }
  }
  if (notified) await processJobs(env, 10);
}

// ---------- admin ----------
export async function adminPayments(env, request) {
  await requireAdmin(env, request);
  const { results } = await env.DB.prepare(`SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.purpose = 'langganan' AND p.status IN ('completed', 'semak') ORDER BY COALESCE(p.completed_at, p.created_at) DESC LIMIT 50`).all();
  return json({ ok: true, payments: results.map(p => ({ id: p.id, name: p.user_name || '(akaun dipadam)', plan: p.plan, months: p.months, amountSen: p.amount_sen, status: p.status, auto: p.recurring > 0, ref: p.provider_ref, paidAt: p.completed_at || p.created_at })) });
}
