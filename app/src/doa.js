// Doa harian: senarai doa yang diurus oleh admin/ustaz, dibaca oleh pelajar.
// Doa contoh dimasukkan sekali sahaja sebagai DRAF (tidak diterbitkan) supaya ustaz
// semak teks Arab, rumi dan maksud sebelum pelajar nampak.
import { now, json, fail, readJson, cleanText, cleanMultiline } from './util.js';
import { requireUser, requireAdmin } from './auth.js';

const SEED = [
  ['Harian', 'Sebelum makan', 'Before eating',
    'اَللّٰهُمَّ بَارِكْ لَنَا فِيْمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ',
    "Allaahumma baarik lanaa fiimaa razaqtanaa wa qinaa 'adzaaban naar",
    'Ya Allah, berkatilah rezeki yang Engkau kurniakan kepada kami dan peliharalah kami daripada azab neraka.',
    'O Allah, bless what You have provided for us and protect us from the punishment of the Fire.', ''],
  ['Harian', 'Selepas makan', 'After eating',
    'اَلْحَمْدُ لِلّٰهِ الَّذِيْ أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِيْنَ',
    "Alhamdu lillaahil ladzii ath'amanaa wa saqaanaa wa ja'alanaa muslimiin",
    'Segala puji bagi Allah yang telah memberi kami makan dan minum, serta menjadikan kami orang Islam.',
    'All praise is for Allah who fed us, gave us drink and made us Muslims.', 'Riwayat Abu Daud dan at-Tirmizi'],
  ['Harian', 'Sebelum tidur', 'Before sleeping',
    'بِاسْمِكَ اللّٰهُمَّ أَمُوْتُ وَأَحْيَا',
    'Bismika Allaahumma amuutu wa ahyaa',
    'Dengan nama-Mu ya Allah, aku mati dan aku hidup.',
    'In Your name, O Allah, I die and I live.', 'Riwayat al-Bukhari'],
  ['Harian', 'Bangun tidur', 'Waking up',
    'اَلْحَمْدُ لِلّٰهِ الَّذِيْ أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُوْرُ',
    "Alhamdu lillaahil ladzii ahyaanaa ba'da maa amaatanaa wa ilaihin nusyuur",
    'Segala puji bagi Allah yang menghidupkan kami setelah mematikan kami, dan kepada-Nya kami dibangkitkan.',
    'All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.', 'Riwayat al-Bukhari'],
  ['Harian', 'Masuk tandas', 'Entering the toilet',
    'اَللّٰهُمَّ إِنِّيْ أَعُوْذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    "Allaahumma innii a'uudzu bika minal khubutsi wal khabaa-its",
    'Ya Allah, aku berlindung kepada-Mu daripada syaitan lelaki dan syaitan perempuan.',
    'O Allah, I seek refuge in You from the male and female devils.', 'Riwayat al-Bukhari dan Muslim'],
  ['Harian', 'Keluar tandas', 'Leaving the toilet',
    'غُفْرَانَكَ',
    'Ghufraanak',
    'Aku memohon keampunan-Mu (ya Allah).',
    'I seek Your forgiveness.', 'Riwayat Abu Daud dan at-Tirmizi'],
  ['Harian', 'Keluar rumah', 'Leaving the house',
    'بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ، لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ',
    "Bismillaahi tawakkaltu 'alallaah, laa hawla wa laa quwwata illaa billaah",
    'Dengan nama Allah, aku bertawakal kepada Allah. Tiada daya dan kekuatan melainkan dengan pertolongan Allah.',
    'In the name of Allah, I place my trust in Allah. There is no might nor power except with Allah.', 'Riwayat Abu Daud dan at-Tirmizi'],
  ['Harian', 'Masuk rumah', 'Entering the house',
    'بِسْمِ اللّٰهِ وَلَجْنَا، وَبِسْمِ اللّٰهِ خَرَجْنَا، وَعَلَى اللّٰهِ رَبِّنَا تَوَكَّلْنَا',
    "Bismillaahi walajnaa, wa bismillaahi kharajnaa, wa 'alallaahi rabbinaa tawakkalnaa",
    'Dengan nama Allah kami masuk, dengan nama Allah kami keluar, dan kepada Allah Tuhan kami, kami bertawakal.',
    'In the name of Allah we enter, in the name of Allah we leave, and upon Allah our Lord we rely.', 'Riwayat Abu Daud'],
  ['Harian', 'Naik kenderaan', 'Boarding a vehicle',
    'سُبْحَانَ الَّذِيْ سَخَّرَ لَنَا هٰذَا وَمَا كُنَّا لَهُ مُقْرِنِيْنَ، وَإِنَّا إِلٰى رَبِّنَا لَمُنْقَلِبُوْنَ',
    'Subhaanal ladzii sakhkhara lanaa haadzaa wa maa kunnaa lahuu muqriniin, wa innaa ilaa rabbinaa lamunqalibuun',
    'Maha Suci Allah yang telah menundukkan kenderaan ini untuk kami, sedangkan kami tidak mampu menguasainya. Dan sesungguhnya kepada Tuhan kamilah kami akan kembali.',
    'Glory be to the One who has subjected this to us, for we could never have done it ourselves. And surely to our Lord we will return.', 'Surah az-Zukhruf 43:13-14'],
  ['Harian', 'Selepas wuduk', 'After ablution (wudu)',
    'أَشْهَدُ أَنْ لَا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُوْلُهُ',
    "Asyhadu an laa ilaaha illallaahu wahdahuu laa syariika lah, wa asyhadu anna Muhammadan 'abduhuu wa rasuuluh",
    'Aku bersaksi bahawa tiada Tuhan melainkan Allah Yang Maha Esa, tiada sekutu bagi-Nya, dan aku bersaksi bahawa Muhammad adalah hamba dan pesuruh-Nya.',
    'I bear witness that there is no god but Allah alone, without partner, and I bear witness that Muhammad is His servant and Messenger.', 'Riwayat Muslim'],
  ['Belajar & mengaji', 'Sebelum belajar / mengaji', 'Before studying / reciting',
    'رَبِّ اشْرَحْ لِيْ صَدْرِيْ، وَيَسِّرْ لِيْ أَمْرِيْ، وَاحْلُلْ عُقْدَةً مِّنْ لِّسَانِيْ، يَفْقَهُوْا قَوْلِيْ',
    "Rabbisy syrah lii shadrii, wa yassir lii amrii, wahlul 'uqdatam mil lisaanii, yafqahuu qaulii",
    'Ya Tuhanku, lapangkanlah dadaku, mudahkanlah urusanku, dan lepaskanlah kekelukan lidahku, supaya mereka faham perkataanku.',
    'My Lord, expand my chest, ease my task for me, and untie the knot from my tongue, so they may understand my speech.', 'Surah Taha 20:25-28'],
  ['Belajar & mengaji', 'Mohon tambah ilmu', 'Asking for more knowledge',
    'رَبِّ زِدْنِيْ عِلْمًا',
    "Rabbi zidnii 'ilmaa",
    'Ya Tuhanku, tambahkanlah ilmuku.',
    'My Lord, increase me in knowledge.', 'Surah Taha 20:114'],
  ['Doa pilihan', 'Kebaikan dunia dan akhirat', 'Good in this world and the Hereafter',
    'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَّفِي الْآخِرَةِ حَسَنَةً وَّقِنَا عَذَابَ النَّارِ',
    "Rabbanaa aatinaa fid dunyaa hasanah, wa fil aakhirati hasanah, wa qinaa 'adzaaban naar",
    'Wahai Tuhan kami, berikanlah kami kebaikan di dunia dan kebaikan di akhirat, dan peliharalah kami daripada azab neraka.',
    'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', 'Surah al-Baqarah 2:201'],
  ['Doa pilihan', 'Untuk ibu bapa', 'For parents',
    'رَبِّ اغْفِرْ لِيْ وَلِوَالِدَيَّ وَارْحَمْهُمَا كَمَا رَبَّيَانِيْ صَغِيْرًا',
    'Rabbighfir lii wa liwaalidayya warhamhumaa kamaa rabbayaanii shaghiiraa',
    'Ya Tuhanku, ampunkanlah dosaku dan dosa kedua ibu bapaku, dan kasihanilah mereka sebagaimana mereka memeliharaku sewaktu kecil.',
    'My Lord, forgive me and my parents, and have mercy on them as they raised me when I was small.', "Berdasarkan Surah al-Isra' 17:24"],
];

