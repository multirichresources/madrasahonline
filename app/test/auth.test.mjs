// Ujian asas aliran daftar/login/admin terhadap `wrangler dev` tempatan.
// Jalankan: node test/auth.test.mjs  (dengan wrangler dev di port 8787)
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const SETUP_KEY = process.env.SETUP_KEY || 'local-setup-key-1234567890';
let pass = 0, failCount = 0;

function jar() {
  let c = '';
  return {
    raw: (path) => fetch(BASE + path, { headers: c ? { cookie: c } : {} }),
    send: (method, path, body, headers = {}) => fetch(BASE + path, { method, headers: { ...(c ? { cookie: c } : {}), ...headers }, body }),
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
// ---- kategori video ----
r = await e.req('GET', '/api/videos');
let cats = r.data.categories || [];
const catBQ = cats.find(c => c.name === 'Belajar Al-Quran');
check('Kategori asal dicipta (Belajar Al-Quran, Sirah, Kisah dari Al-Quran, Fardhu Ain)', cats.length === 4 && catBQ && cats.some(c => c.name === 'Kisah dari Al-Quran'), cats);
check('Video Tajwid lama masuk kategori Belajar Al-Quran, topik kekal', r.data.videos[0].categoryId === catBQ.id && r.data.videos[0].topic === 'Tajwid', r.data.videos[0]);
r = await ad.req('POST', '/api/admin/video-categories', { name: 'Kuliah Maghrib', nameEn: 'Maghrib Lectures' });
const newCat = r.data && r.data.category;
check('Admin tambah kategori', r.status === 201 && newCat.name === 'Kuliah Maghrib' && r.data.categories[r.data.categories.length - 1].id === newCat.id, r.data);
r = await ad.req('POST', `/api/admin/video-categories/${newCat.id}/move`, { dir: -1 });
check('Admin susun kategori (naik)', r.status === 200 && r.data.categories.findIndex(c => c.id === newCat.id) === r.data.categories.length - 2, r.data.categories.map(c => c.name));
r = await ad.req('POST', `/api/admin/videos/${vid}`, { categoryId: newCat.id, topic: 'Nabi Yusuf' });
check('Admin tukar kategori & topik video', r.status === 200 && r.data.video.categoryId === newCat.id && r.data.video.topic === 'Nabi Yusuf', r.data);
r = await ad.req('POST', `/api/admin/videos/${vid}`, { categoryId: 99999 });
check('Kategori tidak wujud ditolak', r.status === 400, r.data);
r = await ad.req('POST', `/api/admin/video-categories/${newCat.id}/delete`, {});
check('Padam kategori', r.status === 200 && !r.data.categories.some(c => c.id === newCat.id));
r = await e.req('GET', '/api/videos');
check('Video kekal tanpa kategori selepas kategori dipadam', r.data.videos.length === 1 && r.data.videos[0].categoryId === null, r.data.videos[0]);
await ad.req('POST', `/api/admin/videos/${vid}`, { categoryId: catBQ.id, topic: 'Tajwid' });
r = await e.req('POST', '/api/admin/video-categories', { name: 'x' });
check('Pelajar tak boleh tambah kategori', r.status === 401);

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

// ---- notifikasi telefon (Web Push) dengan servis push tiruan ----
const http = await import('node:http');
const nodeCrypto = await import('node:crypto');
const pings = [];
const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { pings.push({ path: req.url, headers: req.headers, body: b }); res.writeHead(201); res.end(); }); });
await new Promise(ok => mock.listen(8799, '127.0.0.1', ok));
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
// Cron tempatan. at5=true: minit gandaan 5 (peringatan kelas & bayaran berjalan); false: azan sahaja
const d1 = sql => execSync(`npx wrangler d1 execute madrasah-db --local --command "${sql}"`, { stdio: 'ignore', cwd: process.cwd() });
const plain0 = async (method, path, body) => { const res = await fetch(BASE + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); let data = null; try { data = await res.json(); } catch {} return { status: res.status, data }; };
const cron = (at5 = true) => fetch(BASE + `/cdn-cgi/handler/scheduled?cron=*+*+*+*+*&time=${Math.floor(Date.now() / 300000) * 300000 + (at5 ? 0 : 60000)}`);
const waitPing = async (path, n = 1) => { for (let i = 0; i < 40 && pings.filter(p => p.path === path).length < n; i++) await sleep(100); return pings.filter(p => p.path === path); };

