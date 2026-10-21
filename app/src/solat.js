// Waktu solat (JAKIM) dan notifikasi azan.
//
// Sumber utama: JAKIM e-Solat (rasmi). Sandaran: api.waktusolat.app (salinan data JAKIM).
// Waktu disimpan dalam jadual prayer_times (sebulan setiap kali ambil), jadi API luar
// hanya dipanggil sekali sebulan bagi setiap zon yang digunakan.
import { now, json, fail, readJson } from './util.js';
import { requireUser } from './auth.js';
import { ZONES, DEFAULT_ZONE, zoneInfo, zoneShort } from './zones.js';
import { notify } from './push.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const NAMES = {
  ms: { imsak: 'Imsak', fajr: 'Subuh', syuruk: 'Syuruk', dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak' },
  en: { imsak: 'Imsak', fajr: 'Fajr', syuruk: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
};
const MY = 8 * 3600e3; // UTC+8
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12 };
const pad = n => String(n).padStart(2, '0');

// Tarikh Malaysia (YYYY-MM-DD) bagi satu masa
export const myDate = ms => new Date(ms + MY).toISOString().slice(0, 10);
// "YYYY-MM-DD" + "HH:MM:SS" waktu Malaysia → epoch ms
const myEpoch = (date, hms) => Date.parse(`${date}T${hms.length === 5 ? hms + ':00' : hms}+08:00`);

function myClock(ms, lang) {
  const d = new Date(ms + MY), h = d.getUTCHours(), m = pad(d.getUTCMinutes());
  if (lang === 'en') return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam';
  return `${h % 12 || 12}.${m} ${part}`;
}

