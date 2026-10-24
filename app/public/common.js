// Fungsi dikongsi app pelajar dan panel admin.
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 4.1L20 7l-.9 5 .9 5-5.1.9L12 22l-2.9-4.1L4 17l.9-5L4 7l5.1-.9z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="width:1.2em;height:1.2em;flex:none"><circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" fill="currentColor"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-.12em"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/></svg>',
};

const pattern = id => `<svg class="pat" aria-hidden="true"><defs><pattern id="${id}" width="44" height="44" patternUnits="userSpaceOnUse"><g fill="none" stroke-width="1.1"><rect x="12" y="12" width="20" height="20"/><rect x="12" y="12" width="20" height="20" transform="rotate(45 22 22)"/><circle cx="22" cy="22" r="3.5"/><path d="M0 0l7.5 7.5M44 0l-7.5 7.5M0 44l7.5-7.5M44 44l-7.5-7.5"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`;
const orn = () => `<div class="orn" aria-hidden="true">${I.star}</div>`;

// ---------- versi store (Google Play / App Store) ----------
// Apps store dilancarkan dengan /?store=play atau /?store=ios (atau Capacitor iOS).
// Dalam versi store: tiada sumbangan & tiada bayaran CHIP (polisi Google/Apple) — guna bayaran store.
const STORE = (() => {
  try {
    const q = new URLSearchParams(location.search).get('store');
    if (q === 'play' || q === 'ios') sessionStorage.setItem('mo-store', q);
    const saved = sessionStorage.getItem('mo-store');
    if (saved) return saved;
    if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios') return 'ios';
    if (document.referrer.startsWith('android-app://')) { sessionStorage.setItem('mo-store', 'play'); return 'play'; }
  } catch {}
  return '';
})();

