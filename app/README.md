# Madrasah Online — App sebenar

Satu Cloudflare Worker yang hidangkan app pelajar, panel admin dan API, dengan database Cloudflare D1.

- `src/` — kod API (daftar, login PIN, admin, video, bayaran)
- `public/` — app pelajar dan panel admin (PWA)
- `schema.sql` — struktur database
- `test/` — ujian automatik

## Uji di komputer sendiri

```
npm install
npx wrangler d1 execute madrasah-db --local --file=schema.sql
npx wrangler dev
node test/auth.test.mjs
```

Fail `.dev.vars` (tidak dimuat naik ke GitHub) perlu ada `SETUP_KEY=...` untuk ujian setup admin.

## Deploy ke Cloudflare (sekali sahaja)

1. `npx wrangler login`
2. `npx wrangler d1 create madrasah-db` → salin `database_id` ke `wrangler.jsonc`
3. `npx wrangler d1 execute madrasah-db --remote --file=schema.sql`
4. `npx wrangler secret put SETUP_KEY` → masukkan kunci rawak sekurang-kurangnya 16 aksara
5. `npx wrangler deploy`
6. Cipta admin pertama:
   ```
   curl -X POST https://<domain>/api/admin/admins \
     -H "content-type: application/json" -H "x-setup-key: <SETUP_KEY>" \
     -d '{"email":"...","name":"...","password":"..."}'
   ```

## Nota penting

- **Jangan tukar `HASH_ITERATIONS` selepas ada pelajar berdaftar**, PIN sedia ada akan jadi tidak sah.
- Pelan percuma Cloudflare hadkan masa CPU 10ms setiap permintaan. Jika login gagal dengan ralat had CPU, naik taraf ke Workers Paid.
- PIN 6 angka dilindungi oleh had cubaan per IP dan kunci akaun 15 minit selepas 5 PIN salah.
- Lupa PIN: pelajar terima kod 6 angka melalui emel. Aktif bila servis emel dikonfigurasi (lihat bawah). Sebelum itu, admin set PIN sementara dari panel admin.

## Aktifkan emel (Lupa PIN)

Perlu domain sendiri di Cloudflare DNS. Pilih satu:

- **Cloudflare Email Sending** (pelan Workers Paid): onboard domain di Email Service → Email Sending, kemudian tambah dalam `wrangler.jsonc`:
  `"send_email": [{ "name": "EMAIL" }]` dan var `MAIL_FROM`, contoh `"Madrasah Online <noreply@domainanda.my>"`
- **Resend**: sahkan domain di Resend, tambah secret `RESEND_API_KEY` dan var `MAIL_FROM`

Ujian tempatan: `MAIL_DEV=1` dalam `.dev.vars` cetak emel ke log, tidak dihantar.

_Deploy: Cloudflare Workers Builds, root directory `app`._

## Notifikasi telefon (Web Push)

- Tiada setup diperlukan. Kunci VAPID dijana sendiri kali pertama pelajar hidupkan peringatan, dan disimpan dalam jadual `settings` (key `vapid`). **Jangan padam baris ini**, nanti semua pelajar perlu hidupkan peringatan semula.
- Server hantar "ping" kosong; service worker (`public/sw.js`) ambil mesej dari `/api/push/inbox`.
- Cron setiap minit (`* * * * *`): notifikasi azan. Setiap 5 minit: peringatan kelas, bayaran & sumbangan bulanan. Ping dihantar 40 setiap pusingan (naikkan dengan var `PUSH_BATCH` jika guna Workers Paid). Pembersihan harian pada 3 pagi waktu Malaysia.
- Ujian tempatan: `.dev.vars` perlu `PUSH_ALLOW_HTTP=1`, dan jalankan `wrangler dev --test-scheduled`.

## Bayaran (CHIP Collect)

- Secret di Cloudflare: `CHIP_SECRET_KEY` (portal CHIP → Developers → API keys) dan `CHIP_BRAND_ID` (Developers → Brands). Selagi belum ada, pelajar nampak "Sistem bayaran sedang disiapkan".
- Pakej & harga diurus dalam Admin → Tetapan → Pakej langganan (disimpan dalam `settings`, key `plans`).
- Kad: auto-renew (`force_recurring`), dicaj oleh cron sehari sebelum tamat; gagal → cuba semula 24 jam kemudian, berhenti selepas 3 kali atau jika token tidak sah.
- FPX / DuitNow QR / e-wallet: bayar sekali.
- Callback `/api/pay/callback` tidak dipercayai terus: status sentiasa diambil semula dari `GET /purchases/{id}/` dengan secret key, dan jumlah disemak. Jumlah tak sepadan → status `semak`.
- Ujian tempatan: `.dev.vars` dengan `CHIP_SECRET_KEY=test-secret-key`, `CHIP_BRAND_ID=brand-test`, `CHIP_API_BASE=http://127.0.0.1:8798/api/v1` (servis CHIP tiruan dalam `test/auth.test.mjs`).

## Sumbangan & Taja Pelajar

- Halaman awam `/sumbang` (tanpa login): sekali bayar, atau bulanan dengan kad (token CHIP, dicaj oleh cron).
- Tujuan `taja` → dana taja; admin guna baki untuk taja pelajar (Pelajar → pilih → Taja dari dana), direkod dalam `sponsorships`.
- Rekod sumbangan: `payments.purpose = 'sumbangan'`, diasingkan daripada kutipan langganan.
- Penyumbang bulanan urus sendiri melalui pautan rahsia `/sumbang?urus=TOKEN` (ditunjuk selepas sumbangan pertama). Admin juga boleh hentikan dari tab Sumbangan.
- Tiada tuntutan potongan cukai dibuat.

## Waktu solat & azan

- Sumber: JAKIM e-Solat (`period=duration`, sebulan), sandaran api.waktusolat.app. Disimpan dalam `prayer_times`, jadi API luar dipanggil sekali sebulan bagi setiap zon.
- Pelajar pilih zon (`users.solat_zone`, lalai WLY01) dan waktu yang mahu dinotifikasi (`users.azan`).
- Notifikasi dihantar oleh cron dalam 1–2 minit selepas masuk waktu; `azan_sent` elak berganda. Bunyi ikut bunyi notifikasi telefon (app web tak boleh mainkan azan penuh).
- Ujian tempatan: `JAKIM_API` dan `WAKTUSOLAT_API` dalam `.dev.vars` menghala ke servis tiruan dalam `test/auth.test.mjs`.

## Bahasa (BM / EN)

- App pelajar & `/sumbang`: semua teks dibalut `t('teks BM')`; terjemahan dalam `public/i18n-en.js`. Selepas menambah teks baharu, jalankan `node test/i18n.test.mjs`.
- Mesej ralat server (BM) diterjemah di pelayar oleh `tErr()`.
- Bahasa disimpan dalam pelayar (`mo-lang`) dan dihantar ke server (`users.lang`) supaya notifikasi telefon ikut bahasa pelajar.
- Halaman polisi: `/terma?lang=en` dsb. Panel admin kekal BM.