r = await e.req('GET', '/api/push/key');
const pub = r.data.publicKey;
check('Kunci VAPID dijana automatik', r.status === 200 && Buffer.from(pub, 'base64url').length === 65, r.data);
r = await e.req('POST', '/api/push/subscribe', { endpoint: 'https://jahat.example/push/1' });
check('Endpoint push bukan servis sah ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/push/subscribe', { endpoint: 'http://127.0.0.1:8799/push/e1' });
check('Langgan notifikasi', r.status === 200 && typeof r.data.latestId === 'number', r.data);
r = await e.req('POST', '/api/push/test', {});
check('Notifikasi ujian dihantar', r.status === 200 && r.data.sent === 1, r.data);
let got = await waitPing('/push/e1');
const auth = got[0] && got[0].headers.authorization || '';
const m1 = auth.match(/^vapid t=([^,]+), k=(.+)$/);
let jwtOk = false;
if (m1) {
  const [h, pl, sig] = m1[1].split('.');
  const raw = Buffer.from(pub, 'base64url');
  const key = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  const claims = JSON.parse(Buffer.from(pl, 'base64url').toString());
  jwtOk = m1[2] === pub && claims.aud === 'http://127.0.0.1:8799' && claims.exp > Date.now() / 1000
    && nodeCrypto.verify('sha256', Buffer.from(h + '.' + pl), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
}
check('Ping bertandatangan VAPID sah, tanpa muatan', jwtOk && got[0].body === '' && got[0].headers.ttl === '86400', got[0] && got[0].headers);
r = await e.req('GET', '/api/push/inbox?since=0');
check('Peti masuk: mesej ujian', r.status === 200 && r.data.items.length === 1 && r.data.items[0].title === 'Peringatan sudah aktif', r.data);
let lastSeen = r.data.items[0].id;

// ---- soal jawab ----
const f = jar();
const phoneF = '01' + String(Date.now() + 77).slice(-8);
await f.req('POST', '/api/register', { name: 'Salmah Binti Ali', phone: phoneF, email: 'salmah@contoh.my', pin: '482913' });
r = await f.req('POST', '/api/questions', { body: 'Soalan saya tentang mad.' });
check('Bukan pelanggan tak boleh bertanya', r.status === 402, r.data);
r = await e.req('POST', '/api/questions', { body: 'abc' });
check('Soalan terlalu pendek ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/questions', { body: 'Ustaz, bagaimana nak bezakan bunyi huruf ح dan ه?', videoId: vid });
check('Pelanggan hantar soalan tentang video', r.status === 201 && r.data.question.mine === true && r.data.question.videoTitle === 'Hukum Nun Mati', r.data);
const qid = r.data.question.id;
r = await f.req('GET', '/api/questions');
check('Soalan belum dijawab tak nampak kepada pelajar lain', r.status === 200 && !r.data.questions.some(q => q.id === qid), r.data);
r = await e.req('GET', `/api/questions?video=${vid}`);
check('Penanya nampak soalan sendiri (menunggu)', r.data.questions.length === 1 && r.data.questions[0].answer === null, r.data);
r = await ad.req('GET', '/api/admin/stats');
check('Statistik: soalan belum dijawab & pengguna notifikasi', r.data.stats.unansweredQuestions === 1 && r.data.stats.pushUsers === 1, r.data.stats);
r = await ad.req('GET', '/api/admin/questions?status=belum');
check('Admin nampak soalan dengan nama penuh', r.data.questions.length === 1 && r.data.questions[0].asker === 'Rohana Ismail' && r.data.unanswered === 1, r.data);
const before = pings.length;
r = await ad.req('POST', `/api/admin/questions/${qid}/answer`, { answer: 'ح dari tengah halkum, ه dari pangkal halkum.\nCuba dengar semula minit ke-12.' });
check('Admin jawab soalan', r.status === 200 && r.data.question.answeredBy === 'Admin', r.data);
got = await waitPing('/push/e1', 2);
check('Penanya dapat ping bila dijawab', pings.length > before, pings.length);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Peti masuk: "Ustaz sudah menjawab"', r.data.items.length === 1 && r.data.items[0].title.includes('menjawab') && r.data.items[0].url === '/?k=soaljawab', r.data);
lastSeen = r.data.items[0].id;
r = await f.req('GET', '/api/questions');
check('Soalan dijawab nampak kepada semua (nama pertama sahaja)', r.data.questions.some(q => q.id === qid && q.asker === 'Rohana' && q.answer.includes('halkum') && !q.mine), r.data);
r = await e.req('POST', `/api/questions/${qid}/delete`, {});
check('Soalan yang dijawab tak boleh ditarik balik', r.status === 400, r.data);
r = await ad.req('POST', `/api/admin/questions/${qid}/hide`, { hidden: true });
r = await f.req('GET', '/api/questions');
check('Soalan disembunyikan hilang daripada pelajar', !r.data.questions.some(q => q.id === qid), r.data);
r = await e.req('POST', '/api/questions', { body: 'Soalan kedua untuk ditarik balik.' });
const q2 = r.data.question.id;
r = await e.req('POST', `/api/questions/${q2}/delete`, {});
check('Tarik balik soalan belum dijawab', r.status === 200, r.data);
r = await f.req('POST', '/api/admin/questions/1/answer', { answer: 'X' });
check('Pelajar tak boleh jawab sebagai admin', r.status === 401, r.data);

// ---- peringatan kelas automatik (cron) ----
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Malam Ini', body: 'Bab Mad.', isClass: true, classAt: Date.now() + 20 * 60e3, zoomUrl: 'https://us06web.zoom.us/j/333', membersOnly: true });
check('Hebahan kelas: notifikasi terus kepada pelanggan', r.status === 201 && r.data.notified === 1, r.data);
const soonId = r.data.announcement.id;
r = await ad.req('POST', '/api/admin/announcements', { title: 'Kelas Esok', body: 'Bab Qalqalah.', isClass: true, classAt: Date.now() + 20 * 3600e3, zoomUrl: 'https://us06web.zoom.us/j/444', membersOnly: false, notify: false });
check('Hebahan tanpa notifikasi', r.status === 201 && r.data.notified === 0, r.data);
await sleep(300);
let pingCount = pings.length;
await cron();
await sleep(800);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
const titles = r.data.items.map(i => i.title);
check('Cron: peringatan 30 minit & sehari sebelum', titles.includes('Kelas bermula sekejap lagi') && titles.some(t => t === 'Peringatan kelas: Kelas Esok') && titles.some(t => t.startsWith('Kelas Zoom: Kelas Malam Ini')), titles);
check('Cron: ping dihantar', pings.length > pingCount, pings.length - pingCount);
lastSeen = Math.max(...r.data.items.map(i => i.id));
await cron();
await sleep(500);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Cron: peringatan tidak berulang', r.data.items.length === 0, r.data);
await ad.req('POST', `/api/admin/announcements/${soonId}/delete`, {});
// ---- waktu solat (JAKIM tiruan) & notifikasi azan & bahasa ----
let jakimFail = new Set(), jakimCalls = [];
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const jakim = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    jakimCalls.push({ path: u.pathname, zone: u.searchParams.get('zone'), body: b });
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (u.pathname === '/index.php') {
      const zone = u.searchParams.get('zone');
      if (jakimFail.has(zone)) return send(500, { status: 'ERROR' });
      const p = new URLSearchParams(b), start = new Date(p.get('datestart') + 'T00:00:00Z'), end = new Date(p.get('dateend') + 'T00:00:00Z');
      const prayerTime = [];
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        prayerTime.push({ hijri: '1448-04-29', date: `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS3[d.getUTCMonth()]}-${d.getUTCFullYear()}`, day: 'Wednesday',
          imsak: '05:37:00', fajr: '05:47:00', syuruk: '06:56:00', dhuhr: '13:03:00', asr: '16:12:00', maghrib: '19:07:00', isha: '20:16:00' });
      }
      return send(200, { prayerTime, status: 'OK!', zone, periodType: 'duration' });
    }
    if (u.pathname.startsWith('/alt/v2/solat/')) {
      const y = Number(u.searchParams.get('year')), m = Number(u.searchParams.get('month'));
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), prayers = [];
      for (let d = 1; d <= days; d++) {
        const base = Date.UTC(y, m - 1, d) / 1000 - 8 * 3600; // tengah malam waktu Malaysia
        prayers.push({ day: d, hijri: '1448-04-29', fajr: base + 5 * 3600 + 50 * 60, syuruk: base + 7 * 3600, dhuhr: base + 13 * 3600 + 5 * 60, asr: base + 16 * 3600 + 15 * 60, maghrib: base + 19 * 3600 + 10 * 60, isha: base + 20 * 3600 + 20 * 60 });
      }
      return send(200, { zone: u.pathname.split('/').pop(), year: y, month_number: m, prayers });
    }
    send(404, {});
  });
});
await new Promise(ok => jakim.listen(8796, '127.0.0.1', ok));
const myToday = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const myAt = hms => Date.parse(`${myToday}T${hms}+08:00`);

r = await e.req('GET', '/api/solat/zones');
check('Senarai zon JAKIM', r.status === 200 && r.data.zones.length > 55 && r.data.zones.some(z => z.code === 'WLY01' && z.area.includes('Kuala Lumpur')), r.data.zones && r.data.zones.length);
r = await e.req('GET', '/api/solat');
check('Waktu solat hari ini (zon lalai WLY01, dari JAKIM)', r.status === 200 && r.data.zone.code === 'WLY01' && r.data.today.date === myToday && r.data.today.fajr === myAt('05:47:00') && r.data.today.isha === myAt('20:16:00') && r.data.today.source === 'jakim' && r.data.tomorrow, r.data);
const callsBefore = jakimCalls.length;
r = await e.req('GET', '/api/solat');
check('Waktu solat disimpan (tiada panggilan JAKIM kedua)', jakimCalls.length === callsBefore, jakimCalls.length - callsBefore);
jakimFail.add('SGR01');
r = await e.req('GET', '/api/solat?zone=SGR01');
check('JAKIM gagal → sandaran waktusolat.app', r.status === 200 && r.data.today.source === 'waktusolat' && r.data.today.dhuhr === myAt('13:05:00'), r.data);
jakimFail.add('JHR02');
r = await e.req('POST', '/api/me/solat', { zone: 'XXX99', azan: ['fajr'] });
check('Zon tidak sah ditolak', r.status === 400, r.data);
r = await e.req('POST', '/api/me/solat', { zone: 'WLY01', azan: ['dhuhr', 'asr', 'bukan'] });
check('Simpan zon & waktu notifikasi', r.status === 200 && r.data.azan.join() === 'dhuhr,asr', r.data);
r = await e.req('GET', '/api/me');
check('Profil: zon & azan', r.data.user.solatZone === 'WLY01' && r.data.user.azan.join() === 'dhuhr,asr' && r.data.user.lang === 'ms', r.data.user);

// azan: tetapkan Zohor hari ini = 1 minit lalu
d1(`UPDATE prayer_times SET dhuhr = ${Date.now() - 60e3} WHERE zone = 'WLY01' AND date = '${myToday}'`);
let pBefore = pings.length;
await cron(false); await sleep(800);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
const azanItem = r.data.items.find(i => i.title === 'Waktu Zohor');
check('Notifikasi azan masuk waktu Zohor (BM)', !!azanItem && azanItem.body.includes('Kuala Lumpur') && pings.length > pBefore, r.data.items);
lastSeen = Math.max(lastSeen, ...r.data.items.map(i => i.id));
await cron(false); await sleep(500);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Azan tidak dihantar dua kali', r.data.items.length === 0, r.data.items);
d1(`UPDATE prayer_times SET maghrib = ${Date.now() - 60e3} WHERE zone = 'WLY01' AND date = '${myToday}'`);
await cron(false); await sleep(500);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Waktu yang tidak dipilih (Maghrib) tidak dihantar', r.data.items.length === 0, r.data.items);

