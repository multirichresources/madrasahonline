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
- Lupa PIN (versi 1): admin tetapkan PIN sementara dari panel admin. Kod WhatsApp automatik akan ditambah kemudian.
