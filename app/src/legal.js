// Halaman Terma Penggunaan, Polisi Privasi dan Polisi Bayaran Balik.
// Dijana oleh Worker supaya maklumat pengendali (dari Tetapan admin) sentiasa terkini,
// dan boleh dibaca oleh penyemak payment gateway tanpa perlu log masuk.
import { getOrg } from './content.js';

const UPDATED = '20 Oktober 2026';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const waLocal = p => p ? '0' + p.slice(2, 4) + '-' + p.slice(4, p.length - 4) + ' ' + p.slice(-4) : '';

function operator(o) {
  if (!o.name) return 'pengendali Madrasah Online';
  return `<b>${esc(o.name)}</b>${o.reg ? ` (${esc(o.reg)})` : ''}`;
}

function contactBlock(o) {
  const lines = [];
  if (o.name) lines.push(`<li><b>${esc(o.name)}</b>${o.reg ? ` · ${esc(o.reg)}` : ''}</li>`);
  if (o.email) lines.push(`<li>Emel: <a href="mailto:${esc(o.email)}">${esc(o.email)}</a></li>`);
  if (o.whatsapp) lines.push(`<li>WhatsApp: <a href="https://wa.me/${esc(o.whatsapp)}">${esc(waLocal(o.whatsapp))}</a></li>`);
  if (o.address) lines.push(`<li>Alamat: ${esc(o.address)}</li>`);
  if (!o.email && !o.whatsapp) lines.push('<li>Hubungi admin melalui group WhatsApp kelas.</li>');
  return `<ul class="contact">${lines.join('')}</ul>`;
}