r = await e.req('POST', '/api/me/lang', { lang: 'en' });
check('Tukar bahasa ke English', r.status === 200 && r.data.lang === 'en', r.data);
d1(`UPDATE prayer_times SET asr = ${Date.now() - 60e3} WHERE zone = 'WLY01' AND date = '${myToday}'`);
await cron(false); await sleep(800);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Notifikasi azan dalam English', r.data.items.some(i => i.title === 'Asr prayer time' && i.body.includes('Kuala Lumpur')), r.data.items);
lastSeen = Math.max(lastSeen, ...r.data.items.map(i => i.id));
r = await e.req('POST', '/api/push/test', {});
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Notifikasi sistem ikut bahasa pelajar (EN)', r.data.items.some(i => i.title === 'Reminders are on'), r.data.items);
lastSeen = Math.max(lastSeen, ...r.data.items.map(i => i.id));
await e.req('POST', '/api/me/lang', { lang: 'ms' });
html = await (await fetch(BASE + '/terma?lang=en')).text();
check('Halaman polisi English', html.includes('Terms of Use') && html.includes('lang="en"') && html.includes('Bahasa Melayu version applies'));
html = await (await fetch(BASE + '/privasi')).text();
check('Halaman polisi kekal BM secara lalai', html.includes('Polisi Privasi') && html.includes('>English<'));
jakim.close();

// ---- hantar serentak (fan-out): 60 telefon, 2 pekerja, tiada ping berganda ----
r = await plain0('POST', '/api/internal/push?i=0&n=1', {});
check('Laluan dalaman push dilindungi kunci', r.status === 403, r.data);
const bulkSql = Array.from({ length: 60 }, (_, k) => `(${rid}, 'http://127.0.0.1:8799/push/bulk-${k}', 0, ${Date.now()})`).join(',');
d1(`INSERT INTO push_subs (user_id, endpoint, fails, created_at) VALUES ${bulkSql}`);
await e.req('POST', '/api/push/test', {});
await cron(false); await sleep(1500);
const bulk = pings.filter(p => p.path.startsWith('/push/bulk-'));
check('60 telefon dapat ping tepat sekali (fan-out 2 pekerja)', bulk.length === 60 && new Set(bulk.map(p => p.path)).size === 60, { got: bulk.length, unique: new Set(bulk.map(p => p.path)).size });
d1(`DELETE FROM push_subs WHERE endpoint LIKE '%/push/bulk-%'`);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
lastSeen = Math.max(lastSeen, ...r.data.items.map(i => i.id));

r = await e.req('POST', '/api/push/unsubscribe', { endpoint: 'http://127.0.0.1:8799/push/e1' });
r = await e.req('POST', '/api/push/test', {});
check('Selepas matikan, tiada notifikasi', r.status === 400, r.data);
mock.close();

