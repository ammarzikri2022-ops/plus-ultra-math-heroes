# Panduan ujian dan keputusan

## Dasar semasa: satu guru sahaja (November 2026)

Bahagian lama di bawah menguji reka bentuk dua guru dan tidak lagi mewakili skrip 02 terkini. Ujian terkini ialah `PGLITE_MODULE=/tmp/ua-sql-test/node_modules/@electric-sql/pglite/dist/index.js node tests/teacher-workspace-single-teacher.mjs` pada fixture setempat. Lulus: UUID guru utama + profil teacher + e-mel disahkan; murid, guru kedua dan akaun tidak disahkan ditolak; selepas peranan guru utama ditukar kepada student, akses ditolak; ID kelas bigint dihantar sebagai rentetan; markah dan refleksi kelas lain tidak muncul. Fingerprint belum disemak menolak migrasi. Tiada sambungan ke produksi dibuat.

Selepas audit skema sebenar, gunakan `05-post-migration-audit.sql` dan `06-student-denial-review.sql` pada staging. Ujian langsung mesti meliputi panggilan RPC menggunakan JWT murid/guru kedua, kelas baharu, rekod lama, RLS, fungsi lama SECURITY DEFINER, dan rollback. Jangan menganggap ujian fixture membuktikan migrasi produksi selamat.

## Dijalankan secara tempatan

- 42 semakan PostgreSQL sebenar melalui PGlite, dengan dua guru (A/B), seorang murid dan akaun belum disahkan.
- 27 semakan Node/API termasuk suite induk, menggunakan respons Supabase Auth tiruan. Ini bukan ujian log masuk akaun sebenar.
- TypeScript `tsc --noEmit` lulus.
- Vinext production build lulus.

Ujian PostgreSQL membuktikan pada skema fixture: fingerprint belum disemak ditolak; Auth belum disahkan/anon ditolak; trigger asal dan helper teacher tidak berubah; ID bigint besar tepat; dua pemilik berasingan; rekod percubaan/jawapan/refleksi kelas lain disekat walaupun permissive lama sengaja diluaskan; UPDATE role/class_id, DELETE/recreate profil dan membership palsu ditolak; guru tidak boleh mengubah markah murid; perkongsian hanya pemilik dan revoke; ID legacy eksplisit dipelihara; cubaan meracuni kaunter dengan bigint maksimum yang ditolak tidak memajukan kaunter; polisi restrictive lama tidak boleh dipintas; bacaan asal pelajar dan penyimpanan refleksi sendiri kekal; rollback mengekalkan rekod.

## Jalankan semula (database terpencil sahaja)

Dari akar checkout yang mempunyai fail kod/pakej:

```
node --import tsx --test tests/academy-security.test.ts
npx tsc --noEmit
```

Ujian SQL tidak menyambung ke mana-mana URL dan tidak memerlukan API key:

```
npm install --prefix /tmp/ua-sql-test @electric-sql/pglite
PGLITE_MODULE=/tmp/ua-sql-test/node_modules/@electric-sql/pglite/dist/index.js node tests/teacher-workspace-postgres.mjs
```

Pakej ini mengekalkan struktur database/teacher-workspace-v2 supaya ujian SQL boleh dijalankan terus selepas diekstrak, dengan PGLITE_MODULE ditetapkan. Ujian API memerlukan projek asal dan dependensinya.

## Semakan staging yang masih wajib

Gunakan projek staging, bukan data produksi. Guru A, guru B dan murid S mempunyai akaun Auth berasingan yang telah disahkan. Jangan gunakan SQL Editor sebagai postgres untuk menguji akses RLS; gunakan sesi/JWT pengguna tersebut.

| Tindakan | Hasil dijangka |
|---|---|
| Daftar A/B melalui portal guru dan sahkan e-mel | Masuk dashboard sendiri; tiada Menunggu Kelulusan; profiles.role masih student |
| Log masuk sebelum e-mel disahkan | Ditolak oleh Auth/semakan database |
| A mencipta kelas A; B mencipta kelas B | ID bigint unik, classes + ownership + teacher_classes konsisten; masing-masing hanya melihat kelas dibenarkan |
| Hantar teacher_id/class_id milik orang lain kepada endpoint cipta kelas | Tidak memberi pemilikan/keahlian palsu; endpoint hanya menerima nama sebagai parameter RPC |
| Cipta kelas serentak dari dua sesi, ulang beberapa kali | Tiada ID pendua; lock transaksi selesai atau ralat retry yang jelas; tiada rekod separuh siap |
| A cuba REST SELECT/UPDATE/DELETE rekod kelas B, bukan sekadar melalui UI | Tiada data/tiada perubahan; INSERT membership palsu ditolak |
| Murid S dimasukkan ke A oleh aliran pelayan dipercayai | A membaca S, B tidak membaca S, walaupun kuiz yang sama digunakan kedua-dua kelas |
| A cuba UPDATE score murid atau pindahkan class_id sendiri melalui REST | Ditolak; markah rasmi hanya melalui fungsi penilaian asal |
| A memberi perkongsian kepada B melalui RPC pemilik | B melihat kelas/rekod itu sahaja; B tidak boleh berkongsi semula; revoke menghapus akses |
| B cuba memanggil setiap RPC lama secara terus dengan ID S/A | Tiada kebocoran; jika bocor, baiki RPC tersebut sebelum aktivasi. RLS sahaja tidak mencukupi bagi SECURITY DEFINER |
| Refresh/log keluar/log masuk semula | Sesi sah dipulihkan, konteks database diperiksa semula, log keluar membersihkan sesi |
| Pelajar biasa daftar/log masuk, jawab kuiz, simpan refleksi | Fungsi asal dan markah rasmi kekal; direct UPDATE autoriti profil tidak digunakan |
| Cuba akaun guru berstatus tidak aktif | Konteks/operasi kelas ditolak; tiada akses data baharu |
| Jalankan rollback pada staging | Data asal dan kelas yang baru dicipta kekal, RPC workspace tidak boleh digunakan, aliran lama berfungsi selepas kod portal diundur |

Belum diuji pada produksi: Auth/e-mel sebenar, polisi dan fungsi penuh projek Supabase pengguna, UI pelayar sentuhan, penciptaan kelas produksi serta ujian concurrency berbilang sambungan. Semua ini mesti disahkan sebelum mendakwa sistem aktif sepenuhnya.
