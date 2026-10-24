// Laman web: isi pakej, pautan apps dan maklumat syarikat dari /api/site.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rm = sen => 'RM' + (sen / 100).toFixed(sen % 100 ? 2 : 0);

  function setAppLinks(base) {
    if (!base) return;
    document.querySelectorAll('.js-app').forEach(a => { a.href = base + (a.dataset.path || '/'); });
  }

  function setStore(id, url) {
    const a = $(id);
    if (!a || !url) return;
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.removeAttribute('aria-disabled');
    $(id + '-sub').textContent = id === 'store-play' ? 'Dapatkan di' : 'Muat turun di';
  }

  function renderPlans(plans) {
    const box = $('plans');
    if (!plans || !plans.length) { box.innerHTML = '<p class="free">Maklumat harga akan dikemas kini tidak lama lagi.</p>'; return; }
    box.innerHTML = plans.map(p => {
      const per = p.months > 1 ? `<span class="per">${rm(Math.round(p.priceSen / p.months))} sebulan</span>` : '';
      return `<div class="plan"><div><b>${esc(p.label)}</b>${per}</div><span class="amt">${rm(p.priceSen)}</span></div>`;
    }).join('') + '<p class="free">Percuma tanpa langganan: waktu solat, kiblat, doa harian, zikir dan tasbih.</p>';
  }

  function renderOrg(o) {
    if (!o) return;
    if (o.name) $('org-name').textContent = o.name;
    if (o.reg) $('org-reg').textContent = ` (${o.reg})`;
    if (o.address) $('org-addr').textContent = o.address;
    const parts = [];
    if (o.whatsapp) parts.push(`<a href="https://wa.me/${esc(o.whatsapp)}" target="_blank" rel="noopener">WhatsApp 0${esc(o.whatsapp.slice(2))}</a>`);
    if (o.email) parts.push(`<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`);
    $('org-contact').innerHTML = parts.join('<br>') || 'Melalui apps, menu Akaun.';
  }

  fetch('/api/site', { headers: { accept: 'application/json' } })
    .then(r => r.json())
    .then(d => {
      if (!d || !d.ok) throw new Error('site');
      setAppLinks(d.appUrl && d.appUrl !== location.origin ? d.appUrl : '');
      renderPlans(d.plans);
      renderOrg(d.org);
      setStore('store-play', d.links && d.links.playUrl);
      setStore('store-ios', d.links && d.links.appStoreUrl);
    })
    .catch(() => { $('plans').innerHTML = '<p class="free">Harga tidak dapat dimuatkan. Muat semula halaman.</p>'; });

  // Butang kedai yang belum ada pautan: jangan lompat ke atas
  document.addEventListener('click', e => {
    const a = e.target.closest('.store[aria-disabled="true"]');
    if (a) e.preventDefault();
  });
})();