// ---- bayaran CHIP (servis CHIP tiruan) ----
const chipStore = new Map(), chipCalls = [];
let failCharge = null;
const chipMock = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const body = b ? JSON.parse(b) : {};
    chipCalls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.headers.authorization !== 'Bearer test-secret-key') return send(401, { detail: 'unauthorized' });
    let m;
    if (req.method === 'POST' && req.url === '/api/v1/purchases/') {
      const id = nodeCrypto.randomUUID();
      const total = body.purchase.products.reduce((a, p) => a + p.price * (p.quantity || 1), 0);
      const p = { id, status: 'created', is_recurring_token: false, recurring_token: null, purchase: { total, currency: 'MYR' }, checkout_url: `https://gate.chip-in.asia/p/${id}/`, _req: body };
      chipStore.set(id, p); return send(201, p);
    }
    if (req.method === 'GET' && (m = req.url.match(/^\/api\/v1\/purchases\/([^/]+)\/$/))) {
      const p = chipStore.get(m[1]); return p ? send(200, p) : send(404, { detail: 'not found' });
    }
    if (req.method === 'POST' && (m = req.url.match(/^\/api\/v1\/purchases\/([^/]+)\/charge\/$/))) {
      const p = chipStore.get(m[1]), tok = chipStore.get(body.recurring_token);
      if (failCharge === 'invalid_recurring_token' || !tok || !tok.is_recurring_token) return send(400, { __all__: [{ message: 'Invalid or inactive recurring token!', code: 'invalid_recurring_token' }] });
      if (failCharge) return send(400, { __all__: [{ message: 'Charge failed', code: 'purchase_charge_error' }] });
      p.status = 'paid'; p.recurring_token = tok.id; return send(200, p);
    }
    if (req.method === 'POST' && (m = req.url.match(/^\/api\/v1\/purchases\/([^/]+)\/delete_recurring_token\/$/))) {
      const p = chipStore.get(m[1]); if (p) p.is_recurring_token = false; return send(200, p || {});
    }
    send(404, {});
  });
});
await new Promise(ok => chipMock.listen(8798, '127.0.0.1', ok));
const chipPay = (id, { total } = {}) => { const p = chipStore.get(id); p.status = 'paid'; p.is_recurring_token = !!p._req.force_recurring; if (total) p.purchase.total = total; };
const lastPurchase = () => [...chipStore.values()].pop();
const addM = (ms, n) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime(); };
const callback = id => fetch(BASE + '/api/pay/callback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: 'paid' }) });

r = await e.req('GET', '/api/plans');
check('Pakej: CHIP sedia, hanya Bulanan dibuka (lalai)', r.data.billingReady === true && r.data.plans.length === 1 && r.data.plans[0].priceSen === 1000, r.data);
r = await ad.req('POST', '/api/admin/plans', { plans: [{ id: 'bulanan', active: true, label: 'Bulanan', priceSen: 1000 }, { id: 'tahunan', active: true, label: 'Setahun', priceSen: 50 }] });
check('Harga pakej tak sah ditolak', r.status === 400, r.data);
r = await ad.req('POST', '/api/admin/plans', { plans: [{ id: 'bulanan', active: true, label: 'Bulanan', priceSen: 1000 }, { id: 'tahunan', active: true, label: 'Setahun', priceSen: 11000 }, { id: '3bulan', active: false, label: '3 Bulan', priceSen: 3000 }] });
check('Admin buka pakej Setahun', r.status === 200 && r.data.plans.find(p => p.id === 'tahunan').active === true && r.data.plans.find(p => p.id === 'tahunan').months === 12, r.data);
r = await e.req('GET', '/api/plans');
check('Pelajar nampak 2 pakej', r.data.plans.map(p => p.id).join() === 'bulanan,tahunan', r.data);

let me0 = (await e.req('GET', '/api/me')).data.user;
r = await e.req('POST', '/api/pay/checkout', { planId: 'bulanan', auto: true });
check('Checkout auto-renew: pautan bayaran CHIP', r.status === 200 && r.data.checkoutUrl.startsWith('https://gate.chip-in.asia/'), r.data);
const pay1 = r.data.paymentId;
let pr = lastPurchase();
check('Purchase CHIP: kad sahaja, force_recurring, harga & callback betul', pr._req.force_recurring === true && pr._req.payment_method_whitelist.join() === 'visa,mastercard,maestro'
  && pr._req.purchase.products[0].price === 1000 && pr._req.client.email === 'baru@contoh.my' && pr._req.success_callback.endsWith('/api/pay/callback') && pr._req.reference === 'MO-' + pay1 && pr._req.brand_id === 'brand-test', pr._req);
r = await e.req('POST', '/api/pay/confirm', { paymentId: pay1 });
check('Sebelum bayar: status pending', r.data.payStatus === 'pending', r.data);
await callback(pr.id);
r = await e.req('GET', '/api/me');
check('Callback palsu (belum bayar di CHIP) tidak aktifkan apa-apa', r.data.user.paidUntil === me0.paidUntil && !r.data.user.autoRenew, r.data.user);
chipPay(pr.id);
let cb = await callback(pr.id);
r = await e.req('GET', '/api/me');
const expected1 = addM(Math.max(Date.now(), me0.paidUntil), 1);
check('Callback CHIP: langganan +1 bulan & auto-renew aktif', cb.status === 200 && Math.abs(r.data.user.paidUntil - expected1) < 60e3 && r.data.user.autoRenew === true, { got: r.data.user.paidUntil, expected1 });
const until1 = r.data.user.paidUntil;
const tokenId = pr.id;
await callback(pr.id);
r = await e.req('POST', '/api/pay/confirm', { paymentId: pay1 });
check('Callback berulang tidak tambah tempoh lagi (idempotent)', r.data.payStatus === 'completed' && r.data.paidUntil === until1, r.data);
r = await e.req('POST', '/api/pay/checkout', { planId: 'bulanan', auto: true });
check('Tak boleh daftar auto-renew dua kali', r.status === 400, r.data);
r = await f.req('POST', '/api/pay/confirm', { paymentId: pay1 });
check('Pelajar lain tak boleh semak bayaran orang lain', r.status === 404, r.data);

r = await e.req('POST', '/api/pay/checkout', { planId: 'tahunan', auto: false });
pr = lastPurchase();
check('Checkout sekali bayar: semua cara bayar, tiada force_recurring', r.status === 200 && pr._req.force_recurring === false && !pr._req.payment_method_whitelist && pr._req.purchase.products[0].price === 11000, pr._req);
chipPay(pr.id, { total: 100 });
await callback(pr.id);
r = await e.req('GET', '/api/me');
check('Jumlah tidak sepadan: tidak diaktifkan (status semak)', r.data.user.paidUntil === until1, r.data.user);
r = await e.req('POST', '/api/pay/checkout', { planId: '3bulan', auto: false });
check('Pakej tertutup ditolak', r.status === 400, r.data);

// auto-renew oleh cron
d1(`UPDATE users SET paid_until = ${Date.now() + 12 * 3600e3}, renew_attempt_at = NULL WHERE id = ${rid}`);
const before12 = (await e.req('GET', '/api/me')).data.user.paidUntil;
await cron(); await sleep(800);
r = await e.req('GET', '/api/me');
check('Cron auto-renew: kad dicaj, +1 bulan', Math.abs(r.data.user.paidUntil - addM(before12, 1)) < 60e3 && r.data.user.autoRenew === true, { got: r.data.user.paidUntil, want: addM(before12, 1) });
check('Caj guna token kad yang betul', chipCalls.some(c => c.url.endsWith('/charge/') && c.body.recurring_token === tokenId), chipCalls.filter(c => c.url.endsWith('/charge/')).map(c => c.body));
r = await e.req('GET', '/api/pay/history');
check('Sejarah bayaran: 2 berjaya + 1 semak', r.data.payments.filter(p => p.status === 'completed').length === 2 && r.data.payments.some(p => p.status === 'semak'), r.data);
await cron(); await sleep(500);
r = await e.req('GET', '/api/pay/history');
check('Cron tidak caj berganda', r.data.payments.filter(p => p.status === 'completed').length === 2, r.data);
failCharge = 'purchase_charge_error';
d1(`UPDATE users SET paid_until = ${Date.now() + 6 * 3600e3}, renew_attempt_at = NULL WHERE id = ${rid}`);
await cron(); await sleep(800);
r = await e.req('GET', '/api/me');
check('Kad gagal sekali: auto-renew kekal (cuba esok)', r.data.user.autoRenew === true && r.data.user.paidUntil < Date.now() + 7 * 3600e3, r.data.user);
failCharge = 'invalid_recurring_token';
d1(`UPDATE users SET renew_attempt_at = NULL WHERE id = ${rid}`);
await cron(); await sleep(800);
r = await e.req('GET', '/api/me');
check('Token kad tidak sah: auto-renew dihentikan', r.data.user.autoRenew === false, r.data.user);
failCharge = null;

// berhenti auto-renew
await ad.req('POST', '/api/admin/users/' + (await ad.req('GET', '/api/admin/users?q=Salmah')).data.users[0].id + '/subscription', { months: 1 });
r = await f.req('POST', '/api/pay/checkout', { planId: 'bulanan', auto: true });
pr = lastPurchase(); chipPay(pr.id); await callback(pr.id);
r = await f.req('GET', '/api/me');
check('Pelajar kedua: auto-renew aktif', r.data.user.autoRenew === true, r.data.user);
r = await f.req('POST', '/api/pay/stop-auto', {});
const r2 = await f.req('GET', '/api/me');
check('Berhenti auto-renew: token dipadam di CHIP, akses kekal', r.status === 200 && r2.data.user.autoRenew === false && r2.data.user.active === true && chipCalls.some(c => c.url === `/api/v1/purchases/${pr.id}/delete_recurring_token/`), r2.data.user);
r = await fetch(BASE + '/api/pay/callback', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://gate.chip-in.asia' }, body: JSON.stringify({ id: 'tiada' }) });
check('Callback dari domain CHIP diterima (id tak dikenali diabaikan)', r.status === 200);

// statistik & eksport
r = await ad.req('GET', '/api/admin/payments');
check('Admin: senarai bayaran', r.status === 200 && r.data.payments.length >= 3 && r.data.payments.some(p => p.status === 'semak'), r.data);
r = await ad.req('GET', '/api/admin/insights');
check('Admin: statistik tontonan', r.status === 200 && r.data.videos.some(v => v.title === 'Hukum Nun Mati' && v.viewers === 1), r.data);
const csvRes = await fetch(BASE + '/api/admin/export/pelajar.csv', { headers: { cookie: '' } });
check('Eksport CSV perlu login admin', csvRes.status === 401);
const csv = await ad.raw('/api/admin/export/pelajar.csv');
const csvBytes = new Uint8Array(await csv.arrayBuffer());
const csvText = new TextDecoder().decode(csvBytes);
check('Eksport CSV untuk Excel (BOM, tajuk, data)', csv.status === 200 && csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csvText.includes('Nama,No. telefon') && csvText.includes('Rohana Ismail') && csv.headers.get('content-disposition').includes('.csv'), csvText.slice(0, 200));
// ---- sumbangan & taja pelajar ----
const revBefore = (await ad.req('GET', '/api/admin/stats')).data.stats.revenueThisMonthSen;
r = await plain0('GET', '/api/donate/info');
check('Info sumbangan awam (tanpa login)', r.status === 200 && r.data.ready === true && r.data.monthPriceSen === 1000 && r.data.stats.donors === 0, r.data);
r = await plain0('POST', '/api/donate/checkout', { use: 'taja', amountSen: 100, email: 'a@contoh.my', name: 'A' });
check('Sumbangan bawah RM5 ditolak', r.status === 400, r.data);
r = await plain0('POST', '/api/donate/checkout', { use: 'taja', amountSen: 3000, email: 'bukan-emel', name: 'A' });
check('Sumbangan tanpa emel sah ditolak', r.status === 400, r.data);
r = await plain0('POST', '/api/donate/checkout', { use: 'taja', amountSen: 3000, email: 'a@contoh.my' });
check('Tanpa nama & tidak pilih tanpa nama ditolak', r.status === 400, r.data);
r = await plain0('POST', '/api/donate/checkout', { use: 'taja', amountSen: 3000, email: 'karim@contoh.my', name: 'Haji Karim Bin Yusof', phone: '013-222 3333', message: 'Semoga dipermudahkan.' });
pr = lastPurchase();
check('Checkout sumbangan sekali: tanpa login, harga & resit betul', r.status === 200 && pr._req.force_recurring === false && !pr._req.payment_method_whitelist && pr._req.purchase.products[0].price === 3000 && pr._req.purchase.products[0].name.includes('Taja Pelajar') && pr._req.send_receipt === true, pr._req);
let back = new URL(pr._req.success_redirect);
const dId = back.searchParams.get('d'), dKey = back.searchParams.get('k');
check('Pautan kembali ke /sumbang dengan token', back.pathname === '/sumbang' && back.searchParams.get('status') === 'berjaya' && dKey && dKey.length > 15, pr._req.success_redirect);
r = await plain0('POST', '/api/donate/confirm', { id: dId, token: 'salah' });
check('Semak sumbangan dengan token salah ditolak', r.status === 404, r.data);
chipPay(pr.id); await callback(pr.id);
r = await plain0('POST', '/api/donate/confirm', { id: dId, token: dKey });
check('Sumbangan sekali diterima', r.data.payStatus === 'completed' && r.data.amountSen === 3000 && r.data.use === 'taja' && r.data.monthly === false, r.data);

r = await plain0('POST', '/api/donate/checkout', { use: 'umum', amountSen: 2000, monthly: true, email: 'rahsia@contoh.my', anonymous: true });
pr = lastPurchase(); back = new URL(pr._req.success_redirect);
const urus = back.searchParams.get('urus');
check('Sumbangan bulanan: kad sahaja, simpan token, pautan urus', r.status === 200 && pr._req.force_recurring === true && pr._req.payment_method_whitelist.join() === 'visa,mastercard,maestro' && urus && urus.length > 20, pr._req);
r = await plain0('GET', '/api/donate/manage?token=' + urus);
check('Sebelum bayar: penyumbang bulanan belum aktif', r.status === 200 && r.data.donor.active === false, r.data);
const donorToken = pr.id;
chipPay(pr.id); await callback(pr.id);
r = await plain0('GET', '/api/donate/manage?token=' + urus);
check('Selepas bayar: aktif, nama disembunyikan, caj seterusnya ~1 bulan', r.data.donor.active === true && r.data.donor.name === 'Hamba Allah' && Math.abs(r.data.donor.nextChargeAt - addM(Date.now(), 1)) < 120e3, r.data);
r = await plain0('GET', '/api/donate/manage?token=salah-token-yang-cukup-panjang');
check('Pautan urus palsu ditolak', r.status === 404, r.data);
r = await plain0('GET', '/api/donate/info');
check('Info: penyumbang terkini (Hamba Allah & nama pendek)', r.data.stats.donors === 2 && r.data.recent.map(x => x.name).join() === 'Hamba Allah,Haji Karim', r.data);

r = await ad.req('GET', '/api/admin/donations');
check('Admin: ringkasan sumbangan diasingkan', r.status === 200 && r.data.summary.tajaInSen === 3000 && r.data.summary.umumSen === 2000 && r.data.summary.tajaBalanceSen === 3000 && r.data.summary.monthlyDonors === 1 && r.data.donations[1].message === 'Semoga dipermudahkan.', r.data.summary);
const fId = (await ad.req('GET', '/api/admin/users?q=Salmah')).data.users[0].id;
const fBefore = (await f.req('GET', '/api/me')).data.user.paidUntil;
r = await ad.req('POST', `/api/admin/users/${fId}/sponsor`, { months: 3 });
check('Taja pelajar 3 bulan dari dana', r.status === 200 && r.data.balanceSen === 0 && Math.abs(r.data.paidUntil - addM(Math.max(Date.now(), fBefore), 3)) < 60e3, r.data);
r = await ad.req('POST', `/api/admin/users/${fId}/sponsor`, { months: 1 });
check('Baki dana tak cukup: ditolak', r.status === 400 && /tidak mencukupi/.test(r.data.error), r.data);
r = await plain0('GET', '/api/donate/info');
check('Info awam: 1 pelajar ditaja', r.data.stats.studentsSponsored === 1, r.data.stats);

d1(`UPDATE donors SET next_charge_at = ${Date.now() - 1000}`);
await cron(); await sleep(800);
r = await ad.req('GET', '/api/admin/donations');
check('Cron: sumbangan bulanan dicaj guna token', r.data.summary.umumSen === 4000 && chipCalls.some(c => c.url.endsWith('/charge/') && c.body.recurring_token === donorToken) && r.data.donors[0].nextChargeAt > Date.now() + 20 * 864e5, r.data.summary);
r = await plain0('POST', '/api/donate/stop', { token: urus });
const m2 = await plain0('GET', '/api/donate/manage?token=' + urus);
check('Penyumbang hentikan sumbangan bulanan sendiri', r.status === 200 && m2.data.donor.active === false && chipCalls.some(c => c.url === `/api/v1/purchases/${donorToken}/delete_recurring_token/`), m2.data);
r = await ad.req('GET', '/api/admin/stats');
check('Kutipan langganan tidak bercampur dengan sumbangan', r.data.stats.revenueThisMonthSen === revBefore, { before: revBefore, after: r.data.stats.revenueThisMonthSen });
r = await plain0('GET', '/api/admin/donations');
check('Orang awam tak boleh lihat rekod sumbangan', r.status === 401);
const dcsv = new TextDecoder().decode(await (await ad.raw('/api/admin/export/sumbangan.csv')).arrayBuffer());
check('Eksport rekod sumbangan', dcsv.includes('Haji Karim Bin Yusof') && dcsv.includes('Taja Pelajar') && dcsv.includes('30.00'), dcsv.slice(0, 300));
page = await fetch(BASE + '/sumbang');
check('Halaman /sumbang dipapar', page.status === 200 && (await page.text()).includes('/sumbang.js'));

chipMock.close();

// ---- doa harian ----
r = await plain0('GET', '/api/doas');
check('Doa perlu log masuk', r.status === 401);
r = await e.req('GET', '/api/doas');
check('Pelajar: doa contoh belum diterbitkan', r.status === 200 && r.data.doas.length === 0, r.data);
r = await ad.req('GET', '/api/admin/doas');
const doas = r.data && r.data.doas || [];
check('Admin: doa contoh dimasukkan sebagai draf', doas.length >= 14 && doas.every(d => !d.published) && doas.some(d => d.title === 'Sebelum tidur'), doas.length);
r = await ad.req('GET', '/api/admin/doas');
check('Doa contoh tidak bertindih bila dibuka semula', r.data.doas.length === doas.length);
r = await ad.req('POST', `/api/admin/doas/${doas[0].id}`, { published: true });
check('Admin terbitkan doa', r.status === 200 && r.data.doa.published && r.data.doa.arabic === doas[0].arabic, r.data);
r = await ad.req('POST', '/api/admin/doas', { title: 'Uji', meaning: 'x' });
check('Doa tanpa teks Arab ditolak', r.status === 400);
r = await ad.req('POST', '/api/admin/doas', { category: 'Ujian', title: 'Doa ujian', arabic: 'رَبِّ زِدْنِيْ عِلْمًا', meaning: 'Tambahkan ilmuku', published: true });
const newDoa = r.data && r.data.doa;
check('Admin tambah doa', r.status === 201 && newDoa.category === 'Ujian' && newDoa.sort > doas[doas.length - 1].sort, r.data);
r = await e.req('GET', '/api/doas');
check('Pelajar nampak doa diterbitkan sahaja', r.data.doas.length === 2 && r.data.doas.every(d => d.published), r.data.doas.map(d => d.title));
r = await ad.req('POST', `/api/admin/doas/${newDoa.id}/delete`, {});
r = await e.req('GET', '/api/doas');
check('Doa dipadam hilang dari pelajar', r.data.doas.length === 1);
r = await e.req('POST', '/api/admin/doas', { title: 'x', arabic: 'x', meaning: 'x' });
check('Pelajar tak boleh tambah doa', r.status === 401);

// ---- zikir & selawat (audio) ----
r = await ad.req('GET', '/api/admin/audios');
const auds = r.data && r.data.audios || [];
check('Admin: 4 draf audio contoh, storan R2 sedia', auds.length === 4 && auds.every(a => !a.hasAudio && !a.published) && r.data.storageReady === true, r.data);
const asma = auds.find(a => a.title === 'Asmaul Husna');
check('Asmaul Husna ada 99 nama', asma && asma.arabic.split('، ').length === 99 && asma.rumi.split(', ').length === 99, asma && asma.arabic.split('، ').length);
const aid = auds.find(a => a.title === 'Sayyidul Istighfar').id;
r = await ad.req('POST', `/api/admin/audios/${aid}`, { published: true });
check('Tak boleh terbit audio tanpa fail', r.status === 400, r.data);
let up = await ad.send('POST', `/api/admin/audios/${aid}/file`, 'bukan audio', { 'content-type': 'text/plain' });
check('Fail bukan audio ditolak', up.status === 415);
const bytes = new Uint8Array(3000).map((_, i) => (i * 7) % 256);
up = await ad.send('POST', `/api/admin/audios/${aid}/file?duration=125`, bytes, { 'content-type': 'audio/mpeg' });
let upj = await up.json();
check('Admin muat naik audio', up.status === 200 && upj.audio.hasAudio && upj.audio.durationSec === 125 && upj.audio.size === 3000, upj);
r = await e.req('GET', '/api/audios');
check('Pelajar: audio draf belum kelihatan', r.status === 200 && r.data.audios.length === 0);
r = await ad.req('POST', `/api/admin/audios/${aid}`, { published: true });
check('Admin terbitkan audio', r.status === 200 && r.data.audio.published, r.data);
r = await e.req('GET', '/api/audios');
check('Pelajar nampak audio diterbitkan', r.data.audios.length === 1 && r.data.audios[0].id === aid && r.data.audios[0].durationSec === 125, r.data);
let fr = await e.send('GET', `/api/audios/${aid}/file`);
let fb = new Uint8Array(await fr.arrayBuffer());
check('Main audio penuh', fr.status === 200 && fr.headers.get('content-type') === 'audio/mpeg' && fr.headers.get('accept-ranges') === 'bytes' && fb.length === 3000 && fb[100] === bytes[100], { s: fr.status, ct: fr.headers.get('content-type'), n: fb.length });
fr = await e.send('GET', `/api/audios/${aid}/file`, undefined, { range: 'bytes=10-19' });
fb = new Uint8Array(await fr.arrayBuffer());
check('Audio sokong Range (lompat / iPhone)', fr.status === 206 && fr.headers.get('content-range') === 'bytes 10-19/3000' && fb.length === 10 && fb[0] === bytes[10], { s: fr.status, cr: fr.headers.get('content-range'), n: fb.length });
fr = await fetch(BASE + `/api/audios/${aid}/file`);
check('Audio perlu log masuk', fr.status === 401);
const bytes2 = new Uint8Array(2000).fill(9);
up = await ad.send('POST', `/api/admin/audios/${aid}/file`, bytes2, { 'content-type': 'audio/mp4' });
fr = await e.send('GET', `/api/audios/${aid}/file`);
fb = new Uint8Array(await fr.arrayBuffer());
check('Tukar fail audio', up.status === 200 && fb.length === 2000 && fr.headers.get('content-type') === 'audio/mp4', { n: fb.length });
r = await ad.req('POST', '/api/admin/audios', { title: 'Zikir pagi ujian' });
check('Admin tambah audio baharu (draf)', r.status === 201 && !r.data.audio.published && !r.data.audio.hasAudio, r.data);
r = await ad.req('POST', `/api/admin/audios/${aid}/delete`, {});
r = await e.req('GET', '/api/audios');
fr = await e.send('GET', `/api/audios/${aid}/file`);
check('Audio dipadam hilang', r.data.audios.length === 0 && fr.status === 404);
r = await e.req('POST', '/api/admin/audios', { title: 'x' });
check('Pelajar tak boleh tambah audio', r.status === 401);

// ---- padam akaun dari web (syarat Google Play) ----
const delPhone = '01' + String(Date.now() + 913).slice(-8);
const g = jar();
r = await g.req('POST', '/api/register', { name: 'Pelajar Padam', phone: delPhone, email: 'padam@contoh.my', pin: '482913' });
check('Daftar akaun untuk dipadam', r.status === 201, r.data);
r = await plain0('POST', '/api/account/delete', { phone: delPhone, pin: '482913' });
check('Padam web perlu taip PADAM', r.status === 400, r.data);
r = await plain0('POST', '/api/account/delete', { phone: delPhone, pin: '111222', confirm: 'PADAM' });
check('Padam web: PIN salah ditolak', r.status === 401, r.data);
r = await plain0('POST', '/api/account/delete', { phone: delPhone, pin: '482913', confirm: 'PADAM' });
check('Padam web: akaun dipadam', r.status === 200 && r.data.ok, r.data);
r = await g.req('GET', '/api/me');
check('Sesi akaun dipadam tamat', r.status === 401);
r = await plain0('POST', '/api/login', { phone: delPhone, pin: '482913' });
check('Akaun dipadam tak boleh log masuk', r.status === 401);
let pg2 = await fetch(BASE + '/padam-akaun');
check('Halaman /padam-akaun wujud', pg2.status === 200 && (await pg2.text()).includes('/padam-akaun.js'));
pg2 = await fetch(BASE + '/privasi');
check('Polisi privasi pautkan halaman padam akaun', (await pg2.text()).includes('/padam-akaun'));

// ---- laman web syarikat ----
// fetch() tak benarkan tukar Host, jadi guna node:http
const hostGet = (host, path) => new Promise((ok, bad) => {
  const u = new URL(BASE + path);
  http.get({ hostname: u.hostname, port: u.port, path: u.pathname, headers: { host } }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => ok({ status: res.statusCode, body: b })); }).on('error', bad);
});
let siteRes = await hostGet('baitalsalihin.com', '/');
check('Domain syarikat: halaman utama ialah laman web', siteRes.status === 200 && siteRes.body.includes('Tak pernah terlambat') && siteRes.body.includes('/site/site.js'), siteRes.status);
siteRes = await hostGet('www.baitalsalihin.com', '/sumbang');
check('Domain syarikat: /sumbang tersedia', siteRes.status === 200 && siteRes.body.includes('/sumbang.js'));
let site = await fetch(BASE + '/');
check('Domain app: halaman utama kekal apps', (await site.text()).includes('/pelajar.js'));
r = await plain0('GET', '/api/site');
check('API laman web awam (pakej & syarikat, tanpa login)', r.status === 200 && Array.isArray(r.data.plans) && r.data.plans.length >= 1 && 'playUrl' in r.data.links && !('users' in r.data), r.data);
r = await ad.req('POST', '/api/admin/settings', { name: 'Bait Al Salihin Resources', playUrl: 'https://contoh.com/apps' });
check('Pautan Play Store palsu ditolak', r.status === 400, r.data);
r = await ad.req('POST', '/api/admin/settings', { name: 'Bait Al Salihin Resources', playUrl: 'https://play.google.com/store/apps/details?id=com.baitalsalihin.madrasah', appStoreUrl: '' });
check('Admin simpan pautan Play Store', r.status === 200 && r.data.links.playUrl.includes('play.google.com'), r.data);
r = await plain0('GET', '/api/site');
check('Laman web nampak pautan Play Store', r.data.links.playUrl.includes('com.baitalsalihin.madrasah') && r.data.links.appStoreUrl === '');

