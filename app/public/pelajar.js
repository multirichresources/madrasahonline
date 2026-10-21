// App pelajar Madrasah Online.
// Semua teks dibalut t('…') — teks BM ialah kunci, terjemahan EN dalam /i18n-en.js.
// No. WhatsApp admin & maklumat hubungan datang dari Tetapan admin (/api/config).
const S = {
  view: 'loading', tab: 'utama', user: null, err: '', modal: null,
  cfg: { emailReset: false, org: {} }, reset: { step: 1, phone: '', msg: '' },
  videos: null, continueId: null, filter: '*', playing: null,
  ann: null, kTab: 'pengumuman', qa: null, vqa: null, askVideo: null,
  push: { state: 'unknown' }, plans: null, pay: { plan: null, auto: true }, payResult: null, history: null,
  solat: null, zones: null, sf: null,
};
const app = document.getElementById('app');

// ---------- skrin luar (belum log masuk) ----------
function vLogin() {
  return `<div class="toolbar">${langBtn()}${themeBtn()}</div>
  <div class="login">
    <div class="brand">
      <div class="plate"><img class="logo logo-lg" src="/logo.png" alt="Madrasah Online" width="640" height="608"></div>
      <p class="muted">${t('Kelas mengaji untuk dewasa')}</p>
      ${orn()}
    </div>
    <form id="fLogin" class="card" novalidate>
      <label class="f" for="lPhone">${t('No. telefon')}
        <input class="input" id="lPhone" inputmode="tel" autocomplete="tel" placeholder="${t('Contoh: 012-345 6789')}">
      </label>
      <label class="f" for="lPin">${t('PIN 6 angka')}
        <input class="input pin-input" id="lPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">
      </label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Masuk')}</button>
      <button class="link" type="button" data-a="go" data-v="lupa">${t('Lupa PIN?')}</button>
    </form>
    <button class="btn btn-line" data-a="go" data-v="daftar">${t('Daftar akaun baharu')}</button>
    ${installCard()}
    ${legalLinks()}
  </div>`;
}

const backBar = (to = 'login') => `<div class="top"><button class="iconbtn" data-a="go" data-v="${to}">${I.back} ${t('Kembali')}</button><div class="btn-row" style="flex:none">${langBtn()}${themeBtn()}</div></div>`;

function vDaftar() {
  const q = LANG === 'en' ? '?lang=en' : '';
  return `${backBar()}
  <div class="card">
    <h1 style="font-size:1.6rem">${t('Daftar akaun')}</h1>
    <p class="muted small">${t('Isi maklumat di bawah. Lepas daftar, anda boleh terus pilih pelan langganan.')}</p>
  </div>
  <form id="fDaftar" class="card" novalidate>
    <label class="f" for="dName">${t('Nama penuh')}
      <input class="input" id="dName" autocomplete="name" maxlength="80">
    </label>
    <label class="f" for="dPhone">${t('No. telefon (WhatsApp)')}
      <input class="input" id="dPhone" inputmode="tel" autocomplete="tel" placeholder="${t('Contoh: 012-345 6789')}">
    </label>
    <label class="f" for="dEmail">${t('Emel')}
      <input class="input" id="dEmail" type="email" inputmode="email" autocomplete="email" placeholder="${t('Contoh: nama@gmail.com')}">
    </label>
    <p class="muted small" style="margin-top:-.4rem">${t('Kod set semula PIN dan resit akan dihantar ke emel ini.')}</p>
    <label class="f" for="dPin">${t('Cipta PIN 6 angka')}
      <input class="input pin-input" id="dPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </label>
    <label class="f" for="dPin2">${t('Masukkan PIN sekali lagi')}
      <input class="input pin-input" id="dPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">
    </label>
    <p class="muted small">${t('Ingat PIN ini. Ia digunakan setiap kali log masuk. Elakkan PIN mudah seperti 123456.')}</p>
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
    <p class="agree">${t('Dengan mendaftar, anda bersetuju dengan <a href="{terma}" target="_blank" rel="noopener">Terma Penggunaan</a> dan <a href="{privasi}" target="_blank" rel="noopener">Polisi Privasi</a>.', { terma: '/terma' + q, privasi: '/privasi' + q })}</p>
    <button class="btn btn-primary" type="submit">${t('Daftar')}</button>
  </form>`;
}

function vLupaEmail() {
  const R = S.reset;
  const head = `${backBar()}
  <div class="card"><h1 style="font-size:1.6rem">${t('Lupa PIN')}</h1>
    <p class="muted small">${R.step === 1 ? t('Kami akan hantar kod 6 angka ke emel yang anda daftar.') : t('Masukkan kod dari emel dan cipta PIN baharu.')}</p></div>`;
  if (R.step === 1) return head + `<form id="fForgot" class="card" novalidate>
      <label class="f" for="fPhone">${t('No. telefon yang didaftar')}<input class="input" id="fPhone" inputmode="tel" autocomplete="tel" placeholder="${t('Contoh: 012-345 6789')}"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Hantar kod ke emel')}</button>
      <button class="link" type="button" data-a="lupaAdmin">${t('Tiada emel? Minta bantuan admin')}</button>
    </form>`;
  return head + `<form id="fReset" class="card" novalidate>
      <div class="ok-box">${esc(R.msg)}</div>
      <label class="f" for="rCode">${t('Kod 6 angka dari emel')}<input class="input pin-input" id="rCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
      <label class="f" for="rPin">${t('PIN baharu')}<input class="input pin-input" id="rPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <label class="f" for="rPin2">${t('PIN baharu sekali lagi')}<input class="input pin-input" id="rPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Simpan PIN baharu')}</button>
      <button class="link" type="button" data-a="resendCode">${t('Tak terima kod? Hantar semula')}</button>
    </form>`;
}

function vLupa() {
  if (S.cfg.emailReset && !S.lupaAdmin) return vLupaEmail();
  const wa = (S.cfg.org && S.cfg.org.whatsapp) || '';
  return `${backBar()}
  <div class="card">
    <h1 style="font-size:1.6rem">${t('Lupa PIN')}</h1>
    <p>${t('Jangan risau. Admin boleh set semula PIN anda.')}</p>
    <ol style="margin:0;padding-left:1.3rem;display:flex;flex-direction:column;gap:.4rem">
      <li>${t('Hantar mesej WhatsApp kepada admin dengan <b>nama penuh</b> dan <b>no. telefon</b> yang anda daftar.')}</li>
      <li>${t('Admin akan beri PIN sementara.')}</li>
      <li>${t('Log masuk dengan PIN sementara, kemudian tukar PIN di menu <b>Akaun</b>.')}</li>
    </ol>
    ${wa ? `<a class="btn btn-primary" href="https://wa.me/${wa}?text=${encodeURIComponent(t('Assalamualaikum admin, saya lupa PIN Madrasah Online. Nama: ... No. telefon: ...'))}" target="_blank" rel="noopener">${t('WhatsApp admin')}</a>
      <p class="note">${t('No. admin:')} +${wa}</p>` : `<p class="muted small">${t('Hubungi admin melalui group WhatsApp kelas.')}</p>`}
  </div>`;
}

// ---------- dalam app ----------
function statusCard() {
  const u = S.user;
  if (u.active) {
    const days = Math.max(0, Math.ceil((u.paidUntil - Date.now()) / 864e5));
    return `<div class="status ok">
      <span class="eyebrow">${t('Langganan')}</span>
      <div class="top"><span class="big">${t('Aktif')}</span><span class="pill ok">${t('{n} hari lagi', { n: days })}</span></div>
      <p>${u.autoRenew ? t('Diperbaharui automatik pada <b>{d}</b>.', { d: fmtDate(u.paidUntil - 864e5) }) : t('Tamat pada <b>{d}</b>.', { d: fmtDate(u.paidUntil) })} ${t('Semua video kelas boleh ditonton.')}</p>
      ${!u.autoRenew && days <= 7 ? `<button class="btn btn-primary" data-a="subscribe">${t('Sambung langganan')}</button>` : ''}
    </div>`;
  }
  return `<div class="status bad">
    <span class="eyebrow">${t('Langganan')}</span>
    <span class="big">${u.paidUntil ? t('Langganan anda dah tamat') : t('Langganan belum aktif')}</span>
    <p>${u.paidUntil ? t('Tamat pada {d}.', { d: fmtDate(u.paidUntil) }) + ' ' : ''}${t('Langgan untuk tonton semua video kelas dan bertanya kepada ustaz.')}</p>
    <button class="btn btn-primary" data-a="subscribe">${t('Langgan sekarang')}</button>
  </div>`;
}

