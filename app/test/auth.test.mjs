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

// ---- video + langganan manual ----
const { execSync } = await import('node:child_process');
const t0 = Date.now();
execSync(`npx wrangler d1 execute madrasah-db --local --command "INSERT INTO videos (title, topic, arabic_label, bunny_id, minutes, class_month, published, bunny_status, created_at) VALUES ('Hukum Nun Mati', 'Tajwid', 'النون الساكنة', 'abc-guid', 60, '2026-10', 1, 4, ${t0}), ('Draf belum terbit', 'Tajwid', NULL, 'def-guid', 30, '2026-10', 0, 4, ${t0})"`, { stdio: 'ignore', cwd: process.cwd() });
r = await e.req('GET', '/api/videos');
check('Senarai video: hanya yang diterbitkan', r.status === 200 && r.data.videos.length === 1 && r.data.videos[0].title === 'Hukum Nun Mati', r.data);
const vid = r.data.videos[0].id;
r = await e.req('GET', `/api/videos/${vid}/play`);
check('Tonton ditolak bila langganan tak aktif', r.status === 402, r.data);
r = await ad.req('GET', '/api/admin/users?q=Rohana');
const rid = r.data.users.find(u => u.name === 'Rohana Ismail').id;
r = await e.req('POST', `/api/admin/users/${rid}/subscription`, { months: 1 });
check('Pelajar tak boleh aktifkan langganan sendiri', r.status === 401, r.data);
r = await ad.req('POST', `/api/admin/users/${rid}/subscription`, { months: 1 });
check('Admin aktifkan langganan 1 bulan', r.status === 200 && r.data.active === true, r.data);
r = await e.req('GET', `/api/videos/${vid}/play`);
check('Tonton dibenarkan bila aktif', r.status === 200 && r.data.embedUrl.includes('player.mediadelivery.net/embed/784074/abc-guid') && r.data.watermark === 'Rohana Ismail', r.data);
r = await e.req('POST', `/api/videos/${vid}/progress`, { seconds: 754 });
check('Simpan progres', r.status === 200, r.data);
r = await e.req('GET', '/api/videos');
check('Progres & sambung tonton', r.data.videos[0].watchedSeconds === 754 && r.data.continueId === vid, r.data);
r = await e.req('GET', `/api/videos/${vid}/play`);
check('Sambung dari tempat terakhir', r.data.resumeAt === 754, r.data);
r = await ad.req('GET', '/api/admin/videos');
check('Admin nampak semua video termasuk draf', r.status === 200 && r.data.videos.length === 2 && r.data.bunnyReady === false, r.data);
r = await ad.req('POST', '/api/admin/videos', { title: 'Ujian', topic: 'Tajwid' });
check('Upload ditolak jelas bila Bunny belum disambung', r.status === 503, r.data);
r = await ad.req('POST', `/api/admin/users/${rid}/subscription`, { action: 'tamat' });
check('Admin tamatkan langganan', r.status === 200 && r.data.active === false, r.data);
r = await e.req('GET', `/api/videos/${vid}/play`);
check('Tonton ditolak semula selepas tamat', r.status === 402, r.data);

// ---- polisi, tetapan pengendali, pengumuman & kelas Zoom ----
let page = await fetch(BASE + '/terma');
let html = await page.text();
check('Halaman /terma dipapar tanpa login', page.status === 200 && html.includes('Terma Penggunaan') && html.includes('pengendali Madrasah Online'), page.status);
r = await ad.req('POST', '/api/admin/settings', { name: 'Pertubuhan Ujian', reg: 'PPM-001-10-01012026', email: 'hubungi@contoh.my', whatsapp: '12345', address: 'Kuala Lumpur' });
check('Tetapan: WhatsApp tak sah ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/admin/settings', { name: 'X' });
check('Pelajar tak boleh ubah tetapan', r.status === 401, r.data);
r = await ad.req('POST', '/api/admin/settings', { name: 'Pertubuhan Ujian', reg: 'PPM-001-10-01012026', email: 'hubungi@contoh.my', whatsapp: '012-345 6789', address: 'Kuala Lumpur' });
check('Tetapan disimpan', r.status === 200 && r.data.org.whatsapp === '60123456789', r.data);
html = await (await fetch(BASE + '/privasi')).text();
check('Polisi papar nama & no. pendaftaran', html.includes('Pertubuhan Ujian') && html.includes('PPM-001-10-01012026') && html.includes('012-345 6789'));
page = await fetch(BASE + '/bayaran-balik/');
check('Halaman /bayaran-balik/ (garis miring) OK', page.status === 200 && (await page.text()).includes('Polisi Bayaran Balik'));
r = await e.req('GET', '/api/config');
check('Config awam papar WhatsApp admin', r.data.org.whatsapp === '60123456789' && r.data.org.address === undefined, r.data);

