// App pelajar Madrasah Online.
const CONFIG = {
  // No. WhatsApp admin untuk bantuan lupa PIN, format 60123456789. Kosongkan jika belum ada.
  adminWhatsApp: '',
};

const S = { view: 'loading', tab: 'utama', user: null, err: '', modal: null };
const app = document.getElementById('app');

// ---------- skrin luar (belum log masuk) ----------
function vLogin() {
  return `<div class="toolbar">${themeBtn()}</div>
  <div class="login">
    <div class="brand">
      <div class="plate"><img class="logo logo-lg" src="/logo.png" alt="Madrasah Online" width="640" height="608"></div>
      <p class="muted">Kelas mengaji untuk dewasa</p>
      ${orn()}
    </div>
    <form id="fLogin" class="card" novalidate>
      <label class="f" for="lPhone">No. telefon
        <input class="input" id="lPhone" inputmode="tel" autocomplete="tel" placeholder="Contoh: 012-345 6789">
      </label>
      <label class="f" for="lPin">PIN 6 angka
        <input class="input pin-input" id="lPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">
      </label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Masuk</button>
      <button class="link" type="button" data-a="go" data-v="lupa">Lupa PIN?</button>
    </form>
    <button class="btn btn-line" data-a="go" data-v="daftar">Daftar akaun baharu</button>
    ${installCard()}
  </div>`;
}

function vDaftar() {
  return `<div class="top"><button class="iconbtn" data-a="go" data-v="login">${I.back} Kembali</button>${themeBtn()}</div>
  <div class="card">
    <h1 style="font-size:1.6rem">Daftar akaun</h1>
    <p class="muted small">Isi maklumat di bawah. Lepas daftar, anda boleh terus pilih pelan langganan.</p>
  </div>
  <form id="fDaftar" class="card" novalidate>
    <label class="f" for="dName">Nama penuh
      <input class="input" id="dName" autocomplete="name" maxlength="80">
    </label>
    <label class="f" for="dPhone">No. telefon (WhatsApp)
      <input class="input" id="dPhone" inputmode="tel" autocomplete="tel" placeholder="Contoh: 012-345 6789">
    </label>
    <label class="f" for="dEmail">Emel <span class="muted small">(pilihan, untuk resit)</span>
      <input class="input" id="dEmail" type="email" inputmode="email" autocomplete="email">
    </label>
    <label class="f" for="dPin">Cipta PIN 6 angka
      <input class="input pin-input" id="dPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </label>
    <label class="f" for="dPin2">Masukkan PIN sekali lagi
      <input class="input pin-input" id="dPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </label>
    <p class="muted small">Ingat PIN ini. Ia digunakan setiap kali log masuk. Elakkan PIN mudah seperti 123456.</p>
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
    <button class="btn btn-primary" type="submit">Daftar</button>
  </form>`;
}

function vLupa() {
  const wa = CONFIG.adminWhatsApp;
  return `<div class="top"><button class="iconbtn" data-a="go" data-v="login">${I.back} Kembali</button>${themeBtn()}</div>
  <div class="card">
    <h1 style="font-size:1.6rem">Lupa PIN</h1>
    <p>Jangan risau. Admin boleh set semula PIN anda.</p>
    <ol style="margin:0;padding-left:1.3rem;display:flex;flex-direction:column;gap:.4rem">
      <li>Hantar mesej WhatsApp kepada admin dengan <b>nama penuh</b> dan <b>no. telefon</b> yang anda daftar.</li>
      <li>Admin akan beri PIN sementara.</li>
      <li>Log masuk dengan PIN sementara, kemudian tukar PIN di menu <b>Akaun</b>.</li>
    </ol>
    ${wa ? `<a class="btn btn-primary" href="https://wa.me/${wa}?text=${encodeURIComponent('Assalamualaikum admin, saya lupa PIN Madrasah Online. Nama: ... No. telefon: ...')}" target="_blank" rel="noopener">WhatsApp admin</a>
      <p class="note">No. admin: +${wa}</p>` : '<p class="muted small">Hubungi admin melalui group WhatsApp kelas.</p>'}
  </div>`;
}

// ---------- dalam app ----------
function statusCard() {
  const u = S.user;
  if (u.active) {
    const days = Math.max(0, Math.ceil((u.paidUntil - Date.now()) / 864e5));
    return `<div class="status ok">
      <span class="eyebrow">Langganan</span>
      <div class="top"><span class="big">Aktif</span><span class="pill ok">${days} hari lagi</span></div>
      <p>Tamat pada <b>${fmtDate(u.paidUntil)}</b>. Semua video kelas boleh ditonton.</p>
    </div>`;
  }
  return `<div class="status bad">
    <span class="eyebrow">Langganan</span>
    <span class="big">${u.paidUntil ? 'Langganan anda dah tamat' : 'Langganan belum aktif'}</span>
    <p>${u.paidUntil ? `Tamat pada ${fmtDate(u.paidUntil)}. ` : ''}Langgan RM10 sebulan untuk tonton semua video kelas.</p>
    <button class="btn btn-primary" data-a="subscribe">Langgan sekarang</button>
  </div>`;
}

