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
- Cron setiap 5 minit (`*/5 * * * *`): peringatan sehari & 30 minit sebelum kelas Zoom, dan hantar baki ping (40 setiap pusingan). Pembersihan harian berjalan pada 3 pagi waktu Malaysia.
- Ujian tempatan: `.dev.vars` perlu `PUSH_ALLOW_HTTP=1`, dan jalankan `wrangler dev --test-scheduled`.
