// Zikir & Selawat: audio ustaz (fail di R2, maklumat di D1). Percuma untuk semua pelajar berdaftar.
// Fail dihantar melalui Worker (perlu log masuk) dengan sokongan Range supaya boleh lompat & main di iPhone.
import { now, json, fail, readJson, cleanText, cleanMultiline } from './util.js';
import { requireUser, requireAdmin } from './auth.js';

const MAX_BYTES = 95 * 1024 * 1024; // had badan permintaan Workers ialah 100MB
const TYPES = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'aac',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/3gpp': '3gp',
};

const ASMA = [
  ['الرَّحْمٰنُ', 'Ar-Rahman'], ['الرَّحِيْمُ', 'Ar-Rahim'], ['الْمَلِكُ', 'Al-Malik'], ['الْقُدُّوْسُ', 'Al-Quddus'], ['السَّلَامُ', 'As-Salam'],
  ['الْمُؤْمِنُ', "Al-Mu'min"], ['الْمُهَيْمِنُ', 'Al-Muhaimin'], ['الْعَزِيْزُ', "Al-'Aziz"], ['الْجَبَّارُ', 'Al-Jabbar'], ['الْمُتَكَبِّرُ', 'Al-Mutakabbir'],
  ['الْخَالِقُ', 'Al-Khaliq'], ['الْبَارِئُ', "Al-Bari'"], ['الْمُصَوِّرُ', 'Al-Musawwir'], ['الْغَفَّارُ', 'Al-Ghaffar'], ['الْقَهَّارُ', 'Al-Qahhar'],
  ['الْوَهَّابُ', 'Al-Wahhab'], ['الرَّزَّاقُ', 'Ar-Razzaq'], ['الْفَتَّاحُ', 'Al-Fattah'], ['الْعَلِيْمُ', "Al-'Alim"], ['الْقَابِضُ', 'Al-Qabidh'],
  ['الْبَاسِطُ', 'Al-Basith'], ['الْخَافِضُ', 'Al-Khafidh'], ['الرَّافِعُ', "Ar-Rafi'"], ['الْمُعِزُّ', "Al-Mu'izz"], ['الْمُذِلُّ', 'Al-Muzill'],
  ['السَّمِيْعُ', "As-Sami'"], ['الْبَصِيْرُ', 'Al-Basir'], ['الْحَكَمُ', 'Al-Hakam'], ['الْعَدْلُ', "Al-'Adl"], ['اللَّطِيْفُ', 'Al-Latif'],
  ['الْخَبِيْرُ', 'Al-Khabir'], ['الْحَلِيْمُ', 'Al-Halim'], ['الْعَظِيْمُ', "Al-'Azim"], ['الْغَفُوْرُ', 'Al-Ghafur'], ['الشَّكُوْرُ', 'Asy-Syakur'],
  ['الْعَلِيُّ', "Al-'Aliy"], ['الْكَبِيْرُ', 'Al-Kabir'], ['الْحَفِيْظُ', 'Al-Hafiz'], ['الْمُقِيْتُ', 'Al-Muqit'], ['الْحَسِيْبُ', 'Al-Hasib'],
  ['الْجَلِيْلُ', 'Al-Jalil'], ['الْكَرِيْمُ', 'Al-Karim'], ['الرَّقِيْبُ', 'Ar-Raqib'], ['الْمُجِيْبُ', 'Al-Mujib'], ['الْوَاسِعُ', "Al-Wasi'"],
  ['الْحَكِيْمُ', 'Al-Hakim'], ['الْوَدُوْدُ', 'Al-Wadud'], ['الْمَجِيْدُ', 'Al-Majid'], ['الْبَاعِثُ', "Al-Ba'ith"], ['الشَّهِيْدُ', 'Asy-Syahid'],
  ['الْحَقُّ', 'Al-Haqq'], ['الْوَكِيْلُ', 'Al-Wakil'], ['الْقَوِيُّ', 'Al-Qawiy'], ['الْمَتِيْنُ', 'Al-Matin'], ['الْوَلِيُّ', 'Al-Waliy'],
  ['الْحَمِيْدُ', 'Al-Hamid'], ['الْمُحْصِيْ', 'Al-Muhsi'], ['الْمُبْدِئُ', "Al-Mubdi'"], ['الْمُعِيْدُ', "Al-Mu'id"], ['الْمُحْيِيْ', 'Al-Muhyi'],
  ['الْمُمِيْتُ', 'Al-Mumit'], ['الْحَيُّ', 'Al-Hayy'], ['الْقَيُّوْمُ', 'Al-Qayyum'], ['الْوَاجِدُ', 'Al-Wajid'], ['الْمَاجِدُ', 'Al-Majid'],
  ['الْوَاحِدُ', 'Al-Wahid'], ['الْأَحَدُ', 'Al-Ahad'], ['الصَّمَدُ', 'As-Samad'], ['الْقَادِرُ', 'Al-Qadir'], ['الْمُقْتَدِرُ', 'Al-Muqtadir'],
  ['الْمُقَدِّمُ', 'Al-Muqaddim'], ['الْمُؤَخِّرُ', "Al-Mu'akhkhir"], ['الْأَوَّلُ', 'Al-Awwal'], ['الْآخِرُ', 'Al-Akhir'], ['الظَّاهِرُ', 'Az-Zahir'],
  ['الْبَاطِنُ', 'Al-Batin'], ['الْوَالِيْ', 'Al-Wali'], ['الْمُتَعَالِيْ', "Al-Muta'ali"], ['الْبَرُّ', 'Al-Barr'], ['التَّوَّابُ', 'At-Tawwab'],
  ['الْمُنْتَقِمُ', 'Al-Muntaqim'], ['الْعَفُوُّ', "Al-'Afuw"], ['الرَّءُوْفُ', "Ar-Ra'uf"], ['مَالِكُ الْمُلْكِ', 'Malikul Mulk'], ['ذُو الْجَلَالِ وَالْإِكْرَامِ', 'Zul Jalali wal Ikram'],
  ['الْمُقْسِطُ', 'Al-Muqsit'], ['الْجَامِعُ', "Al-Jami'"], ['الْغَنِيُّ', 'Al-Ghaniy'], ['الْمُغْنِيْ', 'Al-Mughni'], ['الْمَانِعُ', "Al-Mani'"],
  ['الضَّارُّ', 'Adh-Dharr'], ['النَّافِعُ', "An-Nafi'"], ['النُّوْرُ', 'An-Nur'], ['الْهَادِيْ', 'Al-Hadi'], ['الْبَدِيْعُ', "Al-Badi'"],
  ['الْبَاقِيْ', 'Al-Baqi'], ['الْوَارِثُ', 'Al-Warith'], ['الرَّشِيْدُ', 'Ar-Rasyid'], ['الصَّبُوْرُ', 'As-Sabur'],
];

