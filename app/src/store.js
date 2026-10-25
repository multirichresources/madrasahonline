// Langganan melalui Google Play & App Store (apps versi store).
//
// Prinsip: server TIDAK percaya data dari telefon atau notifikasi. Setiap token/transaksi
// disahkan terus dengan API Google / Apple, dan hasilnya disimpan dalam store_subscriptions.
// Tarikh tamat langganan pelajar (users.paid_until) = MAX(web_paid_until, langganan store yang sah).
//
// Konfigurasi (Cloudflare):
//   Google: var GOOGLE_PLAY_PACKAGE (cth. com.baitalsalihin.madrasah), secret GOOGLE_SERVICE_ACCOUNT (JSON akaun servis),
//           secret STORE_RTDN_TOKEN (rahsia dalam URL push Pub/Sub: /api/store/google/rtdn?token=...)
//   Apple:  var APPLE_BUNDLE_ID, secret APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (.p8), var APPLE_ENV (auto|Production|Sandbox)
//   Ujian:  GOOGLE_OAUTH_URL, GOOGLE_PLAY_API, APPLE_API_PROD, APPLE_API_SANDBOX (ganti alamat API dengan pelayan tiruan)
import { now, json, fail, readJson, cleanText, safeEqual } from './util.js';
import { requireUser } from './auth.js';
import { getPlans } from './billing.js';

// Status yang masih memberi akses: aktif, tempoh tangguh, dibatalkan (auto-renew mati tapi belum tamat)
const ENTITLED = "('active', 'grace', 'canceled')";
export const STORE_UNTIL_SQL = `COALESCE((SELECT MAX(s.expires_at) FROM store_subscriptions s WHERE s.user_id = users.id AND s.status IN ${ENTITLED}), 0)`;

// Tarikh asas untuk tambah tempoh web (CHIP / manual / taja), tanpa campur masa store.
// web_paid_until sentiasa <= paid_until; jika paid_until diubah terus dalam database, ikut paid_until.
export const webBase = u => (u.web_paid_until != null ? Math.min(u.web_paid_until, u.paid_until || 0) : (u.paid_until || 0));

// Tetapkan tempoh web dan kira semula paid_until
export function setWebUntilStmt(env, userId, until, extraSet = '', extraArgs = []) {
  return env.DB.prepare(`UPDATE users SET web_paid_until = ?, paid_until = MAX(?, ${STORE_UNTIL_SQL})${extraSet ? ', ' + extraSet : ''} WHERE id = ?`)
    .bind(until, until, ...extraArgs, userId);
}

export async function refreshEntitlement(env, userId) {
  // web_paid_until NULL = rekod lama (sebelum ada store): paid_until ketika itu ialah tempoh web sepenuhnya
  const web = 'COALESCE(MIN(web_paid_until, COALESCE(paid_until, 0)), paid_until, 0)';
  await env.DB.prepare(`UPDATE users SET web_paid_until = ${web}, paid_until = MAX(${web}, ${STORE_UNTIL_SQL}) WHERE id = ?`).bind(userId).run();
}

// ---------- utiliti JWT ----------
const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uJson = o => b64u(enc.encode(JSON.stringify(o)));
function pemToDer(pem) {
  const body = String(pem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), c => c.charCodeAt(0));
}
// Baca bahagian payload JWS (data dari API rasmi; tandatangan tidak disemak di sini)
export function jwsPayload(jws) {
  try {
    const p = String(jws).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p + '==='.slice((p.length + 3) % 4)), c => c.charCodeAt(0))));
  } catch { return null; }
}