function tUtama() {
  return `<div class="toolbar">
      <img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608">
      <button class="iconbtn" data-a="big" aria-label="${Prefs.get('big', '0') === '1' ? 'Kecilkan tulisan' : 'Besarkan tulisan'}">${Prefs.get('big', '0') === '1' ? 'A−' : 'A+'}</button>
      ${themeBtn()}
    </div>
    <div class="hero">
      ${pattern('patHero')}
      <p class="bism">بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
      <p class="muted">Assalamualaikum,</p>
      <h1>${esc(S.user.name)}</h1>
      ${orn()}
    </div>
    ${statusCard()}
    <div class="card">
      <span class="eyebrow">Kelas Zoom bulanan</span>
      <p>Jadual kelas dan butang <b>Masuk Kelas</b> akan dipaparkan di sini bila admin umumkan kelas seterusnya.</p>
    </div>
    ${installCard()}`;
}

function tVideo() {
  return `<div class="top"><h1>Video Kelas</h1></div>
    ${S.user.active ? '' : `<div class="card lock">${I.lock}<h2 style="font-size:1.2rem">Video dikunci</h2><p class="muted">Langgan RM10 sebulan untuk tonton semua rakaman kelas.</p><button class="btn btn-primary" data-a="subscribe">Langgan sekarang</button></div>`}
    <div class="card empty">${I.video}<h2 style="font-size:1.15rem">Rakaman kelas akan dimuat naik</h2><p class="muted">Admin sedang menyediakan video kelas lepas. Video baharu akan muncul di sini.</p></div>`;
}

function tKomuniti() {
  return `<div class="top"><h1>Komuniti</h1></div>
    <div class="card empty">${I.users}<h2 style="font-size:1.15rem">Belum ada pengumuman</h2><p class="muted">Pengumuman kelas dan soal jawab dengan ustaz akan dipaparkan di sini.</p></div>`;
}

function tAkaun() {
  const u = S.user;
  return `<div class="top"><h1>Akaun Saya</h1></div>
    <div class="card">
      <div class="top"><div style="min-width:0"><b style="font-size:1.1rem">${esc(u.name)}</b><p class="muted small">${esc(u.phone)}${u.email ? ' · ' + esc(u.email) : ''}</p></div>
      <span class="pill ${u.active ? 'ok' : 'bad'}">${u.active ? 'Aktif' : 'Tidak aktif'}</span></div>
    </div>
    <div class="card">
      <span class="eyebrow">Langganan</span>
      <p>${u.active ? `Aktif hingga <b>${fmtDate(u.paidUntil)}</b>` : u.paidUntil ? `Tamat pada <b>${fmtDate(u.paidUntil)}</b>` : 'Belum melanggan'}</p>
      ${u.active ? '' : '<button class="btn btn-primary" data-a="subscribe">Langgan sekarang</button>'}
    </div>
    <div class="card">
      <span class="eyebrow">Saiz tulisan</span>
      <div class="btn-row">
        <button class="btn ${Prefs.get('big', '0') === '1' ? 'btn-ghost' : 'btn-primary'}" data-a="bigSet" data-v="0">Biasa</button>
        <button class="btn ${Prefs.get('big', '0') === '1' ? 'btn-primary' : 'btn-ghost'}" data-a="bigSet" data-v="1" style="font-size:1.2rem">Besar</button>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">Tema</span>
      <div class="btn-row">
        <button class="btn ${isDark() ? 'btn-ghost' : 'btn-primary'}" data-a="themeSet" data-v="light">${I.sun} Cerah</button>
        <button class="btn ${isDark() ? 'btn-primary' : 'btn-ghost'}" data-a="themeSet" data-v="dark">${I.moon} Gelap</button>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">Keselamatan</span>
      <button class="btn btn-ghost" data-a="modal" data-v="pin">Tukar PIN</button>
    </div>
    ${installCard()}
    <button class="btn btn-line" data-a="logout">Log keluar</button>
    <button class="link" data-a="modal" data-v="delete" style="align-self:center;color:var(--danger)">Padam akaun saya</button>`;
}