// Draf contoh (tanpa fail audio). Ustaz semak teks & muat naik audio sebelum terbit.
const SEED = [
  ['Asmaul Husna', 'Asmaul Husna (99 names of Allah)',
    ASMA.map(a => a[0]).join('، '),
    ASMA.map(a => a[1]).join(', '),
    'Nama-nama Allah yang indah. Rasulullah ﷺ bersabda: Allah mempunyai 99 nama; sesiapa yang menghitungnya (menghafal dan memahaminya) akan masuk syurga.',
    'The beautiful names of Allah. The Prophet ﷺ said: Allah has 99 names; whoever enumerates them (memorises and understands them) will enter Paradise.',
    'Riwayat al-Bukhari dan Muslim'],
  ['Selawat Tafrijiyah', 'Salawat Tafrijiyah',
    'اَللّٰهُمَّ صَلِّ صَلَاةً كَامِلَةً وَسَلِّمْ سَلَامًا تَامًّا عَلٰى سَيِّدِنَا مُحَمَّدٍ الَّذِيْ تَنْحَلُّ بِهِ الْعُقَدُ، وَتَنْفَرِجُ بِهِ الْكُرَبُ، وَتُقْضٰى بِهِ الْحَوَائِجُ، وَتُنَالُ بِهِ الرَّغَائِبُ وَحُسْنُ الْخَوَاتِيْمِ، وَيُسْتَسْقَى الْغَمَامُ بِوَجْهِهِ الْكَرِيْمِ، وَعَلٰى آلِهِ وَصَحْبِهِ فِيْ كُلِّ لَمْحَةٍ وَنَفَسٍ بِعَدَدِ كُلِّ مَعْلُوْمٍ لَكَ',
    "Allaahumma shalli shalaatan kaamilatan wa sallim salaaman taamman 'alaa sayyidinaa Muhammadinil ladzii tanhallu bihil 'uqadu, wa tanfariju bihil kurabu, wa tuqdhaa bihil hawaa-iju, wa tunaalu bihir raghaa-ibu wa husnul khawaatiim, wa yustasqal ghamaamu biwajhihil kariim, wa 'alaa aalihii wa shahbihii fii kulli lamhatin wa nafasin bi'adadi kulli ma'luumin lak",
    'Ya Allah, limpahkanlah selawat yang sempurna dan kesejahteraan yang penuh ke atas junjungan kami Nabi Muhammad, yang dengan berkatnya terlerai segala ikatan, hilang segala kesusahan, tertunai segala hajat, tercapai segala keinginan dan kesudahan yang baik, dan diturunkan hujan dengan berkat wajahnya yang mulia; dan ke atas keluarga serta sahabatnya pada setiap kerdipan mata dan hembusan nafas, sebanyak bilangan segala yang Engkau ketahui.',
    'O Allah, send perfect blessings and complete peace upon our master Muhammad, through whom knots are untied, hardships are relieved, needs are fulfilled, hopes and good endings are attained, and rain is sought by his noble face; and upon his family and companions, in every glance and breath, as many as everything known to You.',
    ''],
  ['Sayyidul Istighfar', 'Sayyidul Istighfar (master of seeking forgiveness)',
    'اَللّٰهُمَّ أَنْتَ رَبِّيْ لَا إِلٰهَ إِلَّا أَنْتَ، خَلَقْتَنِيْ وَأَنَا عَبْدُكَ، وَأَنَا عَلٰى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوْذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوْءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوْءُ بِذَنْبِيْ، فَاغْفِرْ لِيْ فَإِنَّهُ لَا يَغْفِرُ الذُّنُوْبَ إِلَّا أَنْتَ',
    "Allaahumma anta rabbii laa ilaaha illaa anta, khalaqtanii wa ana 'abduka, wa ana 'alaa 'ahdika wa wa'dika mastatha'tu, a'uudzu bika min syarri maa shana'tu, abuu-u laka bini'matika 'alayya, wa abuu-u bidzanbii, faghfir lii fa innahuu laa yaghfirudz dzunuuba illaa anta",
    'Ya Allah, Engkaulah Tuhanku, tiada Tuhan melainkan Engkau. Engkau yang menciptakan aku dan aku adalah hamba-Mu. Aku berpegang pada perjanjian dan janji-Mu sedaya upayaku. Aku berlindung kepada-Mu daripada keburukan perbuatanku. Aku mengakui nikmat-Mu ke atasku dan aku mengakui dosaku, maka ampunkanlah aku, kerana sesungguhnya tiada yang mengampunkan dosa melainkan Engkau.',
    'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant. I keep Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins except You.',
    'Riwayat al-Bukhari'],
  ['Zikir La ilaha illa anta', 'Dhikr La ilaha illa anta (prayer of Prophet Yunus)',
    'لَا إِلٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّيْ كُنْتُ مِنَ الظّٰلِمِيْنَ',
    'Laa ilaaha illaa anta subhaanaka innii kuntu minazh zhaalimiin',
    'Tiada Tuhan melainkan Engkau, Maha Suci Engkau, sesungguhnya aku termasuk dalam kalangan orang yang zalim.',
    'There is no god but You, glory be to You; indeed I have been among the wrongdoers.',
    "Surah al-Anbiya' 21:87"],
];