const PAGES = {
  '/terma': {
    title: 'Terma Penggunaan',
    body: o => `
<p>Terma ini terpakai kepada penggunaan aplikasi dan laman web Madrasah Online (“perkhidmatan”), yang dikendalikan oleh ${operator(o)} (“kami”). Dengan mendaftar atau menggunakan perkhidmatan, anda bersetuju dengan terma ini.</p>

<h2>1. Tentang perkhidmatan</h2>
<p>Madrasah Online ialah platform kelas mengaji al-Quran untuk dewasa. Pelajar yang melanggan boleh menonton rakaman video kelas, menyertai kelas Zoom bulanan, membaca pengumuman dan menggunakan ruang komuniti.</p>

<h2>2. Akaun anda</h2>
<ol>
  <li>Daftar dengan nama, no. telefon dan emel yang benar. Satu akaun untuk seorang pelajar sahaja.</li>
  <li>Jaga kerahsiaan PIN anda. Anda bertanggungjawab atas semua aktiviti dalam akaun anda.</li>
  <li>Pendaftar mestilah berumur 18 tahun ke atas. Pelajar bawah 18 tahun perlu didaftarkan dengan kebenaran ibu bapa atau penjaga.</li>
</ol>

<h2>3. Langganan dan bayaran</h2>
<ol>
  <li>Yuran langganan ialah <b>RM10 sebulan</b>, atau mengikut pakej lain yang dipaparkan dalam app ketika anda membuat bayaran.</li>
  <li>Akses kepada video kelas hanya tersedia semasa langganan anda aktif.</li>
  <li>Jika anda memilih <b>pembaharuan automatik</b> dengan kad, caj akan dibuat secara automatik pada setiap tarikh pembaharuan sehingga anda membatalkannya.</li>
  <li>Bayaran diproses oleh penyedia gerbang pembayaran berlesen di Malaysia. Kami tidak menyimpan nombor kad anda.</li>
  <li>Harga boleh berubah. Sebarang perubahan akan dimaklumkan sekurang-kurangnya 30 hari lebih awal dan tidak menjejaskan tempoh yang telah dibayar.</li>
</ol>

<h2>4. Pembatalan</h2>
<p>Anda boleh berhenti melanggan pada bila-bila masa melalui app atau dengan menghubungi kami. Tiada caj seterusnya akan dibuat, dan akses anda kekal sehingga akhir tempoh yang telah dibayar. Bayaran balik tertakluk kepada <a href="/bayaran-balik">Polisi Bayaran Balik</a>.</p>

<h2>5. Penggunaan kandungan</h2>
<ol>
  <li>Semua video, nota dan bahan kelas adalah untuk pembelajaran peribadi anda sahaja.</li>
  <li>Anda <b>tidak dibenarkan</b> merakam skrin, memuat turun, menyalin, mengedar semula atau berkongsi akaun, PIN atau pautan kelas dengan orang lain.</li>
  <li>Setiap video dipaparkan bersama tanda nama anda. Pelanggaran boleh menyebabkan akaun digantung tanpa bayaran balik.</li>
</ol>

<h2>6. Adab dalam komuniti</h2>
<p>Gunakan bahasa yang sopan dan saling menghormati. Kandungan yang menghina, memfitnah, berunsur politik, iklan tanpa izin atau spam tidak dibenarkan. Admin boleh menyembunyikan atau memadam kandungan yang tidak sesuai.</p>

<h2>7. Kelas Zoom</h2>
<p>Jadual kelas Zoom akan diumumkan dalam app dan boleh berubah dari semasa ke semasa. Pautan kelas adalah untuk pelajar sahaja dan tidak boleh dikongsi.</p>

<h2>8. Penggantungan dan penamatan akaun</h2>
<p>Kami boleh menggantung atau menamatkan akaun yang melanggar terma ini. Anda boleh memadam akaun anda sendiri pada bila-bila masa melalui menu <b>Akaun → Padam akaun saya</b>.</p>

<h2>9. Had tanggungan</h2>
<p>Kami berusaha memastikan perkhidmatan sentiasa berfungsi, namun gangguan teknikal atau penyelenggaraan boleh berlaku. Setakat yang dibenarkan undang-undang, tanggungan kami terhad kepada jumlah yang telah anda bayar bagi tempoh langganan semasa.</p>

<h2>10. Perubahan terma</h2>
<p>Kami boleh mengemas kini terma ini. Perubahan penting akan dimaklumkan dalam app. Penggunaan berterusan selepas itu bermaksud anda bersetuju dengan terma yang dikemas kini.</p>

<h2>11. Undang-undang</h2>
<p>Terma ini tertakluk kepada undang-undang Malaysia.</p>

<h2>12. Hubungi kami</h2>
${contactBlock(o)}`,
  },

  '/privasi': {
    title: 'Polisi Privasi',
    body: o => `
<p>Polisi ini menerangkan bagaimana ${operator(o)} (“kami”) mengumpul, menggunakan dan melindungi data peribadi anda semasa menggunakan Madrasah Online, selaras dengan Akta Perlindungan Data Peribadi 2010.</p>

<h2>1. Data yang kami kumpul</h2>
<ol>
  <li><b>Maklumat akaun:</b> nama, no. telefon dan alamat emel.</li>
  <li><b>PIN:</b> disimpan dalam bentuk yang disulitkan sehala. Kami sendiri tidak boleh melihat PIN anda.</li>
  <li><b>Rekod langganan dan bayaran:</b> pelan, jumlah, tarikh, status dan nombor rujukan transaksi.</li>
  <li><b>Rekod pembelajaran:</b> video yang ditonton dan minit terakhir anda berhenti, supaya anda boleh sambung tonton.</li>
  <li><b>Kandungan komuniti:</b> soalan atau komen yang anda hantar.</li>
  <li><b>Data teknikal:</b> alamat IP, digunakan untuk keselamatan dan menghadkan cubaan log masuk.</li>
</ol>
<p>Kami <b>tidak</b> menyimpan nombor kad bank anda. Butiran kad diproses terus oleh gerbang pembayaran berlesen.</p>

<h2>2. Tujuan penggunaan</h2>
<ol>
  <li>Mengurus akaun, log masuk dan langganan anda.</li>
  <li>Menghantar kod set semula PIN, resit, peringatan langganan dan makluman kelas.</li>
  <li>Membolehkan anda sambung tonton video dari tempat terakhir.</li>
  <li>Menjaga keselamatan akaun dan mencegah penyalahgunaan.</li>
  <li>Menambah baik kelas dan perkhidmatan.</li>
</ol>

<h2>3. Perkongsian data</h2>
<p>Kami <b>tidak menjual</b> data anda. Data hanya dikongsi dengan penyedia perkhidmatan yang diperlukan untuk menjalankan app ini:</p>
<ol>
  <li><b>Cloudflare</b>: pengehosan app dan pangkalan data.</li>
  <li><b>Bunny.net</b>: penstriman video kelas.</li>
  <li><b>Gerbang pembayaran berlesen</b>: memproses bayaran.</li>
  <li><b>Penyedia perkhidmatan emel</b>: menghantar kod dan makluman.</li>
  <li><b>Zoom</b>: apabila anda menyertai kelas Zoom, tertakluk kepada polisi privasi Zoom.</li>
</ol>
<p>Data juga boleh didedahkan jika dikehendaki oleh undang-undang.</p>

<h2>4. Penyimpanan di luar Malaysia</h2>
<p>Sesetengah penyedia di atas memproses data di pelayan luar Malaysia. Kami memilih penyedia yang mempunyai langkah perlindungan data yang munasabah.</p>

<h2>5. Tempoh simpanan</h2>
<p>Data akaun disimpan selagi akaun anda wujud. Apabila anda memadam akaun, maklumat akaun, rekod tontonan dan soalan anda dipadam serta-merta. Rekod transaksi disimpan sehingga 7 tahun untuk tujuan perakaunan dan cukai, tanpa dikaitkan lagi dengan akaun anda.</p>

<h2>6. Keselamatan</h2>
<p>Sambungan disulitkan (HTTPS), PIN disimpan dalam bentuk hash, sesi log masuk dilindungi, dan akaun dikunci sementara selepas beberapa cubaan PIN yang salah.</p>

<h2>7. Hak anda</h2>
<ol>
  <li><b>Akses dan pembetulan:</b> kemas kini emel dan PIN dalam menu Akaun, atau hubungi kami untuk perubahan lain.</li>
  <li><b>Padam akaun:</b> melalui menu <b>Akaun → Padam akaun saya</b>.</li>
  <li><b>Tarik balik persetujuan atau buat aduan:</b> hubungi kami melalui maklumat di bawah.</li>
</ol>

<h2>8. Kuki dan storan pelayar</h2>
<p>Kami hanya menggunakan kuki yang perlu untuk mengekalkan log masuk anda. Tetapan tema dan saiz tulisan disimpan dalam pelayar anda. Tiada kuki iklan atau penjejakan pihak ketiga.</p>

<h2>9. Pelajar bawah 18 tahun</h2>
<p>Pelajar bawah 18 tahun perlu didaftarkan dengan kebenaran ibu bapa atau penjaga.</p>

<h2>10. Perubahan polisi</h2>
<p>Polisi ini boleh dikemas kini. Perubahan penting akan dimaklumkan dalam app.</p>

<h2>11. Hubungi kami</h2>
${contactBlock(o)}`,
  },

  '/bayaran-balik': {
    title: 'Polisi Bayaran Balik & Pembatalan',
    body: o => `
<p>Polisi ini terpakai kepada semua bayaran langganan dan sumbangan kepada Madrasah Online, yang dikendalikan oleh ${operator(o)}.</p>

<h2>1. Sifat langganan</h2>
<p>Langganan Madrasah Online ialah perkhidmatan digital yang memberi akses serta-merta kepada video kelas. Oleh itu, bayaran bagi tempoh yang telah bermula secara amnya <b>tidak dikembalikan</b>, kecuali dalam keadaan di bahagian 3.</p>

<h2>2. Pembatalan langganan</h2>
<ol>
  <li>Anda boleh berhenti melanggan pada bila-bila masa melalui app atau dengan menghubungi kami.</li>
  <li>Tiada caj seterusnya akan dibuat selepas pembatalan.</li>
  <li>Akses anda kekal sehingga akhir tempoh yang telah dibayar.</li>
</ol>

<h2>3. Bila bayaran balik diberi</h2>
<ol>
  <li>Anda dicaj dua kali atau dicaj jumlah yang salah.</li>
  <li>Anda dicaj selepas berjaya membatalkan langganan.</li>
  <li>Anda langsung tidak dapat menonton video kerana masalah teknikal di pihak kami, dan masalah itu tidak dapat diselesaikan dalam tempoh 7 hari.</li>
  <li>Pembaharuan automatik yang tidak anda sedari, jika dituntut dalam tempoh 7 hari dari tarikh caj dan anda belum menonton sebarang video selepas caj tersebut.</li>
</ol>

<h2>4. Cara memohon</h2>
<p>Hubungi kami dalam tempoh <b>14 hari</b> dari tarikh caj dengan maklumat berikut:</p>
<ol>
  <li>Nama dan no. telefon yang didaftarkan.</li>
  <li>Tarikh dan jumlah caj.</li>
  <li>Sebab permohonan.</li>
</ol>

<h2>5. Proses</h2>
<p>Permohonan akan disemak dalam tempoh 3 hari bekerja. Jika diluluskan, bayaran akan dikembalikan melalui kaedah bayaran asal dalam tempoh 7 hingga 14 hari bekerja, bergantung kepada bank anda.</p>

<h2>6. Sumbangan</h2>
<p>Sumbangan dan tajaan pelajar adalah ikhlas dan tidak dikembalikan, kecuali jika berlaku kesilapan jumlah atau caj berganda yang dimaklumkan dalam tempoh 7 hari.</p>

<h2>7. Hubungi kami</h2>
${contactBlock(o)}`,
  },
};

