// Halaman sumbangan awam (tanpa login): /sumbang
const D = {
  view: 'loading', info: null, err: '',
  f: { use: 'taja', monthly: false, amount: null, anonymous: false },
  result: null, manage: null, manageToken: null, payId: null, accessToken: null,
};
const app = document.getElementById('app');

const USE_LABEL = { taja: 'Taja Pelajar', umum: 'Sumbangan Am' };
function presets() {
  const P = D.info ? D.info.monthPriceSen : 1000;
  return D.f.use === 'taja'
    ? [[P, '1 bulan'], [P * 3, '3 bulan'], [P * 6, '6 bulan'], [P * 12, 'Setahun']]
    : [[1000, ''], [2000, ''], [5000, ''], [10000, '']];
}
const amountSen = () => {
  const custom = val('dAmt');
  if (custom) return Math.round(parseFloat(custom.replace(/[^\d.]/g, '')) * 100) || 0;
  return D.f.amount || presets()[0][0];
};

function tajaText(amt) {
  const P = D.info ? D.info.monthPriceSen : 1000;
  if (D.f.use !== 'taja' || amt < P) return '';
  const m = Math.floor(amt / P);
  const span = m % 12 === 0 ? (m === 12 ? 'setahun' : m / 12 + ' tahun') : m + ' bulan';
  return `${rm(amt)} menaja seorang pelajar selama ${span}${D.f.monthly ? ', setiap bulan' : ''}.`;
}
const goLabel = amt => `Sumbang ${amt >= 500 ? rm(amt) : ''}${D.f.monthly ? ' sebulan' : ''}`;
// Kemas kini butang & nota tanpa melukis semula skrin (papan kekunci telefon tak tertutup)
function amountUI() {
  const amt = amountSen();
  const b = document.getElementById('dGo'); if (b) b.textContent = goLabel(amt);
  const n = document.getElementById('dNote'); if (n) n.textContent = tajaText(amt);
  document.querySelectorAll('[data-a=amt]').forEach(c => c.classList.toggle('on', !val('dAmt') && Number(c.dataset.v) === D.f.amount));
}

function header() {
  return `<div class="toolbar"><a href="/" aria-label="Madrasah Online" style="margin-right:auto"><img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608"></a>${themeBtn()}</div>`;
}