// ---------- Google Play ----------
export const googleReady = env => !!(env.GOOGLE_PLAY_PACKAGE && env.GOOGLE_SERVICE_ACCOUNT);
let gToken = null;
async function googleAccessToken(env) {
  if (gToken && gToken.exp > now() + 60e3) return gToken.value;
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const tokenUrl = env.GOOGLE_OAUTH_URL || sa.token_uri || 'https://oauth2.googleapis.com/token';
  const iat = Math.floor(now() / 1000);
  const unsigned = `${b64uJson({ alg: 'RS256', typ: 'JWT' })}.${b64uJson({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: tokenUrl, iat, exp: iat + 3600 })}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const r = await fetch(tokenUrl, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64u(sig)}`,
  });
  if (!r.ok) throw new Error('Google OAuth ' + r.status);
  const d = await r.json();
  gToken = { value: d.access_token, exp: now() + (d.expires_in || 3600) * 1000 };
  return gToken.value;
}
const playApi = env => (env.GOOGLE_PLAY_API || 'https://androidpublisher.googleapis.com/androidpublisher/v3') + `/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE)}`;

const G_STATUS = {
  SUBSCRIPTION_STATE_ACTIVE: 'active', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace', SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_ON_HOLD: 'on_hold', SUBSCRIPTION_STATE_PAUSED: 'paused', SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'pending', SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
};

