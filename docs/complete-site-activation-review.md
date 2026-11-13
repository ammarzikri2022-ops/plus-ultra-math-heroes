# PLUS ULTRA MATH HEROES — Frontend dan pelan pengaktifan Supabase

Tarikh semakan: 3 November 2026. Projek dan URL asal dikekalkan. Dokumen ini membezakan kod siap daripada pengaktifan database; tiada SQL produksi dijalankan.

## Perubahan laman yang disediakan

- Portal murid/guru menggunakan Supabase Auth sedia ada, pengesahan e-mel, avatar, sesi HttpOnly/Secure dan log keluar sebenar. Tidak menukar pilihan portal kepada hak membaca data orang lain.
- Guru membuka workspace sendiri selepas Auth disahkan; tiada kelulusan pentadbir bagi akaun baharu yang mendapat profil student melalui trigger asal. `profiles.role` tidak dinaikkan menjadi global teacher.
- Dashboard: cipta dan namakan semula kelas, senarai murid, jana/batalkan jemputan, lepaskan keahlian murid dengan pengesahan, keputusan kuiz, refleksi, analisis serta CSV.
- Murid: nama/avatar, jemputan kelas, sejarah markah tersimpan dan refleksi sendiri. ID/nama kelas sahaja tidak memberikan keahlian. Perpindahan kelas memerlukan pelepasan pemilik asal.
- Kuiz mengekalkan sepuluh soalan, pilihan, jawapan, penerangan dan animasi asal. Jawapan dihantar ke backend; skor pelanggan, pupil_id, class_id dan answer key pelanggan tidak digunakan. SQL mengira skor; satu submission UUID tidak menggandakan percubaan apabila dicuba semula.
- Sijil menggunakan keputusan yang disahkan daripada akaun semasa, bukannya skor localStorage pengguna lain. Ambang asal 6/10 dikekalkan. Tanpa keputusan tersimpan yang dapat disahkan, sijil belum dibuka; latihan kuiz masih boleh dimainkan.
- HTML enam halaman, aset watak, latar, navigasi, muzik, Guru Deku AI dan permainan dikekalkan. Tambahan visual terhad kepada maklum balas penyimpanan serta ruang akaun/kelas.

## Semakan Supabase sebenar dan batas akses

Auth settings sebenar memberi HTTP 200: e-mel diaktifkan, signup dibenarkan dan pengesahan e-mel diperlukan. Ini tidak membuktikan penghantaran e-mel atau log masuk pengguna tertentu berjaya.

Struktur bigint classes/teacher_classes disemak berdasarkan audit Supabase yang diberikan pengguna dan tangkap layar audit. classes.id bigint tiada default; classes.name text; year_level default 5; teacher_id uuid dan class_id bigint. Definisi penuh jadual kuiz/markah dan semua polisi belum boleh dibaca menggunakan akses Publishable yang tersedia. Permintaan metadata REST root ditolak HTTP 401 dengan “Secret API key required”. Kami tidak meminta atau memasukkan Secret/service_role key sebagai penyelesaian.

Tiada data murid produksi dibaca. Tiada akaun/e-mel ujian sebenar dicipta, tiada kata laluan diubah, dan tiada migrasi/polisi produksi dijalankan. Pemilik masih perlu menjalankan audit baca sahaja dan menyemak hasilnya sebelum SQL aktivasi. Publishable Key backend sedia ada dipelihara; nilainya tidak ditulis ke HTML, patch atau laporan ini.

## Senarai perubahan database untuk kelulusan