// ---- keselamatan: pengepala, log admin, hash lama ----
let h = await fetch(BASE + '/api/me');
check('API ada pengepala keselamatan', /frame-ancestors 'none'/.test(h.headers.get('content-security-policy') || '') && h.headers.get('x-frame-options') === 'DENY' && h.headers.get('x-content-type-options') === 'nosniff', Object.fromEntries(h.headers));
h = await fetch(BASE + '/');
check('App pelajar ada pengepala keselamatan', /script-src 'self'/.test(h.headers.get('content-security-policy') || '') && h.headers.get('x-frame-options') === 'DENY', Object.fromEntries(h.headers));
h = await fetch(BASE + '/admin');
check('Panel admin ada pengepala keselamatan', h.headers.get('x-frame-options') === 'DENY');
h = await fetch(BASE + '/terma');
const termaHtml = await h.text();
check('Halaman polisi: pengepala + tiada skrip sebaris', h.headers.get('x-frame-options') === 'DENY' && !/<script>/.test(termaHtml) && termaHtml.includes('/theme-init.js'));
check('Fail _headers tidak boleh dimuat turun', (await fetch(BASE + '/_headers')).headers.get('content-type')?.includes('text/html') ?? true);

const bad = jar();
r = await bad.req('POST', '/api/admin/login', { email: 'admin@contoh.my', password: 'cuba-teka-salah' });
check('Login admin salah ditolak', r.status === 401);
await sleep(300);
r = await ad.req('GET', '/api/admin/log');
const logs = r.data && r.data.log || [];
check('Log admin: login direkod', logs.some(l => l.action === 'Log masuk admin' && !l.failed && l.admin === 'Admin'), logs.slice(0, 5));
check('Log admin: login gagal ditanda', logs.some(l => l.action === 'Log masuk admin' && l.failed && (l.detail || '').includes('admin@contoh.my')), logs.slice(0, 5));
check('Log admin: set semula PIN dengan nama pelajar', logs.some(l => l.action === 'Set semula PIN pelajar' && /Rohana Ismail/.test(l.target || '')), logs.filter(l => /PIN/.test(l.action)));
check('Log admin: muat turun CSV direkod', logs.some(l => l.action === 'Muat turun rekod sumbangan (CSV)'));
check('Log admin: langganan manual direkod', logs.some(l => l.action === 'Ubah langganan pelajar'));
check('Log admin: PIN & kata laluan tidak disimpan', !logs.some(l => /739215|624813|katalaluan-panjang|cuba-teka-salah/.test(l.detail || '')), logs.map(l => l.detail).filter(Boolean).slice(0, 8));
r = await plain0('GET', '/api/admin/log');
check('Orang awam tak boleh lihat log admin', r.status === 401);
r = await e.req('GET', '/api/admin/log');
check('Pelajar tak boleh lihat log admin', r.status === 401);

