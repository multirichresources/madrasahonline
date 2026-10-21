// Panel admin Madrasah Online.
const A = { view: 'loading', tab: 'ringkasan', admin: null, err: '', stats: null, users: null, q: '', filter: 'semua', modal: null, sel: null, newPin: null, videos: null, vmeta: null, upload: null, delVideo: null, bunnyItems: null, imp: null, anns: null, annForm: null, delAnn: null, org: null, qs: null, qFilter: 'belum', unanswered: 0, editQ: null };
const blankAnn = () => ({ id: null, isClass: true, title: '', body: '', classAt: null, zoomUrl: '', membersOnly: true, notify: true });
A.annForm = blankAnn();
// ms → nilai untuk <input type="datetime-local"> (waktu tempatan)
const toLocalInput = ms => { if (!ms) return ''; const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const app = document.getElementById('app');

const toWa = phone => '6' + String(phone).replace(/\D/g, '');

function randomPin() {
  const bad = p => /^(\d)\1{5}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p);
  let p;
  do { p = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0'); } while (bad(p));
  return p;
}

const brand = sub => `<div class="toolbar">${themeBtn()}</div>
  <div class="login">
    <div class="brand">
      <div class="plate"><img class="logo logo-lg" src="/logo.png" alt="Madrasah Online" width="640" height="608"></div>
      <h1>Panel Admin</h1>
      <p class="muted">${sub}</p>
      ${orn()}
    </div>`;

function vSetup() {
  return brand('Persediaan kali pertama') + `
    <div class="adminnote">${I.shield}<p>Belum ada akaun admin. Cipta akaun admin pertama menggunakan <b>SETUP_KEY</b> yang disimpan di Cloudflare. Skrin ini hilang selepas admin pertama dicipta.</p></div>
    <form id="fSetup" class="card" novalidate>
      <label class="f" for="sKey">SETUP_KEY<input class="input" id="sKey" type="password" autocomplete="off"></label>
      <label class="f" for="sName">Nama admin<input class="input" id="sName" autocomplete="name"></label>
      <label class="f" for="sEmail">Emel admin<input class="input" id="sEmail" type="email" inputmode="email" autocomplete="username"></label>
      <label class="f" for="sPass">Kata laluan (min. 10 aksara)<input class="input" id="sPass" type="password" autocomplete="new-password"></label>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Cipta akaun admin</button>
    </form>
  </div>`;
}

function vLogin() {
  return brand('Untuk ustaz dan admin sahaja') + `
    <form id="fLogin" class="card" novalidate>
      <label class="f" for="aEmail">Emel admin<input class="input" id="aEmail" type="email" inputmode="email" autocomplete="username"></label>
      <label class="f" for="aPass">Kata laluan<input class="input" id="aPass" type="password" autocomplete="current-password"></label>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Masuk Panel Admin</button>
    </form>
    ${installCard()}
  </div>`;
}

function tRingkasan() {
  const s = A.stats;
  if (!s) return '<div class="loading">Memuatkan statistik...</div>';
  return `<div class="stats">
      <div class="stat"><b>${s.activeUsers}</b><span>Pelajar aktif</span></div>
      <div class="stat"><b>${s.totalUsers}</b><span>Jumlah berdaftar</span></div>
      <div class="stat"><b>${rm(s.revenueThisMonthSen)}</b><span>Kutipan bulan ini</span></div>
      <div class="stat"><b>${s.registeredNotPaid}</b><span>Daftar, belum bayar</span></div>
    </div>
    <div class="card">
      <span class="eyebrow">Perlu tindakan</span>
      <div class="rows">
        <div class="row"><div><b>${s.expiringIn7Days} langganan tamat dalam 7 hari</b><p class="muted small">Ingatkan mereka untuk sambung</p></div></div>
        <div class="row"><div><b>${s.registeredNotPaid} pelajar belum bayar</b><p class="muted small">Boleh follow up melalui WhatsApp</p></div><button class="iconbtn" data-a="filterGo" data-v="belum-bayar">Lihat</button></div>
        <div class="row"><div><b>${s.unansweredQuestions} soalan belum dijawab</b><p class="muted small">Soalan pelajar kepada ustaz</p></div><button class="iconbtn" data-a="tab" data-v="soalan">Jawab</button></div>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">Peringatan telefon</span>
      <p><b>${s.pushUsers}</b> pelajar sudah hidupkan notifikasi. Mereka dapat peringatan sehari dan 30 minit sebelum kelas Zoom secara automatik.</p>
    </div>
    <button class="btn btn-ghost" data-a="refresh">Muat semula</button>`;
}

function userRow(u) {
  const days = u.paidUntil ? Math.ceil((u.paidUntil - Date.now()) / 864e5) : null;
  const pill = !u.paidUntil ? '<span class="pill warn">Belum bayar</span>' : days <= 0 ? '<span class="pill bad">Tamat</span>' : days <= 7 ? `<span class="pill warn">${days} hari lagi</span>` : '<span class="pill ok">Aktif</span>';
  return `<button class="row" data-a="user" data-v="${u.id}" style="width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;cursor:pointer;color:inherit">
    <div style="min-width:0"><b>${esc(u.name)}</b><p class="muted small">${esc(u.phone)} · daftar ${fmtDate(u.createdAt)}</p></div>${pill}</button>`;
}

function tPelajar() {
  const filters = [['semua', 'Semua'], ['aktif', 'Aktif'], ['belum-bayar', 'Belum bayar'], ['tamat', 'Tamat']];
  return `<form id="fSearch" class="card" novalidate>
      <label class="f" for="q">Cari nama atau no. telefon<input class="input" id="q" value="${esc(A.q)}" placeholder="Contoh: Rohana atau 0123"></label>
      <div class="filter-row">${filters.map(([k, l]) => `<button type="button" class="chip ${A.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l}</button>`).join('')}</div>
      <button class="btn btn-primary" type="submit">Cari</button>
    </form>
    <div class="card">
      <span class="eyebrow">${A.users ? A.users.length + ' pelajar' : 'Memuatkan...'}</span>
      <div class="rows">${A.users ? (A.users.length ? A.users.map(userRow).join('') : '<p class="muted">Tiada pelajar sepadan.</p>') : ''}</div>
    </div>`;
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const monthLabel = m => m ? MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4) : '';

function videoRow(v) {
  const pill = v.ready ? (v.published ? '<span class="pill ok">Diterbitkan</span>' : '<span class="pill warn">Sedia, belum terbit</span>')
    : v.status === 5 || v.status === 6 ? `<span class="pill bad">${esc(v.statusLabel)}</span>`
    : `<span class="pill warn">${esc(v.statusLabel)}${v.progress ? ' ' + v.progress + '%' : ''}</span>`;
  return `<div class="q">
    <div class="top" style="align-items:flex-start"><div style="min-width:0"><b>${esc(v.title)}</b>
      <p class="muted small">${esc(v.topic)}${v.classMonth ? ' · ' + monthLabel(v.classMonth) : ''}${v.minutes ? ' · ' + v.minutes + ' minit' : ''}</p></div>${pill}</div>
    <div class="btn-row">
      ${v.ready ? `<button class="btn ${v.published ? 'btn-ghost' : 'btn-primary'}" data-a="vPublish" data-v="${v.id}">${v.published ? 'Sembunyikan' : 'Terbitkan'}</button>` : ''}
      <button class="btn btn-ghost" data-a="vDelete" data-v="${v.id}" style="color:var(--danger)">Padam</button>
    </div>
  </div>`;
}

function tVideo() {
  const m = A.vmeta;
  if (!m) return '<div class="loading">Memuatkan video...</div>';
  const now = new Date(), month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const up = A.upload;
  return `${m.bunnyReady ? '' : `<div class="adminnote">${I.shield}<p><b>Bunny Stream belum disambung.</b> Tambah secret <b>BUNNY_API_KEY</b> di Cloudflare untuk upload video.</p></div>`}
    ${m.bunnyReady && !m.tokenReady ? `<div class="adminnote">${I.shield}<p><b>Perlindungan video belum aktif.</b> Hidupkan Token Authentication di Bunny dan tambah secret <b>BUNNY_TOKEN_KEY</b> di Cloudflare, supaya pautan video tak boleh dikongsi.</p></div>` : ''}
    <div class="card">
      <span class="eyebrow">Import dari Bunny (disyorkan)</span>
      <p class="small">Upload video terus di Bunny (Stream → library <b>madrasah-online</b> → Upload), kemudian import ke app di sini. Lebih stabil untuk rakaman panjang.</p>
      ${A.bunnyItems === null ? '' : A.bunnyItems === 'loading' ? '<p class="muted">Menyemak Bunny...</p>' : A.bunnyItems.length ? `<div class="rows">${A.bunnyItems.map(b => `<div class="row"><div style="min-width:0"><b>${esc(b.title)}</b><p class="muted small">${b.ready ? b.minutes + ' minit' : esc(b.statusLabel) + (b.progress ? ' ' + b.progress + '%' : '')}</p></div><button class="iconbtn" data-a="impOpen" data-v="${b.guid}">Import</button></div>`).join('')}</div>` : '<p class="muted small">Tiada video baharu di Bunny untuk diimport.</p>'}
      <button class="btn btn-primary" data-a="bunnyCheck" ${m.bunnyReady ? '' : 'disabled'}>Semak video baharu di Bunny</button>
    </div>
    <form id="fUpload" class="card" novalidate>
      <span class="eyebrow">Atau muat naik terus dari app</span>
      <label class="f" for="vTitle">Tajuk video<input class="input" id="vTitle" maxlength="120" placeholder="Contoh: Hukum Nun Mati & Tanwin"></label>
      <label class="f" for="vTopic">Topik<select class="input" id="vTopic">${m.topics.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="f" for="vArabic">Label Arab <span class="muted small">(pilihan, untuk gambar kecil)</span><input class="input" id="vArabic" dir="rtl" maxlength="40" placeholder="النون الساكنة" style="font-family:var(--f-ar);font-size:1.2rem"></label>
      <label class="f" for="vMonth">Bulan kelas<input class="input" id="vMonth" type="month" value="${month}"></label>
      <label class="f" for="vFile">Fail video<input class="input" id="vFile" type="file" accept="video/*"></label>
      ${up ? `<div class="ok-box">${esc(up.msg)}${up.pct != null ? ` <b>${up.pct}%</b>` : ''}</div><span class="bar"><i style="width:${up.pct || 0}%"></i></span>` : ''}
      ${up && up.log && up.log.length ? `<details class="uplog" ${up.busy ? '' : 'open'}><summary>Butiran teknikal (screenshot bahagian ini jika upload bermasalah)</summary><pre>${esc(up.log.join('\n'))}</pre></details>` : ''}
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit" ${!m.bunnyReady || (up && up.busy) ? 'disabled' : ''}>Muat naik video</button>
      <p class="note">Jangan tutup halaman ini semasa muat naik. Selepas siap, Bunny akan proses video beberapa minit sebelum boleh diterbitkan.</p>
    </form>
    <div class="card">
      <div class="top"><span class="eyebrow">Semua video · ${A.videos.length}</span><button class="iconbtn" data-a="vRefresh">Muat semula</button></div>
      <div class="qa">${A.videos.length ? A.videos.map(videoRow).join('') : '<p class="muted">Belum ada video.</p>'}</div>
    </div>`;
}

async function loadVideos() {
  const r = await api('GET', '/api/admin/videos');
  if (r.status === 401) return toLogin();
  if (!r.ok) { toast(r.error); return; }
  A.videos = r.videos; A.vmeta = { bunnyReady: r.bunnyReady, tokenReady: r.tokenReady, topics: r.topics };
  render();
}

let tusLoaded = null;
function loadTus() {
  if (window.tus) return Promise.resolve();
  if (!tusLoaded) tusLoaded = new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = '/tus.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
  return tusLoaded;
}

async function startUpload(btn) {
  const file = document.getElementById('vFile').files[0];
  if (!val('vTitle')) { A.err = 'Sila isi tajuk video.'; render(); return; }
  if (!file) { A.err = 'Sila pilih fail video.'; render(); return; }
  A.err = '';
  const r = await busy(btn, () => api('POST', '/api/admin/videos', { title: val('vTitle'), topic: val('vTopic'), arabicLabel: val('vArabic'), classMonth: val('vMonth') }));
  if (r.status === 401) return toLogin();
  if (!r.ok) { A.err = r.error; render(); return; }
  try { await loadTus(); } catch { A.err = 'Gagal memuatkan alat upload. Semak internet dan cuba lagi.'; render(); return; }
  const t = r.upload;
  const t0 = Date.now();
  A.upload = { busy: true, pct: 0, msg: `Memuat naik "${file.name}"...`, log: [] };
  const log = (line) => {
    if (!A.upload || !A.upload.log) return;
    A.upload.log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${line}`);
    if (A.tab === 'video') render();
  };
  log(`Fail: ${file.name} · ${(file.size / 1048576).toFixed(1)} MB · ${file.type || 'jenis tak diketahui'}`);
  log(`Video Bunny: ${t.videoId} · library ${t.libraryId}`);
  log(`Pelayar: ${navigator.userAgent.slice(0, 110)}`);
  forget('vTitle', 'vArabic');
  render();
  let gotResponse = false;
  // Jika 30 saat tiada apa-apa jawapan dari Bunny, beritahu (bukannya diam di 0%)
  const watchdog = setTimeout(() => {
    if (A.upload && A.upload.busy && !gotResponse) {
      A.upload.msg = 'Tiada jawapan dari Bunny selepas 30 saat. Sambungan mungkin disekat. Screenshot butiran teknikal di bawah.';
      log('AMARAN: tiada jawapan dari server Bunny dalam 30 saat');
    }
  }, 30000);
  const up = new tus.Upload(file, {
    endpoint: t.endpoint,
    retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
    chunkSize: 50 * 1024 * 1024,
    headers: { AuthorizationSignature: t.signature, AuthorizationExpire: String(t.expire), VideoId: t.videoId, LibraryId: t.libraryId },
    metadata: { filetype: file.type || 'video/mp4', title: r.video.title },
    // Setiap video Bunny ada rekod upload sendiri, supaya tak tersambung ke upload lama yang dah dipadam
    fingerprint: f => Promise.resolve(['mo', t.videoId, f.name, f.size, f.lastModified].join('-')),
    removeFingerprintOnSuccess: true,
    onBeforeRequest(req) {
      log(`→ ${req.getMethod()} ${req.getURL().replace(/^https:\/\//, '').slice(0, 70)}`);
    },
    onAfterResponse(req, res) {
      gotResponse = true;
      const body = res.getBody ? String(res.getBody() || '').slice(0, 100) : '';
      log(`← ${req.getMethod()} kod ${res.getStatus()}${body ? ' · ' + body : ''}`);
    },
    onShouldRetry(err, attempt) {
      const st = err.originalResponse ? err.originalResponse.getStatus() : 0;
      log(`Ralat: ${String(err.message || err).slice(0, 160)}`);
      A.upload.msg = `Sambungan ke Bunny gagal${st ? ' (kod ' + st + ')' : ''}. Mencuba semula (${attempt + 1}/6)...`;
      render();
      return !(st >= 400 && st < 500 && st !== 409 && st !== 423);
    },
    onProgress(sent, total) {
      const pct = Math.floor(sent / total * 100);
      if (pct !== A.upload.pct) {
        if (A.upload.pct === 0) log('Data mula dihantar');
        A.upload.pct = pct; if (A.tab === 'video') render();
      }
    },
    onError(err) {
      console.error(err);
      clearTimeout(watchdog);
      const res = err.originalResponse;
      const detail = res ? `kod ${res.getStatus()}${res.getBody() ? ': ' + String(res.getBody()).slice(0, 120) : ''}` : String(err.message || err).slice(0, 160);
      log(`GAGAL: ${String(err.message || err).slice(0, 200)}`);
      A.upload = { busy: false, pct: null, log: A.upload.log, msg: `Muat naik gagal (${detail}). Padam video ni dan cuba semula. Jika berulang, screenshot butiran teknikal di bawah.` };
      render(); loadVideos();
    },
    onSuccess() {
      clearTimeout(watchdog);
      A.upload = { busy: false, pct: null, msg: 'Muat naik selesai. Bunny sedang memproses video. Tekan "Muat semula" dalam beberapa minit, kemudian Terbitkan.' };
      toast('Video berjaya dimuat naik.');
      render(); loadVideos();
    },
  });
  try { up.start(); log('Upload dimulakan'); }
  catch (e) { clearTimeout(watchdog); log('GAGAL mula: ' + String(e.message || e)); A.upload.busy = false; A.upload.msg = 'Upload tak dapat dimulakan.'; render(); }
}

