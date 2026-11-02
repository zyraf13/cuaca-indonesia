# Cuaca Indonesia — dashboard 3D data BMKG

Prakiraan cuaca resmi BMKG untuk **514 kabupaten/kota** (37 provinsi), divisualkan dalam 3D
(Three.js). Tanpa backend, tanpa akun, tanpa data pengguna.

## Glassmorphism & performa (pembaruan PRD)

- **Layering:** kanvas Three.js full-viewport fixed di background; semua panel layar depan
  (header, hero, kartu metrik, timeline) memakai kelas `.glass` — `backdrop-filter: blur()`,
  border putih transparan, shadow.
- **Kontras:** glass pakai **tint gelap** `rgba(9,15,29,.52)`, bukan putih 15% seperti contoh PRD —
  teks putih di atas langit 3D terang dengan glass putih tidak lolos kontras. Aturan kontras §1
  menang atas nilai literal contoh CSS.
- **Fallback tanpa blur:** `@supports not (backdrop-filter)` → panel solid `rgba(18,24,38,.9)`.
- **Mitigasi GPU (§4.2):** blur hanya di panel data (bukan seluruh layar); mobile ≤820 px
  blur diturunkan 14→9 px dan tint digelapkan; kalau FPS terukur < 20 selama 2 detik beruntun,
  `main.js` menambah `html.reduce-blur` → semua blur dimatikan, panel jadi solid gelap.
- Bundle tetap 134 kB gzip (CSS murni, tanpa framework glass).

## Jalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser, timezone, cache/throttle/backoff
npm run build    # dist/ siap deploy statis
npm run regions  # regenerasi public/regions.json dari evidence/wilayah.sql
```

## Sumber data

`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<kode desa>` — resmi, CORS `*`
(diverifikasi 2026-10-29, jadi fetch langsung dari browser aman, tanpa proxy).

Atribusi BMKG wajib dan selalu tampil di footer.

## Yang perlu diketahui

- **Satu titik per kabupaten/kota.** API BCU menyediakan prakiraan per **desa** (`adm4`), bukan per
  `adm2`. Jadi tiap kabupaten/kota diwakili satu desa — yang pertama alfabetis di
  `evidence/wilayah.sql`. Nama desa/kecamatan ada di tooltip baris lokasi. Untuk akurasi titik,
  ganti picker jadi cascade provinsi → kab → kecamatan → desa (datanya sudah ada di `regions.json`).
- **Cache 30 menit + throttle 1,2 s** antar request, backoff `Retry-After` saat 429
  (batas BMKG 60 request/menit/IP). Refresh manual melewati cache.
- **Jarak pandang** sering `null` dari BMKG → ditampilkan `—`, bukan angka karangan.
- **3D** prosedural (tanpa file model/tekstur). Kalau WebGL tidak ada → panel 3D disembunyikan,
  kartu data tetap jalan.
- **Bundle** 134 kB gzip (termasuk Three.js).

## Struktur

```
src/core.js      parser BMKG, timezone per lokasi, klasifikasi kondisi, client cache/throttle
src/scene3d.js   diorama Three.js: langit gradien, matahari, awan, hujan, petir
src/main.js      UI: picker wilayah, kartu stats, timeline 3 hari, hash routing (#31.71)
scripts/         build-regions.mjs (wilayah.sql → public/regions.json)
test/core.test.js
```

## Belum dibuat (di luar MVP PRD)

Peringatan cuaca ekstrem / nowcast (v1.1), peta globe multi-lokasi (v2.0), cache server-side,
notifikasi Telegram.