| Fail | Perubahan | Data sedia ada |
|---|---|---|
| 01-audit.sql | Baca jenis lajur, polisi, grant, trigger dan SECURITY DEFINER; hasilkan fingerprint | Tiada perubahan, tiada bacaan baris murid |
| 02-proposed-migration-DO-NOT-RUN-YET.sql | Schema persendirian ua_teacher_private, kaunter ID kelas bigint transaksi, ownership/workspaces/sharing; RPC terhad; restrictive ceilings dan perlindungan role/class_id | Enam jadual/trigger Auth asal tidak dicipta semula; ID/rekod asal tidak ditukar |
| 03-learning-and-classes-review.sql | Preferences, enrollments, jemputan hash/luput, bank jawapan, keputusan rasmi baharu dan refleksi baharu dalam schema persendirian; RPC semakan markah/kelas/rekod | Tidak menulis atau meneka pemetaan INSERT ke legacy quizzes/attempts/answers; rekod lama kekal |
| 04-rollback-learning-review.sql | Hentikan RPC modul pembelajaran; simpan data persendirian sebagai arkib | Tiada pemadaman markah, refleksi atau keahlian |
| 05-rollback-workspace-review.sql | Buang hanya RPC/polisi/trigger workspace selepas modul pembelajaran diundur | Kelas/markah kekal; ID kelas kembali kepada keperluan asal membekalkan ID eksplisit |

**Kelulusan yang diperlukan ialah fail 02 dan 03, selepas hasil 01 disemak.** Fail 02 sengaja mempunyai fingerprint kosong supaya tidak boleh dijalankan tanpa semakan. Jika schema workspace sudah ada, jangan jalankan semula CREATE; semak versi dan sediakan migrasi ke hadapan.

Penyimpanan keputusan baharu ialah jadual sebenar Supabase `ua_teacher_private.quiz_results`, dan refleksi baharu ialah `ua_teacher_private.learning_reflections`. Ini bukan simulasi atau localStorage. Pilihan tambahan ini perlu diluluskan secara jelas: legacy attempts/answers tidak dipenuhi dengan nilai lajur yang diteka kerana skemanya belum diberikan sepenuhnya. Dashboard membaca keputusan baharu serta rekod lama yang dibenarkan melalui laluan berasingan; jika sumber lama gagal, amaran dipaparkan dan ia tidak dianggap sudah diuji. Jangan mendakwa jadual legacy telah menerima markah baharu.

## Pengasingan dan keselamatan

- Semua pelaku ditentukan auth.uid(), bukan body teacher_id/student_id. Class IDs ialah bigint dalam SQL dan rentetan tepat pada JSON/TypeScript.
- Semua fungsi definer baharu search_path kosong dan memeriksa identiti/skop sebelum akses. PUBLIC/anon tidak mendapat EXECUTE. Jadual private mengaktifkan RLS dan tiada SELECT/INSERT/UPDATE/DELETE bagi API users; fungsi sempit menjadi satu-satunya laluan.
- Core restrictive policies mengehadkan hak daripada polisi permissive lama; polisi restrictive lama tetap berkuat kuasa. Quizzes asal tidak diubah. Akses private pembelajaran bergantung semakan kelas eksplisit, bukan polisi asal yang mungkin terlalu luas.
- Rekod baharu menyimpan class_id ketika penghantaran. Guru kelas baharu tidak secara automatik membaca sejarah kelas lama selepas perpindahan. Guru asal mengekalkan sejarah kelasnya; perkongsian hanya pemilik sebenar.
- Rekod legacy bergantung pemetaan dan polisi asal; audit fungsi/view lama wajib. Khususnya SECURITY DEFINER lama boleh memintas RLS. Fingerprint bukan bukti keselamatan: baca definisi, jangan hanya salin digest.
- Kod jemputan rawak disimpan sebagai hash SHA-256, sah tujuh hari, maksimum 100 penggunaan, boleh dibatalkan. Pemilik sahaja boleh mengeluarkan/mengurusnya. Kapasiti kelas baharu 1,000 murid; kelas milik sendiri maksimum 100. Had boleh disemak dalam SQL sebelum aktivasi.
- Pelajar biasa tidak boleh menjadi guru global, mengubah class_id sendiri melalui REST, menulis skor rasmi, atau membaca bank jawapan private. Akaun workspace tidak boleh menghantar markah rasmi sebagai murid.
- Rekod marks/reflections baharu dihadkan 200 penghantaran/hari bagi setiap murid dengan lock transaksi. API mempunyai validasi, semakan origin dan had asas; Supabase Auth kekal mempunyai hadnya sendiri.
- Daftar murid menyimpan nama/avatar dalam Auth metadata sebagai kosmetik. Ia tidak memberikan kelas/peranan. Guru boleh membaca nama/avatar murid yang dibenarkan sahaja; e-mel/token Auth tidak dipulangkan dalam laporan kelas.