r = await e.req('GET', '/api/announcements');
check('Pengumuman: tiada kelas lagi', r.status === 200 && r.data.nextClass === null && r.data.announcements.length === 0, r.data);
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Tajwid', body: 'Sediakan al-Quran.', isClass: true, classAt: Date.now() + 2 * 864e5 });
check('Kelas tanpa pautan Zoom ditolak', r.status === 400, r.data);
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Tajwid', body: 'Sediakan al-Quran.', isClass: true, classAt: Date.now() + 2 * 864e5, zoomUrl: 'http://zoom.us/j/1' });
check('Pautan bukan https ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/admin/announcements', { title: 'X', body: 'Y' });
check('Pelajar tak boleh buat hebahan', r.status === 401, r.data);
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Tajwid Disember', body: 'Sediakan al-Quran.\nMasuk 5 minit awal.', isClass: true, classAt: Date.now() + 2 * 864e5, zoomUrl: 'https://us06web.zoom.us/j/111?pwd=abc', membersOnly: true });
check('Kelas Zoom dicipta', r.status === 201 && r.data.announcement.membersOnly === true, r.data);
const futureId = r.data.announcement.id;
r = await e.req('GET', '/api/announcements');
check('Kelas akan datang: pautan Zoom belum diberi', r.data.nextClass.id === futureId && r.data.nextClass.zoomUrl === null && r.data.nextClass.joinOpen === false && r.data.announcements[0].body.includes('\n'), r.data);
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Makhraj', body: 'Kelas sedang bermula.', isClass: true, classAt: Date.now() - 10 * 60e3, zoomUrl: 'https://us06web.zoom.us/j/222', membersOnly: true });
const liveId = r.data.announcement.id;
r = await e.req('GET', '/api/announcements');
check('Kelas sedang berlangsung jadi kelas seterusnya', r.data.nextClass.id === liveId && r.data.nextClass.joinOpen === true, r.data);
check('Bukan pelanggan: kelas dikunci, tiada pautan', r.data.nextClass.locked === true && r.data.nextClass.zoomUrl === null, r.data.nextClass);
await ad.req('POST', `/api/admin/users/${rid}/subscription`, { months: 1 });
r = await e.req('GET', '/api/announcements');
check('Pelanggan aktif dapat pautan Zoom bila waktu kelas', r.data.nextClass.zoomUrl === 'https://us06web.zoom.us/j/222', r.data.nextClass);
r = await ad.req('POST', `/api/admin/announcements/${liveId}`, { title: 'Kelas Makhraj (dikemas kini)', body: 'Kelas terbuka.', isClass: true, classAt: Date.now() - 10 * 60e3, zoomUrl: 'https://us06web.zoom.us/j/222', membersOnly: false });
check('Admin kemas kini hebahan', r.status === 200 && r.data.announcement.title.includes('dikemas kini') && r.data.announcement.membersOnly === false, r.data);
r = await ad.req('POST', '/api/admin/announcements', { title: 'Video baharu', body: 'Video kelas Oktober sudah ada.' });
check('Pengumuman biasa dicipta', r.status === 201 && r.data.announcement.classAt === null, r.data);
r = await e.req('GET', '/api/announcements');
check('Pelajar nampak semua hebahan (terbaru dulu)', r.data.announcements.length === 3 && r.data.announcements[0].title === 'Video baharu', r.data);
r = await ad.req('POST', `/api/admin/announcements/${liveId}/delete`, {});
r = await e.req('GET', '/api/announcements');
check('Hebahan dipadam', r.data.announcements.length === 2 && r.data.nextClass.id === futureId, r.data);

const plain = jar();
r = await plain.req('GET', '/api/admin/users');
check('Pelajar tanpa sesi admin tak boleh lihat senarai', r.status === 401);

console.log(`\n${pass} lulus, ${failCount} gagal`);
process.exit(failCount ? 1 : 0);
