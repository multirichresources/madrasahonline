// Halaman Terma Penggunaan, Polisi Privasi dan Polisi Bayaran Balik.
// Dijana oleh Worker supaya maklumat pengendali (dari Tetapan admin) sentiasa terkini,
// dan boleh dibaca oleh penyemak payment gateway tanpa perlu log masuk.
import { getOrg } from './content.js';

const UPDATED = { ms: '24 Oktober 2026', en: '24 October 2026' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const waLocal = p => p ? '0' + p.slice(2, 4) + '-' + p.slice(4, p.length - 4) + ' ' + p.slice(-4) : '';

function operator(o, lang = 'ms') {
  if (!o.name) return lang === 'en' ? 'the operator of Madrasah Online' : 'pengendali Madrasah Online';
  return `<b>${esc(o.name)}</b>${o.reg ? ` (${esc(o.reg)})` : ''}`;
}

function contactBlock(o, lang = 'ms') {
  const L = lang === 'en' ? { email: 'Email', address: 'Address', none: 'Contact the admin through the class WhatsApp group.' }
    : { email: 'Emel', address: 'Alamat', none: 'Hubungi admin melalui group WhatsApp kelas.' };
  const lines = [];
  if (o.name) lines.push(`<li><b>${esc(o.name)}</b>${o.reg ? ` · ${esc(o.reg)}` : ''}</li>`);
  if (o.email) lines.push(`<li>${L.email}: <a href="mailto:${esc(o.email)}">${esc(o.email)}</a></li>`);
  if (o.whatsapp) lines.push(`<li>WhatsApp: <a href="https://wa.me/${esc(o.whatsapp)}">${esc(waLocal(o.whatsapp))}</a></li>`);
  if (o.address) lines.push(`<li>${L.address}: ${esc(o.address)}</li>`);
  if (!o.email && !o.whatsapp) lines.push(`<li>${L.none}</li>`);
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
  <li><b>Penyumbang:</b> nama, emel, no. telefon (pilihan) dan mesej, untuk resit dan rekod sumbangan. Nama tidak dipaparkan jika anda memilih untuk tidak menunjukkannya.</li>
  <li><b>Tetapan app:</b> bahasa, kawasan waktu solat dan pilihan notifikasi anda.</li>
  <li><b>Lokasi (arah kiblat):</b> dikira dalam telefon anda sahaja dan <b>tidak dihantar</b> atau disimpan oleh kami.</li>
  <li><b>Rekod solat dan kiraan tasbih:</b> disimpan dalam telefon anda sahaja dan <b>tidak dihantar</b> kepada kami. Ia hilang jika anda kosongkan data pelayar atau tukar telefon.</li>
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
<p>Data akaun disimpan selagi akaun anda wujud. Anda boleh memadam akaun dalam apps (menu Akaun → Padam akaun saya) atau tanpa membuka apps di halaman <a href="/padam-akaun">Padam akaun</a>. Apabila anda memadam akaun, maklumat akaun, rekod tontonan dan soalan anda dipadam serta-merta. Rekod transaksi disimpan sehingga 7 tahun untuk tujuan perakaunan dan cukai, tanpa dikaitkan lagi dengan akaun anda.</p>

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
<p>Sumbangan dan tajaan pelajar adalah ikhlas dan tidak dikembalikan, kecuali jika berlaku kesilapan jumlah atau caj berganda yang dimaklumkan dalam tempoh 7 hari. Sumbangan bulanan boleh dihentikan pada bila-bila masa melalui pautan yang diberi selepas sumbangan pertama, atau dengan menghubungi kami. Sumbangan kepada Madrasah Online tidak layak untuk potongan cukai.</p>

<h2>7. Hubungi kami</h2>
${contactBlock(o)}`,
  },
};

const PAGES_EN = {
  '/terma': {
    title: 'Terms of Use',
    body: o => `
<p>These terms apply to your use of the Madrasah Online app and website (“the service”), operated by ${operator(o, 'en')} (“we”). By registering or using the service, you agree to these terms.</p>

<h2>1. About the service</h2>
<p>Madrasah Online is a Quran reading class platform for adults. Subscribed students can watch recorded class videos, join the monthly Zoom class, read announcements and use the community area.</p>

<h2>2. Your account</h2>
<ol>
  <li>Register with your real name, phone number and email. One account per student.</li>
  <li>Keep your PIN private. You are responsible for all activity in your account.</li>
  <li>You must be 18 or older to register. Students under 18 must be registered with the permission of a parent or guardian.</li>
</ol>

<h2>3. Subscription and payment</h2>
<ol>
  <li>The subscription fee is <b>RM10 per month</b>, or according to any other package shown in the app at the time of payment.</li>
  <li>Class videos are only available while your subscription is active.</li>
  <li>If you choose <b>automatic renewal</b> by card, you will be charged automatically on each renewal date until you cancel.</li>
  <li>Payments are processed by a licensed payment gateway provider in Malaysia. We do not store your card number.</li>
  <li>Prices may change. Any change will be announced at least 30 days in advance and will not affect periods already paid for.</li>
</ol>

<h2>4. Cancellation</h2>
<p>You may stop your subscription at any time through the app or by contacting us. No further charges will be made, and your access remains until the end of the period already paid for. Refunds are subject to the <a href="/bayaran-balik?lang=en">Refund Policy</a>.</p>

<h2>5. Use of content</h2>
<ol>
  <li>All videos, notes and class materials are for your personal learning only.</li>
  <li>You are <b>not allowed</b> to screen-record, download, copy, redistribute or share your account, PIN or class links with others.</li>
  <li>Every video is displayed with your name on it. Violations may lead to account suspension without refund.</li>
</ol>

<h2>6. Community etiquette</h2>
<p>Use polite and respectful language. Insulting, defamatory or political content, unauthorised advertising and spam are not allowed. The admin may hide or remove inappropriate content.</p>

<h2>7. Zoom classes</h2>
<p>The Zoom class schedule will be announced in the app and may change from time to time. Class links are for students only and must not be shared.</p>

<h2>8. Suspension and termination</h2>
<p>We may suspend or terminate accounts that breach these terms. You may delete your own account at any time through <b>Account → Delete my account</b>.</p>

<h2>9. Limitation of liability</h2>
<p>We do our best to keep the service running, but technical disruptions or maintenance may occur. To the extent permitted by law, our liability is limited to the amount you have paid for the current subscription period.</p>

<h2>10. Changes to these terms</h2>
<p>We may update these terms. Important changes will be announced in the app. Continued use after that means you accept the updated terms.</p>

<h2>11. Governing law</h2>
<p>These terms are governed by the laws of Malaysia.</p>

<h2>12. Contact us</h2>
${contactBlock(o, 'en')}`,
  },

  '/privasi': {
    title: 'Privacy Policy',
    body: o => `
<p>This policy explains how ${operator(o, 'en')} (“we”) collects, uses and protects your personal data when you use Madrasah Online, in line with Malaysia's Personal Data Protection Act 2010.</p>

<h2>1. Data we collect</h2>
<ol>
  <li><b>Account details:</b> name, phone number and email address.</li>
  <li><b>PIN:</b> stored in one-way encrypted form. We cannot see your PIN.</li>
  <li><b>Subscription and payment records:</b> plan, amount, date, status and transaction reference number.</li>
  <li><b>Learning records:</b> videos watched and the minute you stopped, so you can continue watching.</li>
  <li><b>Community content:</b> questions or comments you submit.</li>
  <li><b>Technical data:</b> IP address, used for security and to limit login attempts.</li>
  <li><b>Donors:</b> name, email, phone number (optional) and message, for receipts and donation records. Your name is not displayed if you choose to hide it.</li>
  <li><b>App settings:</b> your language, prayer time area and notification choices.</li>
  <li><b>Location (Qibla direction):</b> calculated on your phone only and <b>not sent</b> to or stored by us.</li>
  <li><b>Prayer log and tasbih count:</b> stored on your phone only and <b>not sent</b> to us. They are lost if you clear your browser data or change phones.</li>
</ol>
<p>We do <b>not</b> store your bank card number. Card details are processed directly by the licensed payment gateway.</p>

<h2>2. How we use it</h2>
<ol>
  <li>To manage your account, login and subscription.</li>
  <li>To send PIN reset codes, receipts, subscription reminders and class notices.</li>
  <li>To let you continue watching videos where you left off.</li>
  <li>To keep accounts secure and prevent misuse.</li>
  <li>To improve our classes and service.</li>
</ol>

<h2>3. Sharing of data</h2>
<p>We do <b>not sell</b> your data. Data is only shared with service providers needed to run this app:</p>
<ol>
  <li><b>Cloudflare</b>: app hosting and database.</li>
  <li><b>Bunny.net</b>: class video streaming.</li>
  <li><b>Licensed payment gateway</b>: payment processing.</li>
  <li><b>Email service provider</b>: sending codes and notices.</li>
  <li><b>Zoom</b>: when you join a Zoom class, subject to Zoom's privacy policy.</li>
</ol>
<p>Data may also be disclosed when required by law.</p>

<h2>4. Storage outside Malaysia</h2>
<p>Some of the providers above process data on servers outside Malaysia. We choose providers with reasonable data protection measures.</p>

<h2>5. Retention</h2>
<p>Account data is kept for as long as your account exists. You can delete your account in the app (Account → Delete my account) or without opening the app on the <a href="/padam-akaun?lang=en">Delete account</a> page. When you delete your account, your account details, viewing records and questions are deleted immediately. Transaction records are kept for up to 7 years for accounting and tax purposes, no longer linked to your account.</p>

<h2>6. Security</h2>
<p>Connections are encrypted (HTTPS), PINs are stored as hashes, login sessions are protected, and accounts are temporarily locked after several wrong PIN attempts.</p>

<h2>7. Your rights</h2>
<ol>
  <li><b>Access and correction:</b> update your email and PIN in the Account menu, or contact us for other changes.</li>
  <li><b>Delete your account:</b> through <b>Account → Delete my account</b>.</li>
  <li><b>Withdraw consent or make a complaint:</b> contact us using the details below.</li>
</ol>

<h2>8. Cookies and browser storage</h2>
<p>We only use the cookies needed to keep you logged in. Your theme, text size and language settings are stored in your browser. There are no advertising or third-party tracking cookies.</p>

<h2>9. Students under 18</h2>
<p>Students under 18 must be registered with the permission of a parent or guardian.</p>

<h2>10. Changes to this policy</h2>
<p>This policy may be updated. Important changes will be announced in the app.</p>

<h2>11. Contact us</h2>
${contactBlock(o, 'en')}`,
  },

  '/bayaran-balik': {
    title: 'Refund & Cancellation Policy',
    body: o => `
<p>This policy applies to all subscription payments and donations to Madrasah Online, operated by ${operator(o, 'en')}.</p>

<h2>1. Nature of the subscription</h2>
<p>A Madrasah Online subscription is a digital service that gives immediate access to class videos. Payments for a period that has already started are therefore generally <b>non-refundable</b>, except in the cases listed in section 3.</p>

<h2>2. Cancelling a subscription</h2>
<ol>
  <li>You may stop your subscription at any time through the app or by contacting us.</li>
  <li>No further charges will be made after cancellation.</li>
  <li>Your access remains until the end of the period already paid for.</li>
</ol>

<h2>3. When refunds are given</h2>
<ol>
  <li>You were charged twice or charged the wrong amount.</li>
  <li>You were charged after successfully cancelling your subscription.</li>
  <li>You could not watch any videos at all because of a technical problem on our side that could not be fixed within 7 days.</li>
  <li>An automatic renewal you did not notice, if claimed within 7 days of the charge and you have not watched any video since that charge.</li>
</ol>

<h2>4. How to request a refund</h2>
<p>Contact us within <b>14 days</b> of the charge with the following details:</p>
<ol>
  <li>Your registered name and phone number.</li>
  <li>The date and amount of the charge.</li>
  <li>The reason for your request.</li>
</ol>

<h2>5. Process</h2>
<p>Requests are reviewed within 3 working days. If approved, the payment is refunded to the original payment method within 7 to 14 working days, depending on your bank.</p>

<h2>6. Donations</h2>
<p>Donations and student sponsorships are given sincerely and are non-refundable, except for a wrong amount or a duplicate charge reported within 7 days. Monthly donations can be stopped at any time using the link given after the first donation, or by contacting us. Donations to Madrasah Online are not eligible for tax deduction.</p>

<h2>7. Contact us</h2>
${contactBlock(o, 'en')}`,
  },
};

export const legalPaths = Object.keys(PAGES);

export async function renderLegal(env, path, lang = 'ms') {
  const en = lang === 'en';
  const pages = en ? PAGES_EN : PAGES;
  const page = pages[path];
  const o = await getOrg(env);
  const q = en ? '?lang=en' : '';
  const nav = Object.entries(pages).map(([p, v]) => `<a href="${p}${q}"${p === path ? ' aria-current="page"' : ''}>${esc(v.title.replace(' & Pembatalan', '').replace(' & Cancellation', ''))}</a>`).join('');
  const html = `<!doctype html>
<html lang="${en ? 'en' : 'ms'}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>${esc(page.title)} · Madrasah Online</title>
<meta name="description" content="${esc(page.title)} ${en ? 'for Madrasah Online, Quran reading classes for adults.' : 'untuk Madrasah Online, kelas mengaji al-Quran untuk dewasa.'}">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<link rel="stylesheet" href="/app.css">
<script src="/theme-init.js"></script>
</head>
<body>
<main class="shell legal">
  <div class="top"><a class="iconbtn" href="/">${en ? '← Back to app' : '← Ke app'}</a><a class="iconbtn" href="${path}${en ? '' : '?lang=en'}" lang="${en ? 'ms' : 'en'}">${en ? 'Bahasa Melayu' : 'English'}</a></div>
  <nav class="legal-nav" aria-label="${en ? 'Policies' : 'Polisi'}">${nav}</nav>
  <article class="card">
    <h1>${esc(page.title)}</h1>
    <p class="muted small">${en ? 'Last updated' : 'Kemas kini terakhir'}: ${UPDATED[lang]}</p>
    ${en ? '<p class="muted small">This English version is provided for convenience. If there is any difference, the Bahasa Melayu version applies.</p>' : ''}
    ${page.body(o)}
  </article>
</main>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