function vForm() {
  const I0 = D.info;
  if (!I0.ready) return `${header()}
    <div class="hero">${pattern('patD')}<p class="bism">بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p><h1>Sumbang untuk Madrasah Online</h1>${orn()}</div>
    <div class="card empty">${I.star}<h2 style="font-size:1.15rem">Saluran sumbangan akan dibuka tidak lama lagi</h2><p class="muted">Insya-Allah. Terima kasih atas niat baik anda.</p></div>
    ${legalLinks()}`;
  const P = I0.monthPriceSen, f = D.f, pre = presets();
  if (!f.amount || !pre.some(p => p[0] === f.amount)) f.amount = pre[f.use === 'taja' ? 0 : 1][0];
  const amt = amountSen();
  return `${header()}
    <div class="hero">${pattern('patD')}
      <p class="bism">بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
      <h1>Sumbang untuk Madrasah Online</h1>
      <p class="muted">Bantu lebih ramai orang dewasa belajar membaca al-Quran.</p>
      ${orn()}
    </div>
    ${I0.stats.tajaMonths || I0.stats.donors ? `<div class="card"><div class="donstats">
      <div><b>${I0.stats.studentsSponsored}</b><span>pelajar telah ditaja</span></div>
      <div><b>${I0.stats.donors}</b><span>penyumbang</span></div>
    </div></div>` : ''}
    <form id="fDonate" class="card" novalidate>
      <span class="eyebrow">1. Tujuan</span>
      <div class="vlist" role="radiogroup" aria-label="Tujuan">
        <button type="button" class="opt ${f.use === 'taja' ? 'on' : ''}" role="radio" aria-checked="${f.use === 'taja'}" data-a="use" data-v="taja"><b>Taja pelajar</b><span>Bantu pelajar yang kurang mampu. ${rm(P)} menaja seorang pelajar selama sebulan.</span></button>
        <button type="button" class="opt ${f.use === 'umum' ? 'on' : ''}" role="radio" aria-checked="${f.use === 'umum'}" data-a="use" data-v="umum"><b>Sumbangan am</b><span>Untuk kos kelas, rakaman video dan sistem Madrasah Online.</span></button>
      </div>
      <span class="eyebrow">2. Kekerapan</span>
      <div class="kind-row" role="radiogroup" aria-label="Kekerapan">
        <button type="button" class="opt ${f.monthly ? '' : 'on'}" role="radio" aria-checked="${!f.monthly}" data-a="freq" data-v="0"><b>Sekali</b><span>FPX, DuitNow QR, kad atau e-wallet</span></button>
        <button type="button" class="opt ${f.monthly ? 'on' : ''}" role="radio" aria-checked="${f.monthly}" data-a="freq" data-v="1"><b>Setiap bulan</b><span>Kad sahaja. Boleh berhenti bila-bila masa</span></button>
      </div>
      <span class="eyebrow">3. Jumlah</span>
      <div class="filter-row">${pre.map(([sen, lbl]) => `<button type="button" class="chip ${!val('dAmt') && f.amount === sen ? 'on' : ''}" data-a="amt" data-v="${sen}">${rm(sen)}${lbl ? ' · ' + lbl : ''}</button>`).join('')}</div>
      <label class="f" for="dAmt">Atau jumlah lain (RM)<input class="input" id="dAmt" inputmode="decimal" placeholder="Contoh: 25"></label>
      <p class="small"><b id="dNote">${esc(tajaText(amt))}</b></p>
      <span class="eyebrow">4. Maklumat anda</span>
      <label class="f" for="dName">Nama<input class="input" id="dName" autocomplete="name" maxlength="80"></label>
      <label class="check" for="dAnon"><input type="checkbox" id="dAnon" ${f.anonymous ? 'checked' : ''}><span>Jangan paparkan nama saya<br><span class="muted small" style="font-weight:400">Dipaparkan sebagai "Hamba Allah".</span></span></label>
      <label class="f" for="dEmail">Emel (untuk resit)<input class="input" id="dEmail" type="email" inputmode="email" autocomplete="email"></label>
      <label class="f" for="dPhone">No. telefon <span class="muted small">(pilihan)</span><input class="input" id="dPhone" inputmode="tel" autocomplete="tel" placeholder="Contoh: 012-345 6789"></label>
      <label class="f" for="dMsg">Mesej atau doa <span class="muted small">(pilihan)</span><textarea class="input" id="dMsg" rows="3" maxlength="300"></textarea></label>
      ${D.err ? `<div class="err" role="alert">${esc(D.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit" id="dGo">${goLabel(amt)}</button>
      <p class="note">Bayaran diproses dengan selamat oleh CHIP, gerbang pembayaran berdaftar dengan Bank Negara Malaysia. Rekod sumbangan diasingkan daripada yuran langganan. Sumbangan ini tidak layak untuk potongan cukai.</p>
    </form>
    ${I0.recent.length ? `<div class="card"><span class="eyebrow">Penyumbang terkini</span><div class="rows">${I0.recent.map(r => `<div class="row"><div><b>${esc(r.name)}</b><p class="muted small">${USE_LABEL[r.use] || ''}</p></div><span class="muted small">${fmtDate(r.at)}</span></div>`).join('')}</div>
      <p class="muted small">Jazakumullahu khairan kepada semua penyumbang.</p></div>` : ''}
    ${legalLinks()}`;
}

function vThanks() {
  const R = D.result;
  if (!R || R.state === 'checking') return `${header()}<div class="card"><h1 style="font-size:1.4rem">Menyemak sumbangan...</h1><div class="loading">Sila tunggu sebentar</div></div>`;
  if (R.state === 'failed') return `${header()}<div class="card"><h1 style="font-size:1.4rem">Sumbangan tidak berjaya</h1>
    <p>Tiada caj dibuat. Sila cuba lagi, atau pilih cara bayaran lain.</p><button class="btn btn-primary" data-a="again">Cuba lagi</button></div>`;
  const link = D.manageToken ? `${location.origin}/sumbang?urus=${D.manageToken}` : '';
  return `${header()}
    <div class="card thanks">${I.star}
      <h1 style="font-size:1.6rem">${R.state === 'completed' ? 'Jazakallahu khairan' : 'Sumbangan sedang disahkan'}</h1>
      ${R.state === 'completed'
        ? `<p>Sumbangan <b>${rm(R.amountSen)}</b>${R.monthly ? ' setiap bulan' : ''} untuk <b>${USE_LABEL[R.use]}</b> telah diterima. Semoga Allah membalas kebaikan anda.</p><p class="muted small">Resit telah dihantar ke emel anda.</p>`
        : '<p>Bank masih memproses bayaran anda. Rekod akan dikemas kini secara automatik dalam beberapa minit.</p>'}
    </div>
    ${R.monthly && link ? `<div class="card">
      <span class="eyebrow">Urus sumbangan bulanan</span>
      <p class="small">Simpan pautan ini. Gunakannya jika anda mahu menghentikan sumbangan bulanan pada bila-bila masa.</p>
      <input class="input" id="manageLink" value="${esc(link)}" readonly>
      <button class="btn btn-ghost" data-a="copy">Salin pautan</button>
    </div>` : ''}
    <a class="btn btn-line" href="/sumbang">Kembali ke halaman sumbangan</a>
    ${legalLinks()}`;
}

function vManage() {
  const M = D.manage;
  if (!M) return `${header()}<div class="loading">Memuatkan...</div>`;
  if (M.error) return `${header()}<div class="card"><h1 style="font-size:1.4rem">Pautan tidak sah</h1><p>Pautan urus sumbangan ini tidak dijumpai. Sila hubungi admin Madrasah Online.</p></div>${legalLinks()}`;
  const d = M.donor;
  return `${header()}
    <div class="card">
      <span class="eyebrow">Sumbangan bulanan anda</span>
      <h1 style="font-size:1.4rem">${rm(d.amountSen)} sebulan</h1>
      <p>${USE_LABEL[d.use]} · atas nama <b>${esc(d.name || 'Hamba Allah')}</b></p>
      ${d.active ? `<p class="small">Caj seterusnya: <b>${d.nextChargeAt ? fmtDate(d.nextChargeAt) : '-'}</b></p>
        ${D.confirmStop ? `<div class="confirm"><p><b>Hentikan sumbangan bulanan?</b> Kad anda tidak akan dicaj lagi.</p>
          <button class="btn btn-primary" data-a="stopGo" style="background:var(--danger)">Ya, hentikan</button>
          <button class="btn btn-ghost" data-a="stopCancel">Batal</button></div>`
        : '<button class="btn btn-ghost" data-a="stop">Hentikan sumbangan bulanan</button>'}`
      : `<div class="ok-box">Sumbangan bulanan ini sudah dihentikan${d.stoppedAt ? ' pada ' + fmtDate(d.stoppedAt) : ''}.</div>`}
    </div>
    <p class="muted small" style="text-align:center">Jazakallahu khairan atas sumbangan anda selama ini.</p>
    ${legalLinks()}`;
}

function render() {
  const body = D.view === 'loading' ? `${header()}<div class="loading">Memuatkan...</div>`
    : D.view === 'thanks' ? vThanks() : D.view === 'manage' ? vManage() : vForm();
  app.innerHTML = `<div class="shell" style="padding-bottom:48px">${body}</div>`;
  restoreInputs();
}
window.render = render;

async function checkResult() {
  D.view = 'thanks'; D.result = { state: 'checking' }; render();
  let r;
  for (let i = 0; i < 4; i++) {
    r = await api('POST', '/api/donate/confirm', { id: D.payId, token: D.accessToken });
    if (!r.ok || r.payStatus !== 'pending') break;
    await new Promise(ok => setTimeout(ok, 2500));
  }
  D.result = r.ok ? { state: r.payStatus === 'completed' ? 'completed' : r.payStatus === 'pending' ? 'pending' : 'failed', amountSen: r.amountSen, use: r.use, monthly: r.monthly } : { state: 'failed' };
  render();
}

async function loadManage() {
  D.view = 'manage'; render();
  const r = await api('GET', '/api/donate/manage?token=' + encodeURIComponent(D.manageToken));
  D.manage = r.ok ? r : { error: true };
  render();
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, v = el.dataset.v;
  switch (a) {
    case 'theme': toggleTheme(); break;
    case 'use': D.f.use = v; D.f.amount = null; forget('dAmt'); D.err = ''; break;
    case 'freq': D.f.monthly = v === '1'; D.err = ''; break;
    case 'amt': D.f.amount = Number(v); forget('dAmt'); { const x = document.getElementById('dAmt'); if (x) x.value = ''; } break;
    case 'again': history.replaceState(null, '', '/sumbang'); D.view = 'form'; D.err = ''; break;
    case 'copy': {
      const inp = document.getElementById('manageLink');
      try { await navigator.clipboard.writeText(inp.value); toast('Pautan disalin.'); } catch { inp.select(); toast('Tekan lama dan pilih Copy.'); }
      return;
    }
    case 'stop': D.confirmStop = true; break;
    case 'stopCancel': D.confirmStop = false; break;
    case 'stopGo': {
      const r = await busy(el, () => api('POST', '/api/donate/stop', { token: D.manageToken }));
      if (!r.ok) { toast(r.error); return; }
      D.confirmStop = false; D.manage.donor.active = false; D.manage.donor.stoppedAt = Date.now();
      toast('Sumbangan bulanan dihentikan.');
      break;
    }
    default: return;
  }
  render();
});

// Kemas kini butang & nota jumlah bila menaip jumlah sendiri / tanda tanpa nama
document.addEventListener('input', e => {
  if (e.target.id === 'dAmt') amountUI();
  if (e.target.id === 'dAnon') D.f.anonymous = e.target.checked;
});
document.addEventListener('change', e => { if (e.target.id === 'dAnon') D.f.anonymous = e.target.checked; });

document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id !== 'fDonate') return;
  const btn = e.target.querySelector('button[type="submit"]');
  const body = {
    use: D.f.use, monthly: D.f.monthly, amountSen: amountSen(),
    name: val('dName'), anonymous: document.getElementById('dAnon').checked,
    email: val('dEmail'), phone: val('dPhone'), message: document.getElementById('dMsg').value,
  };
  const r = await busy(btn, () => api('POST', '/api/donate/checkout', body));
  if (!r.ok) { D.err = r.error; render(); return; }
  btn.disabled = true; btn.textContent = 'Membuka halaman bayaran...';
  location.href = r.checkoutUrl;
});

(async function start() {
  const q = new URLSearchParams(location.search);
  D.manageToken = q.get('urus');
  D.payId = Number(q.get('d')) || null;
  D.accessToken = q.get('k');
  const status = q.get('status');
  if (status === 'berjaya' && D.payId && D.accessToken) { checkResult(); return; }
  if (status === 'gagal') { D.view = 'thanks'; D.result = { state: 'failed' }; render(); return; }
  if (D.manageToken && !status) { loadManage(); return; }
  const r = await api('GET', '/api/donate/info');
  D.info = r.ok ? r : { ready: false, stats: {}, recent: [], monthPriceSen: 1000 };
  D.view = 'form'; render();
  if (status === 'batal') toast('Sumbangan dibatalkan. Tiada caj dibuat.');
})();