// ---------- bahasa (BM / EN) ----------
// Teks asal dalam BM menjadi kunci; terjemahan EN dalam /i18n-en.js (window.EN_DICT).
// Panel admin sentiasa BM (admin.js tetapkan LANG = 'ms').
let LANG = (() => { try { return localStorage.getItem('mo-lang') === 'en' ? 'en' : 'ms'; } catch { return 'ms'; } })();
function t(s, vars) {
  let out = LANG === 'en' && window.EN_DICT && window.EN_DICT[s] != null ? window.EN_DICT[s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}
// Mesej ralat dari server (BM) → EN jika ada terjemahan
function tErr(s) {
  if (LANG !== 'en' || !s) return s;
  if (window.EN_DICT && window.EN_DICT[s] != null) return window.EN_DICT[s];
  for (const [re, fn] of (window.EN_PATTERNS || [])) { const m = s.match(re); if (m) return fn(m); }
  return s;
}
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ms';
  try { localStorage.setItem('mo-lang', LANG); } catch {}
  document.documentElement.lang = LANG;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BLN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const BLN_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = i => (LANG === 'en' ? BLN_EN : BLN)[i];
const fmtDate = ms => { const d = new Date(ms); return d.getDate() + ' ' + monthName(d.getMonth()) + ' ' + d.getFullYear(); };
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const HARI_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayName = i => (LANG === 'en' ? HARI_EN : HARI)[i];
// BM: 9.00 malam, 10.30 pagi · EN: 9:00 pm
const fmtTime = ms => { const d = new Date(ms), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  if (LANG === 'en') return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam';
  return `${h % 12 || 12}.${m} ${part}`; };
const fmtClass = ms => `${dayName(new Date(ms).getDay())}, ${fmtDate(ms)} · ${fmtTime(ms)}`;
// "Lagi 3 hari", "Lagi 2 jam 15 minit", "Sedang berlangsung"
function countdown(ms, nowMs = Date.now()) {
  const en = LANG === 'en';
  const diff = ms - nowMs;
  if (diff <= 0) return en ? 'In progress' : 'Sedang berlangsung';
  const min = Math.ceil(diff / 6e4);
  if (min < 60) return en ? `In ${min} min` : `Lagi ${min} minit`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return en ? `In ${h} hr${m ? ' ' + m + ' min' : ''}` : `Lagi ${h} jam${m ? ' ' + m + ' minit' : ''}`;
  const sameDayTomorrow = new Date(nowMs); sameDayTomorrow.setDate(sameDayTomorrow.getDate() + 1);
  if (new Date(ms).toDateString() === sameDayTomorrow.toDateString()) return en ? 'Tomorrow' : 'Esok';
  const days = Math.ceil(diff / 864e5);
  return en ? `In ${days} days` : `Lagi ${days} hari`;
}
const legalLinks = () => { const q = LANG === 'en' ? '?lang=en' : ''; return `<nav class="legal-links" aria-label="${t('Polisi')}"><a href="/terma${q}">${t('Terma')}</a><a href="/privasi${q}">${t('Privasi')}</a><a href="/bayaran-balik${q}">${t('Bayaran Balik')}</a></nav>`; };
const rm = sen => 'RM' + (sen / 100).toLocaleString('en-MY', { minimumFractionDigits: sen % 100 ? 2 : 0, maximumFractionDigits: 2 });

// ---------- tetapan paparan (disimpan dalam pelayar) ----------
const Prefs = {
  get(k, d) { try { return localStorage.getItem('mo-' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mo-' + k, v); } catch {} },
};
function applyPrefs() {
  const theme = Prefs.get('theme', 'light');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('big', Prefs.get('big', '0') === '1');
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', theme === 'dark' ? '#0a1615' : '#ffffff');
}
const isDark = () => Prefs.get('theme', 'light') === 'dark';
const themeBtn = () => `<button class="iconbtn" data-a="theme" aria-label="${isDark() ? t('Tukar ke tema cerah') : t('Tukar ke tema gelap')}">${isDark() ? I.sun : I.moon}</button>`;
// Butang tukar bahasa (tunjuk bahasa yang satu lagi)
const langBtn = () => `<button class="iconbtn" data-a="lang" data-v="${LANG === 'en' ? 'ms' : 'en'}" lang="${LANG === 'en' ? 'ms' : 'en'}" aria-label="${LANG === 'en' ? 'Tukar ke Bahasa Melayu' : 'Switch to English'}">${LANG === 'en' ? 'BM' : 'EN'}</button>`;
function toggleTheme() { Prefs.set('theme', isDark() ? 'light' : 'dark'); applyPrefs(); }

// ---------- notis ringkas ----------
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- panggilan API ----------
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: t('Tiada sambungan internet. Semak talian dan cuba lagi.') };
  }
  let data = {};
  try { data = await r.json(); } catch {}
  return { ...data, ok: r.ok && data.ok !== false, status: r.status, error: data.error ? tErr(data.error) : (r.ok ? null : t('Ralat sistem. Sila cuba lagi.')), message: data.message ? tErr(data.message) : data.message };
}

// Butang sibuk semasa menunggu
async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = t('Sila tunggu...'); }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } }
}

// ---------- pasang app ----------
let installEvt = null;
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (window.render) window.render(); });
function installCard() {
  if (STORE || isStandalone()) return '';
  if (installEvt) return `<button class="btn btn-ghost" data-a="install">${I.home} ${t('Pasang app di telefon')}</button>`;
  if (isIOS()) return `<p class="note">${t('Untuk pasang di iPhone: tekan butang Share di Safari, kemudian pilih <b>Add to Home Screen</b>.')}</p>`;
  return '';
}
function doInstall() {
  if (!installEvt) return;
  installEvt.prompt();
  installEvt.userChoice.finally(() => { installEvt = null; if (window.render) window.render(); });
}

// Simpan isian borang supaya tak hilang bila skrin dilukis semula (contoh selepas ralat).
// Kata laluan dan PIN tidak disimpan.
const keep = {};
document.addEventListener('input', e => { if (e.target.id && e.target.type !== 'password' && e.target.type !== 'file') keep[e.target.id] = e.target.value; });
function restoreInputs() {
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && el.type !== 'file' && !el.value) try { el.value = v; } catch {} }
}
const forget = (...ids) => ids.forEach(id => delete keep[id]);

// Baca nilai borang dengan selamat
const val = id => (document.getElementById(id)?.value || '').trim();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
applyPrefs();
document.documentElement.lang = LANG;