// ---------- ambil data ----------
// JAKIM: tarikh "21-Oct-2026", waktu "05:47:00"
function parseJakim(data) {
  const rows = [];
  for (const p of data.prayerTime || []) {
    const m = String(p.date || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!m || !MON[m[2].toLowerCase()]) continue;
    const date = `${m[3]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`;
    const row = { date, hijri: p.hijri || null };
    let ok = true;
    for (const k of ['imsak', 'fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(p[k] || '')) { if (k !== 'imsak') ok = false; row[k] = null; continue; }
      row[k] = myEpoch(date, p[k]);
    }
    if (ok) rows.push(row);
  }
  return rows;
}

// waktusolat.app v2: { year, month_number, prayers: [{ day, hijri, fajr: <saat epoch>, ... }] }
function parseAlt(data, year, month) {
  const list = data.prayers || data.prayerTime || [];
  const y = data.year || year, mo = data.month_number || month;
  const rows = [];
  for (const p of list) {
    if (typeof p.fajr !== 'number') continue;
    const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : `${y}-${pad(mo)}-${pad(p.day)}`;
    const row = { date, hijri: p.hijri || null };
    for (const k of ['imsak', 'fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha']) row[k] = typeof p[k] === 'number' ? p[k] * 1000 : null;
    if (row.imsak == null) row.imsak = row.fajr - 10 * 60e3;
    rows.push(row);
  }
  return rows;
}

async function fetchMonth(env, zone, year, month) {
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  const jakim = env.JAKIM_API || 'https://www.e-solat.gov.my/index.php';
  try {
    const r = await fetch(`${jakim}?r=esolatApi/takwimsolat&period=duration&zone=${zone}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': 'MadrasahOnline/1.0' },
      body: `datestart=${first}&dateend=${last}`,
      cf: { cacheTtl: 3600 },
    });
    if (r.ok) {
      const rows = parseJakim(await r.json());
      if (rows.length >= 28) return { rows, source: 'jakim' };
    }
    console.warn('JAKIM e-Solat', zone, r.status);
  } catch (e) { console.warn('JAKIM e-Solat ralat', zone, String(e)); }
  const alt = env.WAKTUSOLAT_API || 'https://api.waktusolat.app';
  const r2 = await fetch(`${alt}/v2/solat/${zone}?year=${year}&month=${month}`, { headers: { accept: 'application/json' } });
  if (!r2.ok) throw new Error('waktusolat.app ' + r2.status);
  const rows = parseAlt(await r2.json(), year, month);
  if (rows.length < 28) throw new Error('waktusolat.app data tidak lengkap');
  return { rows, source: 'waktusolat' };
}

// Pastikan waktu bagi tarikh itu ada dalam D1; ambil sebulan jika tiada.
export async function getDay(env, zone, date) {
  const q = () => env.DB.prepare('SELECT * FROM prayer_times WHERE zone = ? AND date = ?').bind(zone, date).first();
  let row = await q();
  if (row) return row;
  const [y, m] = date.split('-').map(Number);
  const { rows, source } = await fetchMonth(env, zone, y, m);
  const t = now();
  const stmts = rows.map(r => env.DB.prepare(`INSERT OR REPLACE INTO prayer_times (zone, date, hijri, imsak, fajr, syuruk, dhuhr, asr, maghrib, isha, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(zone, r.date, r.hijri, r.imsak, r.fajr, r.syuruk, r.dhuhr, r.asr, r.maghrib, r.isha, source, t));
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  row = await q();
  if (!row) throw new Error('Tarikh tiada dalam data ' + zone + ' ' + date);
  return row;
}

const dayShape = r => r && ({ date: r.date, hijri: r.hijri, imsak: r.imsak, fajr: r.fajr, syuruk: r.syuruk, dhuhr: r.dhuhr, asr: r.asr, maghrib: r.maghrib, isha: r.isha, source: r.source });

// ---------- API pelajar ----------
export function listZones() {
  return json({ ok: true, zones: ZONES.map(([code, state, area]) => ({ code, state, area })) }, 200, { 'cache-control': 'public, max-age=86400' });
}

export async function solatToday(env, request) {
  const u = await requireUser(env, request);
  const q = new URL(request.url).searchParams.get('zone');
  const zone = q && zoneInfo(q) ? q : (u.solat_zone || DEFAULT_ZONE);
  const t = now();
  try {
    const today = await getDay(env, zone, myDate(t));
    let tomorrow = null;
    try { tomorrow = await getDay(env, zone, myDate(t + 864e5)); } catch {}
    return json({ ok: true, zone: zoneInfo(zone), now: t, today: dayShape(today), tomorrow: dayShape(tomorrow) });
  } catch (e) {
    console.error('waktu solat', zone, String(e));
    return fail(502, 'Waktu solat tidak dapat dimuatkan sekarang. Cuba lagi sebentar.');
  }
}

export async function saveSolatPrefs(env, request) {
  const u = await requireUser(env, request);
  const b = await readJson(request);
  const zone = zoneInfo(b.zone) ? b.zone : null;
  if (!zone) return fail(400, 'Sila pilih kawasan.');
  const azan = Array.isArray(b.azan) ? PRAYERS.filter(p => b.azan.includes(p)) : [];
  await env.DB.prepare('UPDATE users SET solat_zone = ?, azan = ? WHERE id = ?').bind(zone, azan.join(',') || null, u.id).run();
  return json({ ok: true, solatZone: zone, azan });
}

// ---------- cron: notifikasi azan (setiap minit) ----------
export async function sendAzan(env) {
  const t = now();
  const { results: zones } = await env.DB.prepare(`SELECT DISTINCT COALESCE(u.solat_zone, ?) AS zone FROM users u
      JOIN push_subs ps ON ps.user_id = u.id WHERE u.azan IS NOT NULL AND u.azan != ''`).bind(DEFAULT_ZONE).all();
  let sent = 0;
  for (const { zone } of zones) {
    let row;
    try { row = await getDay(env, zone, myDate(t)); } catch (e) { console.warn('azan: tiada waktu', zone, String(e)); continue; }
    for (const p of PRAYERS) {
      const at = row[p];
      if (!at || t < at || t > at + 4 * 60e3) continue; // dalam 4 minit selepas masuk waktu
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO azan_sent (zone, date, prayer, sent_at) VALUES (?, ?, ?, ?)').bind(zone, row.date, p, t).run();
      if (!ins.meta.changes) continue;
      const area = zoneShort(zone);
      sent += await notify(env, { kind: 'azan', zone, prayer: p, defaultZone: DEFAULT_ZONE }, {
        ms: { title: `Waktu ${NAMES.ms[p]}`, body: `Telah masuk waktu solat ${NAMES.ms[p]} bagi ${area} dan kawasan sekitarnya (${myClock(at, 'ms')}).` },
        en: { title: `${NAMES.en[p]} prayer time`, body: `It is now time for ${NAMES.en[p]} prayer in ${area} and surrounding areas (${myClock(at, 'en')}).` },
        url: '/',
      });
    }
  }
  return sent;
}

// Simpan rekod azan_sent hanya 3 hari
export const cleanAzan = (env, t) => env.DB.prepare('DELETE FROM azan_sent WHERE sent_at < ?').bind(t - 3 * 864e5);