function tUtama() {
  const big = Prefs.get('big', '0') === '1';
  return `<div class="toolbar">
      <img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608">
      <button class="iconbtn" data-a="big" aria-label="${big ? t('Kecilkan tulisan') : t('Besarkan tulisan')}">${big ? 'A−' : 'A+'}</button>
      ${langBtn()}
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
    ${solatCard()}
    ${(() => { const c = S.videos && S.continueId && S.videos.find(v => v.id === S.continueId); return c && S.user.active ? `<div class="card"><span class="eyebrow">${t('Sambung tonton')}</span><div class="vlist">${vItem(c)}</div></div>` : ''; })()}
    ${S.videos && S.videos.length && !S.continueId ? `<div class="card"><span class="eyebrow">${t('Video kelas')}</span><p>${t('{n} rakaman kelas sedia ditonton.', { n: S.videos.length })}</p><button class="btn btn-ghost" data-a="tab" data-v="video">${t('Lihat video')}</button></div>` : ''}
    ${classCard()}
    ${S.ann && S.ann.nextClass ? pushCard(true) : ''}
    ${latestAnnCard()}
    <div class="card">
      <span class="eyebrow">${t('Sumbang & taja pelajar')}</span>
      <p class="small">${t('Bantu orang lain belajar mengaji dengan menaja langganan mereka, atau sumbang untuk kos kelas.')}</p>
      <a class="btn btn-ghost" href="/sumbang">${I.star} ${t('Sumbang sekarang')}</a>
    </div>
    ${installCard()}`;
}

