# Laporan pembaikan login Netlify

## Punca sebenar

Mesej asal datang daripada `lib/hero-portal-test.ts`. Fungsi `testConfig()`
menolak permintaan apabila `HERO_PORTAL_TEST_ENABLED` tiada atau bukan `1`.
GPT Sites mempunyai environment variables tersebut, tetapi deployment Netlify
tidak mewarisinya.

Netlify tidak memberikan pemboleh ubah yang ditulis dalam `netlify.toml` kepada
fungsi server semasa runtime. Nilai login perlu dimasukkan melalui Netlify UI
dengan skop **Functions**.

## Pembaikan kod

- Endpoint `/api/hero-portal-test` kekal sebagai Next.js Node runtime route.
- `GET /api/hero-portal-test?action=health` kini menyemak konfigurasi dengan
  selamat tanpa memaparkan URL key, token, cookie atau kata laluan.
- Projek Supabase diwajibkan sepadan dengan `qyvyxpwqjosqxfmwsikx`.
- Hanya publishable key atau legacy anon key diterima; service-role tidak perlu.
- Ralat konfigurasi Netlify kini menyatakan nama pemboleh ubah yang hilang.
- Cookie sesi kekal `HttpOnly; Secure; SameSite=Strict; Path=/` dengan awalan
  `__Host-`, jadi token tidak boleh dibaca oleh JavaScript frontend.
- Auth, role guru/murid dan polisi RLS tidak dipintas atau diubah.

## Pengesahan

- `npm run build`: lulus.
- Next.js mengesan `/api/hero-portal-test` sebagai laluan dinamik server.
- Health endpoint diuji pada production build tempatan dan mengembalikan
  `ok: true` apabila empat pemboleh ubah wajib tersedia.
- Login sebenar pada domain Netlify masih perlu diuji selepas pemilik laman
  memasukkan publishable key dan melakukan deploy baharu.

