# Apps Android — Madrasah Online (Google Play)

Apps Android ini ialah Trusted Web Activity (TWA): ia membuka https://<host>/?store=play dalam mod versi store
(tiada sumbangan, tiada CHIP, bayaran melalui Google Play Billing).

- Nama package: `com.baitalsalihin.madrasah` (kekal selepas upload pertama ke Play Console)
- Dijana dengan Bubblewrap daripada `twa-manifest.json`
- Ciri: Play Billing (Digital Goods API), notifikasi, lokasi (kiblat)

## Bina fail AAB
GitHub → tab **Actions** → **Bina apps Android** → **Run workflow**. Fail `.aab` boleh dimuat turun di bahagian Artifacts.

Kunci upload disimpan dalam GitHub Secrets (repo ini AWAM — jangan sekali-kali letak fail `.jks` dalam repo):
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`

## Selepas Play Console siap
1. Play Console → Setup → App signing: salin cap jari **SHA-256** (kunci app signing + kunci upload).
2. Masukkan dalam `ANDROID_CERT_SHA256` (wrangler.jsonc, dipisah koma) → `/.well-known/assetlinks.json` akan sahkan apps.
3. Bila domain rasmi aktif: tukar `host` dalam `twa-manifest.json` dan `hostName` dalam `app/build.gradle` kepada `app.baitalsalihin.com`.
4. Cipta produk langganan dengan ID `madrasah.bulanan` (dan `madrasah.tahunan` dll. jika pakej dibuka).
