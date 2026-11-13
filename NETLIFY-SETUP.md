# PLUS ULTRA MATH HEROES — Netlify

Pakej ini ialah kod sumber Next.js untuk dibina oleh Netlify. Ia bukan folder
statik biasa kerana laman menggunakan API pelayan untuk Auth Supabase, Kuiz,
Sijil, Dashboard Guru dan Refleksi.

## Cara pasang

1. Ekstrak ZIP ini dan muat naik kandungannya ke repositori GitHub atau GitLab.
2. Di Netlify pilih **Add new site → Import an existing project**.
3. Pilih repositori itu. Tetapan binaan dibaca daripada `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Di **Site configuration → Environment variables**, tambah nilai daripada
   `.env.example`. Pilih skop **Builds** dan **Functions**. Jangan commit kunci
   sebenar ke Git.
5. Jalankan **Clear cache and deploy site** selepas menyimpan pemboleh ubah.
6. Semak endpoint `https://DOMAIN-ANDA.netlify.app/api/hero-portal-test?action=health`.
   Nilai `ok` mesti `true` tanpa memaparkan sebarang kunci.

## Pemboleh ubah wajib

- `HERO_PORTAL_TEST_ENABLED=1`
- `HERO_PORTAL_TEST_FEATURES_ENABLED=1`
- `HERO_PORTAL_TEST_URL=https://qyvyxpwqjosqxfmwsikx.supabase.co`
- `HERO_PORTAL_TEST_PUBLISHABLE_KEY` = publishable key projek Supabase itu

Jangan masukkan service-role key. Nilai dalam `netlify.toml` hanya digunakan
semasa build dan tidak menggantikan pemboleh ubah runtime Functions.

## Supabase Auth

Selepas Netlify memberi domain akhir, tambah URL berikut dalam Supabase
**Authentication → URL Configuration**:

- Site URL: `https://DOMAIN-ANDA.netlify.app`
- Redirect URL: `https://DOMAIN-ANDA.netlify.app/**`

Gunakan HTTPS. Jangan letakkan service-role key pada Netlify atau frontend.

## Jika masih gagal

- `HERO_PORTAL_TEST_ENABLED=false`: pemboleh ubah belum tersedia kepada Functions.
- `projectMatches=false`: URL Supabase bukan projek `qyvyxpwqjosqxfmwsikx`.
- `keyConfigured=false`: publishable key belum dimasukkan.
- Selepas setiap perubahan environment variables, lakukan deploy baharu.

