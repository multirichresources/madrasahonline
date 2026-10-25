// Service worker: simpan fail app untuk buka pantas, dan papar notifikasi peringatan.
// API tidak pernah disimpan.
const CACHE = 'madrasah-app-v24';
const STATE = 'mo-push-state'; // id notifikasi terakhir yang dipaparkan di peranti ini
const SHELL = ['/', '/admin', '/app.css', '/common.js', '/pelajar.js', '/admin.js', '/tus.min.js', '/i18n-en.js', '/sumbang', '/sumbang.js', '/logo.png', '/icon-192.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== STATE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});

// ---------- notifikasi ----------
// Server hanya hantar "ping" kosong. Mesej sebenar diambil dari /api/push/inbox.
async function readState() {
  try { const r = await (await caches.open(STATE)).match('/__push-state'); return r ? await r.json() : { lastId: 0, last: null }; }
  catch { return { lastId: 0, last: null }; }
}
async function writeState(st) {
  try { await (await caches.open(STATE)).put('/__push-state', new Response(JSON.stringify(st), { headers: { 'content-type': 'application/json' } })); } catch {}
}
const show = n => self.registration.showNotification(n.title, {
  body: n.body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'mo-' + n.id, data: { url: n.url || '/' }, lang: 'ms',
});

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    const st = await readState();
    let items = [];
    try {
      const r = await fetch('/api/push/inbox?since=' + (st.lastId || 0), { credentials: 'include', cache: 'no-store' });
      if (r.ok) items = (await r.json()).items || [];
    } catch {}
    if (items.length) {
      for (const n of items) await show(n);
      const last = items[items.length - 1];
      await writeState({ lastId: Math.max(st.lastId || 0, ...items.map(n => n.id)), last });
      return;
    }
    // Tiada mesej baharu (sudah dipapar, atau tidak log masuk): papar semula yang terakhir tanpa bunyi,
    // kerana pelayar wajibkan notifikasi untuk setiap ping.
    if (st.last) return show(st.last);
    return self.registration.showNotification('Madrasah Online', { body: 'Ada makluman baharu. Tekan untuk buka app.', icon: '/icon-192.png', tag: 'mo-umum', data: { url: '/' } });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = wins.find(c => { const u = new URL(c.url); return u.origin === self.location.origin && !u.pathname.startsWith('/admin'); });
    if (app) {
      await app.focus();
      if ('navigate' in app) { try { await app.navigate(url); } catch {} }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