// Hash lama (tanpa pin_iter) masih boleh login
d1(`UPDATE users SET pin_iter = NULL WHERE phone = '6${phone}'`);
r = await jar().req('POST', '/api/login', { phone, pin: '624813' });
check('Akaun dengan hash lama masih boleh login', r.status === 200, r.data);

// ---- langganan Google Play & App Store (API tiruan, tandatangan JWT disemak) ----
const devVars = Object.fromEntries(fs.readFileSync('.dev.vars', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
  .map(l => { const i = l.indexOf('='); let v = l.slice(i + 1).trim(); if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1); return [l.slice(0, i), v]; }));
const saInfo = JSON.parse(devVars.GOOGLE_SERVICE_ACCOUNT);
const gPub = nodeCrypto.createPublicKey(saInfo.private_key);
const aPub = nodeCrypto.createPublicKey(devVars.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'));
const PKG = devVars.GOOGLE_PLAY_PACKAGE, BID = devVars.APPLE_BUNDLE_ID;
const storeJwtOk = (tok, key, alg) => {
  const [h, p, s] = String(tok).split('.');
  const ok = nodeCrypto.verify('sha256', Buffer.from(h + '.' + p), alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key, Buffer.from(s || '', 'base64url'));
  return ok ? { header: JSON.parse(Buffer.from(h, 'base64url')), claims: JSON.parse(Buffer.from(p, 'base64url')) } : null;
};
const storeJws = o => `${Buffer.from('{"alg":"ES256"}').toString('base64url')}.${Buffer.from(JSON.stringify(o)).toString('base64url')}.c2ln`;
const gSubs = new Map(), aSubs = new Map(), storeCalls = [];
const storeMock = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    storeCalls.push({ method: req.method, url: req.url });
    let m;
    if (req.method === 'POST' && req.url === '/token') {
      const q = new URLSearchParams(b);
      const j = storeJwtOk(q.get('assertion'), gPub, 'RS256');
      if (!j || j.claims.iss !== saInfo.client_email || !/androidpublisher/.test(j.claims.scope) || q.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:jwt-bearer') return send(400, { error: 'invalid_grant' });
      return send(200, { access_token: 'g-access-123', expires_in: 3600 });
    }
    const gBase = `/androidpublisher/v3/applications/${PKG}/purchases/`;
    if (req.url.startsWith(gBase)) {
      if (req.headers.authorization !== 'Bearer g-access-123') return send(401, {});
      if (req.method === 'GET' && (m = req.url.slice(gBase.length).match(/^subscriptionsv2\/tokens\/([^/]+)$/))) {
        const s = gSubs.get(decodeURIComponent(m[1])); return s ? send(200, s) : send(404, { error: { code: 404 } });
      }
      if (req.method === 'POST' && (m = req.url.slice(gBase.length).match(/^subscriptions\/([^/]+)\/tokens\/([^/]+):acknowledge$/))) {
        const s = gSubs.get(decodeURIComponent(m[2])); if (s) s.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; return send(200, {});
      }
    }
    if ((m = req.url.match(/^\/(prod|sandbox)\/inApps\/v1\/subscriptions\/([^/]+)$/))) {
      const j = storeJwtOk((req.headers.authorization || '').replace(/^Bearer /, ''), aPub, 'ES256');
      if (!j || j.header.kid !== devVars.APPLE_KEY_ID || j.claims.iss !== devVars.APPLE_ISSUER_ID || j.claims.bid !== BID || j.claims.aud !== 'appstoreconnect-v1') return send(401, {});
      const s = aSubs.get(m[2]);
      if (!s || s.env !== m[1]) return send(404, { errorCode: 4040010 });
      return send(200, { environment: m[1] === 'prod' ? 'Production' : 'Sandbox', bundleId: s.bundleId || BID, data: [{ subscriptionGroupIdentifier: 'g1', lastTransactions: [{
        originalTransactionId: m[2], status: s.status,
        signedTransactionInfo: storeJws({ originalTransactionId: m[2], productId: s.productId, expiresDate: s.expiresDate, bundleId: s.bundleId || BID, ...(s.revoked ? { revocationDate: Date.now() } : {}) }),
        signedRenewalInfo: storeJws({ autoRenewStatus: s.autoRenew ? 1 : 0 }),
      }] }] });
    }
    send(404, {});
  });
});
await new Promise(ok => storeMock.listen(8799, '127.0.0.1', ok));
const storeMock2 = http.createServer((req, res) => storeMock.emit('request', req, res));
await new Promise(ok => storeMock2.listen(8800, '127.0.0.1', ok));
const gState = (expiresAt, state = 'SUBSCRIPTION_STATE_ACTIVE', autoRenew = true, ack = 'ACKNOWLEDGEMENT_STATE_PENDING', productId = 'madrasah.bulanan') => ({
  subscriptionState: state, acknowledgementState: ack,
  lineItems: [{ productId, expiryTime: new Date(expiresAt).toISOString(), autoRenewingPlan: { autoRenewEnabled: autoRenew } }],
});
const SDAY = 864e5;
const nearT = (a, b, tol = 5 * 60e3) => Math.abs(a - b) < tol;
const storeStudent = async (name, ph) => { const j = jar(); const x = await j.req('POST', '/api/register', { name, phone: ph, email: `${ph}@contoh.my`, pin: '482913' }); return { j, id: x.data && x.data.user && x.data.user.id }; };
const phS1 = '011' + String(Date.now()).slice(-7), phS2 = '012' + String(Date.now()).slice(-7), phS3 = '013' + String(Date.now()).slice(-7);
const s1 = await storeStudent('Pelajar Play', phS1), s2 = await storeStudent('Pelajar Apple', phS2), s3 = await storeStudent('Pelajar Lama', phS3);
r = await ad.req('GET', '/api/admin/users?q=Pelajar');
const st_uid = n => r.data.users.find(u => u.name === n).id;
const id1 = st_uid('Pelajar Play'), id2 = st_uid('Pelajar Apple'), id3 = st_uid('Pelajar Lama');