function shape(a, admin) {
  return {
    id: a.id, title: a.title, titleEn: a.title_en || '', arabic: a.arabic || '', rumi: a.rumi || '', meaning: a.meaning || '',
    meaningEn: a.meaning_en || '', source: a.source || '', durationSec: a.duration_sec || 0, hasAudio: !!a.r2_key,
    sort: a.sort, published: !!a.published, updatedAt: a.updated_at || a.created_at,
    ...(admin ? { size: a.size || 0, mime: a.mime || '' } : {}),
  };
}

export const audioReady = env => !!env.AUDIO;

async function seedOnce(env) {
  const done = await env.DB.prepare("SELECT value FROM settings WHERE key = 'audio_seeded'").first();
  if (done) return;
  const t = now();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM audios').first()).n;
  const stmts = n ? [] : SEED.map(([title, titleEn, arabic, rumi, meaning, meaningEn, source], i) =>
    env.DB.prepare(`INSERT INTO audios (title, title_en, arabic, rumi, meaning, meaning_en, source, sort, published, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).bind(title, titleEn, arabic, rumi, meaning, meaningEn, source || null, (i + 1) * 10, t));
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('audio_seeded', '1', ?)").bind(t));
  await env.DB.batch(stmts);
}

// ---------- pelajar ----------
export async function listAudios(env, request) {
  await requireUser(env, request);
  const { results } = await env.DB.prepare('SELECT * FROM audios WHERE published = 1 AND r2_key IS NOT NULL ORDER BY sort, id').all();
  return json({ ok: true, audios: results.map(a => shape(a)) });
}

async function serve(env, request, a) {
  if (!env.AUDIO || !a || !a.r2_key) return fail(404, 'Audio tidak dijumpai.');
  let obj;
  try { obj = await env.AUDIO.get(a.r2_key, { range: request.headers }); }
  catch { obj = await env.AUDIO.get(a.r2_key); } // julat tidak sah: hantar fail penuh
  if (!obj) return fail(404, 'Audio tidak dijumpai.');
  const h = new Headers();
  obj.writeHttpMetadata(h);
  if (!h.get('content-type')) h.set('content-type', a.mime || 'audio/mpeg');
  h.set('etag', obj.httpEtag);
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'private, max-age=86400');
  const r = obj.range;
  if (request.headers.has('range') && r) {
    const start = r.offset !== undefined ? r.offset : Math.max(0, obj.size - r.suffix);
    const len = r.length !== undefined ? r.length : obj.size - start;
    h.set('content-range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    h.set('content-length', String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('content-length', String(obj.size));
  return new Response(obj.body, { headers: h });
}

export async function streamAudio(env, request, id) {
  await requireUser(env, request);
  const a = await env.DB.prepare('SELECT * FROM audios WHERE id = ? AND published = 1').bind(id).first();
  return serve(env, request, a);
}

// ---------- admin ----------
export async function adminListAudios(env, request) {
  await requireAdmin(env, request);
  await seedOnce(env);
  const { results } = await env.DB.prepare('SELECT * FROM audios ORDER BY sort, id').all();
  return json({ ok: true, audios: results.map(a => shape(a, true)), storageReady: audioReady(env) });
}

export async function adminAudioFile(env, request, id) {
  await requireAdmin(env, request);
  const a = await env.DB.prepare('SELECT * FROM audios WHERE id = ?').bind(id).first();
  return serve(env, request, a);
}

function readAudio(b, old) {
  const v = { ...(old ? shape(old) : {}), ...b };
  const d = {
    title: cleanText(v.title, 80),
    titleEn: cleanText(v.titleEn, 80),
    arabic: cleanMultiline(v.arabic, 6000),
    rumi: cleanMultiline(v.rumi, 6000),
    meaning: cleanMultiline(v.meaning, 3000),
    meaningEn: cleanMultiline(v.meaningEn, 3000),
    source: cleanText(v.source, 120),
    sort: Number.isFinite(Number(v.sort)) ? Math.max(0, Math.min(100000, Math.round(Number(v.sort)))) : 0,
    published: v.published ? 1 : 0,
    durationSec: Number.isFinite(Number(v.durationSec)) ? Math.max(0, Math.min(86400, Math.round(Number(v.durationSec)))) : 0,
  };
  if (!d.title) return { error: 'Sila isi tajuk.' };
  return d;
}

export async function adminCreateAudio(env, request) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  if (b.sort === undefined) b.sort = ((await env.DB.prepare('SELECT MAX(sort) AS s FROM audios').first()).s || 0) + 10;
  b.published = false; // terbit hanya selepas fail audio dimuat naik
  const d = readAudio(b);
  if (d.error) return fail(400, d.error);
  const row = await env.DB.prepare(`INSERT INTO audios (title, title_en, arabic, rumi, meaning, meaning_en, source, sort, published, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?) RETURNING *`)
    .bind(d.title, d.titleEn || null, d.arabic || null, d.rumi || null, d.meaning || null, d.meaningEn || null, d.source || null, d.sort, now()).first();
  return json({ ok: true, audio: shape(row, true) }, 201);
}

export async function adminUpdateAudio(env, request, id) {
  await requireAdmin(env, request);
  const old = await env.DB.prepare('SELECT * FROM audios WHERE id = ?').bind(id).first();
  if (!old) return fail(404, 'Audio tidak dijumpai.');
  const d = readAudio(await readJson(request), old);
  if (d.error) return fail(400, d.error);
  if (d.published && !old.r2_key) return fail(400, 'Muat naik fail audio dahulu sebelum terbit.');
  const row = await env.DB.prepare(`UPDATE audios SET title = ?, title_en = ?, arabic = ?, rumi = ?, meaning = ?, meaning_en = ?, source = ?,
      sort = ?, published = ?, duration_sec = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .bind(d.title, d.titleEn || null, d.arabic || null, d.rumi || null, d.meaning || null, d.meaningEn || null, d.source || null,
      d.sort, d.published, d.durationSec || null, now(), id).first();
  return json({ ok: true, audio: shape(row, true) });
}

// Muat naik fail: badan permintaan ialah fail audio itu sendiri (bukan borang)
export async function adminUploadAudio(env, request, id) {
  await requireAdmin(env, request);
  if (!env.AUDIO) return fail(503, 'Storan audio (R2) belum disambung.');
  const old = await env.DB.prepare('SELECT * FROM audios WHERE id = ?').bind(id).first();
  if (!old) return fail(404, 'Audio tidak dijumpai.');
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return fail(415, 'Jenis fail tidak disokong. Guna MP3 atau M4A.');
  const size = Number(request.headers.get('content-length') || 0);
  if (!size) return fail(411, 'Saiz fail tidak diketahui. Cuba muat naik semula.');
  if (size > MAX_BYTES) return fail(413, 'Fail terlalu besar (had 95MB). Simpan sebagai MP3 atau pendekkan rakaman.');
  const key = `audio/${id}-${now()}.${ext}`;
  await env.AUDIO.put(key, request.body, { httpMetadata: { contentType: type === 'audio/mp3' ? 'audio/mpeg' : type } });
  const dur = Number(new URL(request.url).searchParams.get('duration'));
  const row = await env.DB.prepare('UPDATE audios SET r2_key = ?, mime = ?, size = ?, duration_sec = COALESCE(?, duration_sec), updated_at = ? WHERE id = ? RETURNING *')
    .bind(key, type, size, Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null, now(), id).first();
  if (old.r2_key && old.r2_key !== key) { try { await env.AUDIO.delete(old.r2_key); } catch (e) { console.error('padam audio lama', e); } }
  return json({ ok: true, audio: shape(row, true) });
}

export async function adminDeleteAudio(env, request, id) {
  await requireAdmin(env, request);
  const old = await env.DB.prepare('SELECT r2_key FROM audios WHERE id = ?').bind(id).first();
  await env.DB.prepare('DELETE FROM audios WHERE id = ?').bind(id).run();
  if (old && old.r2_key && env.AUDIO) { try { await env.AUDIO.delete(old.r2_key); } catch (e) { console.error('padam audio', e); } }
  return json({ ok: true });
}
