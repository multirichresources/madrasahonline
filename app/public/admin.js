// Panel admin Madrasah Online (sentiasa dalam BM).
LANG = 'ms';
document.documentElement.lang = 'ms';
const A = { view: 'loading', tab: 'ringkasan', admin: null, err: '', stats: null, users: null, q: '', filter: 'semua', modal: null, sel: null, newPin: null, videos: null, vmeta: null, upload: null, delVideo: null, bunnyItems: null, imp: null, anns: null, annForm: null, delAnn: null, org: null, qs: null, qFilter: 'belum', unanswered: 0, editQ: null, plans: null, billingReady: false, insights: null, payments: null, don: null, taja: null };
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

// ---------- Ringkasan: command center ----------
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const compactRm = sen => { const v = sen / 100; return v >= 1000 ? 'RM' + (v / 1000).toLocaleString('en-MY', { maximumFractionDigits: 1 }) + 'K' : 'RM' + Math.round(v).toLocaleString('en-MY'); };
const monthShort = ym => MONTHS[Number(ym.slice(5, 7)) - 1];
const monthLong = ym => monthShort(ym) + ' ' + ym.slice(0, 4);
const dayMonth = ms => { const d = new Date(ms); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
// Skala paksi-Y yang kemas (0, 25, 50, 75, 100 …)
function niceMax(v) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
// Perubahan berbanding tempoh lepas (naik = baik untuk semua metrik di sini)
function delta(now, prev, label) {
  if (!prev && !now) return `<span class="kpi-d">Tiada perubahan ${label}</span>`;
  if (!prev) return `<span class="kpi-d up">▲ baharu ${label}</span>`;
  const d = Math.round((now - prev) / prev * 100);
  return `<span class="kpi-d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d)}% ${label}</span>`;
}
function kpi(label, value, sub, extra = '') {
  return `<div class="kpi"><span class="kpi-l">${label}</span><b class="kpi-v">${value}</b>${sub ? `<span class="kpi-s">${sub}</span>` : ''}${extra}</div>`;
}
// Carta lajur (HTML, bukan gambar): series = [{key, name}], rows = [{label, tip, values: {key: n}}]
function colChart({ title, sub, series, rows, fmt, tickFmt, labelEvery = 1 }) {
  const max = niceMax(Math.max(0, ...rows.flatMap(r => series.map(s => r.values[s.key] || 0))));
  const ticks = [0, .25, .5, .75, 1].map(f => f * max);
  const last = rows.length - 1;
  return `<figure class="card vz">
    <figcaption class="vz-head"><span class="eyebrow">${title}</span>${sub ? `<span class="muted small">${sub}</span>` : ''}
      ${series.length > 1 ? `<span class="vz-legend">${series.map((s, i) => `<span><i class="sw s${i + 1}"></i>${s.name}</span>`).join('')}</span>` : ''}</figcaption>
    <div class="vz-plot">
      <div class="vz-grid" aria-hidden="true">${ticks.map(v => `<div class="vz-tick" style="bottom:${v / max * 100}%"><span>${tickFmt(v)}</span></div>`).join('')}</div>
      <div class="vz-cols">${rows.map((r, i) => `<div class="vz-col">
        <div class="vz-bars">${series.map((s, k) => {
          const v = r.values[s.key] || 0;
          // Label nilai hanya pada lajur terkini, dan hanya untuk satu siri (elak label bertindih)
          return `<i class="vz-bar s${k + 1}${series.length > 1 ? ' duo' : ''}" style="height:${v / max * 100}%" tabindex="0" data-tip="${esc(r.tip)}${series.length > 1 ? ' · ' + esc(s.name) : ''}" data-val="${esc(fmt(v))}">${i === last && v > 0 && series.length === 1 ? `<em class="vz-val">${fmt(v)}</em>` : ''}</i>`;
        }).join('')}</div>
        <span class="vz-x">${(last - i) % labelEvery === 0 ? esc(r.label) : ''}</span></div>`).join('')}</div>
    </div>
    <table class="sr-only"><caption>${title}</caption><tr><th>Tempoh</th>${series.map(s => `<th>${s.name}</th>`).join('')}</tr>
      ${rows.map(r => `<tr><td>${esc(r.tip)}</td>${series.map(s => `<td>${fmt(r.values[s.key] || 0)}</td>`).join('')}</tr>`).join('')}</table>
  </figure>`;
}
// Bar status pelajar (bahagian daripada keseluruhan)
function statusBar(st, total) {
  const parts = [['aktif', 'Aktif (lebih 7 hari)', 'st-good'], ['hampirTamat', 'Tamat ≤ 7 hari', 'st-warn'], ['tamat', 'Tamat', 'st-bad'], ['belumBayar', 'Belum bayar', 'st-none']];
  return `<div class="card vz">
    <div class="vz-head"><span class="eyebrow">Status pelajar</span><span class="muted small">${total} berdaftar</span></div>
    <div class="vz-stack" role="img" aria-label="${parts.map(([k, l]) => `${l} ${st[k]}`).join(', ')}">${parts.filter(([k]) => st[k]).map(([k, l, c]) =>
      `<i class="${c}" style="flex:${st[k]}" tabindex="0" data-tip="${l}" data-val="${st[k]} pelajar · ${pct(st[k], total)}%"></i>`).join('') || '<i class="st-empty" style="flex:1"></i>'}</div>
    <div class="vz-keys">${parts.map(([k, l, c]) => {
      const go = { aktif: 'aktif', tamat: 'tamat', belumBayar: 'belum-bayar' }[k];
      const inner = `<i class="sw ${c}"></i><span>${l}</span><b>${st[k]}</b><span class="muted small">${pct(st[k], total)}%</span>`;
      return go ? `<button class="vz-key" data-a="filterGo" data-v="${go}" title="Lihat senarai">${inner}</button>` : `<div class="vz-key">${inner}</div>`;
    }).join('')}</div>
  </div>`;
}
// Meter: satu nisbah terhadap jumlah
function meter(label, n, of, note) {
  const p = pct(n, of);
  return `<div class="meter"><div class="meter-top"><span>${label}</span><b>${p}%</b></div>
    <div class="meter-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${label}"><i style="width:${p}%"></i></div>
    <span class="muted small">${note}</span></div>`;
}
function videoBars(videos) {
  const top = videos.slice(0, 8), max = Math.max(1, ...top.map(v => v.viewers));
  return `<div class="card vz">
    <div class="vz-head"><span class="eyebrow">Tontonan video</span>
      <span class="vz-legend"><span><i class="sw s1"></i>Habis tonton</span><span><i class="sw s1-soft"></i>Belum habis</span></span></div>
    ${top.length ? `<div class="hbars">${top.map(v => `<div class="hbar">
      <div class="hbar-top"><span class="hbar-t">${esc(v.title)}</span><b>${v.viewers} pelajar</b></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${v.viewers / max * 100}%">
        ${v.finished ? `<i class="s1" style="flex:${v.finished}" tabindex="0" data-tip="${esc(v.title)} · habis tonton" data-val="${v.finished} pelajar"></i>` : ''}
        ${v.viewers - v.finished ? `<i class="s1-soft" style="flex:${v.viewers - v.finished}" tabindex="0" data-tip="${esc(v.title)} · belum habis" data-val="${v.viewers - v.finished} pelajar"></i>` : ''}
      </div></div></div>`).join('')}</div>` : '<p class="muted">Belum ada video diterbitkan.</p>'}
  </div>`;
}

function tRingkasan() {
  const s = A.stats, D = A.dash;
  if (!s || !D) return '<div class="loading">Memuatkan statistik...</div>';
  const rev = D.revenue, cur = rev[rev.length - 1], prev = rev[rev.length - 2];
  const st = D.status, active = st.aktif + st.hampirTamat;
  return `<div class="dash">
    <div class="kpis">
      ${kpi('Pelajar aktif', active, `${st.hampirTamat} tamat dalam 7 hari`)}
      ${kpi(`Kutipan langganan · ${monthShort(cur.month)}`, rm(cur.langganan), '', delta(cur.langganan, D.prevMtd.langganan, `vs ${monthShort(prev.month)}, tempoh sama`))}
      ${kpi('Pelajar baharu · 30 hari', D.newUsers30, '', delta(D.newUsers30, D.newUsersPrev30, 'vs 30 hari sebelumnya'))}
      ${kpi(`Sumbangan · ${monthShort(cur.month)}`, rm(cur.sumbangan), '', delta(cur.sumbangan, D.prevMtd.sumbangan, `vs ${monthShort(prev.month)}, tempoh sama`))}
      ${kpi('Soalan menunggu jawapan', s.unansweredQuestions, '', s.unansweredQuestions ? '<button class="kpi-link" data-a="tab" data-v="soalan">Jawab sekarang →</button>' : '<span class="kpi-d up">Semua dah dijawab</span>')}
    </div>
    <div class="dash-a">${colChart({ title: 'Kutipan 6 bulan', sub: 'Bayaran web (CHIP)', series: [{ key: 'langganan', name: 'Langganan' }, { key: 'sumbangan', name: 'Sumbangan' }],
      rows: rev.map(r => ({ label: monthShort(r.month), tip: monthLong(r.month), values: r })), fmt: rm, tickFmt: compactRm })}</div>
    <div class="dash-b">${colChart({ title: 'Pelajar baharu setiap minggu', sub: '12 minggu terakhir', series: [{ key: 'count', name: 'Pelajar baharu' }],
      rows: D.weeks.map(w => ({ label: dayMonth(w.start), tip: 'Minggu ' + dayMonth(w.start), values: w })), fmt: n => String(n), tickFmt: n => String(Math.round(n * 10) / 10), labelEvery: 3 })}</div>
    <div class="dash-c">${statusBar(st, s.totalUsers)}</div>
    <div class="dash-d card">
      <span class="eyebrow">Penglibatan pelajar aktif</span>
      ${meter('Tonton video dalam 7 hari', D.watchers7, active, `${D.watchers7} daripada ${active} pelajar aktif`)}
      ${meter('Auto-renew aktif', D.autoRenew, active, `${D.autoRenew} daripada ${active} pelajar aktif (kad atau store)`)}
      ${meter('Notifikasi telefon dihidupkan', s.pushUsers, s.totalUsers, `${s.pushUsers} daripada ${s.totalUsers} pelajar berdaftar`)}
    </div>
    <div class="dash-e">${A.insights ? videoBars(A.insights.videos) : '<div class="card"><div class="loading">Memuatkan...</div></div>'}</div>
    <div class="dash-f card">
      <span class="eyebrow">Perlu tindakan</span>
      <div class="rows">
        <div class="row"><div><b>${s.expiringIn7Days} langganan tamat dalam 7 hari</b><p class="muted small">Ingatkan mereka untuk sambung</p></div></div>
        <div class="row"><div><b>${s.registeredNotPaid} pelajar belum bayar</b><p class="muted small">Boleh follow up melalui WhatsApp</p></div><button class="iconbtn" data-a="filterGo" data-v="belum-bayar">Lihat</button></div>
        <div class="row"><div><b>${s.unansweredQuestions} soalan belum dijawab</b><p class="muted small">Soalan pelajar kepada ustaz</p></div><button class="iconbtn" data-a="tab" data-v="soalan">Jawab</button></div>
      </div>
    </div>
    ${insightCards()}
    <div class="dash-btns">
      <a class="btn btn-ghost" href="/api/admin/export/pelajar.csv" download>Muat turun senarai pelajar (Excel)</a>
      <button class="btn btn-ghost" data-a="refresh">Muat semula</button>
    </div>
  </div>`;
}

const waLink = (phone, text) => `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
function insightCards() {
  const d = A.insights, pays = A.payments;
  if (!d) return '<div class="card dash-g"><div class="loading">Memuatkan statistik...</div></div>';
  // Papar 5 nama dahulu; selebihnya bila tekan "Lihat semua"
  const cut = (list, key) => A.showAll === key ? list : list.slice(0, 5);
  const more = (list, key) => list.length > 5 && A.showAll !== key ? `<button class="link" data-a="showAll" data-v="${key}" style="align-self:flex-start">Lihat semua (${list.length})</button>` : '';
  const followExp = cut(d.expiring, 'exp').map(u => `<div class="row"><div><b>${esc(u.name)}</b><p class="muted small">Tamat ${fmtDate(u.paidUntil)}</p></div>
      <a class="iconbtn" href="${waLink(u.wa, `Assalamualaikum ${u.name}. Langganan Madrasah Online anda akan tamat pada ${fmtDate(u.paidUntil)}. Sambung di app supaya boleh terus menonton video kelas: ${location.origin}`)}" target="_blank" rel="noopener">WhatsApp</a></div>`).join('');
  const followIdle = cut(d.idle, 'idle').map(u => `<div class="row"><div><b>${esc(u.name)}</b><p class="muted small">${u.lastWatch ? 'Tonton terakhir ' + fmtDate(u.lastWatch) : 'Belum tonton video'}</p></div>
      <a class="iconbtn" href="${waLink(u.wa, `Assalamualaikum ${u.name}. Ada rakaman kelas baharu di Madrasah Online. Jom sambung belajar: ${location.origin}`)}" target="_blank" rel="noopener">WhatsApp</a></div>`).join('');
  return `<div class="card dash-g">
      <span class="eyebrow">Perlu follow up</span>
      <p class="small"><b>${d.expiring.length}</b> langganan tamat dalam 7 hari (tanpa auto-renew)</p>
      ${followExp ? `<div class="rows">${followExp}</div>${more(d.expiring, 'exp')}` : ''}
      <p class="small"><b>${d.idle.length}</b> pelanggan tak tonton video 14 hari</p>
      ${followIdle ? `<div class="rows">${followIdle}</div>${more(d.idle, 'idle')}` : ''}
    </div>
    <div class="card dash-h">
      <span class="eyebrow">Bayaran terkini</span>
      ${!pays ? '<p class="muted">Memuatkan...</p>' : pays.length ? `<div class="rows">${pays.slice(0, 10).map(p => `<div class="row"><div style="min-width:0"><b>${esc(p.name)}</b><p class="muted small">${fmtDate(p.paidAt)} · ${p.months || 1} bulan${p.auto ? ' · kad auto' : ''}</p></div><span class="pill ${p.status === 'completed' ? 'ok' : 'warn'}">${rm(p.amountSen)}${p.status === 'semak' ? ' · semak' : ''}</span></div>`).join('')}</div>` : '<p class="muted">Belum ada bayaran.</p>'}
    </div>`;
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

// Kategori & topik video
const catById = id => ((A.vmeta && A.vmeta.categories) || []).find(c => c.id === id) || null;
const vMeta = v => [catById(v.categoryId) ? catById(v.categoryId).name : '', v.topic].filter(Boolean).join(' › ');
function catTopicFields(prefix, v = {}) {
  const cats = (A.vmeta && A.vmeta.categories) || [];
  return `<label class="f" for="${prefix}Cat">Kategori<select class="input" id="${prefix}Cat">
      <option value="">— Tiada kategori —</option>
      ${cats.map(c => `<option value="${c.id}"${c.id === v.categoryId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select></label>
    <label class="f" for="${prefix}Topic">Topik <span class="muted small">(pilihan, cth. Makhraj, Tajwid, Nabi Yusuf)</span><input class="input" id="${prefix}Topic" maxlength="40" list="topicList" value="${esc(v.topic || '')}"></label>
    <datalist id="topicList">${((A.vmeta && A.vmeta.topics) || []).map(t => `<option value="${esc(t)}">`).join('')}</datalist>`;
}
function catCard() {
  const cats = (A.vmeta && A.vmeta.categories) || [];
  const count = id => (A.videos || []).filter(v => v.categoryId === id).length;
  return `<div class="card">
    <span class="eyebrow">Kategori video</span>
    <p class="muted small">Pelajar nampak video dikumpul ikut kategori. Topik (cth. Makhraj, Tajwid) dipilih dalam setiap video.</p>
    <div class="rows">${cats.map((c, i) => `<div class="row">
      <div style="min-width:0"><b>${esc(c.name)}</b><p class="muted small">${c.nameEn && c.nameEn !== c.name ? esc(c.nameEn) + ' · ' : ''}${count(c.id)} video</p></div>
      <div class="btn-row" style="flex:none;gap:.3rem">
        <button class="iconbtn" data-a="catMove" data-v="${c.id}" data-dir="-1" aria-label="Naik" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="iconbtn" data-a="catMove" data-v="${c.id}" data-dir="1" aria-label="Turun" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="iconbtn" data-a="catEdit" data-v="${c.id}">Ubah</button>
      </div>
    </div>`).join('') || '<p class="muted">Belum ada kategori.</p>'}</div>
    <button class="btn btn-ghost" data-a="catNew">Tambah kategori</button>
  </div>`;
}
function catModal() {
  const c = A.editCat || {};
  return `<form id="fCat" novalidate style="display:flex;flex-direction:column;gap:.8rem">
    <h2 style="font-size:1.25rem">${c.id ? 'Ubah kategori' : 'Tambah kategori'}</h2>
    <label class="f" for="cName">Nama kategori<input class="input" id="cName" maxlength="40" value="${esc(c.name || '')}" placeholder="Contoh: Kisah dari Al-Quran"></label>
    <label class="f" for="cNameEn">Nama (English) <span class="muted small">(pilihan)</span><input class="input" id="cNameEn" maxlength="40" value="${esc(c.nameEn || '')}" placeholder="Contoh: Stories from the Quran"></label>
    ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
    <button class="btn btn-primary" type="submit">Simpan</button>
    ${c.id ? `<button class="btn btn-ghost" type="button" data-a="catDel" data-v="${c.id}" style="color:var(--danger)">Padam kategori</button><p class="muted small">Video dalam kategori ini tidak dipadam, cuma jadi "tiada kategori".</p>` : ''}
    <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
  </form>`;
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const monthLabel = m => m ? MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4) : '';

function videoRow(v) {
  const pill = v.ready ? (v.published ? '<span class="pill ok">Diterbitkan</span>' : '<span class="pill warn">Sedia, belum terbit</span>')
    : v.status === 5 || v.status === 6 ? `<span class="pill bad">${esc(v.statusLabel)}</span>`
    : `<span class="pill warn">${esc(v.statusLabel)}${v.progress ? ' ' + v.progress + '%' : ''}</span>`;
  return `<div class="q">
    <div class="top" style="align-items:flex-start"><div style="min-width:0"><b>${esc(v.title)}</b>
      <p class="muted small">${[vMeta(v) ? esc(vMeta(v)) : 'Tiada kategori', v.classMonth ? monthLabel(v.classMonth) : '', v.minutes ? v.minutes + ' minit' : '', v.chapterCount ? v.chapterCount + ' bab' : ''].filter(Boolean).join(' · ')}</p></div>${pill}</div>
    <div class="btn-row">
      ${v.ready ? `<button class="btn ${v.published ? 'btn-ghost' : 'btn-primary'}" data-a="vPublish" data-v="${v.id}">${v.published ? 'Sembunyikan' : 'Terbitkan'}</button>` : ''}
      <button class="btn btn-ghost" data-a="vEdit" data-v="${v.id}">Edit</button>
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
      ${catTopicFields('v')}
      <label class="f" for="vArabic">Label Arab <span class="muted small">(pilihan, untuk gambar kecil)</span><input class="input" id="vArabic" dir="rtl" maxlength="40" placeholder="النون الساكنة" style="font-family:var(--f-ar);font-size:1.2rem"></label>
      <label class="f" for="vMonth">Bulan kelas<input class="input" id="vMonth" type="month" value="${month}"></label>
      <label class="f" for="vFile">Fail video<input class="input" id="vFile" type="file" accept="video/*"></label>
      ${up ? `<div class="ok-box">${esc(up.msg)}${up.pct != null ? ` <b>${up.pct}%</b>` : ''}</div><span class="bar"><i style="width:${up.pct || 0}%"></i></span>` : ''}
      ${up && up.log && up.log.length ? `<details class="uplog" ${up.busy ? '' : 'open'}><summary>Butiran teknikal (screenshot bahagian ini jika upload bermasalah)</summary><pre>${esc(up.log.join('\n'))}</pre></details>` : ''}
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit" ${!m.bunnyReady || (up && up.busy) ? 'disabled' : ''}>Muat naik video</button>
      <p class="note">Jangan tutup halaman ini semasa muat naik. Selepas siap, Bunny akan proses video beberapa minit sebelum boleh diterbitkan.</p>
    </form>
    ${catCard()}
    <div class="card">
      <div class="top"><span class="eyebrow">Semua video · ${A.videos.length}</span><button class="iconbtn" data-a="vRefresh">Muat semula</button></div>
      <div class="qa">${A.videos.length ? A.videos.map(videoRow).join('') : '<p class="muted">Belum ada video.</p>'}</div>
    </div>`;
}

async function loadVideos() {
  const r = await api('GET', '/api/admin/videos');
  if (r.status === 401) return toLogin();
  if (!r.ok) { toast(r.error); return; }
  A.videos = r.videos; A.vmeta = { bunnyReady: r.bunnyReady, tokenReady: r.tokenReady, topics: r.topics, categories: r.categories || [] };
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
  const r = await busy(btn, () => api('POST', '/api/admin/videos', { title: val('vTitle'), categoryId: val('vCat'), topic: val('vTopic'), arabicLabel: val('vArabic'), classMonth: val('vMonth') }));
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
  forget('vTitle', 'vTopic', 'vArabic');
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

function plansCard() {
  if (!A.plans) return '<div class="card"><span class="eyebrow">Pakej langganan</span><p class="muted">Memuatkan...</p></div>';
  return `<form id="fPlans" class="card" novalidate>
    <span class="eyebrow">Pakej langganan</span>
    ${A.billingReady ? '<div class="ok-box">CHIP sudah disambung. Pelajar boleh membayar dalam app.</div>'
      : `<div class="adminnote">${I.shield}<p><b>CHIP belum disambung.</b> Tambah secret <b>CHIP_SECRET_KEY</b> dan <b>CHIP_BRAND_ID</b> di Cloudflare. Sebelum itu, pelajar akan nampak "Sistem bayaran sedang disiapkan".</p></div>`}
    <p class="muted small">Tandakan pakej yang ditawarkan. Harga baharu terpakai untuk bayaran seterusnya, termasuk auto-renew.</p>
    ${A.plans.map(p => `<div class="q">
      <label class="check" for="pl-${p.id}-on"><input type="checkbox" id="pl-${p.id}-on" ${p.active ? 'checked' : ''}><span>${p.months} bulan</span></label>
      <div class="btn-row">
        <label class="f" for="pl-${p.id}-label" style="flex:1">Nama<input class="input" id="pl-${p.id}-label" maxlength="30" value="${esc(p.label)}"></label>
        <label class="f" for="pl-${p.id}-price" style="flex:1">Harga (RM)<input class="input" id="pl-${p.id}-price" inputmode="decimal" value="${(p.priceSen / 100).toFixed(2).replace(/\.00$/, '')}"></label>
      </div>
    </div>`).join('')}
    <button class="btn btn-primary" type="submit">Simpan pakej</button>
  </form>`;
}

function tSumbangan() {
  const d = A.don;
  if (!d) return '<div class="loading">Memuatkan sumbangan...</div>';
  const s = d.summary, use = u => u === 'taja' ? 'Taja pelajar' : 'Am';
  return `<div class="stats">
      <div class="stat"><b>${rm(s.monthSen)}</b><span>Sumbangan bulan ini</span></div>
      <div class="stat"><b>${rm(s.allSen)}</b><span>Jumlah keseluruhan</span></div>
      <div class="stat"><b>${rm(s.tajaBalanceSen)}</b><span>Baki dana taja</span></div>
      <div class="stat"><b>${s.monthlyDonors}</b><span>Penyumbang bulanan (${rm(s.monthlyPledgeSen)}/bln)</span></div>
    </div>
    <div class="card">
      <span class="eyebrow">Dana taja pelajar</span>
      <p class="small">Masuk ${rm(s.tajaInSen)} · digunakan ${rm(s.tajaUsedSen)} · baki <b>${rm(s.tajaBalanceSen)}</b> (cukup untuk ${Math.floor(s.tajaBalanceSen / s.monthPriceSen)} bulan langganan).</p>
      <p class="muted small">Untuk menaja: tab <b>Pelajar</b> → pilih pelajar → <b>Taja dari dana</b>.</p>
      ${d.sponsorships.length ? `<div class="rows">${d.sponsorships.slice(0, 10).map(x => `<div class="row"><div><b>${esc(x.student)}</b><p class="muted small">${fmtDate(x.at)} · ${x.months} bulan${x.by ? ' · oleh ' + esc(x.by) : ''}</p></div><span class="pill ok">${rm(x.amountSen)}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card">
      <span class="eyebrow">Penyumbang bulanan aktif</span>
      ${d.donors.length ? `<div class="rows">${d.donors.map(x => `<div class="row"><div style="min-width:0"><b>${esc(x.name)}</b><p class="muted small">${rm(x.amountSen)}/bulan · ${use(x.use)} · caj seterusnya ${x.nextChargeAt ? fmtDate(x.nextChargeAt) : '-'}</p></div><button class="iconbtn" data-a="donorStop" data-v="${x.id}">Henti</button></div>`).join('')}</div>` : '<p class="muted">Belum ada.</p>'}
    </div>
    <div class="card">
      <span class="eyebrow">Sumbangan terkini</span>
      ${d.donations.length ? `<div class="qa">${d.donations.map(x => `<div class="q">
        <div class="who"><b>${esc(x.name)}${x.anonymous ? ' (tanpa nama)' : ''}</b><span>${fmtDate(x.at)}</span></div>
        <p class="small">${rm(x.amountSen)} · ${use(x.use)}${x.monthly ? ' · bulanan' : ''}${x.status === 'semak' ? ' · <b style="color:var(--warn)">perlu semak</b>' : ''}</p>
        <p class="muted small" style="overflow-wrap:anywhere">${esc(x.email || '')}${x.phone ? ' · ' + esc(x.phone) : ''}</p>
        ${x.message ? `<p class="ann small">“${esc(x.message)}”</p>` : ''}
      </div>`).join('')}</div>` : '<p class="muted">Belum ada sumbangan.</p>'}
    </div>
    <a class="btn btn-ghost" href="/sumbang" target="_blank" rel="noopener">Buka halaman sumbangan</a>
    <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent('Assalamualaikum. Jom bersama taja pelajar dewasa belajar mengaji di Madrasah Online. Sumbang di sini: ' + location.origin + '/sumbang')}" target="_blank" rel="noopener">Kongsi pautan sumbangan (WhatsApp)</a>
    <a class="btn btn-ghost" href="/api/admin/export/sumbangan.csv" download>Muat turun rekod sumbangan (Excel)</a>`;
}

// ---------- zikir & selawat (audio) ----------
const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
const fmtMB = b => b ? (b / 1048576).toFixed(1) + 'MB' : '';
function tZikir() {
  const L = A.auds;
  if (!L) return '<div class="loading">Memuatkan audio...</div>';
  const up = A.aup;
  return `${A.audReady ? '' : `<div class="adminnote">${I.shield}<p><b>Storan audio belum disambung.</b> Hidupkan R2 di Cloudflare dan cipta bucket <b>madrasah-audio</b>. Teks boleh disediakan dahulu.</p></div>`}
    <div class="adminnote">${I.shield}<p><b>Percuma untuk semua pelajar berdaftar.</b> Draf contoh disediakan tanpa audio. Muat naik rakaman ustaz (MP3/M4A), semak teks, kemudian tekan <b>Terbitkan</b>.</p></div>
    <div class="card">
      <div class="top"><span class="eyebrow">${L.length} audio · ${L.filter(a => a.published).length} diterbitkan</span></div>
      <button class="btn btn-primary" data-a="audNew">Tambah audio</button>
    </div>
    <div class="card"><div class="qa">${L.map(a => `<div class="q">
      <div class="top" style="align-items:flex-start"><div style="min-width:0"><b>${esc(a.title)}</b>
        <p class="muted small">${a.hasAudio ? [fmtDur(a.durationSec), fmtMB(a.size)].filter(Boolean).join(' · ') || 'Audio ada' : 'Belum ada fail audio'}${a.source ? ' · ' + esc(a.source) : ''}</p></div>
        ${a.published ? '<span class="pill ok">Diterbitkan</span>' : a.hasAudio ? '<span class="pill warn">Draf</span>' : '<span class="pill bad">Tiada audio</span>'}</div>
      ${a.hasAudio ? `<audio controls preload="none" src="/api/admin/audios/${a.id}/file?v=${a.updatedAt}" style="width:100%"></audio>` : ''}
      ${up && up.id === a.id ? `<div class="ok-box">Memuat naik... <b id="aupPct">${up.pct}%</b></div><span class="bar"><i id="aupBar" style="width:${up.pct}%"></i></span>` : ''}
      <div class="btn-row">
        <label class="btn ${a.hasAudio ? 'btn-ghost' : 'btn-primary'}"${up ? ' style="opacity:.5;pointer-events:none"' : ''}>${a.hasAudio ? 'Tukar audio' : 'Muat naik audio'}<input type="file" accept="audio/*,.mp3,.m4a" data-aup="${a.id}" hidden></label>
        ${a.hasAudio ? `<button class="btn ${a.published ? 'btn-ghost' : 'btn-primary'}" data-a="audPub" data-v="${a.id}">${a.published ? 'Sembunyikan' : 'Terbitkan'}</button>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-a="audEdit" data-v="${a.id}">Edit teks</button>
        <button class="btn btn-ghost" style="color:var(--danger)" data-a="audDel" data-v="${a.id}">Padam</button>
      </div>
    </div>`).join('') || '<p class="muted">Belum ada audio.</p>'}</div></div>`;
}
const AUD_IDS = ['zTitle', 'zTitleEn', 'zArabic', 'zRumi', 'zMeaning', 'zMeaningEn', 'zSource', 'zSort'];
function audModal() {
  const d = A.editAud || {};
  return `<form id="fAud" novalidate style="display:flex;flex-direction:column;gap:.8rem">
    <h2 style="font-size:1.25rem">${d.id ? 'Edit teks audio' : 'Tambah audio'}</h2>
    <label class="f" for="zTitle">Tajuk<input class="input" id="zTitle" maxlength="80" value="${esc(d.title || '')}" placeholder="Contoh: Selawat Tafrijiyah"></label>
    <label class="f" for="zTitleEn">Tajuk (English) <span class="muted small">(pilihan)</span><input class="input" id="zTitleEn" maxlength="80" value="${esc(d.titleEn || '')}"></label>
    <label class="f" for="zArabic">Teks Arab <span class="muted small">(pilihan)</span><textarea class="input" id="zArabic" dir="rtl" rows="4" style="font-family:var(--f-ar);font-size:1.4rem;line-height:1.9">${esc(d.arabic || '')}</textarea></label>
    <label class="f" for="zRumi">Rumi <span class="muted small">(pilihan)</span><textarea class="input" id="zRumi" rows="3">${esc(d.rumi || '')}</textarea></label>
    <label class="f" for="zMeaning">Maksud <span class="muted small">(pilihan)</span><textarea class="input" id="zMeaning" rows="3">${esc(d.meaning || '')}</textarea></label>
    <label class="f" for="zMeaningEn">Maksud (English) <span class="muted small">(pilihan)</span><textarea class="input" id="zMeaningEn" rows="2">${esc(d.meaningEn || '')}</textarea></label>
    <label class="f" for="zSource">Rujukan <span class="muted small">(pilihan)</span><input class="input" id="zSource" maxlength="120" value="${esc(d.source || '')}"></label>
    <label class="f" for="zSort">Susunan <span class="muted small">(nombor kecil di atas)</span><input class="input" id="zSort" inputmode="numeric" value="${d.sort ?? ''}"></label>
    ${d.id ? '' : '<p class="muted small">Selepas simpan, tekan <b>Muat naik audio</b> pada senarai untuk pilih fail rakaman.</p>'}
    ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
    <button class="btn btn-primary" type="submit">Simpan</button>
    <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
  </form>`;
}
async function uploadAudio(id, file) {
  if (!file) return;
  if (file.size > 95 * 1048576) { toast('Fail terlalu besar (had 95MB). Simpan sebagai MP3 atau pendekkan rakaman.'); return; }
  const type = file.type && file.type.startsWith('audio/') ? file.type
    : /\.m4a$/i.test(file.name) ? 'audio/mp4' : /\.mp3$/i.test(file.name) ? 'audio/mpeg' : /\.wav$/i.test(file.name) ? 'audio/wav' : file.type;
  const dur = await new Promise(ok => {
    const a = new Audio(), u = URL.createObjectURL(file);
    const done = v => { ok(Number.isFinite(v) ? v : 0); URL.revokeObjectURL(u); };
    a.preload = 'metadata'; a.onloadedmetadata = () => done(a.duration); a.onerror = () => done(0);
    setTimeout(() => done(0), 6000); a.src = u;
  });
  A.aup = { id, pct: 0 }; render();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/api/admin/audios/${id}/file?duration=${Math.round(dur || 0)}`);
  xhr.setRequestHeader('content-type', type || 'application/octet-stream');
  xhr.upload.onprogress = e => {
    if (!e.lengthComputable || !A.aup) return;
    A.aup.pct = Math.round(e.loaded / e.total * 100);
    const t = document.getElementById('aupPct'), b = document.getElementById('aupBar');
    if (t) t.textContent = A.aup.pct + '%'; if (b) b.style.width = A.aup.pct + '%';
  };
  xhr.onload = () => {
    let r = {}; try { r = JSON.parse(xhr.responseText); } catch {}
    A.aup = null;
    if (xhr.status === 401) return toLogin();
    if (xhr.status >= 200 && xhr.status < 300 && r.ok) { A.auds = A.auds.map(x => x.id === id ? r.audio : x); toast('Audio dimuat naik. Tekan Terbitkan bila sedia.'); }
    else toast(r.error || 'Muat naik gagal. Cuba lagi.');
    render();
  };
  xhr.onerror = () => { A.aup = null; toast('Sambungan terputus. Cuba lagi dengan WiFi.'); render(); };
  xhr.send(file);
}
document.addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.aup;
  if (id && e.target.files && e.target.files[0]) uploadAudio(Number(id), e.target.files[0]);
});

// ---------- doa harian ----------
function tDoa() {
  const L = A.doas;
  if (!L) return '<div class="loading">Memuatkan doa...</div>';
  const drafts = L.filter(d => !d.published).length;
  const cats = [...new Set(L.map(d => d.category))];
  return `<div class="adminnote">${I.shield}<p><b>Semak sebelum terbit.</b> Doa contoh disediakan sebagai draf. Sila minta ustaz semak teks Arab, rumi, maksud dan rujukan, kemudian tekan <b>Terbitkan</b>. Pelajar hanya nampak doa yang diterbitkan.</p></div>
    <div class="card">
      <div class="top"><span class="eyebrow">${L.length} doa · ${L.length - drafts} diterbitkan${drafts ? ' · ' + drafts + ' draf' : ''}</span></div>
      <button class="btn btn-primary" data-a="doaNew">Tambah doa</button>
    </div>
    ${cats.map(c => `<div class="card">
      <span class="eyebrow">${esc(c)}</span>
      <div class="qa">${L.filter(d => d.category === c).map(d => `<div class="q">
        <div class="top" style="align-items:flex-start"><div style="min-width:0"><b>${esc(d.title)}</b>${d.source ? `<p class="muted small">${esc(d.source)}</p>` : ''}</div>
          ${d.published ? '<span class="pill ok">Diterbitkan</span>' : '<span class="pill warn">Draf</span>'}</div>
        <p class="doa-ar">${esc(d.arabic)}</p>
        ${d.rumi ? `<p class="small muted" style="font-style:italic">${esc(d.rumi)}</p>` : ''}
        <p class="small">${esc(d.meaning)}</p>
        <div class="btn-row">
          <button class="btn ${d.published ? 'btn-ghost' : 'btn-primary'}" data-a="doaPub" data-v="${d.id}">${d.published ? 'Sembunyikan' : 'Terbitkan'}</button>
          <button class="btn btn-ghost" data-a="doaEdit" data-v="${d.id}">Edit</button>
          <button class="btn btn-ghost" data-a="doaDel" data-v="${d.id}" style="color:var(--danger)">Padam</button>
        </div>
      </div>`).join('')}</div>
    </div>`).join('')}
    ${!L.length ? '<div class="card"><p class="muted">Belum ada doa.</p></div>' : ''}`;
}
const DOA_IDS = ['dCat', 'dTitle', 'dTitleEn', 'dArabic', 'dRumi', 'dMeaning', 'dMeaningEn', 'dSource', 'dSort'];
function doaModal() {
  const d = A.editDoa || {}, cats = [...new Set([...(A.doas || []).map(x => x.category), 'Harian', 'Belajar & mengaji', 'Doa pilihan'])];
  return `<form id="fDoa" novalidate style="display:flex;flex-direction:column;gap:.8rem">
    <h2 style="font-size:1.25rem">${d.id ? 'Edit doa' : 'Tambah doa'}</h2>
    <label class="f" for="dCat">Kategori<input class="input" id="dCat" list="dCats" maxlength="40" value="${esc(d.category || 'Harian')}"></label>
    <datalist id="dCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <label class="f" for="dTitle">Tajuk<input class="input" id="dTitle" maxlength="80" value="${esc(d.title || '')}" placeholder="Contoh: Sebelum tidur"></label>
    <label class="f" for="dTitleEn">Tajuk (English) <span class="muted small">(pilihan)</span><input class="input" id="dTitleEn" maxlength="80" value="${esc(d.titleEn || '')}"></label>
    <label class="f" for="dArabic">Teks Arab<textarea class="input" id="dArabic" dir="rtl" rows="3" style="font-family:var(--f-ar);font-size:1.45rem;line-height:1.9">${esc(d.arabic || '')}</textarea></label>
    <label class="f" for="dRumi">Rumi <span class="muted small">(cara sebut)</span><textarea class="input" id="dRumi" rows="2">${esc(d.rumi || '')}</textarea></label>
    <label class="f" for="dMeaning">Maksud<textarea class="input" id="dMeaning" rows="3">${esc(d.meaning || '')}</textarea></label>
    <label class="f" for="dMeaningEn">Maksud (English) <span class="muted small">(pilihan)</span><textarea class="input" id="dMeaningEn" rows="2">${esc(d.meaningEn || '')}</textarea></label>
    <label class="f" for="dSource">Rujukan <span class="muted small">(pilihan)</span><input class="input" id="dSource" maxlength="120" value="${esc(d.source || '')}" placeholder="Contoh: Riwayat al-Bukhari"></label>
    <label class="f" for="dSort">Susunan <span class="muted small">(nombor kecil di atas)</span><input class="input" id="dSort" inputmode="numeric" value="${d.sort ?? ''}"></label>
    <label class="check" for="dPub"><input type="checkbox" id="dPub" ${d.published ? 'checked' : ''}><span>Terbitkan (pelajar boleh nampak)</span></label>
    ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
    <button class="btn btn-primary" type="submit">Simpan</button>
    <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
  </form>`;
}

function tTetapan() {
  const o = A.org;
  return `${plansCard()}
    <form id="fOrg" class="card" novalidate>
      <span class="eyebrow">Maklumat pengendali</span>
      <p class="muted small">Dipaparkan dalam halaman Terma, Privasi & Bayaran Balik, skrin Lupa PIN dan menu Akaun pelajar. Payment gateway biasanya semak maklumat ini.</p>
      ${!o ? '<p class="muted">Memuatkan...</p>' : `
      <label class="f" for="oName">Nama syarikat / pertubuhan<input class="input" id="oName" maxlength="120" value="${esc(o.name)}" placeholder="Nama seperti dalam SSM / ROS"></label>
      <label class="f" for="oReg">No. pendaftaran (SSM / ROS)<input class="input" id="oReg" maxlength="60" value="${esc(o.reg)}" placeholder="Contoh: 202401012345 (1234567-X)"></label>
      <label class="f" for="oEmail">Emel hubungan<input class="input" id="oEmail" type="email" inputmode="email" value="${esc(o.email)}"></label>
      <label class="f" for="oWa">No. WhatsApp admin<input class="input" id="oWa" inputmode="tel" value="${o.whatsapp ? '0' + esc(o.whatsapp.slice(2)) : ''}" placeholder="Contoh: 012-345 6789"></label>
      <label class="f" for="oAddr">Alamat perniagaan<textarea class="input" id="oAddr" maxlength="300" rows="3">${esc(o.address)}</textarea></label>
      <label class="f" for="oPlay">Pautan apps di Google Play <span class="muted small">(kosongkan jika belum ada)</span><input class="input" id="oPlay" inputmode="url" value="${esc((A.links || {}).playUrl || '')}" placeholder="https://play.google.com/store/apps/details?id=..."></label>
      <label class="f" for="oIos">Pautan apps di App Store <span class="muted small">(kosongkan jika belum ada)</span><input class="input" id="oIos" inputmode="url" value="${esc((A.links || {}).appStoreUrl || '')}" placeholder="https://apps.apple.com/my/app/..."></label>
      <p class="muted small">Pautan apps dipaparkan sebagai butang muat turun di laman web. Jika kosong, butang tertulis "Akan datang".</p>
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
    ${logCard()}
    ${installCard()}`;
}

// Log aktiviti admin: siapa buat apa. Login gagal ditanda merah (mungkin orang cuba teka kata laluan).
function logDetail(d) {
  if (!d) return '';
  try {
    const o = JSON.parse(d);
    return Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== '•••' && typeof v !== 'object')
      .map(([k, v]) => `${k}: ${v}`).join(' · ').slice(0, 160);
  } catch { return ''; }
}
function logCard() {
  const L = A.log;
  return `<div class="card">
    <span class="eyebrow">Log aktiviti admin</span>
    <p class="muted small">Rekod setiap perubahan, muat turun data dan cubaan log masuk admin (disimpan 1 tahun). Kata laluan dan PIN tidak direkod.</p>
    ${!L ? '<button class="btn btn-ghost" data-a="loadLog">Lihat log</button>' : !L.items.length ? '<p class="muted">Belum ada rekod.</p>' : `
    <div class="rows adminlog">${L.items.map(r => `<div class="row" style="align-items:flex-start">
      <div style="min-width:0">
        <b${r.failed ? ' style="color:var(--danger)"' : ''}>${esc(r.failed ? 'Log masuk GAGAL' : r.action)}</b>${r.target ? ` <span class="muted">· ${esc(r.target)}</span>` : ''}
        <div class="muted small" style="overflow-wrap:anywhere">${[r.admin, logDetail(r.detail)].filter(Boolean).map(esc).join(' · ')}${r.failed || /Log masuk/.test(r.action) ? ' · IP ' + esc(r.ip || '-') : ''}</div>
      </div>
      <span class="muted small" style="white-space:nowrap;text-align:right">${fmtDate(r.at)}<br>${fmtTime(r.at)}</span>
    </div>`).join('')}</div>
    ${L.more ? '<button class="btn btn-ghost" data-a="moreLog">Lihat lagi</button>' : ''}`}
  </div>`;
}
async function loadLog(more) {
  const before = more && A.log && A.log.items.length ? A.log.items[A.log.items.length - 1].id : '';
  const r = await api('GET', '/api/admin/log' + (before ? '?before=' + before : ''));
  if (r.status === 401) return toLogin();
  if (!r.ok) return toast(r.error);
  A.log = { items: (more && A.log ? A.log.items : []).concat(r.log), more: r.log.length === 100 };
  render();
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
        <div class="row"><span class="muted">Auto-renew kad</span><b>${u.autoRenew ? 'Ya' : 'Tidak'}</b></div>
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
      <span class="eyebrow">Taja dari dana</span>
      <p class="muted small">${A.taja ? `Baki dana taja: <b>${rm(A.taja.balanceSen)}</b> (${rm(A.taja.monthPriceSen)} sebulan).` : 'Memuatkan baki...'}</p>
      ${A.taja && A.taja.balanceSen >= A.taja.monthPriceSen ? `<div class="filter-row">${[1, 3, 6, 12].filter(m => m * A.taja.monthPriceSen <= A.taja.balanceSen).map(m => `<button class="chip" data-a="sponsor" data-v="${m}">Taja ${m} bulan</button>`).join('')}</div>` : A.taja ? '<p class="muted small">Baki belum mencukupi untuk menaja.</p>' : ''}
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
      ${catTopicFields('i')}
      <label class="f" for="iArabic">Label Arab <span class="muted small">(pilihan)</span><input class="input" id="iArabic" dir="rtl" maxlength="40" style="font-family:var(--f-ar);font-size:1.2rem"></label>
      <label class="f" for="iMonth">Bulan kelas<input class="input" id="iMonth" type="month" value="${month}"></label>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Import ke app</button>
      <button class="btn btn-ghost" type="button" data-a="close">Batal</button>
    </form>`;
  }
  if (A.modal === 'doa') inner = doaModal();
  if (A.modal === 'cat') inner = catModal();
  if (A.modal === 'aud') inner = audModal();
  if (A.modal === 'auddel') inner = `<h2 style="font-size:1.25rem">Padam audio?</h2>
      <p><b>${esc(A.delAud.title)}</b> dan fail audionya akan dipadam. Tindakan ini tidak boleh dibatalkan.</p>
      <button class="btn btn-primary" data-a="audDelGo" style="background:var(--danger)">Ya, padam</button>
      <button class="btn btn-ghost" data-a="close">Batal</button>`;
  if (A.modal === 'doadel') inner = `<h2 style="font-size:1.25rem">Padam doa?</h2>
      <p><b>${esc(A.delDoa.title)}</b> akan dipadam. Tindakan ini tidak boleh dibatalkan.</p>
      <button class="btn btn-primary" data-a="doaDelGo" style="background:var(--danger)">Ya, padam</button>
      <button class="btn btn-ghost" data-a="close">Batal</button>`;
  if (A.modal === 'vedit') {
    const v = A.editVideo;
    inner = `<form id="fVEdit" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">Edit video</h2>
      <label class="f" for="eTitle">Tajuk dalam app<input class="input" id="eTitle" maxlength="120" value="${esc(v.title)}"></label>
      ${catTopicFields('e', v)}
      <label class="f" for="eArabic">Label Arab <span class="muted small">(pilihan)</span><input class="input" id="eArabic" dir="rtl" maxlength="40" value="${esc(v.arabicLabel || '')}" style="font-family:var(--f-ar);font-size:1.2rem"></label>
      <label class="f" for="eMonth">Bulan kelas<input class="input" id="eMonth" type="month" value="${esc(v.classMonth || '')}"></label>
      <label class="f" for="eChap">Bab dalam video <span class="muted small">(pilihan · satu bab sebaris: masa, kemudian tajuk)</span>
        <textarea class="input" id="eChap" rows="6" maxlength="5000" placeholder="00:00 Pengenalan&#10;05:30 Hukum mad asli&#10;18:45 Latihan bacaan bersama">${esc(v.chaptersText || '')}</textarea></label>
      <p class="muted small">Pelajar boleh tekan bab untuk terus lompat ke bahagian itu. Masa ikut video, cth. 05:30 atau 1:05:30.</p>
      <p class="muted small">Perubahan terus dilihat pelajar. Fail video tidak berubah.</p>
      ${A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">Simpan</button>
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
    const tabs = [['ringkasan', 'Ringkasan'], ['pelajar', 'Pelajar'], ['video', 'Video'], ['hebahan', 'Hebahan'], ['soalan', `Soalan${A.unanswered ? ' (' + A.unanswered + ')' : ''}`], ['doa', 'Doa'], ['zikir', 'Zikir'], ['sumbangan', 'Sumbangan'], ['tetapan', 'Tetapan']];
    body = `<div class="top"><div style="display:flex;align-items:center;gap:.7rem;min-width:0"><img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608"><h1>Panel Admin</h1></div>
        <div class="btn-row" style="flex:none">${themeBtn()}<button class="iconbtn" data-a="logout">Keluar</button></div></div>
      <div class="adm">
        <nav class="tabs adm-nav" aria-label="Menu admin">${tabs.map(([k, l]) => `<button class="chip ${A.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}"${A.tab === k ? ' aria-current="page"' : ''}>${l}</button>`).join('')}</nav>
        <main class="adm-main tab-${A.tab}">${{ ringkasan: tRingkasan, pelajar: tPelajar, video: tVideo, hebahan: tHebahan, soalan: tSoalan, doa: tDoa, zikir: tZikir, sumbangan: tSumbangan, tetapan: tTetapan }[A.tab]()}</main>
      </div>`;
  }
  app.innerHTML = `<div class="shell admin${A.view === 'app' ? ' wide' : ''}">${body}</div>${modal()}`;
  restoreInputs();
}
window.render = render;

// Tooltip carta: satu kotak, ikut tetikus / fokus papan kekunci (teks guna textContent)
const vizTip = document.createElement('div');
vizTip.className = 'viz-tip'; vizTip.setAttribute('role', 'tooltip'); vizTip.hidden = true;
vizTip.innerHTML = '<b></b><span></span>';
document.body.appendChild(vizTip);
function showTip(el, x, y) {
  vizTip.firstChild.textContent = el.dataset.val || '';
  vizTip.lastChild.textContent = el.dataset.tip || '';
  vizTip.hidden = false;
  const w = vizTip.offsetWidth, h = vizTip.offsetHeight;
  vizTip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
  vizTip.style.top = Math.max(8, y - h - 12) + 'px';
}
document.addEventListener('pointermove', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) showTip(el, e.clientX, e.clientY); else vizTip.hidden = true;
});
document.addEventListener('focusin', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el) { vizTip.hidden = true; return; }
  const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top);
});
document.addEventListener('scroll', () => { vizTip.hidden = true; }, true);

async function loadStats() {
  api('GET', '/api/admin/insights').then(x => { A.insights = x.ok ? x : { videos: [], expiring: [], idle: [] }; if (A.tab === 'ringkasan') render(); });
  api('GET', '/api/admin/payments').then(x => { A.payments = x.ok ? x.payments : []; if (A.tab === 'ringkasan') render(); });
  const r = await api('GET', '/api/admin/stats');
  if (r.status === 401) return toLogin();
  if (r.ok) { A.stats = r.stats; A.dash = r.dash; A.unanswered = r.stats.unansweredQuestions; } else toast(r.error);
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
async function loadAuds() {
  const r = await api('GET', '/api/admin/audios');
  if (r.status === 401) return toLogin();
  A.auds = r.ok ? r.audios : []; A.audReady = r.ok ? r.storageReady : false;
  if (!r.ok) toast(r.error);
  render();
}
async function loadDoas() {
  const r = await api('GET', '/api/admin/doas');
  if (r.status === 401) return toLogin();
  A.doas = r.ok ? r.doas : [];
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
async function loadDon() {
  const r = await api('GET', '/api/admin/donations');
  if (r.status === 401) return toLogin();
  A.don = r.ok ? r : null;
  if (!r.ok) toast(r.error);
  render();
}
async function loadQs() {
  const r = await api('GET', `/api/admin/questions?status=${A.qFilter}`);
  if (r.status === 401) return toLogin();
  if (r.ok) { A.qs = r.questions; A.unanswered = r.unanswered; } else { A.qs = []; toast(r.error); }
  render();
}
async function loadPlans() {
  const r = await api('GET', '/api/admin/plans');
  if (r.status === 401) return toLogin();
  if (r.ok) { A.plans = r.plans; A.billingReady = r.billingReady; forget(...r.plans.flatMap(p => [`pl-${p.id}-label`, `pl-${p.id}-price`])); }
  render();
}
async function loadOrg() {
  const r = await api('GET', '/api/admin/settings');
  if (r.status === 401) return toLogin();
  if (r.ok) { A.org = r.org; A.links = r.links; forget('oName', 'oReg', 'oEmail', 'oWa', 'oAddr', 'oPlay', 'oIos'); } else toast(r.error);
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
  if (t === 'tetapan') { A.log = null; loadOrg(); loadPlans(); }
  if (t === 'sumbangan') { A.don = null; loadDon(); }
  if (t === 'doa') { A.doas = null; loadDoas(); }
  if (t === 'zikir') { A.auds = null; loadAuds(); }
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
    case 'refresh': A.stats = null; A.dash = null; A.insights = null; A.payments = null; render(); loadStats(); return;
    case 'filter': A.filter = v; loadUsers(); return;
    case 'showAll': A.showAll = v; break;
    case 'filterGo': A.filter = v; A.q = ''; openTab('pelajar'); return;
    case 'user':
      A.sel = A.users.find(u => String(u.id) === v); A.newPin = null; A.err = ''; A.modal = 'user'; A.taja = null;
      api('GET', '/api/admin/taja-balance').then(r => { if (r.ok) { A.taja = r; if (A.modal === 'user') render(); } });
      break;
    case 'sponsor': {
      const r = await busy(el, () => api('POST', `/api/admin/users/${A.sel.id}/sponsor`, { months: Number(v) }));
      if (r.status === 401) return toLogin();
      if (!r.ok) { A.err = r.error; break; }
      Object.assign(A.sel, { paidUntil: r.paidUntil, active: true }); A.taja.balanceSen = r.balanceSen;
      toast(`${A.sel.name} ditaja ${v} bulan. Aktif hingga ${fmtDate(r.paidUntil)}.`);
      loadUsers();
      break;
    }
    case 'donorStop': {
      const r = await busy(el, () => api('POST', `/api/admin/donors/${v}/stop`, {}));
      if (r.status === 401) return toLogin();
      if (!r.ok) { toast(r.error); return; }
      toast('Sumbangan bulanan dihentikan.'); loadDon(); return;
    }
    case 'modal': A.modal = v; A.err = ''; break;
    case 'loadLog': loadLog(false); return;
    case 'moreLog': loadLog(true); return;
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
    case 'audNew': A.editAud = null; forget(...AUD_IDS); A.err = ''; A.modal = 'aud'; break;
    case 'audEdit': A.editAud = A.auds.find(x => String(x.id) === v); forget(...AUD_IDS); A.err = ''; A.modal = 'aud'; break;
    case 'audPub': {
      const d = A.auds.find(x => String(x.id) === v);
      const r = await busy(el, () => api('POST', `/api/admin/audios/${v}`, { published: !d.published }));
      if (r.status === 401) return toLogin();
      if (!r.ok) { toast(r.error); return; }
      A.auds = A.auds.map(x => x.id === d.id ? r.audio : x); toast(r.audio.published ? 'Audio diterbitkan. Pelajar boleh dengar.' : 'Audio disembunyikan.');
      break;
    }
    case 'audDel': A.delAud = A.auds.find(x => String(x.id) === v); A.modal = 'auddel'; break;
    case 'audDelGo': {
      const r = await busy(el, () => api('POST', `/api/admin/audios/${A.delAud.id}/delete`, {}));
      if (!r.ok) { toast(r.error); return; }
      A.auds = A.auds.filter(x => x.id !== A.delAud.id); A.modal = null; toast('Audio dipadam.');
      break;
    }
    case 'doaNew': A.editDoa = null; forget(...DOA_IDS, 'dPub'); A.err = ''; A.modal = 'doa'; break;
    case 'doaEdit': A.editDoa = A.doas.find(x => String(x.id) === v); forget(...DOA_IDS, 'dPub'); A.err = ''; A.modal = 'doa'; break;
    case 'doaPub': {
      const d = A.doas.find(x => String(x.id) === v);
      const r = await busy(el, () => api('POST', `/api/admin/doas/${v}`, { published: !d.published }));
      if (r.status === 401) return toLogin();
      if (!r.ok) { toast(r.error); return; }
      A.doas = A.doas.map(x => x.id === d.id ? r.doa : x); toast(r.doa.published ? 'Doa diterbitkan.' : 'Doa disembunyikan.');
      break;
    }
    case 'doaDel': A.delDoa = A.doas.find(x => String(x.id) === v); A.modal = 'doadel'; break;
    case 'doaDelGo': {
      const r = await busy(el, () => api('POST', `/api/admin/doas/${A.delDoa.id}/delete`, {}));
      if (!r.ok) { toast(r.error); return; }
      A.doas = A.doas.filter(x => x.id !== A.delDoa.id); A.modal = null; toast('Doa dipadam.');
      break;
    }
    case 'catNew': A.editCat = null; forget('cName', 'cNameEn'); A.err = ''; A.modal = 'cat'; break;
    case 'catEdit': A.editCat = A.vmeta.categories.find(x => String(x.id) === v); forget('cName', 'cNameEn'); A.err = ''; A.modal = 'cat'; break;
    case 'catMove': {
      const r = await busy(el, () => api('POST', `/api/admin/video-categories/${v}/move`, { dir: Number(el.dataset.dir) }));
      if (r.status === 401) return toLogin();
      if (!r.ok) { toast(r.error); return; }
      A.vmeta.categories = r.categories; break;
    }
    case 'catDel': {
      const r = await busy(el, () => api('POST', `/api/admin/video-categories/${v}/delete`, {}));
      if (!r.ok) { toast(r.error); return; }
      A.vmeta.categories = r.categories; A.videos = A.videos.map(x => String(x.categoryId) === v ? { ...x, categoryId: null } : x);
      A.modal = null; toast('Kategori dipadam. Videonya kekal tanpa kategori.'); break;
    }
    case 'vEdit': A.editVideo = A.videos.find(x => String(x.id) === v); forget('eTitle', 'eCat', 'eTopic', 'eArabic', 'eMonth', 'eChap'); A.err = ''; A.modal = 'vedit'; break;
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
    const r = await busy(btn, () => api('POST', '/api/admin/videos/import', { guid: A.imp.guid, title: val('iTitle'), categoryId: val('iCat'), topic: val('iTopic'), arabicLabel: val('iArabic'), classMonth: val('iMonth') }));
    if (!r.ok) { A.err = r.error; render(); return; }
    forget('iTitle', 'iArabic');
    A.bunnyItems = A.bunnyItems.filter(b => b.guid !== A.imp.guid); A.modal = null; A.err = '';
    A.videos.unshift(r.video);
    toast(r.video.ready ? 'Video diimport. Tekan Terbitkan bila sedia.' : 'Video diimport. Bunny masih memproses, terbitkan bila status Sedia.');
  }
  if (f.id === 'fAud') {
    const raw = id => document.getElementById(id)?.value || '';
    const body = { title: val('zTitle'), titleEn: val('zTitleEn'), arabic: raw('zArabic').trim(), rumi: raw('zRumi').trim(),
      meaning: raw('zMeaning').trim(), meaningEn: raw('zMeaningEn').trim(), source: val('zSource') };
    if (val('zSort') !== '') body.sort = Number(val('zSort'));
    const id = A.editAud && A.editAud.id;
    const r = await busy(btn, () => api('POST', id ? `/api/admin/audios/${id}` : '/api/admin/audios', body));
    if (r.status === 401) return toLogin();
    if (!r.ok) { A.err = r.error; render(); return; }
    forget(...AUD_IDS); A.modal = null; A.err = '';
    toast(id ? 'Teks dikemas kini.' : 'Audio ditambah. Sekarang muat naik fail rakaman.');
    loadAuds(); return;
  }
  if (f.id === 'fDoa') {
    const raw = id => document.getElementById(id)?.value || '';
    const body = { category: val('dCat'), title: val('dTitle'), titleEn: val('dTitleEn'), arabic: raw('dArabic').trim(), rumi: raw('dRumi').trim(),
      meaning: raw('dMeaning').trim(), meaningEn: raw('dMeaningEn').trim(), source: val('dSource'), published: document.getElementById('dPub').checked };
    if (val('dSort') !== '') body.sort = Number(val('dSort'));
    const id = A.editDoa && A.editDoa.id;
    const r = await busy(btn, () => api('POST', id ? `/api/admin/doas/${id}` : '/api/admin/doas', body));
    if (r.status === 401) return toLogin();
    if (!r.ok) { A.err = r.error; render(); return; }
    forget(...DOA_IDS, 'dPub'); A.modal = null; A.err = '';
    toast(id ? 'Doa dikemas kini.' : 'Doa ditambah.');
    loadDoas(); return;
  }
  if (f.id === 'fCat') {
    const id = A.editCat && A.editCat.id;
    const r = await busy(btn, () => api('POST', id ? `/api/admin/video-categories/${id}` : '/api/admin/video-categories', { name: val('cName'), nameEn: val('cNameEn') }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { A.err = r.error; render(); return; }
    forget('cName', 'cNameEn'); A.vmeta.categories = r.categories; A.modal = null; A.err = '';
    toast(id ? 'Kategori dikemas kini.' : 'Kategori ditambah.');
  }
  if (f.id === 'fVEdit') {
    const id = A.editVideo.id;
    const r = await busy(btn, () => api('POST', `/api/admin/videos/${id}`, { title: val('eTitle'), categoryId: val('eCat'), topic: val('eTopic'), arabicLabel: val('eArabic'), classMonth: val('eMonth'), chapters: val('eChap') }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { A.err = r.error; render(); return; }
    forget('eTitle', 'eCat', 'eTopic', 'eArabic', 'eMonth', 'eChap');
    A.videos = A.videos.map(x => x.id === id ? r.video : x); A.modal = null; A.err = '';
    toast('Video dikemas kini.');
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
  if (f.id === 'fPlans') {
    const plans = A.plans.map(p => ({
      id: p.id,
      active: document.getElementById(`pl-${p.id}-on`).checked,
      label: val(`pl-${p.id}-label`),
      priceSen: Math.round(parseFloat(val(`pl-${p.id}-price`).replace(/[^\d.]/g, '')) * 100),
    }));
    const r = await busy(btn, () => api('POST', '/api/admin/plans', { plans }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { toast(r.error); return; }
    A.plans = r.plans; forget(...r.plans.flatMap(p => [`pl-${p.id}-label`, `pl-${p.id}-price`]));
    toast('Pakej disimpan.');
  }
  if (f.id === 'fOrg') {
    const r = await busy(btn, () => api('POST', '/api/admin/settings', { name: val('oName'), reg: val('oReg'), email: val('oEmail'), whatsapp: val('oWa'), address: document.getElementById('oAddr').value, playUrl: val('oPlay'), appStoreUrl: val('oIos') }));
    if (r.status === 401) return toLogin();
    if (!r.ok) { toast(r.error); return; }
    A.org = r.org; A.links = r.links; forget('oName', 'oReg', 'oEmail', 'oWa', 'oAddr', 'oPlay', 'oIos');
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