function qRow(q) {
  const editing = A.editQ === q.id || !q.answer;
  return `<div class="q">
    <div class="who"><b>${esc(q.asker)}</b><span>${fmtDate(q.createdAt)}</span></div>
    ${q.askerPhone ? `<span class="muted small">${esc(q.askerPhone)}</span>` : ''}
    ${q.videoTitle ? `<span class="muted small">Tentang video: <b>${esc(q.videoTitle)}</b></span>` : ''}
    <p class="ann">${esc(q.body)}</p>
    ${editing && !q.hidden ? `<form class="fAnswer" data-v="${q.id}" novalidate style="display:flex;flex-direction:column;gap:.6rem">
        <label class="f" for="ans-${q.id}">${q.answer ? 'Edit jawapan' : 'Jawapan ustaz'}<textarea class="input" id="ans-${q.id}" rows="4" maxlength="3000">${esc(q.answer || '')}</textarea></label>
        <button class="btn btn-primary" type="submit">${q.answer ? 'Simpan jawapan' : 'Hantar jawapan'}</button>
        ${q.answer ? '<button class="btn btn-ghost" type="button" data-a="qEditCancel">Batal</button>' : ''}
      </form>`
      : q.answer ? `<div class="ans"><b>Jawapan ${esc(q.answeredBy || 'admin')}</b><p class="ann">${esc(q.answer)}</p></div>` : ''}
    <div class="btn-row">
      ${q.answer && !editing && !q.hidden ? `<button class="btn btn-ghost" data-a="qEdit" data-v="${q.id}">Edit jawapan</button>` : ''}
      <button class="btn btn-ghost" data-a="qHide" data-v="${q.id}">${q.hidden ? 'Papar semula' : 'Sembunyikan'}</button>
    </div>
  </div>`;
}

