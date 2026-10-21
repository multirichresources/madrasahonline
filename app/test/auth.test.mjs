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

// ---- notifikasi telefon (Web Push) dengan servis push tiruan ----
const http = await import('node:http');
const nodeCrypto = await import('node:crypto');
const pings = [];
const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { pings.push({ path: req.url, headers: req.headers, body: b }); res.writeHead(201); res.end(); }); });
await new Promise(ok => mock.listen(8799, '127.0.0.1', ok));
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
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
await fetch(BASE + '/cdn-cgi/handler/scheduled?cron=*%2F5+*+*+*+*');
await sleep(800);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
const titles = r.data.items.map(i => i.title);
check('Cron: peringatan 30 minit & sehari sebelum', titles.includes('Kelas bermula sekejap lagi') && titles.some(t => t === 'Peringatan kelas: Kelas Esok') && titles.some(t => t.startsWith('Kelas Zoom: Kelas Malam Ini')), titles);
check('Cron: ping dihantar', pings.length > pingCount, pings.length - pingCount);
lastSeen = Math.max(...r.data.items.map(i => i.id));
await fetch(BASE + '/cdn-cgi/handler/scheduled?cron=*%2F5+*+*+*+*');
await sleep(500);
r = await e.req('GET', `/api/push/inbox?since=${lastSeen}`);
check('Cron: peringatan tidak berulang', r.data.items.length === 0, r.data);
await ad.req('POST', `/api/admin/announcements/${soonId}/delete`, {});
r = await e.req('POST', '/api/push/unsubscribe', { endpoint: 'http://127.0.0.1:8799/push/e1' });
r = await e.req('POST', '/api/push/test', {});
check('Selepas matikan, tiada notifikasi', r.status === 400, r.data);
mock.close();

const plain = jar();
r = await plain.req('GET', '/api/admin/users');
check('Pelajar tanpa sesi admin tak boleh lihat senarai', r.status === 401);

console.log(`\n${pass} lulus, ${failCount} gagal`);
process.exit(failCount ? 1 : 0);
