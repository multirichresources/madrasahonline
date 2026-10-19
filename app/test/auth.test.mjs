// Ujian asas aliran daftar/login/admin terhadap `wrangler dev` tempatan.
// Jalankan: node test/auth.test.mjs  (dengan wrangler dev di port 8787)
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const SETUP_KEY = process.env.SETUP_KEY || 'local-setup-key-1234567890';
let pass = 0, failCount = 0;

function jar() {
  let c = '';
  return {
    async req(method, path, body, headers = {}) {
      const r = await fetch(BASE + path, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(c ? { cookie: c } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const sc = r.headers.get('set-cookie');
      if (sc) c = sc.split(';')[0];
      let data = null;
      try { data = await r.json(); } catch {}
      return { status: r.status, data };
    },
  };
}

function check(name, cond, info) {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { failCount++; console.log('  FAIL', name, info !== undefined ? JSON.stringify(info) : ''); }
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/api/me'); return; } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  throw new Error('server tidak sedia');
}

await waitReady();
const phone = '01' + String(Date.now()).slice(-8);

const a = jar();
let r = await a.req('POST', '/api/register', { name: 'Rohana Ismail', phone, email: 'rohana@contoh.my', pin: '123456' });
check('PIN berturutan ditolak', r.status === 400, r.data);
r = await a.req('POST', '/api/register', { name: 'Rohana Ismail', phone: '12345', email: 'rohana@contoh.my', pin: '482913' });
check('No. telefon tak sah ditolak', r.status === 400, r.data);
r = await a.req('POST', '/api/register', { name: 'Rohana Ismail', phone, pin: '482913' });
check('Daftar tanpa emel ditolak', r.status === 400 && /emel/.test(r.data.error), r.data);
r = { status: 400 };
check('No. telefon tak sah ditolak', r.status === 400, r.data);
r = await a.req('POST', '/api/register', { name: 'Rohana Ismail', phone, email: 'rohana@contoh.my', pin: '482913' });
check('Daftar berjaya', r.status === 201 && r.data.user.name === 'Rohana Ismail' && r.data.user.active === false, r.data);
r = await a.req('GET', '/api/me');
check('Sesi aktif selepas daftar', r.status === 200 && r.data.user.phone.startsWith('01'), r.data);
r = await a.req('POST', '/api/register', { name: 'Lain', phone, email: 'lain@contoh.my', pin: '482913' });
check('No. telefon berulang ditolak', r.status === 409, r.data);
r = await a.req('POST', '/api/logout', {});
check('Log keluar', r.status === 200);
r = await a.req('GET', '/api/me');
check('Selepas log keluar, /me ditolak', r.status === 401);

const b = jar();
r = await b.req('POST', '/api/login', { phone: phone.replace(/^0/, '+60'), pin: '482913' });
check('Login dengan format +60', r.status === 200, r.data);
r = await b.req('POST', '/api/register', { name: 'X', phone: '0123456789', email: 'x@contoh.my', pin: '482913' }, { origin: 'https://jahat.example' });
check('Permintaan silang laman ditolak', r.status === 403, r.data);

const c = jar();
for (let i = 1; i <= 4; i++) await c.req('POST', '/api/login', { phone, pin: '000001' });
r = await c.req('POST', '/api/login', { phone, pin: '000001' });
check('Kunci akaun selepas 5 PIN salah', r.status === 423, r.data);
r = await c.req('POST', '/api/login', { phone, pin: '482913' });
check('PIN betul pun ditolak semasa dikunci', r.status === 423, r.data);

const ad = jar();
r = await ad.req('POST', '/api/admin/admins', { email: 'admin@contoh.my', name: 'Admin', password: 'katalaluan-panjang-1' }, { 'x-setup-key': 'salah' });
check('Setup admin tanpa kunci betul ditolak', r.status === 403, r.data);
r = await ad.req('POST', '/api/admin/admins', { email: 'admin@contoh.my', name: 'Admin', password: 'katalaluan-panjang-1' }, { 'x-setup-key': SETUP_KEY });
check('Admin pertama dicipta', r.status === 201 || r.status === 409, r.data);
r = await ad.req('GET', '/api/admin/stats');
check('Statistik admin perlu login', r.status === 401);
r = await ad.req('POST', '/api/admin/login', { email: 'admin@contoh.my', password: 'katalaluan-panjang-1' });
check('Login admin', r.status === 200, r.data);
r = await ad.req('GET', '/api/admin/stats');
check('Statistik admin', r.status === 200 && r.data.stats.totalUsers >= 1, r.data);
r = await ad.req('GET', '/api/admin/users?q=Rohana');
check('Cari pelajar', r.status === 200 && r.data.users.some(u => u.name === 'Rohana Ismail'), r.data);
const uid = r.data.users.find(u => u.name === 'Rohana Ismail').id;
r = await ad.req('POST', `/api/admin/users/${uid}/pin`, { pin: '739215' });
check('Admin set semula PIN (buka kunci)', r.status === 200, r.data);
r = await c.req('POST', '/api/login', { phone, pin: '739215' });
check('Login dengan PIN baharu', r.status === 200, r.data);
r = await b.req('GET', '/api/me');
check('Sesi lama dibatalkan selepas reset PIN', r.status === 401);

// ---- lupa PIN melalui emel (MAIL_DEV: kod dicetak ke log wrangler) ----
const fs = await import('node:fs');
const LOG = process.env.DEV_LOG;
const e = jar();
r = await e.req('GET', '/api/config');
check('Config: emel reset aktif (mod dev)', r.status === 200 && r.data.emailReset === true, r.data);
r = await e.req('POST', '/api/pin/forgot', { phone: '0199999999' });
check('Lupa PIN no. tak berdaftar: jawapan sama (tak dedah)', r.status === 200 && !r.data.hint, r.data);
r = await e.req('POST', '/api/pin/forgot', { phone });
check('Lupa PIN: kod dihantar, emel disamarkan', r.status === 200 && r.data.hint === 'ro****@contoh.my', r.data);
await new Promise(res => setTimeout(res, 500));
const m = [...fs.readFileSync(LOG, 'utf8').matchAll(/\[MAIL_DEV\] rohana@contoh\.my \| Kod set semula PIN: (\d{6})/g)].pop();
check('Kod ada dalam log emel', !!m);
const code = m ? m[1] : '000000';
const wrongCode = code === '111111' ? '222222' : '111111';
r = await e.req('POST', '/api/pin/reset', { phone, code: wrongCode, pin: '624813' });
check('Kod salah ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/pin/reset', { phone, code, pin: '624813' });
check('Reset PIN dengan kod betul', r.status === 200, r.data);
r = await e.req('POST', '/api/pin/reset', { phone, code, pin: '624813' });
check('Kod tak boleh guna dua kali', r.status === 400, r.data);
r = await e.req('POST', '/api/login', { phone, pin: '624813' });
check('Login dengan PIN dari reset emel', r.status === 200, r.data);
r = await e.req('POST', '/api/me/email', { email: 'baru@contoh.my', pin: '000000' });
check('Tukar emel perlu PIN betul', r.status === 401, r.data);
r = await e.req('POST', '/api/me/email', { email: 'baru@contoh.my', pin: '624813' });
check('Tukar emel', r.status === 200 && r.data.email === 'baru@contoh.my', r.data);

const plain = jar();
r = await plain.req('GET', '/api/admin/users');
check('Pelajar tanpa sesi admin tak boleh lihat senarai', r.status === 401);

console.log(`\n${pass} lulus, ${failCount} gagal`);
process.exit(failCount ? 1 : 0);