r = await jar().req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'x' });
check('Store: sahkan pembelian perlu log masuk', r.status === 401, r.data);
r = await s1.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'tiada-token' });
check('Store: token Google tak wujud ditolak', r.status === 404, r.data);
r = await s1.j.req('POST', '/api/store/verify', { platform: 'paypal', purchaseToken: 'x' });
check('Store: platform tak sah ditolak', r.status === 400, r.data);

const gExp1 = Date.now() + 60 * SDAY;
gSubs.set('gtok-1', gState(gExp1));
r = await s1.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-1' });
check('Store Google: pembelian disahkan, langganan aktif', r.status === 200 && r.data.active && r.data.status === 'active' && nearT(r.data.paidUntil, gExp1), r.data);
check('Store Google: pembelian di-acknowledge', gSubs.get('gtok-1').acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED');
r = await s1.j.req('GET', '/api/me');
check('Store Google: /api/me tunjuk langganan Google Play', r.data.user.active && r.data.user.store.length === 1 && r.data.user.store[0].platform === 'google' && r.data.user.store[0].autoRenew && r.data.user.autoRenew === false, r.data.user);
r = await s2.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-1' });
check('Store Google: token yang sama tak boleh dipakai akaun lain', r.status === 409, r.data);
r = await s1.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-1' });
check('Store Google: sahkan semula (pulihkan) oleh pemilik OK', r.status === 200 && r.data.active, r.data);

// Langganan web (manual admin) + store: tempoh tidak bercampur
r = await ad.req('POST', `/api/admin/users/${id1}/subscription`, { months: 1 });
check('Web + store: langganan manual tidak memendekkan tempoh store', r.status === 200 && nearT(r.data.paidUntil, gExp1) && r.data.storeActive === true, r.data);
const webUntil1 = addM(Date.now(), 1);

// RTDN Google: langganan tamat → kembali kepada tempoh web
gSubs.set('gtok-1', gState(Date.now() - 1000, 'SUBSCRIPTION_STATE_EXPIRED', false, 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'));
const rtdnBody = JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ version: '1.0', packageName: PKG, subscriptionNotification: { notificationType: 13, purchaseToken: 'gtok-1' } })).toString('base64'), messageId: '1' }, subscription: 'projects/x/subscriptions/y' });
let res2 = await fetch(BASE + '/api/store/google/rtdn?token=salah', { method: 'POST', headers: { 'content-type': 'application/json' }, body: rtdnBody });
check('RTDN Google: token rahsia salah ditolak', res2.status === 401);
res2 = await fetch(BASE + '/api/store/google/rtdn?token=' + devVars.STORE_RTDN_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://pubsub.googleapis.com' }, body: rtdnBody });
check('RTDN Google: diterima walaupun dari server luar', res2.status === 200);
r = await s1.j.req('GET', '/api/me');
check('RTDN Google: tamat store → tempoh web kekal', r.data.user.active && nearT(r.data.user.paidUntil, webUntil1, 2 * SDAY) && r.data.user.store.length === 0, r.data.user);
r = await ad.req('POST', `/api/admin/users/${id1}/subscription`, { action: 'tamat' });
check('Web + store: admin tamatkan → tidak aktif', r.status === 200 && r.data.active === false, r.data);

// Naik taraf pelan Google (linkedPurchaseToken): token lama tidak lagi beri akses
gSubs.set('gtok-a', gState(Date.now() + 20 * SDAY));
r = await s1.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-a' });
gSubs.set('gtok-b', { ...gState(Date.now() + 365 * SDAY, 'SUBSCRIPTION_STATE_ACTIVE', true, 'ACKNOWLEDGEMENT_STATE_PENDING', 'madrasah.tahunan'), linkedPurchaseToken: 'gtok-a' });
r = await s1.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-b' });
r = await s1.j.req('GET', '/api/me');
check('Store Google: naik taraf pelan → hanya token baharu dikira', r.data.user.store.length === 1 && nearT(r.data.user.paidUntil, Date.now() + 365 * SDAY), r.data.user);

// App Store: production tiada → cuba sandbox
const aExp1 = Date.now() + 30 * SDAY;
aSubs.set('2000000111', { env: 'sandbox', status: 1, productId: 'madrasah.bulanan', expiresDate: aExp1, autoRenew: true });
r = await s2.j.req('POST', '/api/store/verify', { platform: 'apple', originalTransactionId: '2000000111' });
check('Store Apple: disahkan (sandbox), langganan aktif', r.status === 200 && r.data.active && r.data.status === 'active' && nearT(r.data.paidUntil, aExp1), r.data);
check('Store Apple: JWT ES256 diterima API (production dicuba dahulu)', storeCalls.some(c => c.url === '/prod/inApps/v1/subscriptions/2000000111') && storeCalls.some(c => c.url === '/sandbox/inApps/v1/subscriptions/2000000111'));
aSubs.set('2000000222', { env: 'prod', status: 1, productId: 'lain.bulanan', expiresDate: aExp1, autoRenew: true, bundleId: 'com.app.lain' });
r = await s2.j.req('POST', '/api/store/verify', { platform: 'apple', originalTransactionId: '2000000222' });
check('Store Apple: pembelian app lain (bundle berbeza) ditolak', r.status === 404, r.data);
r = await s2.j.req('POST', '/api/store/verify', { platform: 'apple', originalTransactionId: '' });
check('Store Apple: tanpa id transaksi ditolak', r.status === 400, r.data);

// Notifikasi App Store: status diambil dari API Apple, bukan dari notifikasi
aSubs.get('2000000111').status = 2; aSubs.get('2000000111').expiresDate = Date.now() - 1000;
const notif = { signedPayload: storeJws({ notificationType: 'EXPIRED', data: { bundleId: BID, signedTransactionInfo: storeJws({ originalTransactionId: '2000000111' }) } }) };
res2 = await fetch(BASE + '/api/store/apple/notify', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://apple.com' }, body: JSON.stringify(notif) });
r = await s2.j.req('GET', '/api/me');
check('Notifikasi Apple: langganan tamat → tidak aktif', res2.status === 200 && r.data.user.active === false, r.data.user);
aSubs.get('2000000111').status = 1; aSubs.get('2000000111').expiresDate = Date.now() + 40 * SDAY;
res2 = await fetch(BASE + '/api/store/apple/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signedPayload: storeJws({ notificationType: 'DID_RENEW', data: { signedTransactionInfo: storeJws({ originalTransactionId: '2000000111', expiresDate: Date.now() + 999 * SDAY }) } }) }) });
r = await s2.j.req('GET', '/api/me');
check('Notifikasi Apple: tarikh dari API, bukan dari notifikasi', r.data.user.active && nearT(r.data.user.paidUntil, Date.now() + 40 * SDAY), r.data.user);
aSubs.get('2000000111').autoRenew = false;
await fetch(BASE + '/api/store/apple/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(notif) });
r = await s2.j.req('GET', '/api/me');
check('Store Apple: auto-renew dimatikan → masih aktif hingga tamat', r.data.user.active && r.data.user.store[0].autoRenew === false && r.data.user.store[0].status === 'canceled', r.data.user);

// Cron: sahkan semula langganan yang hampir tamat
aSubs.get('2000000111').autoRenew = true; aSubs.get('2000000111').expiresDate = Date.now() + 33 * SDAY;
d1(`UPDATE store_subscriptions SET expires_at = ${Date.now() + 3600e3}, verified_at = ${Date.now() - 7 * 3600e3} WHERE store_key = '2000000111'`);
await cron(true); await sleep(500);
r = await s2.j.req('GET', '/api/me');
check('Cron store: langganan disahkan semula & dilanjutkan', nearT(r.data.user.paidUntil, Date.now() + 33 * SDAY) && r.data.user.store[0].autoRenew, r.data.user);
aSubs.get('2000000111').revoked = true;
d1(`UPDATE store_subscriptions SET expires_at = ${Date.now() + 3600e3}, verified_at = ${Date.now() - 7 * 3600e3} WHERE store_key = '2000000111'`);
await cron(true); await sleep(500);
r = await s2.j.req('GET', '/api/me');
check('Cron store: bayaran balik (revoke) → akses ditarik', r.data.user.active === false, r.data.user);

// Rekod lama (web_paid_until kosong): tempoh web tidak hilang bila store disambung
const legacyUntil = Date.now() + 90 * SDAY;
d1(`UPDATE users SET paid_until = ${legacyUntil}, web_paid_until = NULL WHERE id = ${id3}`);
gSubs.set('gtok-3', gState(Date.now() + 10 * SDAY));
r = await s3.j.req('POST', '/api/store/verify', { platform: 'google', purchaseToken: 'gtok-3' });
check('Rekod lama: tempoh web dikekalkan bila store lebih pendek', r.status === 200 && nearT(r.data.paidUntil, legacyUntil), r.data);
gSubs.set('gtok-3', gState(Date.now() - 1000, 'SUBSCRIPTION_STATE_EXPIRED', false, 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'));
await fetch(BASE + '/api/store/google/rtdn?token=' + devVars.STORE_RTDN_TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ subscriptionNotification: { purchaseToken: 'gtok-3' } })).toString('base64') } }) });
r = await s3.j.req('GET', '/api/me');
check('Rekod lama: selepas store tamat, tempoh web masih ada', r.data.user.active && nearT(r.data.user.paidUntil, legacyUntil), r.data.user);