## Apa yang telah diuji

- Ujian API tempatan dengan respons Auth terkawal: pendaftaran, pengesahan bentuk input, login/log keluar, cookie/sesi, profile identity, tiada kenaikan role melalui metadata, workspace, penciptaan kelas, penolakan skor palsu, penolakan roster guru untuk pelajar, bigint tepat, ralat migrasi tiada, dan tiada kejayaan palsu.
- PostgreSQL terpencil (PGlite): dua guru dan murid; RLS walaupun polisi lama sengaja dilonggarkan; role/class_id tidak boleh diubah; bank skor private; grading 10/10 dan 0/10; idempotency; invite/join/revoke; kelas silang; rekod sejarah selepas perpindahan; refleksi; serta rollback tanpa membuang rekod. Jalankan `UA_TEST_LEARNING=1 PGLITE_MODULE=<path>/@electric-sql/pglite/dist/index.js node tests/teacher-workspace-postgres.mjs`.
- `node --import tsx --test tests/academy-security.test.ts tests/learning-api.test.ts`, TypeScript dan production build.
- Semakan byte: app/site-shell.html tidak berubah; teks soalan/pilihan/jawapan/penerangan kuiz asal tidak berubah.

Bukan ujian produksi: pendaftaran/e-mel sebenar, login akaun sebenar, cipta kelas/markah/refleksi produksi, atau pengasingan RLS produksi. Pelayan pratonton tempatan hidup tetapi cloud browser mendapat ERR_CONNECTION_REFUSED; itu batas laluan pratonton, bukan bukti laman produksi rosak. Ujian dashboard penuh melalui pelayar belum disahkan. Ujian concurrency berbilang sambungan dan beban ramai pengguna/SMTP sebenar juga belum dilaksanakan.

## Langkah pengaktifan

1. Semak hasil audit penuh dengan skema sebenar termasuk sebarang NOT NULL tanpa default, polisi INSERT/UPDATE dan semua fungsi/views yang memintas RLS.
2. Luluskan penyimpanan private tambahan dan SQL 02/03. Simpan backup/snapshot.
3. Jalankan pada staging dahulu sebagai postgres dengan BYPASSRLS. Uji dua guru A/B dan pelajar S dengan sesi Auth sebenar. Jangan menguji RLS melalui SQL Editor sebagai postgres sahaja.
4. Semak bahawa A mencipta A, B mencipta B, S menyertai jemputan A; A membaca markah/refleksi S dan B ditolak melalui REST/RPC secara terus. Pindahkan S selepas pelepasan A dan pastikan B tidak mendapat sejarah A.
5. Semak email URL allowlist menunjuk /academy?confirmed=1, pengesahan sebenar, refresh/log keluar, markah server, percubaan ulang, roster, CSV dan sijil. Konfigurasi SMTP/had Auth mengikut jumlah pengguna yang sebenar; belum dianggap lulus hanya kerana Auth settings memberi 200.
6. Selepas kelulusan, pemilik menjalankan SQL produksi melalui Supabase SQL Editor. Kod tidak mengandungi endpoint menjalankan SQL atau akses service_role. Kemudian uji sekali lagi sebelum mengisytiharkan semua ciri aktif.

Tanpa SQL diluluskan/diaktifkan, frontend tidak mereka data atau melangkau Auth. Ia memaparkan kegagalan penyimpanan/setup yang tepat; guru baharu tidak diberikan akses palsu. Ini sebab laman belum boleh dinyatakan lengkap aktif sepenuhnya pada database produksi.
