// Sumbangan & Taja Pelajar.
//
// - Halaman awam /sumbang: sesiapa boleh menyumbang tanpa akaun (sekali, atau setiap bulan dengan kad).
// - Dua tujuan: 'taja' (dana untuk menaja langganan pelajar kurang mampu) dan 'umum' (operasi madrasah).
// - Rekod sumbangan (payments.purpose = 'sumbangan') diasingkan daripada yuran langganan.
// - Admin guna baki dana taja untuk melanjutkan langganan pelajar tertentu (jadual sponsorships).
// - Penyumbang bulanan tiada akaun; mereka urus sumbangan melalui pautan rahsia /sumbang?urus=TOKEN.
import { now, json, fail, readJson, cleanText, cleanMultiline, validEmail, normalizePhone, randomToken, sha256Hex, rateLimit, clientIp, displayPhone } from './util.js';
import { requireAdmin } from './auth.js';
import { chip, billingReady, CARD_METHODS, addMonths, syncPayment, getPlans } from './billing.js';
import { getOrg } from './content.js';

const MIN_SEN = 500, MAX_SEN = 1000000;
const USES = { taja: 'Taja Pelajar', umum: 'Sumbangan Am' };

async function monthlyPriceSen(env) {
  const p = (await getPlans(env)).find(x => x.id === 'bulanan');
  return p ? p.priceSen : 1000;
}

async function tajaBalance(env) {
  const [inn, used] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(amount_sen), 0) AS s FROM payments WHERE purpose = 'sumbangan' AND donation_use = 'taja' AND status = 'completed'"),
    env.DB.prepare('SELECT COALESCE(SUM(amount_sen), 0) AS s FROM sponsorships'),
  ]);
  return { inSen: inn.results[0].s, usedSen: used.results[0].s, balanceSen: inn.results[0].s - used.results[0].s };
}

// ---------- awam ----------
export async function donateInfo(env) {
  const t = now();
  const [months, donors, recent] = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(months), 0) AS n, COUNT(DISTINCT user_id) AS students FROM sponsorships'),
    env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(donor_email, id)) AS n FROM payments WHERE purpose = 'sumbangan' AND status = 'completed'"),
    env.DB.prepare("SELECT donor_name, anonymous, donation_use, completed_at FROM payments WHERE purpose = 'sumbangan' AND status = 'completed' ORDER BY completed_at DESC LIMIT 8"),
  ]);
  const org = await getOrg(env);
  return json({
    ok: true,
    ready: billingReady(env),
    monthPriceSen: await monthlyPriceSen(env),
    org: { name: org.name },
    stats: { tajaMonths: months.results[0].n, studentsSponsored: months.results[0].students, donors: donors.results[0].n },
    recent: recent.results.map(r => ({ name: r.anonymous || !r.donor_name ? 'Hamba Allah' : r.donor_name.split(/\s+/).slice(0, 2).join(' '), use: r.donation_use, at: r.completed_at })),
    now: t,
  });
}

