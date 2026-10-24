// Padam akaun dari laman web, tanpa membuka apps (syarat Google Play).
const P = { done: false, err: '', org: {} };
const app = document.getElementById('app');
const qLang = new URLSearchParams(location.search).get('lang');
if (qLang === 'en' || qLang === 'ms') setLang(qLang);

function render() {
  const o = P.org || {};
  const contact = [o.whatsapp ? `<a href="https://wa.me/${esc(o.whatsapp)}" target="_blank" rel="noopener">WhatsApp 0${esc(o.whatsapp.slice(2))}</a>` : '', o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : ''].filter(Boolean).join(' / ');
  app.innerHTML = `<div class="shell legal" style="padding-bottom:48px">
    <div class="top"><a class="iconbtn" href="/">${I.back} ${t('Ke app')}</a>${langBtn()}</div>
    <article class="card">
      <h1>${t('Padam akaun')}</h1>
      ${P.done ? `<div class="ok-box">${t('Akaun anda telah dipadam. Terima kasih kerana belajar bersama kami.')}</div>` : `
      <p>${t('Gunakan borang ini untuk memadam akaun Madrasah Online anda tanpa membuka apps. Anda juga boleh memadam akaun dalam apps di menu <b>Akaun → Padam akaun saya</b>.')}</p>
      <p><b>${t('Yang dipadam serta-merta:')}</b> ${t('nama, no. telefon, emel, PIN, progres tontonan, soalan anda, langganan notifikasi dan sesi log masuk. Auto-renew kad juga dihentikan.')}</p>
      <p><b>${t('Yang disimpan:')}</b> ${t('rekod transaksi bayaran disimpan sehingga 7 tahun untuk tujuan perakaunan dan cukai, tanpa dikaitkan lagi dengan anda.')}</p>
      <p>${t('Langganan yang masih berbaki <b>tidak boleh dipulangkan</b> dan tindakan ini <b>tidak boleh dibatalkan</b>.')}</p>
      <form id="fDel" novalidate style="display:flex;flex-direction:column;gap:.8rem">
        <label class="f" for="dPhone">${t('No. telefon berdaftar')}<input class="input" id="dPhone" inputmode="tel" autocomplete="tel" placeholder="012-345 6789"></label>
        <label class="f" for="dPin">${t('PIN 6 angka')}<input class="input pin-input" id="dPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
        <label class="f" for="dConfirm">${t('Taip PADAM untuk sahkan')}<input class="input" id="dConfirm" autocapitalize="characters" autocomplete="off"></label>
        ${P.err ? `<div class="err" role="alert">${esc(P.err)}</div>` : ''}
        <button class="btn btn-primary" type="submit" style="background:var(--danger)">${t('Padam akaun saya')}</button>
      </form>
      <p class="muted small">${t('Lupa PIN? Hubungi admin untuk minta akaun dipadam:')} ${contact || t('melalui group WhatsApp kelas.')}</p>`}
    </article>
    ${legalLinks()}
  </div>`;
  restoreInputs();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (el && el.dataset.a === 'lang') { setLang(el.dataset.v); render(); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'fDel') return;
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const r = await busy(btn, () => api('POST', '/api/account/delete', {
    phone: val('dPhone'), pin: document.getElementById('dPin').value, confirm: val('dConfirm').toUpperCase(),
  }));
  if (r.ok) { P.done = true; P.err = ''; forget('dPhone', 'dConfirm'); }
  else P.err = r.error;
  render();
});

render();
api('GET', '/api/config').then(c => { if (c.ok) { P.org = c.org || {}; render(); } });
