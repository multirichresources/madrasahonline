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

  // ---------- Jelajah Madrasah Online (3D) ----------
  const TOUR = {
    ringkasan: { label: 'Madrasah Online', value: 'Kelas mengaji', sub: 'untuk orang dewasa', tag: 'Madrasah Online',
      title: 'Kelas Al-Quran untuk orang dewasa', text: 'Belajar mengaji dari rumah bersama ustaz, ikut masa anda dan tanpa rasa malu. Dari kenal huruf hingga bacaan lancar.' },
    video: { label: 'Bilik kelas', value: 'Video ustaz', sub: 'tonton & ulang', tag: 'Bilik kelas',
      title: 'Video kelas ustaz', text: 'Rakaman kelas makhraj, tajwid dan bacaan. Ada bab untuk terus ke bahagian tertentu, butang ulang 10 saat dan kelajuan perlahan 0.75x.' },
    hebahan: { label: 'Papan hebahan', value: 'Kelas Zoom', sub: 'setiap bulan', tag: 'Papan hebahan',
      title: 'Kelas Zoom bulanan', text: 'Belajar bersama ustaz secara langsung. Peringatan dihantar ke telefon sehari dan 30 minit sebelum kelas.' },
    soalan: { label: 'Peti soalan', value: 'Tanya ustaz', sub: 'bila-bila masa', tag: 'Peti soalan',
      title: 'Tanya ustaz', text: 'Tulis soalan tentang bacaan, tajwid atau makhraj bila-bila masa. Anda dimaklumkan bila ustaz menjawab.' },
    pelajar: { label: 'Pusat ibadah', value: 'Waktu solat', sub: 'kiblat · doa · zikir', tag: 'Pusat ibadah',
      title: 'Waktu solat, kiblat, doa & zikir', text: 'Waktu rasmi JAKIM untuk kawasan anda, notifikasi masuk waktu, kompas kiblat, rekod solat, doa harian, zikir dan tasbih. Percuma untuk semua.' },
    sumbangan: { label: 'Tabung', value: 'Taja pelajar', sub: 'sumbangan', tag: 'Tabung',
      title: 'Tabung taja pelajar', text: 'Sumbangan anda membantu pelajar yang kurang mampu untuk terus belajar mengaji.', link: { href: '#sumbang', text: 'Cara menyumbang' } },
  };
  const info = $('tourInfo'), stage = $('tourStage');
  function showZone(id) {
    const z = TOUR[id]; if (!z || !info) return;
    info.innerHTML = `<span class="tour-tag">${esc(z.tag)}</span><h3>${esc(z.title)}</h3><p>${esc(z.text)}</p>${z.link ? `<a class="tour-more" href="${esc(z.link.href)}">${esc(z.link.text)} →</a>` : ''}`;
    document.querySelectorAll('.tour-list button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zone === id)));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.tour-list button');
    if (!b) return;
    showZone(b.dataset.zone);
    if (window.Madrasah3D) window.Madrasah3D.select(b.dataset.zone);
  });
  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  const saveData = navigator.connection && navigator.connection.saveData;
  function start3d() {
    const sc = document.createElement('script'); sc.src = '/m3d.js';
    sc.onload = () => {
      stage.innerHTML = '';
      const ok = window.Madrasah3D.mount(stage, null, { theme: 'site', cards: TOUR, live: false, people: 26, onSelect: showZone,
        hint: 'Seret untuk pusing · tekan bangunan' });
      if (ok) { window.Madrasah3D.select('ringkasan'); stage.classList.add('on'); } else stage.classList.add('off');
    };
    sc.onerror = () => stage.classList.add('off');
    document.head.appendChild(sc);
  }
  if (stage) {
    if (!webgl || saveData) stage.classList.add('off');
    else if ('IntersectionObserver' in window) {
      // muat hanya bila pelawat hampir sampai ke bahagian ini (laman kekal laju untuk iklan)
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); start3d(); } }, { rootMargin: '300px' });
      io.observe(stage);
    } else start3d();
  }

  // Butang kedai yang belum ada pautan: jangan lompat ke atas
  document.addEventListener('click', e => {
    const a = e.target.closest('.store[aria-disabled="true"]');
    if (a) e.preventDefault();
  });
})();