export const legalPaths = Object.keys(PAGES);

export async function renderLegal(env, path) {
  const page = PAGES[path];
  const o = await getOrg(env);
  const nav = Object.entries(PAGES).map(([p, v]) => `<a href="${p}"${p === path ? ' aria-current="page"' : ''}>${esc(v.title.replace(' & Pembatalan', ''))}</a>`).join('');
  const html = `<!doctype html>
<html lang="ms" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>${esc(page.title)} · Madrasah Online</title>
<meta name="description" content="${esc(page.title)} untuk Madrasah Online, kelas mengaji al-Quran untuk dewasa.">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<link rel="stylesheet" href="/app.css">
<script>try{var t=localStorage.getItem('mo-theme');if(t)document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('mo-big')==='1')document.documentElement.classList.add('big')}catch(e){}</script>
</head>
<body>
<main class="shell legal">
  <div class="top"><a class="iconbtn" href="/">← Ke app</a><img class="logo-sm" src="/logo.png" alt="Madrasah Online" width="640" height="608"></div>
  <nav class="legal-nav" aria-label="Polisi">${nav}</nav>
  <article class="card">
    <h1>${esc(page.title)}</h1>
    <p class="muted small">Kemas kini terakhir: ${UPDATED}</p>
    ${page.body(o)}
  </article>
</main>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