export async function donateCheckout(env, request) {
  if (!billingReady(env)) return fail(503, 'Saluran sumbangan belum dibuka.');
  if (!(await rateLimit(env.DB, 'donate:' + clientIp(request), 10, 3600e3))) return fail(429, 'Terlalu banyak cubaan. Cuba lagi sebentar.');
  const b = await readJson(request);
  const use = b.use === 'umum' ? 'umum' : b.use === 'taja' ? 'taja' : null;
  if (!use) return fail(400, 'Sila pilih tujuan sumbangan.');
  const amountSen = Math.round(Number(b.amountSen));
  if (!Number.isInteger(amountSen) || amountSen < MIN_SEN || amountSen > MAX_SEN) return fail(400, 'Jumlah sumbangan mestilah antara RM5 dan RM10,000.');
  const email = cleanText(b.email, 254).toLowerCase();
  if (!validEmail(email)) return fail(400, 'Sila masukkan emel yang sah. Resit akan dihantar ke emel ini.');
  const name = cleanText(b.name, 80);
  const anonymous = b.anonymous ? 1 : 0;
  if (!name && !anonymous) return fail(400, 'Sila masukkan nama, atau tandakan "Jangan paparkan nama saya".');
  let phone = null;
  if (cleanText(b.phone, 30)) { phone = normalizePhone(b.phone); if (!phone) return fail(400, 'No. telefon tidak sah.'); }
  const message = cleanMultiline(b.message, 300) || null;
  const monthly = !!b.monthly;
  const origin = new URL(request.url).origin;
  const t = now();
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('app_origin', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(origin, t).run();

  let donorId = null, manageToken = null;
  if (monthly) {
    manageToken = randomToken(24);
    const d = await env.DB.prepare('INSERT INTO donors (name, email, phone, anonymous, donation_use, amount_sen, active, fails, manage_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?) RETURNING id')
      .bind(name || null, email, phone, anonymous, use, amountSen, await sha256Hex(manageToken), t).first();
    donorId = d.id;
  }
  const access = randomToken(18);
  const pay = await env.DB.prepare(`INSERT INTO payments (user_id, purpose, plan, months, amount_sen, provider, status, donor_name, donor_email, donor_phone, anonymous, message, donation_use, donor_id, recurring, access_hash, created_at)
      VALUES (NULL, 'sumbangan', NULL, NULL, ?, 'chip', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(amountSen, name || null, email, phone, anonymous, message, use, donorId, monthly ? 1 : 0, await sha256Hex(access), t).first();
  const back = `${origin}/sumbang?d=${pay.id}&k=${access}${manageToken ? '&urus=' + manageToken : ''}`;
  let p;
  try {
    p = await chip(env, 'POST', '/purchases/', {
      brand_id: env.CHIP_BRAND_ID,
      client: { email, full_name: (name || 'Hamba Allah').slice(0, 128), ...(phone ? { phone: '+' + phone } : {}) },
      purchase: { currency: 'MYR', products: [{ name: `${USES[use]} Madrasah Online${monthly ? ' (bulanan)' : ''}`, price: amountSen, quantity: 1 }] },
      reference: `MO-S${pay.id}`,
      send_receipt: true,
      force_recurring: monthly,
      ...(monthly ? { payment_method_whitelist: CARD_METHODS } : {}),
      success_redirect: back + '&status=berjaya',
      failure_redirect: back + '&status=gagal',
      cancel_redirect: `${origin}/sumbang?status=batal`,
      success_callback: `${origin}/api/pay/callback`,
      platform: 'web',
      creator_agent: 'MadrasahOnline/1.0',
    });
  } catch (e) {
    console.error('sumbang', String(e));
    await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").bind(pay.id).run();
    return fail(502, 'Tidak dapat menyambung ke sistem bayaran. Cuba lagi sebentar.');
  }
  await env.DB.prepare('UPDATE payments SET provider_ref = ? WHERE id = ?').bind(p.id, pay.id).run();
  return json({ ok: true, checkoutUrl: p.checkout_url });
}

// Halaman terima kasih: semak status dengan token akses (tiada login untuk penyumbang)
export async function donateConfirm(env, request) {
  const b = await readJson(request);
  const pay = await env.DB.prepare("SELECT * FROM payments WHERE id = ? AND purpose = 'sumbangan'").bind(Number(b.id)).first();
  if (!pay || !pay.access_hash || pay.access_hash !== await sha256Hex(String(b.token || ''))) return fail(404, 'Rekod sumbangan tidak dijumpai.');
  let status = pay.status;
  if (status === 'pending' && billingReady(env) && pay.provider_ref) {
    try { status = await syncPayment(env, pay); } catch (e) { console.error('sahkan sumbangan', String(e)); }
  }
  return json({ ok: true, payStatus: status, amountSen: pay.amount_sen, use: pay.donation_use, monthly: pay.recurring === 1 });
}

async function donorByToken(env, token) {
  if (!token || String(token).length < 20) return null;
  return env.DB.prepare('SELECT * FROM donors WHERE manage_hash = ?').bind(await sha256Hex(String(token))).first();
}

export async function donorManage(env, request) {
  const d = await donorByToken(env, new URL(request.url).searchParams.get('token'));
  if (!d) return fail(404, 'Pautan tidak sah.');
  return json({ ok: true, donor: { name: d.anonymous ? 'Hamba Allah' : d.name, amountSen: d.amount_sen, use: d.donation_use, active: !!d.active, nextChargeAt: d.next_charge_at, stoppedAt: d.stopped_at } });
}

async function stopDonor(env, d) {
  if (d.chip_token && billingReady(env)) {
    try { await chip(env, 'POST', `/purchases/${encodeURIComponent(d.chip_token)}/delete_recurring_token/`); } catch (e) { console.warn('padam token sumbangan', String(e)); }
  }
  await env.DB.prepare('UPDATE donors SET active = 0, chip_token = NULL, stopped_at = ? WHERE id = ?').bind(now(), d.id).run();
}

export async function donorStop(env, request) {
  const b = await readJson(request);
  const d = await donorByToken(env, b.token);
  if (!d) return fail(404, 'Pautan tidak sah.');
  await stopDonor(env, d);
  return json({ ok: true });
}

// ---------- cron: caj sumbangan bulanan ----------
export async function chargeDonors(env, t) {
  const due = await env.DB.prepare(`SELECT * FROM donors WHERE active = 1 AND chip_token IS NOT NULL AND next_charge_at <= ?
      AND (attempt_at IS NULL OR attempt_at < ?) ORDER BY next_charge_at LIMIT 6`).bind(t, t - 23 * 3600e3).all();
  const origin = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_origin'").first())?.value;
  for (const d of due.results) {
    await env.DB.prepare('UPDATE donors SET attempt_at = ? WHERE id = ?').bind(t, d.id).run();
    const pay = await env.DB.prepare(`INSERT INTO payments (user_id, purpose, amount_sen, provider, status, donor_name, donor_email, donor_phone, anonymous, donation_use, donor_id, recurring, created_at)
        VALUES (NULL, 'sumbangan', ?, 'chip', 'pending', ?, ?, ?, ?, ?, ?, 2, ?) RETURNING *`)
      .bind(d.amount_sen, d.name, d.email, d.phone, d.anonymous, d.donation_use, d.id, t).first();
    try {
      const p = await chip(env, 'POST', '/purchases/', {
        brand_id: env.CHIP_BRAND_ID,
        client: { email: d.email, full_name: (d.name || 'Hamba Allah').slice(0, 128) },
        purchase: { currency: 'MYR', products: [{ name: `${USES[d.donation_use]} Madrasah Online (bulanan)`, price: d.amount_sen, quantity: 1 }] },
        reference: `MO-S${pay.id}`,
        send_receipt: true,
        ...(origin ? { success_callback: `${origin}/api/pay/callback` } : {}),
        platform: 'api',
        creator_agent: 'MadrasahOnline/1.0',
      });
      await env.DB.prepare('UPDATE payments SET provider_ref = ? WHERE id = ?').bind(p.id, pay.id).run();
      const c = await chip(env, 'POST', `/purchases/${encodeURIComponent(p.id)}/charge/`, { recurring_token: d.chip_token });
      // Berjaya atau sedang diproses: jadualkan bulan seterusnya (callback/cron akan sahkan bayaran)
      await env.DB.prepare('UPDATE donors SET next_charge_at = ?, fails = 0 WHERE id = ?').bind(addMonths(d.next_charge_at, 1), d.id).run();
      if (c.status === 'paid') await env.DB.prepare("UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?").bind(now(), pay.id).run();
    } catch (e) {
      const code = e.data && (e.data.__all__?.[0]?.code || e.data.code);
      console.warn('sumbangan bulanan', d.id, String(e));
      await env.DB.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").bind(pay.id).run();
      const fails = (d.fails || 0) + 1;
      if (code === 'invalid_recurring_token' || fails >= 3) {
        await env.DB.prepare('UPDATE donors SET active = 0, chip_token = NULL, fails = ?, stopped_at = ? WHERE id = ?').bind(fails, now(), d.id).run();
      } else {
        await env.DB.prepare('UPDATE donors SET fails = ? WHERE id = ?').bind(fails, d.id).run();
      }
    }
  }
}

// ---------- admin ----------
export async function adminDonations(env, request) {
  await requireAdmin(env, request);
  const t = now();
  const monthStart = new Date(t + 8 * 3600e3); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const ms = monthStart.getTime() - 8 * 3600e3; // awal bulan waktu Malaysia
  const [month, all, list, donors, spons] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(amount_sen), 0) AS s, COUNT(*) AS n FROM payments WHERE purpose = 'sumbangan' AND status = 'completed' AND completed_at >= ?").bind(ms),
    env.DB.prepare("SELECT donation_use AS use, COALESCE(SUM(amount_sen), 0) AS s FROM payments WHERE purpose = 'sumbangan' AND status = 'completed' GROUP BY donation_use"),
    env.DB.prepare("SELECT * FROM payments WHERE purpose = 'sumbangan' AND status IN ('completed', 'semak') ORDER BY completed_at DESC LIMIT 100"),
    env.DB.prepare('SELECT * FROM donors WHERE active = 1 ORDER BY created_at DESC'),
    env.DB.prepare('SELECT s.*, u.name AS user_name, a.name AS admin_name FROM sponsorships s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN admins a ON a.id = s.admin_id ORDER BY s.created_at DESC LIMIT 50'),
  ]);
  const byUse = Object.fromEntries(all.results.map(r => [r.use, r.s]));
  const bal = await tajaBalance(env);
  return json({
    ok: true,
    summary: {
      monthSen: month.results[0].s, monthCount: month.results[0].n,
      allSen: (byUse.taja || 0) + (byUse.umum || 0), tajaInSen: byUse.taja || 0, umumSen: byUse.umum || 0,
      tajaUsedSen: bal.usedSen, tajaBalanceSen: bal.balanceSen,
      monthlyDonors: donors.results.length, monthlyPledgeSen: donors.results.reduce((a, d) => a + d.amount_sen, 0),
      monthPriceSen: await monthlyPriceSen(env),
    },
    donations: list.results.map(p => ({
      id: p.id, name: p.donor_name || 'Hamba Allah', anonymous: !!p.anonymous, email: p.donor_email, phone: p.donor_phone ? displayPhone(p.donor_phone) : null,
      amountSen: p.amount_sen, use: p.donation_use, monthly: p.recurring > 0, message: p.message, status: p.status, at: p.completed_at || p.created_at,
    })),
    donors: donors.results.map(d => ({ id: d.id, name: d.name || 'Hamba Allah', email: d.email, amountSen: d.amount_sen, use: d.donation_use, nextChargeAt: d.next_charge_at, since: d.created_at })),
    sponsorships: spons.results.map(s => ({ id: s.id, student: s.user_name || '(akaun dipadam)', months: s.months, amountSen: s.amount_sen, by: s.admin_name || '', note: s.note, at: s.created_at })),
  });
}

export async function adminStopDonor(env, request, id) {
  await requireAdmin(env, request);
  const d = await env.DB.prepare('SELECT * FROM donors WHERE id = ?').bind(id).first();
  if (!d) return fail(404, 'Penyumbang tidak dijumpai.');
  await stopDonor(env, d);
  return json({ ok: true });
}

export async function adminTajaBalance(env, request) {
  await requireAdmin(env, request);
  const bal = await tajaBalance(env);
  return json({ ok: true, balanceSen: bal.balanceSen, monthPriceSen: await monthlyPriceSen(env) });
}

// Taja pelajar dari dana taja: lanjutkan langganan dan tolak dari baki.
export async function adminSponsor(env, request, userId) {
  const a = await requireAdmin(env, request);
  const b = await readJson(request);
  const months = Number(b.months);
  if (![1, 3, 6, 12].includes(months)) return fail(400, 'Pilih 1, 3, 6 atau 12 bulan.');
  const u = await env.DB.prepare('SELECT id, paid_until FROM users WHERE id = ?').bind(userId).first();
  if (!u) return fail(404, 'Pelajar tidak dijumpai.');
  const cost = months * await monthlyPriceSen(env);
  const bal = await tajaBalance(env);
  if (bal.balanceSen < cost) return fail(400, `Baki dana taja tidak mencukupi (baki RM${(bal.balanceSen / 100).toFixed(2)}, perlu RM${(cost / 100).toFixed(2)}).`);
  const t = now();
  const until = addMonths(Math.max(t, u.paid_until || 0), months);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sponsorships (user_id, months, amount_sen, admin_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, months, cost, a.id, cleanText(b.note, 120) || null, t),
    env.DB.prepare("UPDATE users SET paid_until = ?, plan = 'taja' WHERE id = ?").bind(until, userId),
  ]);
  return json({ ok: true, paidUntil: until, active: true, balanceSen: bal.balanceSen - cost });
}

const cell = v => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const ymd = ms => ms ? new Date(ms + 8 * 3600e3).toISOString().slice(0, 10) : '';

export async function adminExportDonations(env, request) {
  await requireAdmin(env, request);
  const { results } = await env.DB.prepare("SELECT * FROM payments WHERE purpose = 'sumbangan' AND status = 'completed' ORDER BY completed_at").all();
  const rows = [['Tarikh', 'Nama', 'Emel', 'No. telefon', 'Tujuan', 'Jenis', 'Jumlah (RM)', 'Rujukan CHIP', 'Mesej']];
  for (const p of results) rows.push([ymd(p.completed_at), p.anonymous ? `${p.donor_name || ''} (tanpa nama)` : (p.donor_name || ''), p.donor_email || '', p.donor_phone ? displayPhone(p.donor_phone) : '', USES[p.donation_use] || '', p.recurring > 0 ? 'Bulanan' : 'Sekali', (p.amount_sen / 100).toFixed(2), p.provider_ref || '', p.message || '']);
  const csv = '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="sumbangan-madrasah-online-${ymd(now())}.csv"`, 'cache-control': 'no-store' } });
}