function shape(d) {
  return {
    id: d.id, category: d.category, title: d.title, titleEn: d.title_en || '', arabic: d.arabic, rumi: d.rumi || '',
    meaning: d.meaning, meaningEn: d.meaning_en || '', source: d.source || '', sort: d.sort, published: !!d.published,
  };
}

// Masukkan doa contoh sekali sahaja (jika admin padam semua, tidak dimasukkan semula)
async function seedOnce(env) {
  const done = await env.DB.prepare("SELECT value FROM settings WHERE key = 'doa_seeded'").first();
  if (done) return;
  const t = now();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM doas').first()).n;
  const stmts = n ? [] : SEED.map(([category, title, titleEn, arabic, rumi, meaning, meaningEn, source], i) =>
    env.DB.prepare(`INSERT INTO doas (category, title, title_en, arabic, rumi, meaning, meaning_en, source, sort, published, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).bind(category, title, titleEn, arabic, rumi, meaning, meaningEn, source || null, (i + 1) * 10, t));
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('doa_seeded', '1', ?)").bind(t));
  await env.DB.batch(stmts);
}

const ORDER = 'ORDER BY MIN(sort) OVER (PARTITION BY category), category, sort, id';

export async function listDoas(env, request) {
  await requireUser(env, request);
  const { results } = await env.DB.prepare(`SELECT * FROM doas WHERE published = 1 ${ORDER}`).all();
  return json({ ok: true, doas: results.map(shape) });
}

export async function adminListDoas(env, request) {
  await requireAdmin(env, request);
  await seedOnce(env);
  const { results } = await env.DB.prepare(`SELECT * FROM doas ${ORDER}`).all();
  return json({ ok: true, doas: results.map(shape) });
}

function readDoa(b, old) {
  const v = { ...(old ? shape(old) : {}), ...b };
  const d = {
    category: cleanText(v.category, 40) || 'Harian',
    title: cleanText(v.title, 80),
    titleEn: cleanText(v.titleEn, 80),
    arabic: cleanMultiline(v.arabic, 1500),
    rumi: cleanMultiline(v.rumi, 1500),
    meaning: cleanMultiline(v.meaning, 1500),
    meaningEn: cleanMultiline(v.meaningEn, 1500),
    source: cleanText(v.source, 120),
    sort: Number.isFinite(Number(v.sort)) ? Math.max(0, Math.min(100000, Math.round(Number(v.sort)))) : 0,
    published: v.published ? 1 : 0,
  };
  if (!d.title) return { error: 'Sila isi tajuk doa.' };
  if (!d.arabic) return { error: 'Sila isi teks Arab.' };
  if (!d.meaning) return { error: 'Sila isi maksud doa.' };
  return d;
}

export async function adminCreateDoa(env, request) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  if (b.sort === undefined) b.sort = ((await env.DB.prepare('SELECT MAX(sort) AS s FROM doas').first()).s || 0) + 10;
  const d = readDoa(b);
  if (d.error) return fail(400, d.error);
  const row = await env.DB.prepare(`INSERT INTO doas (category, title, title_en, arabic, rumi, meaning, meaning_en, source, sort, published, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(d.category, d.title, d.titleEn || null, d.arabic, d.rumi || null, d.meaning, d.meaningEn || null, d.source || null, d.sort, d.published, now()).first();
  return json({ ok: true, doa: shape(row) }, 201);
}

export async function adminUpdateDoa(env, request, id) {
  await requireAdmin(env, request);
  const old = await env.DB.prepare('SELECT * FROM doas WHERE id = ?').bind(id).first();
  if (!old) return fail(404, 'Doa tidak dijumpai.');
  const d = readDoa(await readJson(request), old);
  if (d.error) return fail(400, d.error);
  const row = await env.DB.prepare(`UPDATE doas SET category = ?, title = ?, title_en = ?, arabic = ?, rumi = ?, meaning = ?, meaning_en = ?,
      source = ?, sort = ?, published = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .bind(d.category, d.title, d.titleEn || null, d.arabic, d.rumi || null, d.meaning, d.meaningEn || null, d.source || null, d.sort, d.published, now(), id).first();
  return json({ ok: true, doa: shape(row) });
}

export async function adminDeleteDoa(env, request, id) {
  await requireAdmin(env, request);
  await env.DB.prepare('DELETE FROM doas WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