function tSoalan() {
  const filters = [['belum', 'Belum dijawab'], ['dijawab', 'Dijawab'], ['sembunyi', 'Disembunyikan']];
  return `<div class="filter-row">${filters.map(([k, l]) => `<button class="chip ${A.qFilter === k ? 'on' : ''}" data-a="qFilter" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="muted small">Jawapan boleh dibaca semua pelajar. Pelajar yang bertanya akan dapat notifikasi bila soalannya dijawab.</p>
    <div class="qa">${!A.qs ? '<p class="muted">Memuatkan...</p>'
      : A.qs.length ? A.qs.map(qRow).join('')
      : `<div class="card empty"><p class="muted">${A.qFilter === 'belum' ? 'Alhamdulillah, semua soalan sudah dijawab.' : 'Tiada soalan.'}</p></div>`}</div>`;
}

function annShareText(a) {
  return `*${a.title}*\n\n${a.classAt ? `Kelas Zoom: ${fmtClass(a.classAt)}\n\n` : ''}${a.body}\n\n${a.classAt ? 'Butang *Masuk Kelas* akan dibuka dalam app 30 minit sebelum kelas bermula.\n' : ''}Buka app Madrasah Online: ${location.origin}`;
}

function annRow(a) {
  const past = a.classAt && Date.now() > a.classAt + 3 * 3600e3;
  return `<div class="q">
    <b>${esc(a.title)}</b>
    <p class="muted small">${a.classAt ? 'Kelas Zoom · ' + fmtClass(a.classAt) : 'Pengumuman'} · dihebah ${fmtDate(a.createdAt)}</p>
    ${a.classAt ? `<div>${past ? '<span class="pill bad">Sudah lepas</span>' : a.membersOnly ? '<span class="pill ok">Pelanggan sahaja</span>' : '<span class="pill warn">Terbuka untuk semua</span>'}</div>` : ''}
    <p class="ann small">${esc(a.body.length > 160 ? a.body.slice(0, 160) + '…' : a.body)}</p>
    <div class="btn-row">
      <button class="btn btn-ghost" data-a="annEdit" data-v="${a.id}">Edit</button>
      <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(annShareText(a))}" target="_blank" rel="noopener">Kongsi WhatsApp</a>
    </div>
    <button class="link" data-a="annDelete" data-v="${a.id}" style="color:var(--danger);align-self:flex-start">Padam</button>
  </div>`;
}

function tHebahan() {
  const f = A.annForm, editing = !!f.id;
  return `<form id="fAnn" class="card" novalidate>
      <span class="eyebrow">${editing ? 'Edit hebahan' : 'Hebahan baharu'}</span>
      <div class="kind-row" role="radiogroup" aria-label="Jenis hebahan">
        <button type="button" class="opt ${f.isClass ? 'on' : ''}" role="radio" aria-checked="${f.isClass}" data-a="annKind" data-v="kelas"><b>Kelas Zoom</b><span>Ada tarikh & butang Masuk Kelas</span></button>
        <button type="button" class="opt ${f.isClass ? '' : 'on'}" role="radio" aria-checked="${!f.isClass}" data-a="annKind" data-v="biasa"><b>Pengumuman</b><span>Makluman biasa</span></button>
      </div>
      <label class="f" for="hTitle">Tajuk<input class="input" id="hTitle" maxlength="120" value="${esc(f.title)}" placeholder="${f.isClass ? 'Contoh: Kelas Tajwid November' : 'Contoh: Video baharu sudah dimuat naik'}"></label>
      ${f.isClass ? `
      <label class="f" for="hWhen">Tarikh & masa kelas<input class="input" id="hWhen" type="datetime-local" value="${toLocalInput(f.classAt)}"></label>
      <label class="f" for="hZoom">Pautan Zoom<input class="input" id="hZoom" type="url" inputmode="url" value="${esc(f.zoomUrl)}" placeholder="https://us06web.zoom.us/j/..."></label>
      <label class="check" for="hMembers"><input type="checkbox" id="hMembers" ${f.membersOnly ? 'checked' : ''}><span>Pautan Zoom untuk pelajar yang melanggan sahaja<br><span class="muted small" style="font-weight:400">Buang tanda jika kelas ini terbuka untuk semua yang berdaftar.</span></span></label>` : ''}
      <label class="f" for="hBody">Mesej<textarea class="input" id="hBody" maxlength="2000" rows="5" placeholder="${f.isClass ? 'Contoh: Sediakan al-Quran dan masuk 5 minit awal. Kita sambung bab Mad Asli.' : 'Tulis makluman untuk pelajar...'}">${esc(f.body)}</textarea></label>
      ${f.isClass ? '<p class="muted small">Pautan Zoom tak dipaparkan awal. Pelajar nampak butang <b>Masuk Kelas</b> 30 minit sebelum kelas bermula. Peringatan telefon dihantar automatik sehari dan 30 minit sebelum kelas.</p>' : ''}
      ${editing ? '' : `<label class="check" for="hNotify"><input type="checkbox" id="hNotify" ${f.notify ? 'checked' : ''}><span>Hantar notifikasi ke telefon pelajar sekarang</span></label>`}
      ${A.err && A.modal === null ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${editing ? 'Simpan perubahan' : 'Terbitkan hebahan'}</button>
      ${editing ? '<button class="btn btn-ghost" type="button" data-a="annCancel">Batal edit</button>' : ''}
    </form>
    <div class="card">
      <div class="top"><span class="eyebrow">Semua hebahan${A.anns ? ' · ' + A.anns.length : ''}</span><button class="iconbtn" data-a="annRefresh">Muat semula</button></div>
      <p class="muted small">Tekan <b>Kongsi WhatsApp</b> untuk hantar hebahan ke group kelas.</p>
      <div class="qa">${!A.anns ? '<p class="muted">Memuatkan...</p>' : A.anns.length ? A.anns.map(annRow).join('') : '<p class="muted">Belum ada hebahan.</p>'}</div>
    </div>`;
}

function tTetapan() {
  const o = A.org;
  return `<form id="fOrg" class="card" novalidate>
      <span class="eyebrow">Maklumat pengendali</span>
      <p class="muted small">Dipaparkan dalam halaman Terma, Privasi & Bayaran Balik, skrin Lupa PIN dan menu Akaun pelajar. Payment gateway biasanya semak maklumat ini.</p>
      ${!o ? '<p class="muted">Memuatkan...</p>' : `
      <label class="f" for="oName">Nama syarikat / pertubuhan<input class="input" id="oName" maxlength="120" value="${esc(o.name)}" placeholder="Nama seperti dalam SSM / ROS"></label>
      <label class="f" for="oReg">No. pendaftaran (SSM / ROS)<input class="input" id="oReg" maxlength="60" value="${esc(o.reg)}" placeholder="Contoh: 202401012345 (1234567-X)"></label>
      <label class="f" for="oEmail">Emel hubungan<input class="input" id="oEmail" type="email" inputmode="email" value="${esc(o.email)}"></label>
      <label class="f" for="oWa">No. WhatsApp admin<input class="input" id="oWa" inputmode="tel" value="${o.whatsapp ? '0' + esc(o.whatsapp.slice(2)) : ''}" placeholder="Contoh: 012-345 6789"></label>
      <label class="f" for="oAddr">Alamat perniagaan<textarea class="input" id="oAddr" maxlength="300" rows="3">${esc(o.address)}</textarea></label>
      <button class="btn btn-primary" type="submit">Simpan maklumat</button>
      <div class="legal-links"><a href="/terma" target="_blank" rel="noopener">Lihat Terma</a><a href="/privasi" target="_blank" rel="noopener">Lihat Privasi</a><a href="/bayaran-balik" target="_blank" rel="noopener">Lihat Bayaran Balik</a></div>`}
    </form>
    <div class="card">
      <span class="eyebrow">Akaun admin</span>
      <p><b>${esc(A.admin.name)}</b><br><span class="muted small">${esc(A.admin.email)}</span></p>
      <button class="btn btn-ghost" data-a="modal" data-v="password">Tukar kata laluan</button>
    </div>
    <div class="card">
      <span class="eyebrow">Tambah admin / ustaz</span>
      <form id="fNewAdmin" novalidate style="display:flex;flex-direction:column;gap:.7rem">
        <label class="f" for="nName">Nama<input class="input" id="nName"></label>
        <label class="f" for="nEmail">Emel<input class="input" id="nEmail" type="email" inputmode="email"></label>
        <label class="f" for="nPass">Kata laluan sementara (min. 10 aksara)<input class="input" id="nPass" type="text" autocomplete="off"></label>
        <button class="btn btn-primary" type="submit">Tambah admin</button>
      </form>
    </div>
    ${installCard()}`;
}

function modal() {
  if (!A.modal) return '';
  let inner = '';
  if (A.modal === 'user') {
    const u = A.sel;
    inner = `<h2 style="font-size:1.25rem">${esc(u.name)}</h2>
      <div class="rows">
        <div class="row"><span class="muted">Telefon</span><b>${esc(u.phone)}</b></div>
        <div class="row"><span class="muted">Emel</span><b style="overflow-wrap:anywhere">${esc(u.email || '-')}</b></div>
        <div class="row"><span class="muted">Langganan</span><b>${u.active ? 'Aktif hingga ' + fmtDate(u.paidUntil) : u.paidUntil ? 'Tamat ' + fmtDate(u.paidUntil) : 'Belum bayar'}</b></div>
        <div class="row"><span class="muted">Daftar</span><b>${fmtDate(u.createdAt)}</b></div>
      </div>
      <span class="eyebrow">Langganan manual</span>
      <p class="muted small">Untuk pelajar ditaja atau bayaran di luar app.</p>
      <div class="filter-row">
        <button class="chip" data-a="sub" data-v="1">+1 bulan</button>
        <button class="chip" data-a="sub" data-v="3">+3 bulan</button>
        <button class="chip" data-a="sub" data-v="12">+12 bulan</button>
        ${u.active ? '<button class="chip" data-a="sub" data-v="tamat" style="color:var(--danger)">Tamatkan</button>' : ''}
      </div>
      <a class="btn btn-ghost" href="https://wa.me/${toWa(u.phone)}" target="_blank" rel="noopener">WhatsApp pelajar</a>
      ${A.newPin ? `<div class="ok-box">PIN sementara: <span style="font-size:1.3rem;letter-spacing:.2em">${A.newPin}</span></div>
        <a class="btn btn-primary" href="https://wa.me/${toWa(u.phone)}?text=${encodeURIComponent(`Assalamualaikum ${u.name}. PIN sementara Madrasah Online anda: ${A.newPin}. Sila log masuk dan tukar PIN di menu Akaun.`)}" target="_blank" rel="noopener">Hantar PIN melalui WhatsApp</a>`
      : `<button class="btn btn-line" data-a="resetPin">Set semula PIN (lupa PIN)</button>`}
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-ghost" data-a="close">Tutup</button>`;
  }
  if (A.modal === 'import') {
    const b = A.imp, now = new Date(), month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    inner = `<form id="fImport" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">Import video</h2>
      <label class="f" for="iTitle">Tajuk dalam app<input class="input" id="iTitle" maxlength="120" value="${esc(b.title.replace(/\.[a-z0-9]{2,4}$/i, ''))}"></label>
      <label class="f" for="iTopic">Topik<select class="input" id="iTopic">${A.vmeta.topics.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="f" for="iArabic">Label Arab <span class="muted small">(pilihan)</span><input class="input" id="iArabic" dir="rtl" maxlength="40" style="font-family:var(--f-ar);font-size:1.2rem"></label>
      <label class="f" for="iMonth">Bulan kelas<input class="input" id="iMonth" type="month" value="${month}"></label>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Import ke app</button>
      <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
    </form>`;
  }
  if (A.modal === 'vdelete') inner = `<h2 style="font-size:1.25rem">Padam video?</h2>
      <p><b>${esc(A.delVideo.title)}</b> akan dipadam dari app dan dari Bunny. Tindakan ini tidak boleh dibatalkan.</p>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" data-a="vDeleteGo" style="background:var(--danger)">Ya, padam</button>
      <button class="btn btn-ghost" data-a="close">Batal</button>`;
  if (A.modal === 'adelete') inner = `<h2 style="font-size:1.25rem">Padam hebahan?</h2>
      <p><b>${esc(A.delAnn.title)}</b> akan dipadam dan tidak lagi dipaparkan kepada pelajar.</p>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" data-a="annDeleteGo" style="background:var(--danger)">Ya, padam</button>
      <button class="btn btn-ghost" data-a="close">Batal</button>`;
  if (A.modal === 'password') inner = `<form id="fPass" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">Tukar kata laluan</h2>
      <label class="f" for="cOld">Kata laluan sekarang<input class="input" id="cOld" type="password" autocomplete="current-password"></label>
      <label class="f" for="cNew">Kata laluan baharu (min. 10 aksara)<input class="input" id="cNew" type="password" autocomplete="new-password"></label>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Simpan</button>
      <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
    </form>`;
  return `<div class="modal-back" data-a="backdrop"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function render() {
  let body;
  if (A.view === 'loading') body = '<div class="loading">Memuatkan...</div>';
  else if (A.view === 'setup') body = vSetup();
  else if (A.view === 'login') body = vLogin();
  else {
    const tabs = [['ringkasan', 'Ringkasan'], ['pelajar', 'Pelajar'], ['video', 'Video'], ['hebahan', 'Hebahan'], ['soalan', `Soalan${A.unanswered ? ' (' + A.unanswered + ')' : ''}`], ['tetapan', 'Tetapan']];
    body = `<div class="top"><div style="display:flex;align-items:center;gap:.7rem;min-width:0"><img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608"><h1>Panel Admin</h1></div>
        <div class="btn-row" style="flex:none">${themeBtn()}<button class="iconbtn" data-a="logout">Keluar</button></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="chip ${A.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>
      ${{ ringkasan: tRingkasan, pelajar: tPelajar, video: tVideo, hebahan: tHebahan, soalan: tSoalan, tetapan: tTetapan }[A.tab]()}`;
  }
  app.innerHTML = `<div class="shell admin">${body}</div>${modal()}`;
  restoreInputs();
}
window.render = render;

async function loadStats() {
  const r = await api('GET', '/api/admin/stats');
  if (r.status === 401) return toLogin();
  if (r.ok) { A.stats = r.stats; A.unanswered = r.stats.unansweredQuestions; } else toast(r.error);
  render();
}
async function loadUsers() {
  A.users = null; render();
  const r = await api('GET', `/api/admin/users?q=${encodeURIComponent(A.q)}&status=${A.filter}`);
  if (r.status === 401) return toLogin();
  A.users = r.ok ? r.users : [];
  if (!r.ok) toast(r.error);
  render();
}
async function loadAnns() {
  const r = await api('GET', '/api/admin/announcements');
  if (r.status === 401) return toLogin();
  A.anns = r.ok ? r.announcements : [];
  if (!r.ok) toast(r.error);
  render();
}
async function loadQs() {
  const r = await api('GET', `/api/admin/questions?status=${A.qFilter}`);
  if (r.status === 401) return toLogin();
  if (r.ok) { A.qs = r.questions; A.unanswered = r.unanswered; } else { A.qs = []; toast(r.error); }
  render();
}
async function loadOrg() {
  const r = await api('GET', '/api/admin/settings');
  if (r.status === 401) return toLogin();
  if (r.ok) { A.org = r.org; forget('oName', 'oReg', 'oEmail', 'oWa', 'oAddr'); } else toast(r.error);
  render();
}
// Simpan isian borang hebahan ke A.annForm sebelum lukis semula (contoh bila tukar jenis)
function readAnnForm() {
  const f = A.annForm, el = id => document.getElementById(id);
  if (el('hTitle')) f.title = el('hTitle').value;
  if (el('hBody')) f.body = el('hBody').value;
  if (el('hWhen')) f.classAt = el('hWhen').value ? new Date(el('hWhen').value).getTime() : null;
  if (el('hZoom')) f.zoomUrl = el('hZoom').value;
  if (el('hMembers')) f.membersOnly = el('hMembers').checked;
  if (el('hNotify')) f.notify = el('hNotify').checked;
}
const ANN_IDS = ['hTitle', 'hBody', 'hWhen', 'hZoom'];
// Borang hebahan sentiasa disalin ke A.annForm supaya isian tak hilang bila skrin dilukis semula
['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('#fAnn')) readAnnForm(); }));
function toLogin() { A.admin = null; A.view = 'login'; A.modal = null; render(); }
function openTab(t) {
  A.tab = t; A.err = ''; window.scrollTo(0, 0); render();
  if (t === 'ringkasan') loadStats();
  if (t === 'pelajar') loadUsers();
  if (t === 'video') loadVideos();
  if (t === 'hebahan') loadAnns();
  if (t === 'tetapan') loadOrg();
  if (t === 'soalan') { A.qs = null; A.editQ = null; loadQs(); }
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, v = el.dataset.v;
  if (a === 'backdrop' && e.target !== el) return;
  switch (a) {
    case 'theme': toggleTheme(); render(); return;
    case 'install': doInstall(); return;
    case 'tab': openTab(v); return;
    case 'refresh': A.stats = null; render(); loadStats(); return;
    case 'filter': A.filter = v; loadUsers(); return;
    case 'filterGo': A.filter = v; A.q = ''; openTab('pelajar'); return;
    case 'user': A.sel = A.users.find(u => String(u.id) === v); A.newPin = null; A.err = ''; A.modal = 'user'; break;
    case 'modal': A.modal = v; A.err = ''; break;
    case 'close': case 'backdrop': A.modal = null; A.err = ''; A.newPin = null; break;
    case 'resetPin': {
      const pin = randomPin();
      const r = await busy(el, () => api('POST', `/api/admin/users/${A.sel.id}/pin`, { pin }));
      if (r.status === 401) return toLogin();
      if (r.ok) { A.newPin = pin; A.err = ''; } else A.err = r.error;
      break;
    }
    case 'sub': {
      const body = v === 'tamat' ? { action: 'tamat' } : { months: Number(v) };
      const r = await busy(el, () => api('POST', `/api/admin/users/${A.sel.id}/subscription`, body));
      if (r.status === 401) return toLogin();
      if (!r.ok) { A.err = r.error; break; }
      Object.assign(A.sel, { paidUntil: r.paidUntil, active: r.active });
      toast(r.active ? 'Langganan aktif hingga ' + fmtDate(r.paidUntil) : 'Langganan ditamatkan.');
      loadUsers();
      break;
    }
    case 'vRefresh': A.videos = null; A.vmeta = null; render(); loadVideos(); return;
    case 'bunnyCheck': {
      A.bunnyItems = 'loading'; render();
      const r = await api('GET', '/api/admin/bunny-videos');
      if (r.status === 401) return toLogin();
      A.bunnyItems = r.ok ? r.items : null;
      if (!r.ok) toast(r.error);
      break;
    }
    case 'impOpen': A.imp = A.bunnyItems.find(b => b.guid === v); A.err = ''; A.modal = 'import'; break;
    case 'vPublish': {
      const vid = A.videos.find(x => String(x.id) === v);
      const r = await busy(el, () => api('POST', `/api/admin/videos/${v}`, { published: !vid.published }));
      if (!r.ok) { toast(r.error); return; }
      Object.assign(vid, r.video); toast(r.video.published ? 'Video diterbitkan. Pelajar boleh tonton.' : 'Video disembunyikan.');
      break;
    }
    case 'vDelete': A.delVideo = A.videos.find(x => String(x.id) === v); A.modal = 'vdelete'; A.err = ''; break;
    case 'vDeleteGo': {
      const r = await busy(el, () => api('POST', `/api/admin/videos/${A.delVideo.id}/delete`, {}));
      if (!r.ok) { A.err = r.error; break; }
      A.videos = A.videos.filter(x => x.id !== A.delVideo.id); A.modal = null; toast('Video dipadam.');
      break;
    }
    case 'qFilter': A.qFilter = v; A.qs = null; A.editQ = null; render(); loadQs(); return;
    case 'qEdit': A.editQ = Number(v); forget('ans-' + v); break;
    case 'qEditCancel': A.editQ = null; break;
    case 'qHide': {
      const q = A.qs.find(x => String(x.id) === v);
      const r = await busy(el, () => api('POST', `/api/admin/questions/${v}/hide`, { hidden: !q.hidden }));
      if (r.status === 401) return toLogin();
      if (!r.ok) { toast(r.error); return; }
      A.qs = A.qs.filter(x => x !== q);
      if (!q.answer) A.unanswered = Math.max(0, A.unanswered + (q.hidden ? 1 : -1));
      toast(q.hidden ? 'Soalan dipapar semula.' : 'Soalan disembunyikan daripada pelajar.');
      break;
    }
    case 'annKind': readAnnForm(); A.annForm.isClass = v === 'kelas'; forget(...ANN_IDS); A.err = ''; break;
    case 'annRefresh': A.anns = null; render(); loadAnns(); return;
    case 'annEdit': {
      const a = A.anns.find(x => String(x.id) === v);
      A.annForm = { id: a.id, isClass: !!a.classAt, title: a.title, body: a.body, classAt: a.classAt, zoomUrl: a.zoomUrl, membersOnly: a.classAt ? a.membersOnly : true };
      forget(...ANN_IDS); A.err = ''; window.scrollTo(0, 0);
      break;
    }
    case 'annCancel': A.annForm = blankAnn(); forget(...ANN_IDS); A.err = ''; break;
    case 'annDelete': A.delAnn = A.anns.find(x => String(x.id) === v); A.modal = 'adelete'; A.err = ''; break;
    case 'annDeleteGo': {
      const r = await busy(el, () => api('POST', `/api/admin/announcements/${A.delAnn.id}/delete`, {}));
      if (r.status === 401) return toLogin();
      if (!r.ok) { A.err = r.error; break; }
      A.anns = A.anns.filter(x => x.id !== A.delAnn.id);
      if (A.annForm.id === A.delAnn.id) A.annForm = blankAnn();
      A.modal = null; toast('Hebahan dipadam.');
      break;
    }
    case 'logout': await api('POST', '/api/admin/logout', {}); toast('Anda telah log keluar.'); return toLogin();
    default: return;
  }
  render();
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type="submit"]');
  if (f.id === 'fSetup') {
    const r = await busy(btn, async () => {
      const res = await fetch('/api/admin/admins', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-setup-key': val('sKey') },
        body: JSON.stringify({ name: val('sName'), email: val('sEmail'), password: document.getElementById('sPass').value }),
      });
      const d = await res.json().catch(() => ({}));
      return { ok: res.ok, error: d.error || 'Ralat sistem.' };
    });
    if (!r.ok) { A.err = r.error; render(); return; }
    A.err = ''; A.view = 'login';
    toast('Akaun admin dicipta. Sila log masuk.');
  }
  if (f.id === 'fLogin') {
    const r = await busy(btn, () => api('POST', '/api/admin/login', { email: val('aEmail'), password: document.getElementById('aPass').value }));
    if (!r.ok) { A.err = r.error; render(); return; }
    A.admin = r.admin; A.view = 'app'; A.err = '';
    openTab('ringkasan'); return;
  }
  if (f.id === 'fSearch') { A.q = val('q'); loadUsers(); return; }
  if (f.id === 'fUpload') { await startUpload(btn); return; }
  if (f.id === 'fImport') {
    const r = await busy(btn, () => api('POST', '/api/admin/videos/import', { guid: A.imp.guid, title: val('iTitle'), topic: val('iTopic'), arabicLabel: val('iArabic'), classMonth: val('iMonth') }));
    if (!r.ok) { A.err = r.error; render(); return; }
    forget('iTitle', 'iArabic');
    A.bunnyItems = A.bunnyItems.filter(b => b.guid !== A.imp.guid); A.modal = null; A.err = '';
    A.videos.unshift(r.video);
    toast(r.video.ready ? 'Video diimport. Tekan Terbitkan bila sedia.' : 'Video diimport. Bunny masih memproses, terbitkan bila status Sedia.');
  }
  if (f.id === 'fPass') {
    const r = await busy(btn, () => api('POST', '/api/admin/password', { oldPassword: document.getElementById('cOld').value, newPassword: document.getElementById('cNew').value }));
    if (!r.ok) { A.err = r.error; render(); return; }
    A.modal = null; A.err = ''; toast('Kata laluan ditukar.');
  }
  if (f.classList.contains('fAnswer')) {
    const id = f.dataset.v;
    const r = await busy(btn, () => api('POST', `/api/admin/questions/${id}/answer`, { answer: document.getElementById('ans-' + id).value }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { toast(r.error); return; }
    forget('ans-' + id);
    const wasNew = !A.qs.find(x => String(x.id) === id).answer;
    if (wasNew && A.qFilter === 'belum') { A.qs = A.qs.filter(x => String(x.id) !== id); A.unanswered = Math.max(0, A.unanswered - 1); }
    else A.qs = A.qs.map(x => String(x.id) === id ? r.question : x);
    A.editQ = null;
    toast(wasNew ? 'Jawapan dihantar. Pelajar akan dimaklumkan.' : 'Jawapan dikemas kini.');
  }
  if (f.id === 'fAnn') {
    readAnnForm();
    const F = A.annForm;
    const body = { title: F.title, body: F.body, isClass: F.isClass, classAt: F.classAt, zoomUrl: F.zoomUrl, membersOnly: F.membersOnly, notify: F.notify };
    if (F.isClass && F.classAt && F.classAt < Date.now() - 3 * 3600e3 && !F.id) { A.err = 'Tarikh kelas sudah lepas. Sila semak tarikh dan masa.'; render(); return; }
    const r = await busy(btn, () => api('POST', F.id ? `/api/admin/announcements/${F.id}` : '/api/admin/announcements', body));
    if (r.status === 401) return toLogin();
    if (!r.ok) { A.err = r.error; render(); return; }
    A.err = '';
    if (F.id) A.anns = A.anns.map(x => x.id === F.id ? r.announcement : x);
    else A.anns = [r.announcement, ...(A.anns || [])];
    A.annForm = blankAnn(); forget(...ANN_IDS);
    toast(F.id ? 'Hebahan dikemas kini.' : `Hebahan diterbitkan.${r.notified ? ` Notifikasi dihantar kepada ${r.notified} pelajar.` : ''}`);
  }
  if (f.id === 'fOrg') {
    const r = await busy(btn, () => api('POST', '/api/admin/settings', { name: val('oName'), reg: val('oReg'), email: val('oEmail'), whatsapp: val('oWa'), address: document.getElementById('oAddr').value }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { toast(r.error); return; }
    A.org = r.org; forget('oName', 'oReg', 'oEmail', 'oWa', 'oAddr');
    toast('Maklumat disimpan.');
  }
  if (f.id === 'fNewAdmin') {
    const r = await busy(btn, () => api('POST', '/api/admin/admins', { name: val('nName'), email: val('nEmail'), password: val('nPass') }));
    if (!r.ok) { toast(r.error); return; }
    forget('nName', 'nEmail', 'nPass'); f.reset(); toast('Admin baharu ditambah. Kongsi emel dan kata laluan sementara secara peribadi.');
    return;
  }
  render();
});

(async function start() {
  const me = await api('GET', '/api/admin/me');
  if (me.ok) { A.admin = me.admin; A.view = 'app'; openTab('ringkasan'); return; }
  const st = await api('GET', '/api/admin/setup-status');
  A.view = st.ok && st.needsSetup ? 'setup' : 'login';
  render();
})();