// Pulangkan { key, productId, expiresAt, status, autoRenew, needsAck, linked }
async function fetchGoogle(env, token) {
  const at = await googleAccessToken(env);
  const r = await fetch(`${playApi(env)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { authorization: `Bearer ${at}` } });
  if (r.status === 404 || r.status === 410) return null;
  if (!r.ok) throw new Error('Google Play API ' + r.status);
  const d = await r.json();
  const items = d.lineItems || [];
  const item = items.slice().sort((a, b) => Date.parse(b.expiryTime || 0) - Date.parse(a.expiryTime || 0))[0] || {};
  return {
    key: token,
    productId: item.productId || '',
    expiresAt: Date.parse(item.expiryTime || '') || 0,
    status: G_STATUS[d.subscriptionState] || 'expired',
    autoRenew: !!(item.autoRenewingPlan && item.autoRenewingPlan.autoRenewEnabled),
    needsAck: d.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    linked: d.linkedPurchaseToken || null,
  };
}
async function ackGoogle(env, productId, token) {
  const at = await googleAccessToken(env);
  const r = await fetch(`${playApi(env)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, {
    method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: '{}',
  });
  if (!r.ok) console.error('Google acknowledge', r.status);
}

// ---------- App Store ----------
export const appleReady = env => !!(env.APPLE_BUNDLE_ID && env.APPLE_ISSUER_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
let aToken = null;
async function appleJwt(env) {
  if (aToken && aToken.exp > now() + 60e3) return aToken.value;
  const iat = Math.floor(now() / 1000);
  const unsigned = `${b64uJson({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' })}.${b64uJson({ iss: env.APPLE_ISSUER_ID, iat, exp: iat + 1800, aud: 'appstoreconnect-v1', bid: env.APPLE_BUNDLE_ID })}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(env.APPLE_PRIVATE_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)); // r||s (format JWS)
  aToken = { value: `${unsigned}.${b64u(sig)}`, exp: now() + 1500e3 };
  return aToken.value;
}
const APPLE_PROD = env => env.APPLE_API_PROD || 'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX = env => env.APPLE_API_SANDBOX || 'https://api.storekit-sandbox.itunes.apple.com';

async function fetchAppleFrom(env, base, originalTransactionId) {
  const r = await fetch(`${base}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, { headers: { authorization: `Bearer ${await appleJwt(env)}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('App Store API ' + r.status);
  return r.json();
}
// Status Apple: 1 aktif, 2 tamat, 3 cuba caj semula (tiada akses), 4 tempoh tangguh, 5 ditarik balik
const A_STATUS = { 1: 'active', 2: 'expired', 3: 'on_hold', 4: 'grace', 5: 'revoked' };
async function fetchApple(env, originalTransactionId) {
  const mode = env.APPLE_ENV || 'auto';
  let d = mode === 'Sandbox' ? null : await fetchAppleFrom(env, APPLE_PROD(env), originalTransactionId);
  if (!d && mode !== 'Production') d = await fetchAppleFrom(env, APPLE_SANDBOX(env), originalTransactionId);
  if (!d) return null;
  const txs = (d.data || []).flatMap(g => g.lastTransactions || []).filter(x => String(x.originalTransactionId) === String(originalTransactionId));
  if (!txs.length) return null;
  const pick = txs.map(x => ({ x, info: jwsPayload(x.signedTransactionInfo) || {}, renew: jwsPayload(x.signedRenewalInfo) || {} }))
    .sort((a, b) => (b.info.expiresDate || 0) - (a.info.expiresDate || 0))[0];
  if (pick.info.bundleId && env.APPLE_BUNDLE_ID && pick.info.bundleId !== env.APPLE_BUNDLE_ID) return null;
  let status = A_STATUS[pick.x.status] || 'expired';
  const autoRenew = pick.renew.autoRenewStatus === 1;
  if (status === 'active' && !autoRenew) status = 'canceled';
  if (pick.info.revocationDate) status = 'revoked';
  return {
    key: String(originalTransactionId), productId: pick.info.productId || '', expiresAt: pick.info.expiresDate || 0,
    status, autoRenew, accountToken: pick.info.appAccountToken || null,
  };
}

// ---------- simpan & kemas kini ----------
async function planFor(env, productId) {
  const plans = await getPlans(env);
  const p = plans.find(x => productId === x.id || productId.endsWith('.' + x.id) || productId.endsWith('_' + x.id));
  return p ? p.id : null;
}

async function upsert(env, platform, userId, s) {
  const t = now();
  await env.DB.prepare(`INSERT INTO store_subscriptions (user_id, platform, store_key, product_id, plan, expires_at, status, auto_renew, verified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, store_key) DO UPDATE SET product_id = excluded.product_id, plan = excluded.plan, expires_at = excluded.expires_at,
        status = excluded.status, auto_renew = excluded.auto_renew, verified_at = excluded.verified_at, updated_at = excluded.updated_at`)
    .bind(userId, platform, s.key, s.productId, await planFor(env, s.productId), s.expiresAt, s.status, s.autoRenew ? 1 : 0, t, t, t).run();
  await refreshEntitlement(env, userId);
}

async function verifyKey(env, platform, key) {
  return platform === 'google' ? fetchGoogle(env, key) : fetchApple(env, key);
}

// Sahkan semula langganan yang sudah dikenali (notifikasi / cron)
async function reverify(env, row) {
  try {
    const s = await verifyKey(env, row.platform, row.store_key);
    if (!s) { await env.DB.prepare("UPDATE store_subscriptions SET status = 'expired', verified_at = ? WHERE id = ?").bind(now(), row.id).run(); await refreshEntitlement(env, row.user_id); return; }
    await upsert(env, row.platform, row.user_id, s);
    if (row.platform === 'google' && s.needsAck && (s.status === 'active' || s.status === 'grace')) await ackGoogle(env, s.productId, s.key);
  } catch (e) { console.error('store reverify', row.platform, String(e)); }
}

// ---------- API pelajar ----------
// Telefon hantar token Google Play / originalTransactionId Apple selepas beli atau "Pulihkan pembelian".
export async function storeVerify(env, request) {
  const u = await requireUser(env, request);
  const b = await readJson(request);
  const platform = b.platform === 'apple' ? 'apple' : b.platform === 'google' ? 'google' : null;
  const key = cleanText(platform === 'apple' ? b.originalTransactionId : b.purchaseToken, 600);
  if (!platform || !key) return fail(400, 'Maklumat pembelian tidak lengkap.');
  if (platform === 'google' && !googleReady(env)) return fail(503, 'Pembayaran Google Play belum disambung.');
  if (platform === 'apple' && !appleReady(env)) return fail(503, 'Pembayaran App Store belum disambung.');
  const owner = await env.DB.prepare('SELECT user_id FROM store_subscriptions WHERE platform = ? AND store_key = ?').bind(platform, key).first();
  if (owner && owner.user_id !== u.id) return fail(409, 'Pembelian ini sudah digunakan oleh akaun lain. Log masuk dengan akaun yang membuat pembelian.');
  let s;
  try { s = await verifyKey(env, platform, key); } catch (e) { console.error('store verify', String(e)); return fail(502, 'Pembelian tidak dapat disahkan sekarang. Cuba lagi sebentar.'); }
  if (!s) return fail(404, 'Pembelian tidak dijumpai. Cuba lagi atau hubungi admin.');
  if (platform === 'apple' && s.accountToken && b.accountToken && s.accountToken !== b.accountToken) return fail(409, 'Pembelian ini milik akaun lain.');
  await upsert(env, platform, u.id, s);
  // Naik taraf pelan Google: token lama tidak lagi sah
  if (platform === 'google' && s.linked) await env.DB.prepare("UPDATE store_subscriptions SET status = 'expired', updated_at = ? WHERE platform = 'google' AND store_key = ?").bind(now(), s.linked).run();
  if (platform === 'google' && s.needsAck && (s.status === 'active' || s.status === 'grace')) await ackGoogle(env, s.productId, s.key);
  await refreshEntitlement(env, u.id);
  const fresh = await env.DB.prepare('SELECT paid_until FROM users WHERE id = ?').bind(u.id).first();
  return json({ ok: true, status: s.status, expiresAt: s.expiresAt, paidUntil: fresh.paid_until, active: fresh.paid_until > now() });
}

// Senarai langganan store pelajar (untuk menu Akaun: "Urus di Google Play / App Store")
export async function myStoreSubs(env, userId) {
  const { results } = await env.DB.prepare(`SELECT platform, product_id, expires_at, status, auto_renew FROM store_subscriptions
      WHERE user_id = ? AND status IN ${ENTITLED} ORDER BY expires_at DESC`).bind(userId).all();
  return results.map(r => ({ platform: r.platform, productId: r.product_id, expiresAt: r.expires_at, status: r.status, autoRenew: !!r.auto_renew }));
}

// ---------- notifikasi dari store ----------
// Google Real-time Developer Notifications (Pub/Sub push). URL: /api/store/google/rtdn?token=STORE_RTDN_TOKEN
export async function googleRtdn(env, request) {
  const tok = new URL(request.url).searchParams.get('token') || '';
  if (!env.STORE_RTDN_TOKEN || !safeEqual(tok, env.STORE_RTDN_TOKEN)) return fail(401, 'Tidak dibenarkan.');
  const b = await readJson(request).catch(() => ({}));
  let msg = null;
  try { msg = JSON.parse(atob((b.message && b.message.data) || '')); } catch {}
  const token = msg && msg.subscriptionNotification && msg.subscriptionNotification.purchaseToken;
  if (token && googleReady(env)) {
    const row = await env.DB.prepare("SELECT * FROM store_subscriptions WHERE platform = 'google' AND store_key = ?").bind(token).first();
    if (row) await reverify(env, row); // token belum dikenali: akan disahkan bila telefon hantar
  }
  return json({ ok: true });
}

// App Store Server Notifications V2: { signedPayload }
export async function appleNotify(env, request) {
  const b = await readJson(request).catch(() => ({}));
  const p = jwsPayload(b.signedPayload);
  const info = p && p.data ? jwsPayload(p.data.signedTransactionInfo) : null;
  const otid = info && info.originalTransactionId;
  if (otid && appleReady(env)) {
    const row = await env.DB.prepare("SELECT * FROM store_subscriptions WHERE platform = 'apple' AND store_key = ?").bind(String(otid)).first();
    if (row) await reverify(env, row); // status sebenar diambil dari API Apple, bukan dari notifikasi
  }
  return json({ ok: true });
}

// ---------- cron: sahkan semula langganan yang hampir/baru tamat ----------
export async function syncStoreSubs(env) {
  if (!googleReady(env) && !appleReady(env)) return;
  const t = now();
  const { results } = await env.DB.prepare(`SELECT * FROM store_subscriptions
      WHERE status IN ('active', 'grace', 'canceled', 'on_hold', 'pending') AND expires_at < ? AND (verified_at IS NULL OR verified_at < ?)
      ORDER BY verified_at LIMIT 10`).bind(t + 864e5, t - 6 * 3600e3).all();
  for (const row of results) {
    if ((row.platform === 'google' && googleReady(env)) || (row.platform === 'apple' && appleReady(env))) await reverify(env, row);
  }
}