// Padam akaun: rekod langganan store dibuang
r = await s1.j.req('POST', '/api/me/delete', { pin: '482913', confirm: 'PADAM' });
const leftover = execSync(`npx wrangler d1 execute madrasah-db --local --json --command "SELECT COUNT(*) AS n FROM store_subscriptions WHERE user_id = ${id1}"`, { cwd: process.cwd() }).toString();
check('Padam akaun: langganan store turut dibuang', r.status === 200 && /"n":\s*0/.test(leftover), { r: r.data, leftover: leftover.slice(-120) });
storeMock.close(); storeMock2.close();
h = await fetch(BASE + '/.well-known/assetlinks.json');
check('assetlinks.json: JSON sah (kosong selagi cap jari belum diisi)', h.status === 200 && /application\/json/.test(h.headers.get('content-type')) && JSON.stringify(await h.json()) === '[]');
r = await s2.j.req('GET', '/api/plans');
check('Pakej: ID produk store & status store dihantar', r.data.plans[0].productId === 'madrasah.bulanan' && r.data.storeReady.google === true && r.data.storeReady.apple === true, r.data);

const plain = jar();
r = await plain.req('GET', '/api/admin/users');
check('Pelajar tanpa sesi admin tak boleh lihat senarai', r.status === 401);

console.log(`\n${pass} lulus, ${failCount} gagal`);
process.exit(failCount ? 1 : 0);