function nav() {
  const items = [['utama', 'Utama', I.home], ['video', 'Video', I.video], ['komuniti', 'Komuniti', I.users], ['akaun', 'Akaun', I.user]];
  return `<nav class="nav"><div class="nav-in">${items.map(([k, l, ic]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}" aria-label="${l}"${S.tab === k ? ' aria-current="page"' : ''}>${ic}<span>${l}</span></button>`).join('')}</div></nav>`;
}

function modal() {
  if (!S.modal) return '';
  let inner = '';
  if (S.modal === 'pin') inner = `<form id="fPin" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">Tukar PIN</h2>
      <label class="f" for="pOld">PIN sekarang<input class="input pin-input" id="pOld" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
      <label class="f" for="pNew">PIN baharu<input class="input pin-input" id="pNew" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <label class="f" for="pNew2">PIN baharu sekali lagi<input class="input pin-input" id="pNew2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Simpan PIN baharu</button>
      <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
    </form>`;
  if (S.modal === 'delete') inner = `<form id="fDelete" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">Padam akaun?</h2>
      <p>Akaun, progres tontonan dan soalan anda akan dipadam terus. Langganan yang masih berbaki <b>tidak boleh dipulangkan</b>.</p>
      <label class="f" for="xPin">Masukkan PIN untuk sahkan<input class="input pin-input" id="xPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit" style="background:var(--danger)">Padam akaun saya</button>
      <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
    </form>`;
  if (S.modal === 'subscribe') inner = `<h2 style="font-size:1.25rem">Langganan RM10 sebulan</h2>
      <p>Sistem bayaran sedang disiapkan. Admin akan maklumkan dalam group WhatsApp bila bayaran dibuka.</p>
      <button class="btn btn-primary" data-a="close">Faham</button>`;
  return `<div class="modal-back" data-a="backdrop"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function draw() {
  let body;
  if (S.view === 'loading') body = '<div class="loading">Memuatkan...</div>';
  else if (S.view === 'login') body = vLogin();
  else if (S.view === 'daftar') body = vDaftar();
  else if (S.view === 'lupa') body = vLupa();
  else body = { utama: tUtama, video: tVideo, komuniti: tKomuniti, akaun: tAkaun }[S.tab]();
  app.innerHTML = `<div class="shell">${body}</div>${S.view === 'app' ? nav() : ''}${modal()}`;
}
function render() { draw(); restoreInputs(); }
window.render = render;

// ---------- tindakan ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, v = el.dataset.v;
  if (a === 'backdrop' && e.target !== el) return; // klik dalam modal
  switch (a) {
    case 'go': S.view = v; S.err = ''; window.scrollTo(0, 0); break;
    case 'tab': S.tab = v; window.scrollTo(0, 0); break;
    case 'theme': toggleTheme(); break;
    case 'themeSet': Prefs.set('theme', v); applyPrefs(); break;
    case 'big': Prefs.set('big', Prefs.get('big', '0') === '1' ? '0' : '1'); applyPrefs(); break;
    case 'bigSet': Prefs.set('big', v); applyPrefs(); break;
    case 'install': doInstall(); return;
    case 'modal': S.modal = v; S.err = ''; break;
    case 'subscribe': S.modal = 'subscribe'; break;
    case 'close': case 'backdrop': S.modal = null; S.err = ''; break;
    case 'logout':
      await api('POST', '/api/logout', {});
      S.user = null; S.view = 'login'; S.tab = 'utama';
      toast('Anda telah log keluar.');
      break;
    default: return;
  }
  render();
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type="submit"]');
  if (f.id === 'fLogin') {
    const r = await busy(btn, () => api('POST', '/api/login', { phone: val('lPhone'), pin: val('lPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user = r.user; S.view = 'app'; S.tab = 'utama'; S.err = '';
    toast('Assalamualaikum, ' + r.user.name);
  }
  if (f.id === 'fDaftar') {
    if (val('dPin') !== val('dPin2')) { S.err = 'PIN tidak sama. Sila masukkan semula.'; render(); return; }
    const r = await busy(btn, () => api('POST', '/api/register', { name: val('dName'), phone: val('dPhone'), email: val('dEmail'), pin: val('dPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user = r.user; S.view = 'app'; S.tab = 'utama'; S.err = '';
    toast('Pendaftaran berjaya. Selamat datang!');
  }
  if (f.id === 'fPin') {
    if (val('pNew') !== val('pNew2')) { S.err = 'PIN baharu tidak sama.'; render(); return; }
    const r = await busy(btn, () => api('POST', '/api/me/pin', { oldPin: val('pOld'), newPin: val('pNew') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.modal = null; S.err = '';
    toast('PIN berjaya ditukar.');
  }
  if (f.id === 'fDelete') {
    const r = await busy(btn, () => api('POST', '/api/me/delete', { pin: val('xPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.modal = null; S.user = null; S.view = 'login'; S.err = '';
    toast('Akaun anda telah dipadam.');
  }
  render();
});


(async function start() {
  const r = await api('GET', '/api/me');
  if (r.ok) { S.user = r.user; S.view = 'app'; }
  else S.view = 'login';
  render();
})();
