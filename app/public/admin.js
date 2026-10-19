// Panel admin Madrasah Online.
const A = { view: 'loading', tab: 'ringkasan', admin: null, err: '', stats: null, users: null, q: '', filter: 'semua', modal: null, sel: null, newPin: null };
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
      </div>
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

function tTetapan() {
  return `<div class="card">
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
      <a class="btn btn-ghost" href="https://wa.me/${toWa(u.phone)}" target="_blank" rel="noopener">WhatsApp pelajar</a>
      ${A.newPin ? `<div class="ok-box">PIN sementara: <span style="font-size:1.3rem;letter-spacing:.2em">${A.newPin}</span></div>
        <a class="btn btn-primary" href="https://wa.me/${toWa(u.phone)}?text=${encodeURIComponent(`Assalamualaikum ${u.name}. PIN sementara Madrasah Online anda: ${A.newPin}. Sila log masuk dan tukar PIN di menu Akaun.`)}" target="_blank" rel="noopener">Hantar PIN melalui WhatsApp</a>`
      : `<button class="btn btn-line" data-a="resetPin">Set semula PIN (lupa PIN)</button>`}
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-ghost" data-a="close">Tutup</button>`;
  }
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
    const tabs = [['ringkasan', 'Ringkasan'], ['pelajar', 'Pelajar'], ['tetapan', 'Tetapan']];
    body = `<div class="top"><div style="display:flex;align-items:center;gap:.7rem;min-width:0"><img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608"><h1>Panel Admin</h1></div>
        <div class="btn-row" style="flex:none">${themeBtn()}<button class="iconbtn" data-a="logout">Keluar</button></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="chip ${A.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>
      ${{ ringkasan: tRingkasan, pelajar: tPelajar, tetapan: tTetapan }[A.tab]()}`;
  }
  app.innerHTML = `<div class="shell admin">${body}</div>${modal()}`;
  restoreInputs();
}
window.render = render;

async function loadStats() {
  const r = await api('GET', '/api/admin/stats');
  if (r.status === 401) return toLogin();
  if (r.ok) A.stats = r.stats; else toast(r.error);
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
function toLogin() { A.admin = null; A.view = 'login'; A.modal = null; render(); }
function openTab(t) {
  A.tab = t; window.scrollTo(0, 0); render();
  if (t === 'ringkasan') loadStats();
  if (t === 'pelajar') loadUsers();
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
  if (f.id === 'fPass') {
    const r = await busy(btn, () => api('POST', '/api/admin/password', { oldPassword: document.getElementById('cOld').value, newPassword: document.getElementById('cNew').value }));
    if (!r.ok) { A.err = r.error; render(); return; }
    A.modal = null; A.err = ''; toast('Kata laluan ditukar.');
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