// ---------- waktu solat ----------
const PRAY_NAMES = () => ({ fajr: t('Subuh'), syuruk: t('Syuruk'), dhuhr: t('Zohor'), asr: t('Asar'), maghrib: t('Maghrib'), isha: t('Isyak') });
const AZAN_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const HIJRI_MS = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijah'];
const HIJRI_EN = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah'];
function fmtHijri(h) {
  const m = String(h || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${Number(m[3])} ${(LANG === 'en' ? HIJRI_EN : HIJRI_MS)[Number(m[2]) - 1]} ${m[1]}H`;
}
const myToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function nextPrayer() {
  const d = S.solat && S.solat.today; if (!d) return null;
  const now = Date.now(), N = PRAY_NAMES();
  for (const k of AZAN_KEYS) if (d[k] > now) return { key: k, at: d[k], label: N[k] };
  const tm = S.solat.tomorrow;
  return tm ? { key: 'fajr', at: tm.fajr, label: t('{p} (esok)', { p: N.fajr }), tomorrow: true } : null;
}

function solatCard() {
  const s = S.solat;
  if (!s) return '';
  if (s.error) return `<div class="card"><span class="eyebrow">${t('Waktu solat')}</span><p class="small">${esc(s.error)}</p><button class="btn btn-ghost" data-a="solatRetry">${t('Cuba lagi')}</button></div>`;
  const d = s.today, N = PRAY_NAMES(), nx = nextPrayer(), now = Date.now();
  const current = [...AZAN_KEYS].reverse().find(k => d[k] <= now);
  const azanOn = S.user.azan && S.user.azan.length && S.push.state === 'on';
  return `<div class="card solat">
    <div class="top"><span class="eyebrow">${t('Waktu solat')}</span><button class="link" data-a="solatSettings">${t('Tukar kawasan')}</button></div>
    <p class="small muted">${esc(s.zone.area)}${d.hijri ? ' · ' + fmtHijri(d.hijri) : ''}</p>
    ${nx ? `<div class="pnext"><span class="muted small">${t('Waktu seterusnya')}</span><b>${esc(nx.label)} · ${fmtTime(nx.at)}</b><span class="pill ok">${countdown(nx.at)}</span></div>` : ''}
    <div class="ptimes">${['fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha'].map(k => `<div class="pt${k === current ? ' now' : ''}${nx && !nx.tomorrow && k === nx.key ? ' next' : ''}"><span>${N[k]}</span><b>${d[k] ? fmtTime(d[k]).replace(/ (pagi|tengah hari|petang|malam|am|pm)$/, '') : '-'}</b></div>`).join('')}</div>
    ${azanOn ? `<p class="small">${I.bell} ${t('Notifikasi masuk waktu aktif ({n} waktu).', { n: S.user.azan.length })} <button class="link" data-a="solatSettings">${t('Ubah')}</button></p>`
      : `<button class="btn btn-ghost" data-a="solatSettings">${t('Hidupkan notifikasi waktu solat')}</button>`}
    <button class="btn btn-line" data-a="qibla">${I.compass} ${t('Arah kiblat')}</button>
    <p class="note">${t('Sumber: JAKIM e-Solat')}</p>
  </div>`;
}

// ---------- arah kiblat ----------
// Lokasi diproses dalam telefon sahaja (tidak dihantar ke server).
const KAABA = { lat: 21.422487, lon: 39.826206 };
const KL = { lat: 3.139, lon: 101.6869 };
const RAD = Math.PI / 180;
function qiblaBearing(lat, lon) {
  const p1 = lat * RAD, p2 = KAABA.lat * RAD, dl = (KAABA.lon - lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
function distanceKm(lat, lon) {
  const dp = (KAABA.lat - lat) * RAD, dl = (KAABA.lon - lon) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(lat * RAD) * Math.cos(KAABA.lat * RAD) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const Q = { heading: null, smooth: null, listening: false, aligned: false, timer: null, raf: 0 };

function openQibla() {
  S.qibla = { state: 'locating', compass: 'idle' };
  S.modal = 'qibla'; render();
  let finished = false;
  const done = (lat, lon, approx) => {
    if (finished || S.modal !== 'qibla') return;
    finished = true;
    S.qibla = { ...S.qibla, state: 'ready', lat, lon, approx, bearing: qiblaBearing(lat, lon), km: distanceKm(lat, lon) };
    render();
    // Android: kompas boleh terus dimulakan. iPhone perlu izin melalui butang.
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') startCompass();
  };
  if (!navigator.geolocation) return done(KL.lat, KL.lon, true);
  // Pelayar tidak mengira masa tamat selagi soalan izin lokasi belum dijawab — guna anggaran KL selepas 12 saat
  setTimeout(() => done(KL.lat, KL.lon, true), 12000);
  navigator.geolocation.getCurrentPosition(p => done(p.coords.latitude, p.coords.longitude, false), () => done(KL.lat, KL.lon, true), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

function onOrient(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading; // iPhone
  else if ((e.absolute || e.type === 'deviceorientationabsolute') && typeof e.alpha === 'number') h = (360 - e.alpha) % 360; // Android
  if (h == null) return;
  h = (h + ((screen.orientation && screen.orientation.angle) || 0) + 360) % 360;
  // Tapis lembut supaya jarum tak bergetar (ambil kira lintasan 359° → 0°)
  if (Q.smooth == null) Q.smooth = h;
  else { const d = ((h - Q.smooth + 540) % 360) - 180; Q.smooth = (Q.smooth + d * 0.25 + 360) % 360; }
  Q.heading = Q.smooth;
  if (S.qibla && S.qibla.compass !== 'on') { S.qibla.compass = 'on'; clearTimeout(Q.timer); render(); }
  if (!Q.raf) Q.raf = requestAnimationFrame(drawCompass);
}

async function startCompass() {
  if (Q.listening) return;
  if (typeof DeviceOrientationEvent === 'undefined') { S.qibla.compass = 'none'; render(); return; }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') { S.qibla.compass = 'denied'; render(); return; } }
    catch { S.qibla.compass = 'denied'; render(); return; }
  }
  Q.listening = true; Q.smooth = null; Q.aligned = false;
  window.addEventListener('ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation', onOrient);
  S.qibla.compass = 'waiting'; render();
  Q.timer = setTimeout(() => { if (S.qibla && S.qibla.compass === 'waiting') { S.qibla.compass = 'none'; render(); } }, 3000);
}
function stopCompass() {
  window.removeEventListener('deviceorientationabsolute', onOrient);
  window.removeEventListener('deviceorientation', onOrient);
  Q.listening = false; Q.heading = null; Q.smooth = null; clearTimeout(Q.timer); cancelAnimationFrame(Q.raf); Q.raf = 0;
}

// Kemas kini dail terus (tanpa lukis semula seluruh skrin) supaya lancar
function drawCompass() {
  Q.raf = 0;
  const q = S.qibla, dial = document.getElementById('qDial');
  if (!q || !dial || Q.heading == null) return;
  dial.style.transform = `rotate(${-Q.heading}deg)`;
  const diff = ((q.bearing - Q.heading + 540) % 360) - 180, ok = Math.abs(diff) <= 5;
  const box = document.getElementById('qBox'), st = document.getElementById('qStatus');
  if (box) box.classList.toggle('aligned', ok);
  if (st) st.textContent = ok ? t('Anda sedang menghadap kiblat') : diff > 0 ? t('Pusing ke kanan {d}°', { d: Math.round(Math.abs(diff)) }) : t('Pusing ke kiri {d}°', { d: Math.round(Math.abs(diff)) });
  if (ok && !Q.aligned && navigator.vibrate) { try { navigator.vibrate(120); } catch {} }
  Q.aligned = ok;
}

function compassSvg(bearing) {
  const L = LANG === 'en' ? ['N', 'E', 'S', 'W'] : ['U', 'T', 'S', 'B'];
  let ticks = '';
  for (let a = 0; a < 360; a += 15) ticks += `<line x1="100" y1="${a % 90 ? 14 : 10}" x2="100" y2="22" transform="rotate(${a} 100 100)" class="${a % 90 ? 'tk' : 'tk major'}"/>`;
  return `<svg viewBox="0 0 200 200" class="qsvg" aria-hidden="true">
    <circle cx="100" cy="100" r="92" class="ring"/>${ticks}
    ${L.map((l, i) => `<text x="100" y="40" transform="rotate(${i * 90} 100 100)" class="${i === 0 ? 'cardinal north' : 'cardinal'}" text-anchor="middle">${l}</text>`).join('')}
    <g transform="rotate(${bearing} 100 100)"><line x1="100" y1="100" x2="100" y2="34" class="qline"/>
      <g transform="translate(100 26)"><rect x="-11" y="-11" width="22" height="22" rx="2" class="kaaba"/><rect x="-11" y="-5" width="22" height="3.5" class="kaaba-band"/></g></g>
    <circle cx="100" cy="100" r="5" class="hub"/>
  </svg>`;
}

function qiblaModal() {
  const q = S.qibla;
  if (!q || q.state === 'locating') return `<h2 style="font-size:1.25rem">${t('Arah kiblat')}</h2><div class="loading">${t('Mengesan lokasi anda...')}</div>`;
  const deg = Math.round(q.bearing);
  const live = q.compass === 'on';
  return `<h2 style="font-size:1.25rem">${t('Arah kiblat')}</h2>
    <div id="qBox" class="qbox">
      <div class="qpointer" aria-hidden="true"></div>
      <div id="qDial" class="qdial">${compassSvg(q.bearing)}</div>
    </div>
    <p id="qStatus" class="qstatus" role="status" aria-live="polite">${live ? '' : t('Kiblat: {d}° dari arah Utara', { d: deg })}</p>
    ${q.compass === 'idle' ? `<button class="btn btn-primary" data-a="qiblaStart">${t('Mulakan kompas')}</button>` : ''}
    ${q.compass === 'waiting' ? `<p class="muted small" style="text-align:center">${t('Menunggu kompas telefon...')}</p>` : ''}
    ${live ? `<p class="small" style="text-align:center">${t('Pegang telefon rata (mendatar) dan pusing badan perlahan-lahan sehingga ikon Kaabah berada di atas.')}</p>` : ''}
    ${q.compass === 'none' || q.compass === 'denied' ? `<div class="adminnote">${I.compass}<p>${q.compass === 'denied' ? t('Akses kompas tidak dibenarkan.') : t('Telefon ini tidak mempunyai kompas, atau kompas tidak dapat dibaca.')} ${t('Gunakan app Kompas telefon dan hadap <b>{d}°</b> (arah barat laut).', { d: deg })}</p></div>` : ''}
    <p class="muted small">${q.approx ? t('Lokasi tidak dapat dikesan, jadi arah dikira dari Kuala Lumpur. Bezanya kecil untuk seluruh Malaysia.') : t('Jarak ke Kaabah: {km} km', { km: Math.round(q.km).toLocaleString(LANG === 'en' ? 'en-MY' : 'ms-MY') })}</p>
    <p class="note">${t('Jauhkan telefon daripada besi atau magnet. Jika arah kelihatan salah, gerakkan telefon membentuk angka 8 untuk kalibrasi kompas. Lokasi anda tidak dihantar ke server.')}</p>
    <button class="btn btn-ghost" data-a="close">${t('Tutup')}</button>`;
}

async function loadSolat() {
  const r = await api('GET', '/api/solat');
  if (r.status === 401) return;
  S.solat = r.ok ? { zone: r.zone, today: r.today, tomorrow: r.tomorrow } : { error: r.error };
  if (S.view === 'app' && !S.playing && !S.modal) render();
}
async function loadZones() {
  if (S.zones) return;
  const r = await api('GET', '/api/solat/zones');
  if (r.ok) { S.zones = r.zones; if (S.modal === 'solat') render(); }
}

function solatModal() {
  const f = S.sf;
  if (!S.zones) return `<h2 style="font-size:1.25rem">${t('Waktu solat & notifikasi')}</h2><div class="loading">${t('Memuatkan...')}</div>`;
  const states = [...new Set(S.zones.map(z => z.state))];
  const N = PRAY_NAMES();
  return `<form id="fSolat" novalidate style="display:flex;flex-direction:column;gap:.8rem">
    <h2 style="font-size:1.25rem">${t('Waktu solat & notifikasi')}</h2>
    <label class="f" for="sZone">${t('Kawasan anda')}
      <select class="input" id="sZone">${states.map(st => `<optgroup label="${esc(st)}">${S.zones.filter(z => z.state === st).map(z => `<option value="${z.code}"${z.code === f.zone ? ' selected' : ''}>${esc(z.area)}</option>`).join('')}</optgroup>`).join('')}</select>
    </label>
    <span class="eyebrow">${t('Notifikasi masuk waktu')}</span>
    ${S.push.state !== 'on' ? `<p class="small">${t('Notifikasi telefon belum dihidupkan. Hidupkan dahulu supaya telefon berbunyi bila masuk waktu.')}</p>
      ${S.push.state === 'off' ? `<button type="button" class="btn btn-primary" data-a="pushOn">${t('Hidupkan notifikasi')}</button>` : pushCard(false)}` : ''}
    <div class="vlist">${AZAN_KEYS.map(k => `<label class="check" for="az-${k}"><input type="checkbox" id="az-${k}" data-az="${k}" ${f.azan.includes(k) ? 'checked' : ''}><span>${N[k]}</span></label>`).join('')}</div>
    <p class="muted small">${t('Notifikasi berbunyi mengikut bunyi notifikasi telefon anda. App web tidak dapat memainkan bunyi azan penuh.')}</p>
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
    <button class="btn btn-primary" type="submit">${t('Simpan')}</button>
    <button class="btn btn-ghost" type="button" data-a="close">${t('Batal')}</button>
  </form>`;
}

// ---------- kelas Zoom & pengumuman ----------
function joinButton(a) {
  if (a.locked) return `<p class="small"><b>${t('Kelas ini untuk pelajar yang melanggan.')}</b></p><button class="btn btn-primary" data-a="subscribe">${t('Langgan sekarang')}</button>`;
  if (a.zoomUrl) return `<a class="btn btn-primary btn-join" href="${esc(a.zoomUrl)}" target="_blank" rel="noopener">${I.video} ${t('Masuk Kelas')}</a>
    <p class="note">${t('Aplikasi Zoom akan dibuka. Jika diminta, pilih <b>Join</b>.')}</p>`;
  if (!a.hasZoom) return '';
  if (Date.now() > a.classAt + 3 * 3600e3) return '';
  return `<span class="btn btn-ghost btn-join" aria-disabled="true">${I.video} ${t('Masuk Kelas')}</span>
    <p class="note">${t('Butang dibuka 30 minit sebelum kelas, iaitu pada {time}.', { time: fmtTime(a.joinOpensAt) })}</p>`;
}

function classCard() {
  if (!S.ann) return '';
  const n = S.ann.nextClass;
  if (!n) return `<div class="card"><span class="eyebrow">${t('Kelas Zoom bulanan')}</span>
    <p>${t('Belum ada kelas dijadualkan. Tarikh dan butang <b>Masuk Kelas</b> akan dipaparkan di sini bila admin umumkan kelas seterusnya.')}</p></div>`;
  const d = new Date(n.classAt), live = Date.now() >= n.classAt;
  return `<div class="card classcard">
    <div class="top"><span class="eyebrow">${t('Kelas Zoom seterusnya')}</span><span class="pill ${live ? 'warn' : 'ok'}">${countdown(n.classAt)}</span></div>
    <div class="zoom-date">
      <div class="datebox"><b>${d.getDate()}</b><span>${monthName(d.getMonth())}</span></div>
      <div class="when" style="min-width:0"><b>${esc(n.title)}</b><span class="muted small">${dayName(d.getDay())}, ${fmtTime(n.classAt)}</span></div>
    </div>
    ${n.body ? `<p class="ann small">${esc(n.body)}</p>` : ''}
    ${joinButton(n)}
  </div>`;
}

function latestAnnCard() {
  if (!S.ann) return '';
  const nextId = S.ann.nextClass && S.ann.nextClass.id;
  const a = S.ann.announcements.find(x => x.id !== nextId && Date.now() - x.createdAt < 14 * 864e5);
  if (!a) return '';
  const body = a.body.length > 220 ? a.body.slice(0, 220).trimEnd() + '…' : a.body;
  return `<div class="card">
    <span class="eyebrow">${t('Pengumuman terkini')}</span>
    <b>${esc(a.title)}</b>
    <span class="ann-meta">${fmtDate(a.createdAt)}</span>
    <p class="ann">${esc(body)}</p>
    <button class="btn btn-ghost" data-a="tab" data-v="komuniti">${t('Lihat semua pengumuman')}</button>
  </div>`;
}

function annItem(a) {
  return `<article class="card">
    <b style="font-size:1.1rem">${esc(a.title)}</b>
    <span class="ann-meta">${t('Dihebahkan {d}', { d: fmtDate(a.createdAt) })}</span>
    ${a.classAt ? `<div class="ok-box">${t('Kelas Zoom: {when}', { when: fmtClass(a.classAt) })}</div>` : ''}
    <p class="ann">${esc(a.body)}</p>
    ${a.classAt ? joinButton(a) : ''}
  </article>`;
}

async function loadAnn() {
  const r = await api('GET', '/api/announcements');
  if (r.status === 401) return;
  if (r.ok) { S.ann = { nextClass: r.nextClass, announcements: r.announcements }; if (S.view === 'app' && !S.playing) render(); }
}

// Setiap 30 saat: kemas kini kiraan masa (kelas & solat); ambil pautan Zoom bila butang patut dibuka;
// muat semula waktu solat bila hari bertukar.
setInterval(() => {
  if (S.view !== 'app' || S.modal || S.playing || !['utama', 'komuniti'].includes(S.tab)) return;
  if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (S.solat && S.solat.today && S.solat.today.date !== myToday()) { loadSolat(); return; }
  const n = S.ann && S.ann.nextClass;
  if (n && n.hasZoom && !n.locked && !n.zoomUrl && Date.now() >= n.joinOpensAt && Date.now() <= n.classAt + 3 * 3600e3) { loadAnn(); return; }
  if (S.tab === 'utama' && (n || S.solat)) render();
}, 30000);

const monthLabel = m => m ? monthName(Number(m.slice(5, 7)) - 1) + ' ' + m.slice(0, 4) : '';

function vItem(v) {
  const total = Math.max(1, v.minutes * 60), pct = Math.min(100, Math.round(v.watchedSeconds / total * 100));
  return `<button class="vitem" data-a="play" data-v="${v.id}">
    ${v.thumbUrl ? `<span class="thumb-img"><img src="${esc(v.thumbUrl)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">${v.arabicLabel ? `<span class="thumb-ar">${esc(v.arabicLabel)}</span>` : ''}</span>`
      : `<span class="thumb">${v.arabicLabel ? esc(v.arabicLabel) : `<span style="font-family:var(--f-body);font-size:.8rem;direction:ltr">${esc(v.topic)}</span>`}</span>`}
    <span class="vinfo">
      <b>${esc(v.title)}</b>
      <span class="muted small">${esc(v.topic)} · ${t('{n} minit', { n: v.minutes })}${v.classMonth ? ' · ' + monthLabel(v.classMonth) : ''}</span>
      ${pct > 0 ? `<span class="bar" aria-label="${t('Ditonton {p}%', { p: pct })}"><i style="width:${pct}%"></i></span><span class="muted small">${pct >= 95 ? t('Dah habis tonton') : t('Ditonton {p}%', { p: pct })}</span>` : ''}
    </span>
  </button>`;
}

function lockCard() {
  return `<div class="card lock">${I.lock}<h2 style="font-size:1.2rem">${t('Video dikunci')}</h2><p class="muted">${t('Langgan untuk tonton semua rakaman kelas.')}</p><button class="btn btn-primary" data-a="subscribe">${t('Langgan sekarang')}</button></div>`;
}

function tVideo() {
  if (S.playing) return vPlayer();
  if (!S.videos) return `<div class="top"><h1>${t('Video Kelas')}</h1></div><div class="loading">${t('Memuatkan video...')}</div>`;
  const topics = ['*', ...new Set(S.videos.map(v => v.topic))];
  const list = S.videos.filter(v => S.filter === '*' || v.topic === S.filter);
  return `<div class="top"><h1>${t('Video Kelas')}</h1>${S.videos.length ? `<span class="pill ok">${t('{n} video', { n: S.videos.length })}</span>` : ''}</div>
    ${S.user.active ? '' : lockCard()}
    ${S.videos.length ? `
      ${topics.length > 2 ? `<div class="chips" role="tablist" aria-label="${t('Tapis topik')}">${topics.map(tp => `<button class="chip ${S.filter === tp ? 'on' : ''}" data-a="vfilter" data-v="${esc(tp)}">${tp === '*' ? t('Semua') : esc(tp)}</button>`).join('')}</div>` : ''}
      <div class="vlist">${list.map(vItem).join('')}</div>`
    : `<div class="card empty">${I.video}<h2 style="font-size:1.15rem">${t('Rakaman kelas akan dimuat naik')}</h2><p class="muted">${t('Admin sedang menyediakan video kelas lepas. Video baharu akan muncul di sini.')}</p></div>`}`;
}

function vPlayer() {
  const P = S.playing, v = P.video;
  return `<div class="top"><button class="iconbtn" data-a="stopPlay">${I.back} ${t('Kembali')}</button><span class="pill ok">${esc(v.topic)}</span></div>
    ${P.embedUrl ? `<div class="player-frame">
        <iframe id="vframe" src="${esc(P.embedUrl)}" loading="eager" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(v.title)}"></iframe>
        <span class="wm-name" aria-hidden="true">Madrasah Online · ${esc(P.watermark)}</span>
      </div>` : `<div class="player-frame"><div class="loading" style="color:#fff">${P.error ? esc(P.error) : t('Memuatkan video...')}</div></div>`}
    <div class="card">
      <h1 style="font-size:1.25rem">${esc(v.title)}</h1>
      <p class="muted small">${esc(v.topic)} · ${t('{n} minit', { n: v.minutes })}${v.classMonth ? ' · ' + t('Kelas {m}', { m: monthLabel(v.classMonth) }) : ''}</p>
      <p class="small">${t('Nak ikut bacaan perlahan-lahan? Tekan ikon <b>tetapan</b> dalam video, kemudian pilih kelajuan <b>0.75</b>.')}</p>
      ${P.resumeAt > 30 ? `<p class="muted small">${t('Video disambung dari tempat terakhir anda tonton.')}</p>` : ''}
    </div>
    ${askCard(v.id)}
    ${S.vqa && S.vqa.length ? `<div class="qa">${S.vqa.map(q => qItem(q, false)).join('')}</div>` : ''}`;
}

// ---------- soal jawab ----------
function qItem(q, showVideo = true) {
  return `<article class="q">
    <div class="who"><b>${q.mine ? t('Soalan anda') : t('Soalan {name}', { name: esc(q.asker) })}</b><span>${fmtDate(q.createdAt)}</span></div>
    ${showVideo && q.videoTitle ? `<span class="muted small">${t('Tentang video:')} <b>${esc(q.videoTitle)}</b></span>` : ''}
    <p class="ann">${esc(q.body)}</p>
    ${q.answer ? `<div class="ans"><b>${t('Jawapan {name}', { name: esc(q.answeredBy) })}</b><p class="ann">${esc(q.answer)}</p></div>`
      : `<div class="top"><span class="pill warn">${t('Menunggu jawapan ustaz')}</span><button class="link" data-a="qDelete" data-v="${q.id}" style="color:var(--danger)">${t('Tarik balik')}</button></div>`}
  </article>`;
}

function askCard(videoId) {
  return `<div class="card">
    <span class="eyebrow">${videoId ? t('Soalan tentang video ini') : t('Tanya ustaz')}</span>
    <p class="small">${videoId ? t('Ada bahagian yang kurang faham dalam video ini?') : t('Ada soalan tentang bacaan, tajwid atau makhraj?')} ${t('Tanya ustaz. Jawapan akan dipaparkan di sini.')}</p>
    <button class="btn btn-primary" data-a="ask" data-v="${videoId || ''}">${t('Tanya ustaz')}</button>
  </div>`;
}

function tSoalJawab() {
  const list = S.qa;
  return `${askCard(null)}
    ${!list ? `<div class="loading">${t('Memuatkan soal jawab...')}</div>`
      : list.length ? `<div class="qa">${list.map(q => qItem(q)).join('')}</div>`
      : `<div class="card empty">${I.users}<h2 style="font-size:1.15rem">${t('Belum ada soal jawab')}</h2><p class="muted">${t('Jadilah yang pertama bertanya. Soalan dan jawapan ustaz akan dipaparkan di sini untuk manfaat semua.')}</p></div>`}`;
}

async function loadQa() {
  const r = await api('GET', '/api/questions');
  if (r.ok) { S.qa = r.questions; if (S.view === 'app' && S.tab === 'komuniti') render(); }
}
async function loadVqa(videoId) {
  const r = await api('GET', `/api/questions?video=${videoId}`);
  if (r.ok && S.playing && S.playing.video.id === videoId) { S.vqa = r.questions; render(); }
}

// ---------- peringatan (notifikasi telefon) ----------
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64ToBytes(s) {
  const b = atob((s + '==='.slice((s.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
async function setPushLast(id) {
  try { await (await caches.open('mo-push-state')).put('/__push-state', new Response(JSON.stringify({ lastId: id || 0, last: null }), { headers: { 'content-type': 'application/json' } })); } catch {}
}
async function currentSub() {
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}
async function checkPush() {
  if (!pushSupported()) { S.push.state = isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'; return; }
  if (Notification.permission === 'denied') { S.push.state = 'denied'; return; }
  const sub = Notification.permission === 'granted' ? await currentSub() : null;
  S.push.state = sub ? 'on' : 'off';
  if (sub) api('POST', '/api/push/subscribe', { endpoint: sub.endpoint }); // pastikan peranti dipaut ke akaun yang sedang log masuk
}
async function enablePush(btn) {
  let perm;
  try { perm = await Notification.requestPermission(); } catch { perm = 'default'; }
  if (perm !== 'granted') { S.push.state = perm === 'denied' ? 'denied' : 'off'; render(); return; }
  const r = await busy(btn, async () => {
    const k = await api('GET', '/api/push/key');
    if (!k.ok) return k;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.publicKey) });
      const res = await api('POST', '/api/push/subscribe', { endpoint: sub.endpoint });
      if (res.ok) await setPushLast(res.latestId);
      return res;
    } catch (e) { return { ok: false, error: t('Telefon ini tidak dapat menghidupkan notifikasi. Cuba buka app dari skrin utama telefon.') }; }
  });
  if (!r.ok) { toast(r.error); return; }
  S.push.state = 'on'; render();
  toast(t('Peringatan dihidupkan. Notifikasi ujian sedang dihantar.'));
  api('POST', '/api/push/test');
}
async function disablePush() {
  const sub = await currentSub();
  if (sub) { api('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }); try { await sub.unsubscribe(); } catch {} }
  S.push.state = 'off';
}

function pushCard(compact) {
  const st = S.push.state;
  if (st === 'unknown' || (compact && st !== 'off' && st !== 'ios-install')) return '';
  const head = `<span class="eyebrow">${t('Peringatan kelas')}</span>`;
  if (st === 'on') return `<div class="card">${head}<p>${t('<b>Aktif di telefon ini.</b> Anda akan dapat notifikasi sehari sebelum kelas, 30 minit sebelum kelas, dan bila ustaz jawab soalan anda.')}</p>
    <div class="btn-row"><button class="btn btn-ghost" data-a="pushTest">${t('Hantar ujian')}</button><button class="btn btn-ghost" data-a="pushOff">${t('Matikan')}</button></div></div>`;
  if (st === 'off') return `<div class="card">${head}<p>${t('Dapatkan notifikasi di telefon sebelum kelas Zoom bermula, supaya tak terlepas.')}</p>
    <button class="btn btn-primary" data-a="pushOn">${t('Hidupkan peringatan')}</button></div>`;
  if (st === 'ios-install') return `<div class="card">${head}<p class="small">${t('Untuk dapat peringatan di iPhone, pasang app dulu: tekan butang <b>Share</b> di Safari, pilih <b>Add to Home Screen</b>, kemudian buka app dari skrin utama.')}</p></div>`;
  if (st === 'denied') return `<div class="card">${head}<p class="small">${t('Notifikasi disekat untuk app ini. Buka <b>Tetapan</b> telefon atau pelayar, cari Madrasah Online, dan benarkan notifikasi.')}</p></div>`;
  return `<div class="card">${head}<p class="small muted">${t('Telefon atau pelayar ini belum menyokong notifikasi. Cuba buka app ini menggunakan Google Chrome.')}</p></div>`;
}

function tKomuniti() {
  const list = S.ann ? S.ann.announcements : null;
  const tabs = [['pengumuman', t('Pengumuman')], ['soaljawab', t('Soal Jawab')]];
  return `<div class="top"><h1>${t('Komuniti')}</h1></div>
    <div class="chips" role="tablist">${tabs.map(([k, l]) => `<button class="chip ${S.kTab === k ? 'on' : ''}" role="tab" aria-selected="${S.kTab === k}" data-a="kTab" data-v="${k}">${l}</button>`).join('')}</div>
    ${S.kTab === 'soaljawab' ? tSoalJawab() : `
    ${!list ? `<div class="loading">${t('Memuatkan pengumuman...')}</div>`
      : list.length ? list.map(annItem).join('')
      : `<div class="card empty">${I.users}<h2 style="font-size:1.15rem">${t('Belum ada pengumuman')}</h2><p class="muted">${t('Pengumuman dan jadual kelas Zoom akan dipaparkan di sini.')}</p></div>`}`}`;
}

function tAkaun() {
  const u = S.user, big = Prefs.get('big', '0') === '1';
  const zone = S.solat && S.solat.zone;
  return `<div class="top"><h1>${t('Akaun Saya')}</h1></div>
    <div class="card">
      <div class="top"><div style="min-width:0"><b style="font-size:1.1rem">${esc(u.name)}</b><p class="muted small">${esc(u.phone)}${u.email ? ' · ' + esc(u.email) : ''}</p></div>
      <span class="pill ${u.active ? 'ok' : 'bad'}">${u.active ? t('Aktif') : t('Tidak aktif')}</span></div>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Langganan')}</span>
      <p>${u.active ? t('Aktif hingga <b>{d}</b>', { d: fmtDate(u.paidUntil) }) : u.paidUntil ? t('Tamat pada <b>{d}</b>.', { d: fmtDate(u.paidUntil) }) : t('Belum melanggan')}</p>
      ${u.active && u.autoRenew ? `<p class="small">${t('<b>Auto-renew aktif.</b> Kad anda akan dicaj secara automatik pada {d}.', { d: fmtDate(u.paidUntil - 864e5) })}</p>
        <button class="btn btn-ghost" data-a="modal" data-v="stopAuto">${t('Berhenti auto-renew')}</button>` : ''}
      ${!u.active ? `<button class="btn btn-primary" data-a="subscribe">${t('Langgan sekarang')}</button>`
        : !u.autoRenew ? `<button class="btn btn-ghost" data-a="subscribe">${t('Sambung / tambah tempoh')}</button>` : ''}
      <button class="link" data-a="history" style="align-self:flex-start">${t('Sejarah bayaran')}</button>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Bahasa / Language')}</span>
      <div class="btn-row">
        <button class="btn ${LANG === 'ms' ? 'btn-primary' : 'btn-ghost'}" data-a="lang" data-v="ms" lang="ms">Bahasa Melayu</button>
        <button class="btn ${LANG === 'en' ? 'btn-primary' : 'btn-ghost'}" data-a="lang" data-v="en" lang="en">English</button>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Saiz tulisan')}</span>
      <div class="btn-row">
        <button class="btn ${big ? 'btn-ghost' : 'btn-primary'}" data-a="bigSet" data-v="0">${t('Biasa')}</button>
        <button class="btn ${big ? 'btn-primary' : 'btn-ghost'}" data-a="bigSet" data-v="1" style="font-size:1.2rem">${t('Besar')}</button>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Tema')}</span>
      <div class="btn-row">
        <button class="btn ${isDark() ? 'btn-ghost' : 'btn-primary'}" data-a="themeSet" data-v="light">${I.sun} ${t('Cerah')}</button>
        <button class="btn ${isDark() ? 'btn-primary' : 'btn-ghost'}" data-a="themeSet" data-v="dark">${I.moon} ${t('Gelap')}</button>
      </div>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Waktu solat & notifikasi')}</span>
      <p class="small">${zone ? t('Kawasan: <b>{area}</b>', { area: esc(zone.area) }) : ''}</p>
      <p class="small">${u.azan && u.azan.length ? t('Notifikasi masuk waktu: {list}', { list: u.azan.map(k => PRAY_NAMES()[k]).join(', ') }) : t('Notifikasi masuk waktu: tidak aktif')}</p>
      <button class="btn btn-ghost" data-a="solatSettings">${t('Tetapan waktu solat')}</button>
    </div>
    ${pushCard(false)}
    <div class="card">
      <span class="eyebrow">${t('Keselamatan')}</span>
      <p class="small">${u.email ? t('Emel: <b>{e}</b>', { e: esc(u.email) }) : t('<b>Tiada emel.</b> Tambah emel supaya boleh set semula PIN sendiri jika terlupa.')}</p>
      <button class="btn btn-ghost" data-a="modal" data-v="email">${u.email ? t('Tukar emel') : t('Tambah emel')}</button>
      <button class="btn btn-ghost" data-a="modal" data-v="pin">${t('Tukar PIN')}</button>
    </div>
    <div class="card">
      <span class="eyebrow">${t('Maklumat & bantuan')}</span>
      ${S.cfg.org && S.cfg.org.whatsapp ? `<a class="btn btn-ghost" href="https://wa.me/${esc(S.cfg.org.whatsapp)}" target="_blank" rel="noopener">${t('WhatsApp admin')}</a>` : ''}
      <a class="btn btn-ghost" href="/sumbang">${t('Sumbang / taja pelajar')}</a>
      ${legalLinks()}
    </div>
    ${installCard()}
    <button class="btn btn-line" data-a="logout">${t('Log keluar')}</button>
    <button class="link" data-a="modal" data-v="delete" style="align-self:center;color:var(--danger)">${t('Padam akaun saya')}</button>`;
}

function nav() {
  const items = [['utama', t('Utama'), I.home], ['video', t('Video'), I.video], ['komuniti', t('Komuniti'), I.users], ['akaun', t('Akaun'), I.user]];
  return `<nav class="nav"><div class="nav-in">${items.map(([k, l, ic]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}" aria-label="${l}"${S.tab === k ? ' aria-current="page"' : ''}>${ic}<span>${l}</span></button>`).join('')}</div></nav>`;
}

function subscribeModal() {
  const P = S.plans;
  if (!P) return `<h2 style="font-size:1.25rem">${t('Langganan')}</h2><div class="loading">${t('Memuatkan pakej...')}</div>`;
  if (!P.billingReady || !P.plans.length) return `<h2 style="font-size:1.25rem">${t('Langganan')}</h2>
    <p>${t('Sistem bayaran sedang disiapkan. Admin akan maklumkan dalam group WhatsApp bila bayaran dibuka.')}</p>
    <button class="btn btn-primary" data-a="close">${t('Faham')}</button>`;
  const plan = P.plans.find(p => p.id === S.pay.plan) || P.plans[0];
  S.pay.plan = plan.id;
  const per = p => p.months > 1 ? t('≈ {amt} sebulan', { amt: rm(Math.round(p.priceSen / p.months)) }) : t('sebulan');
  const every = plan.months === 1 ? t('setiap bulan') : plan.months === 12 ? t('setiap tahun') : t('setiap {n} bulan', { n: plan.months });
  const planLabel = p => t(p.label); // nama lalai (Bulanan, Setahun…) diterjemah; nama tersuai kekal
  return `<h2 style="font-size:1.25rem">${t('Pilih pakej')}</h2>
    <div class="vlist" role="radiogroup" aria-label="${t('Pakej')}">${P.plans.map(p => `<button type="button" class="opt ${p.id === plan.id ? 'on' : ''}" role="radio" aria-checked="${p.id === plan.id}" data-a="planPick" data-v="${p.id}">
      <b>${esc(planLabel(p))} · ${rm(p.priceSen)}</b><span>${per(p)}</span></button>`).join('')}</div>
    <span class="eyebrow">${t('Cara bayar')}</span>
    <div class="vlist" role="radiogroup" aria-label="${t('Cara bayar')}">
      <button type="button" class="opt ${S.pay.auto ? 'on' : ''}" role="radio" aria-checked="${S.pay.auto}" data-a="payAuto" data-v="1"><b>${t('Kad debit / kredit (auto-renew)')}</b><span>${t('Dicaj automatik {every}. Tak perlu ingat tarikh. Boleh berhenti bila-bila masa.', { every })}</span></button>
      <button type="button" class="opt ${S.pay.auto ? '' : 'on'}" role="radio" aria-checked="${!S.pay.auto}" data-a="payAuto" data-v="0"><b>${t('FPX, DuitNow QR atau e-wallet')}</b><span>${t('Bayar sekali. Perlu bayar semula bila tamat.')}</span></button>
    </div>
    ${S.user.active ? `<p class="muted small">${t('Tempoh baharu akan ditambah selepas {d}.', { d: fmtDate(S.user.paidUntil) })}</p>` : ''}
    ${!S.user.email ? `<div class="err">${t('Sila tambah emel dahulu. Resit bayaran akan dihantar ke emel anda.')}</div><button class="btn btn-ghost" data-a="modal" data-v="email">${t('Tambah emel')}</button>` : ''}
    ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
    <button class="btn btn-primary" data-a="payGo" ${S.user.email ? '' : 'disabled'}>${t('Bayar {amt}', { amt: rm(plan.priceSen) })}</button>
    <p class="note">${t('Pembayaran diproses dengan selamat oleh CHIP, gerbang pembayaran berdaftar dengan Bank Negara Malaysia.')} <a href="/bayaran-balik${LANG === 'en' ? '?lang=en' : ''}" target="_blank" rel="noopener">${t('Polisi bayaran balik')}</a></p>
    <button class="btn btn-ghost" data-a="close">${t('Batal')}</button>`;
}

async function loadPlans() {
  const r = await api('GET', '/api/plans');
  S.plans = r.ok ? { billingReady: r.billingReady, plans: r.plans } : { billingReady: false, plans: [] };
  if (S.modal === 'subscribe') render();
}

async function checkPayment(id) {
  S.modal = 'payResult'; S.payResult = { state: 'checking' }; render();
  let r;
  for (let i = 0; i < 4; i++) {
    r = await api('POST', '/api/pay/confirm', { paymentId: id });
    if (!r.ok || r.payStatus !== 'pending') break;
    await new Promise(ok => setTimeout(ok, 2500));
  }
  if (r.ok && r.payStatus === 'completed') {
    S.payResult = { state: 'completed', paidUntil: r.paidUntil, autoRenew: r.autoRenew };
    const me = await api('GET', '/api/me'); if (me.ok) S.user = me.user;
    loadVideos();
  } else S.payResult = { state: r.ok && r.payStatus === 'pending' ? 'pending' : 'failed' };
  render();
}

function modal() {
  if (!S.modal) return '';
  let inner = '';
  if (S.modal === 'pin') inner = `<form id="fPin" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">${t('Tukar PIN')}</h2>
      <label class="f" for="pOld">${t('PIN sekarang')}<input class="input pin-input" id="pOld" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
      <label class="f" for="pNew">${t('PIN baharu')}<input class="input pin-input" id="pNew" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <label class="f" for="pNew2">${t('PIN baharu sekali lagi')}<input class="input pin-input" id="pNew2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Simpan PIN baharu')}</button>
      <button class="btn btn-ghost" type="button" data-a="close">${t('Batal')}</button>
    </form>`;
  if (S.modal === 'email') inner = `<form id="fEmail" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">${S.user.email ? t('Tukar emel') : t('Tambah emel')}</h2>
      <label class="f" for="eEmail">${t('Alamat emel')}<input class="input" id="eEmail" type="email" inputmode="email" autocomplete="email" value="${esc(S.user.email || '')}"></label>
      <label class="f" for="ePin">${t('PIN untuk sahkan')}<input class="input pin-input" id="ePin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Simpan')}</button>
      <button class="btn btn-ghost" type="button" data-a="close">${t('Batal')}</button>
    </form>`;
  if (S.modal === 'delete') inner = `<form id="fDelete" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">${t('Padam akaun?')}</h2>
      <p>${t('Akaun, progres tontonan dan soalan anda akan dipadam terus. Langganan yang masih berbaki <b>tidak boleh dipulangkan</b>.')}</p>
      <label class="f" for="xPin">${t('Masukkan PIN untuk sahkan')}<input class="input pin-input" id="xPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit" style="background:var(--danger)">${t('Padam akaun saya')}</button>
      <button class="btn btn-ghost" type="button" data-a="close">${t('Batal')}</button>
    </form>`;
  if (S.modal === 'ask') inner = `<form id="fAsk" novalidate style="display:flex;flex-direction:column;gap:.8rem">
      <h2 style="font-size:1.25rem">${t('Tanya ustaz')}</h2>
      ${S.askVideo ? `<p class="small muted">${t('Tentang video:')} <b>${esc((S.videos || []).find(x => x.id === S.askVideo)?.title || '')}</b></p>` : ''}
      <label class="f" for="askBody">${t('Soalan anda')}<textarea class="input" id="askBody" rows="5" maxlength="1000" placeholder="${t('Contoh: Bagaimana cara sebut huruf ع dengan betul?')}"></textarea></label>
      <p class="muted small">${t('Soalan dan jawapan boleh dibaca oleh pelajar lain untuk manfaat bersama. Hanya nama pertama anda dipaparkan.')}</p>
      ${S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : ''}
      <button class="btn btn-primary" type="submit">${t('Hantar soalan')}</button>
      <button class="btn btn-ghost" type="button" data-a="close">${t('Batal')}</button>
    </form>`;
  if (S.modal === 'solat') inner = solatModal();
  if (S.modal === 'qibla') inner = qiblaModal();
  if (S.modal === 'subscribe') inner = subscribeModal();
  if (S.modal === 'payResult') {
    const R = S.payResult || { state: 'checking' };
    inner = R.state === 'checking' ? `<h2 style="font-size:1.25rem">${t('Menyemak bayaran...')}</h2><div class="loading">${t('Sila tunggu sebentar')}</div>`
      : R.state === 'completed' ? `<div class="thanks card" style="border:0;background:none;padding:0">${I.star}<h2 style="font-size:1.35rem">${t('Alhamdulillah, bayaran berjaya')}</h2>
          <p>${t('Langganan anda aktif hingga <b>{d}</b>.', { d: fmtDate(R.paidUntil) })}${R.autoRenew ? ' ' + t('Auto-renew dengan kad telah dihidupkan.') : ''}</p>
          <p class="muted small">${t('Resit telah dihantar ke emel anda.')}</p></div>
          <button class="btn btn-primary" data-a="payDone">${t('Tonton video kelas')}</button>`
      : R.state === 'pending' ? `<h2 style="font-size:1.25rem">${t('Bayaran sedang disahkan')}</h2>
          <p>${t('Bank masih memproses bayaran anda. Langganan akan aktif secara automatik dalam beberapa minit. Anda boleh tutup skrin ini.')}</p>
          <button class="btn btn-primary" data-a="close">${t('Faham')}</button>`
      : `<h2 style="font-size:1.25rem">${t('Bayaran tidak berjaya')}</h2>
          <p>${t('Tiada caj dibuat. Sila cuba lagi, atau pilih cara bayaran lain.')}</p>
          <button class="btn btn-primary" data-a="subscribe">${t('Cuba lagi')}</button>
          <button class="btn btn-ghost" data-a="close">${t('Tutup')}</button>`;
  }
  if (S.modal === 'stopAuto') inner = `<h2 style="font-size:1.25rem">${t('Berhenti auto-renew?')}</h2>
      <p>${t('Kad anda tidak akan dicaj lagi. Langganan kekal aktif hingga <b>{d}</b>, selepas itu anda perlu langgan semula untuk terus menonton.', { d: fmtDate(S.user.paidUntil) })}</p>
      <button class="btn btn-primary" data-a="stopAutoGo" style="background:var(--danger)">${t('Ya, berhenti auto-renew')}</button>
      <button class="btn btn-ghost" data-a="close">${t('Batal')}</button>`;
  if (S.modal === 'history') inner = `<h2 style="font-size:1.25rem">${t('Sejarah bayaran')}</h2>
      ${!S.history ? `<div class="loading">${t('Memuatkan...')}</div>` : S.history.length ? `<div class="rows">${S.history.map(h => `<div class="row"><div><b>${rm(h.amountSen)}</b><p class="muted small">${fmtDate(h.paidAt)} · ${t('{n} bulan', { n: h.months })}${h.auto ? ' · ' + t('kad auto') : ''}</p></div><span class="pill ${h.status === 'completed' ? 'ok' : 'warn'}">${h.status === 'completed' ? t('Berjaya') : t('Disemak')}</span></div>`).join('')}</div>` : `<p class="muted">${t('Belum ada bayaran.')}</p>`}
      <p class="muted small">${t('Resit setiap bayaran dihantar ke emel anda.')}</p>
      <button class="btn btn-ghost" data-a="close">${t('Tutup')}</button>`;
  return `<div class="modal-back" data-a="backdrop"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function draw() {
  let body;
  if (S.view === 'loading') body = `<div class="loading">${t('Memuatkan...')}</div>`;
  else if (S.view === 'login') body = vLogin();
  else if (S.view === 'daftar') body = vDaftar();
  else if (S.view === 'lupa') body = vLupa();
  else body = { utama: tUtama, video: tVideo, komuniti: tKomuniti, akaun: tAkaun }[S.tab]();
  app.innerHTML = `<div class="shell">${body}</div>${S.view === 'app' ? nav() : ''}${modal()}`;
}
function render() { draw(); restoreInputs(); if (S.modal === 'qibla') drawCompass(); else if (Q.listening) stopCompass(); }
window.render = render;

// ---------- video ----------
async function loadVideos() {
  const r = await api('GET', '/api/videos');
  if (r.status === 401) { S.user = null; S.view = 'login'; render(); return; }
  if (r.ok) { S.videos = r.videos; S.continueId = r.continueId; if (!S.playing) render(); }
}

let pj = null, lastSaved = 0, lastSeconds = 0, lastDuration = 0;
function loadPlayerJs() {
  if (window.playerjs) return Promise.resolve();
  return new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
}
async function saveProgress(force) {
  if (!S.playing || !S.playing.embedUrl) return;
  const now = Date.now();
  if (!force && now - lastSaved < 30000) return; // setiap 30 saat
  lastSaved = now;
  api('POST', `/api/videos/${S.playing.video.id}/progress`, { seconds: Math.floor(lastSeconds) });
}
async function stopPlayer() {
  if (S.playing) { await saveProgress(true); }
  S.playing = null; pj = null; lastSeconds = 0;
}
async function openVideo(id) {
  const v = S.videos.find(x => x.id === id);
  if (!S.user.active) { S.modal = 'subscribe'; if (!S.plans) loadPlans(); render(); return; }
  S.tab = 'video'; S.playing = { video: v, embedUrl: null }; S.vqa = null; window.scrollTo(0, 0); render();
  loadVqa(id);
  const r = await api('GET', `/api/videos/${id}/play`);
  if (!r.ok) {
    if (r.status === 402) { S.user.active = false; S.playing = null; S.modal = 'subscribe'; if (!S.plans) loadPlans(); render(); return; }
    S.playing.error = r.error; render(); return;
  }
  Object.assign(S.playing, { embedUrl: r.embedUrl, resumeAt: r.resumeAt, watermark: r.watermark });
  lastSeconds = r.resumeAt || 0;
  render();
  try {
    await loadPlayerJs();
    const frame = document.getElementById('vframe');
    if (!frame || !window.playerjs) return;
    pj = new playerjs.Player(frame);
    pj.on('ready', () => {
      if (S.playing && S.playing.resumeAt > 30) pj.setCurrentTime(S.playing.resumeAt - 5);
      pj.on('timeupdate', d => { lastSeconds = d.seconds; lastDuration = d.duration || lastDuration; saveProgress(false); });
      pj.on('pause', () => saveProgress(true));
      pj.on('ended', () => { lastSeconds = lastDuration || lastSeconds; saveProgress(true); });
    });
  } catch (e) { console.warn('player.js tidak dimuatkan', e); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveProgress(true); });

function openSolatSettings() {
  S.sf = { zone: S.user.solatZone || (S.solat && S.solat.zone && S.solat.zone.code) || 'WLY01', azan: [...(S.user.azan || [])] };
  if (!S.sf.azan.length && S.push.state === 'on') S.sf.azan = [...AZAN_KEYS]; // cadangan lalai: semua waktu
  S.modal = 'solat'; S.err = ''; loadZones();
}
// Simpan pilihan borang solat supaya kekal bila skrin dilukis semula
document.addEventListener('change', e => {
  if (!S.sf) return;
  if (e.target.id === 'sZone') S.sf.zone = e.target.value;
  if (e.target.dataset && e.target.dataset.az) {
    const k = e.target.dataset.az;
    S.sf.azan = e.target.checked ? [...new Set([...S.sf.azan, k])] : S.sf.azan.filter(x => x !== k);
  }
});

// ---------- tindakan ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, v = el.dataset.v;
  if (a === 'backdrop' && e.target !== el) return; // klik dalam modal
  switch (a) {
    case 'go': S.view = v; S.err = ''; S.lupaAdmin = false; S.reset = { step: 1, phone: '', msg: '' }; window.scrollTo(0, 0); break;
    case 'lupaAdmin': S.lupaAdmin = true; S.err = ''; break;
    case 'resendCode': S.reset.step = 1; S.err = ''; break;
    case 'lang':
      setLang(v);
      if (S.user) { S.user.lang = LANG; api('POST', '/api/me/lang', { lang: LANG }); }
      S.err = '';
      break;
    case 'tab': await stopPlayer(); S.tab = v; window.scrollTo(0, 0); if (v === 'video' || v === 'utama') loadVideos(); if (v === 'utama' || v === 'komuniti') loadAnn(); if (v === 'komuniti' && S.kTab === 'soaljawab') loadQa(); if (v === 'utama' && !S.solat) loadSolat(); break;
    case 'vfilter': S.filter = v; break;
    case 'kTab': S.kTab = v; if (v === 'soaljawab') loadQa(); else loadAnn(); break;
    case 'solatSettings': openSolatSettings(); break;
    case 'solatRetry': S.solat = null; loadSolat(); break;
    case 'qibla': openQibla(); return;
    case 'qiblaStart': startCompass(); return;
    case 'ask':
      if (!S.user.active) { S.modal = 'subscribe'; if (!S.plans) loadPlans(); break; }
      S.askVideo = v ? Number(v) : null; S.modal = 'ask'; S.err = ''; break;
    case 'qDelete': {
      const r = await busy(el, () => api('POST', `/api/questions/${v}/delete`, {}));
      if (!r.ok) { toast(r.error); return; }
      S.qa = S.qa && S.qa.filter(q => String(q.id) !== v); S.vqa = S.vqa && S.vqa.filter(q => String(q.id) !== v);
      toast(t('Soalan ditarik balik.'));
      break;
    }
    case 'pushOn': await enablePush(el); if (S.modal === 'solat' && S.push.state === 'on' && !S.sf.azan.length) { S.sf.azan = [...AZAN_KEYS]; render(); } return;
    case 'pushOff': await disablePush(); toast(t('Peringatan dimatikan di telefon ini.')); break;
    case 'pushTest': { const r = await busy(el, () => api('POST', '/api/push/test')); toast(r.ok ? t('Notifikasi ujian dihantar. Semak telefon anda.') : r.error); return; }
    case 'play': openVideo(Number(v)); return;
    case 'stopPlay': await stopPlayer(); window.scrollTo(0, 0); loadVideos(); break;
    case 'theme': toggleTheme(); break;
    case 'themeSet': Prefs.set('theme', v); applyPrefs(); break;
    case 'big': Prefs.set('big', Prefs.get('big', '0') === '1' ? '0' : '1'); applyPrefs(); break;
    case 'bigSet': Prefs.set('big', v); applyPrefs(); break;
    case 'install': doInstall(); return;
    case 'modal': S.modal = v; S.err = ''; break;
    case 'subscribe': S.modal = 'subscribe'; S.err = ''; if (!S.plans) loadPlans(); break;
    case 'planPick': S.pay.plan = v; break;
    case 'payAuto': S.pay.auto = v === '1'; break;
    case 'payGo': {
      const r = await busy(el, () => api('POST', '/api/pay/checkout', { planId: S.pay.plan, auto: S.pay.auto }));
      if (!r.ok) { S.err = r.error; break; }
      el.disabled = true; el.textContent = t('Membuka halaman bayaran...');
      location.href = r.checkoutUrl; return;
    }
    case 'payDone': S.modal = null; S.tab = 'video'; window.scrollTo(0, 0); loadVideos(); break;
    case 'stopAutoGo': {
      const r = await busy(el, () => api('POST', '/api/pay/stop-auto', {}));
      if (!r.ok) { toast(r.error); return; }
      S.user.autoRenew = false; S.modal = null; toast(t('Auto-renew dihentikan. Langganan kekal aktif hingga tarikh tamat.'));
      break;
    }
    case 'history': S.modal = 'history'; S.history = null; api('GET', '/api/pay/history').then(r => { S.history = r.ok ? r.payments : []; if (S.modal === 'history') render(); }); break;
    case 'close': case 'backdrop': S.modal = null; S.err = ''; S.sf = null; break;
    case 'logout':
      await stopPlayer(); S.videos = null; S.continueId = null; S.ann = null; S.qa = null; S.solat = null;
      if (S.push.state === 'on') await disablePush(); // peranti ini tak lagi terima notifikasi akaun ini
      await api('POST', '/api/logout', {});
      S.user = null; S.view = 'login'; S.tab = 'utama';
      toast(t('Anda telah log keluar.'));
      break;
    default: return;
  }
  render();
});

function afterLogin() {
  loadVideos(); loadAnn(); loadSolat(); checkPush().then(render);
  // Bahasa notifikasi ikut bahasa paparan peranti ini
  if (S.user.lang !== LANG) { S.user.lang = LANG; api('POST', '/api/me/lang', { lang: LANG }); }
}

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type="submit"]');
  if (f.id === 'fLogin') {
    const r = await busy(btn, () => api('POST', '/api/login', { phone: val('lPhone'), pin: val('lPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user = r.user; S.view = 'app'; S.tab = 'utama'; S.err = ''; afterLogin();
    toast('Assalamualaikum, ' + r.user.name);
  }
  if (f.id === 'fDaftar') {
    if (val('dPin') !== val('dPin2')) { S.err = t('PIN tidak sama. Sila masukkan semula.'); render(); return; }
    const r = await busy(btn, () => api('POST', '/api/register', { name: val('dName'), phone: val('dPhone'), email: val('dEmail'), pin: val('dPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user = r.user; S.view = 'app'; S.tab = 'utama'; S.err = ''; afterLogin();
    toast(t('Pendaftaran berjaya. Selamat datang!'));
  }
  if (f.id === 'fForgot') {
    const phone = val('fPhone');
    const r = await busy(btn, () => api('POST', '/api/pin/forgot', { phone }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.reset = { step: 2, phone, msg: r.hint ? t('Kod dihantar ke {email}. Semak juga folder Spam.', { email: r.hint }) : r.message };
    S.err = '';
  }
  if (f.id === 'fReset') {
    if (val('rPin') !== val('rPin2')) { S.err = t('PIN baharu tidak sama.'); render(); return; }
    const r = await busy(btn, () => api('POST', '/api/pin/reset', { phone: S.reset.phone, code: val('rCode'), pin: val('rPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.view = 'login'; S.err = ''; S.reset = { step: 1, phone: '', msg: '' };
    toast(t('PIN baharu disimpan. Sila log masuk.'));
  }
  if (f.id === 'fSolat') {
    const r = await busy(btn, () => api('POST', '/api/me/solat', { zone: S.sf.zone, azan: S.sf.azan }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user.solatZone = r.solatZone; S.user.azan = r.azan; S.modal = null; S.sf = null; S.err = '';
    toast(r.azan.length && S.push.state === 'on' ? t('Disimpan. Telefon akan berbunyi bila masuk waktu solat.') : t('Tetapan waktu solat disimpan.'));
    loadSolat();
  }
  if (f.id === 'fAsk') {
    const r = await busy(btn, () => api('POST', '/api/questions', { body: val('askBody'), videoId: S.askVideo }));
    if (!r.ok) {
      if (r.status === 402) { S.user.active = false; S.modal = 'subscribe'; if (!S.plans) loadPlans(); render(); return; }
      S.err = r.error; render(); return;
    }
    forget('askBody'); S.modal = null; S.err = '';
    if (S.askVideo && S.vqa) S.vqa.unshift(r.question);
    if (S.qa) S.qa.unshift(r.question);
    toast(t('Soalan dihantar. Ustaz akan jawab, insya-Allah.'));
  }
  if (f.id === 'fEmail') {
    const r = await busy(btn, () => api('POST', '/api/me/email', { email: val('eEmail'), pin: val('ePin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.user.email = r.email; S.modal = S.plans && S.plans.billingReady ? 'subscribe' : null; S.err = '';
    toast(t('Emel disimpan.'));
  }
  if (f.id === 'fPin') {
    if (val('pNew') !== val('pNew2')) { S.err = t('PIN baharu tidak sama.'); render(); return; }
    const r = await busy(btn, () => api('POST', '/api/me/pin', { oldPin: val('pOld'), newPin: val('pNew') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.modal = null; S.err = '';
    toast(t('PIN berjaya ditukar.'));
  }
  if (f.id === 'fDelete') {
    const r = await busy(btn, () => api('POST', '/api/me/delete', { pin: val('xPin') }));
    if (!r.ok) { S.err = r.error; render(); return; }
    S.modal = null; S.user = null; S.view = 'login'; S.err = '';
    toast(t('Akaun anda telah dipadam.'));
  }
  render();
});


(async function start() {
  api('GET', '/api/config').then(c => { if (c.ok) { S.cfg = { emailReset: !!c.emailReset, org: c.org || {} }; if (S.view === 'lupa' || (S.view === 'app' && S.tab === 'akaun')) render(); } });
  // Pautan dari notifikasi: /?k=soaljawab atau /?k=pengumuman
  const k = new URLSearchParams(location.search).get('k');
  if (k === 'soaljawab' || k === 'pengumuman') { S.tab = 'komuniti'; S.kTab = k; history.replaceState(null, '', '/'); }
  // Kembali dari halaman bayaran CHIP: /?bayar=berjaya|gagal|batal&p=ID
  const qs = new URLSearchParams(location.search), bayar = qs.get('bayar'), payId = Number(qs.get('p')) || null;
  if (bayar) history.replaceState(null, '', '/');
  const r = await api('GET', '/api/me');
  if (r.ok) {
    S.user = r.user; S.view = 'app'; afterLogin(); if (S.kTab === 'soaljawab') loadQa();
    if (bayar === 'berjaya' && payId) { checkPayment(payId); return; }
    if (bayar === 'gagal' && payId) { S.modal = 'payResult'; S.payResult = { state: 'failed' }; }
    if (bayar === 'batal') setTimeout(() => toast(t('Pembayaran dibatalkan. Tiada caj dibuat.')), 300);
  }
  else S.view = 'login';
  render();
})();
