# Pembetulan migrasi guru — bigint / Teacher Workspace v2

**STATUS: UNTUK SEMAKAN. Tiada SQL Supabase produksi dijalankan. Tiada perubahan diterbitkan pada laman web.**

## Semakan November 2026 — satu guru sahaja

Lima RPC workspace didapati tiada dalam audit pengguna. Skrip 02 kini dipinkan kepada UUID Auth `db291d38-1c27-41b4-9a68-6bcff1773838` dan profil `teacher`, serta memerlukan e-mel Auth `ammarzikri2020@gmail.com` yang disahkan semasa pemasangan. RPC pendaftaran **tidak menerima** ID/e-mel/role dari klien. `is_member()` dan `is_active()` juga menyemak UUID/peranan supaya rekod workspace yang tersilap diwujudkan tidak memberi akses kepada pengguna lain. Kebenaran ini disemak dalam database bagi panggilan RPC terus. Jika akaun guru utama berubah, migrasi baharu yang disemak perlu disediakan; jangan hanya menukar e-mel frontend.

**Bahagian asal dokumen di bawah menerangkan reka bentuk lama dua guru dan pendaftaran workspace kendiri untuk semua akaun yang disahkan. Bahagian itu bukan dasar semasa dan tidak boleh digunakan sebagai arahan mengaktifkan akses umum.** Ujian aktif semasa ialah `tests/teacher-workspace-single-teacher.mjs`; ujian dua guru lama ialah bahan sejarah dan tidak dijangka lulus terhadap skrip terkini.

Urutan semakan: jalankan `01-audit.sql` dan semak hasil sebenar termasuk semua SECURITY DEFINER lama, trigger, polisi dan aliran murid. Masukkan fingerprint audit **hanya selepas** definisi disemak. Uji 02 pada staging dengan skema sebenar dan UUID guru yang sepadan. Selepas kelulusan berasingan barulah pertimbangkan produksi. Gunakan `05-post-migration-audit.sql` selepas pelaksanaan dan `06-student-denial-review.sql` pada staging untuk menguji penolakan akaun murid. Tiada fail ini patut dijalankan secara automatik.

Belum disahkan: `attempts.student_id`, `answers.attempt_id`, `student_reflections.student_id`, `classes.year_level`, lajur wajib tambahan, semua polisi restrictive, grant SELECT, fungsi SECURITY DEFINER lama, dan keserasian migrasi pembelajaran tambahan dalam projek Supabase sebenar. Skrip 02 akan berhenti pada sebahagian prasyarat ini; pintu fingerprint memerlukan semakan manual terhadap baki definisi. Laporan legacy menggunakan SECURITY INVOKER dan RLS pengguna; jika polisi lama menolak bacaan sah, audit dahulu tanpa melonggarkan akses.

Cadangan UUID terdahulu tidak sepadan dengan skema sebenar. Gunakan fail dalam pakej ini menggantikan migrasi terdahulu; jangan jalankan kedua-duanya.

## Fail dan urutan

1. `01-audit.sql`: baca definisi/skema/polisi sahaja, bukan rekod murid.
2. `02-proposed-migration-DO-NOT-RUN-YET.sql`: migrasi lengkap satu transaksi, dengan semakan prasyarat dan pintu semakan audit.
3. `03-rollback-review.sql`: rollback tanpa memadam data.
4. `04-test-guide.md`: ujian tempatan dan semakan staging.
5. `05-post-migration-audit.sql`: audit metadata dan kiraan selepas migrasi.
6. `06-student-denial-review.sql`: simulasi sesi murid dalam transaksi rollback; ganti UUID contoh pada staging.
7. `tests/teacher-workspace-single-teacher.mjs`: ujian PostgreSQL terpencil untuk dasar satu guru. Tiada akaun produksi digunakan.

## Kontrak skema

| Medan | Jenis |
|---|---|
| classes.id, teacher_classes.class_id, profiles.class_id | bigint |
| profiles.id, teacher_classes.teacher_id, attempts.student_id | uuid |
| classes.name | text |
| classes.year_level | integer; kelas baharu menggunakan nilai 5 |

Hanya **identiti pengguna** menggunakan UUID. Semua rujukan kelas menggunakan bigint. `answers.attempt_id` dipadankan secara teks tepat dengan `attempts.id`, tanpa menukar ID kelas kepada UUID. ID kelas pada JSON RPC/frontend dihantar sebagai **rentetan**, termasuk nombor melebihi 9,007,199,254,740,991; jangan gunakan Number()/parseInt() untuk identiti kelas.

Struktur profiles.class_id, attempts.student_id dan student_reflections.student_id (jika jadual refleksi wujud) masih perlu sepadan dengan prasyarat. Jika audit menunjukkan nama/jenis berbeza, migrasi berhenti; jangan buang semakan tersebut untuk memaksa pelaksanaan. Lajur wajib tambahan pada classes/teacher_classes juga menyebabkan migrasi berhenti sehingga pemetaan disemak.

## Pendaftaran guru tunggal

Hanya UUID Auth yang dipinkan dan profil `teacher` yang disahkan boleh memanggil `ua_register_teacher_workspace()`; murid dan guru lain ditolak pada database walaupun memanggil PostgREST secara terus. `profiles.role`, trigger `create_student_profile()` dan fungsi `is_teacher_for_class(bigint)` tidak ditukar. Tiada kelas lama diberikan sebagai milik secara automatik; keahlian `teacher_classes` sedia ada untuk guru utama terus boleh dibaca mengikut semakan kelas dan RLS. Portal guru mengesahkan sesi, manakala RPC mengambil identiti daripada `auth.uid()`.

## Penjana ID kelas bigint

Migrasi mengunci classes ketika menginisialisasi kaunter persendirian daripada MAX(id). Trigger BEFORE INSERT/UPDATE OF id mengunci satu baris kaunter sehingga transaksi selesai. INSERT tanpa ID mendapat nombor seterusnya; INSERT/UPDATE legacy dengan ID eksplisit yang lebih tinggi memajukan kaunter. Tiada ID/rekod sedia ada ditukar. PK classes kekal pertahanan tambahan terhadap pendua.

Kaunter ialah jadual transaksi, bukan `setval()` pada sequence. Jika INSERT ditolak RLS atau mana-mana langkah penciptaan kelas gagal, perubahan kaunter dan kelas dibatalkan bersama-sama. Cubaan ID maksimum yang ditolak tidak boleh meracuni penjana ID. Ruang bigint yang habis menghasilkan ralat, bukan kitar semula ID.

RPC `ua_teacher_create_class(p_name)` mengesahkan workspace aktif, mengehadkan nama 1–100 aksara dan 100 kelas milik sendiri, kemudian memasukkan classes, pemilikan dan teacher_classes secara atomik. Tiada parameter acting teacher_id atau class_id. Keahlian tambahan hanya melalui RPC perkongsian yang memeriksa pemilik sebenar; penerima tidak boleh berkongsi semula milik orang lain.

## Kesan RLS — jangan sekadar tambah permissive USING(true)

Polisi permissive digabung dengan OR; polisi restrictive mesti semuanya lulus. Polisi baharu tidak boleh mengatasi restrictive lama atau kebenaran jadual yang tiada.

| Operasi | Akaun tanpa workspace (murid asal) | Akaun workspace |
|---|---|---|
| SELECT profiles/classes/membership/attempts/answers/reflections | Ceiling baharu TRUE; polisi asal terus menentukan akses | Polisi permissive baharu terhad kepada data sendiri atau kelas dibenarkan; restrictive ceiling menolak semua rekod lain walaupun polisi lama terlalu luas |
| INSERT | Tidak diberi hak baharu; polisi asal | Tiada polisi permissive write baharu. Ceiling hanya membenarkan identiti sendiri untuk rekod murid; classes/teacher_classes tidak boleh dimutasi terus. Cipta kelas melalui RPC |
| UPDATE | Polisi asal, ditambah perlindungan medan autoriti profil | Tiada hak menukar rekod/markah murid lain. USING dan WITH CHECK memeriksa identiti sendiri, selain polisi asal |
| DELETE | Polisi asal, tetapi pemadaman profil mesti melalui aliran dipercayai | Tiada hak memadam kelas, keahlian atau rekod orang lain; operasi rekod sendiri masih memerlukan polisi asal |
| quizzes | Tidak berubah | Tidak berubah; soalan bersama bukan bukti hak membaca percubaan semua murid |

Trigger profil menolak perubahan terus daripada authenticated/anon terhadap id, role atau class_id, serta DELETE/recreate untuk memintas perlindungan. Perubahan kelas murid yang sah perlu menggunakan proses pelayan dipercayai yang sudah diaudit. Jika pendaftaran murid lama menggunakan UPDATE REST terus pada class_id, aliran tersebut mesti dipindahkan ke RPC keahlian yang selamat sebelum aktivasi; jangan membuka UPDATE class_id kepada pengguna semula.

Had tambahan ini tidak mengesahkan jawapan atau mengira markah. Fungsi pelayan penilaian asal kekal bertanggungjawab mengesahkan jawapan/markah rasmi. Tiada kod kuiz, markah atau refleksi asal dipadam.

## SECURITY DEFINER dan akses silang

Fungsi definer baharu menggunakan search_path kosong, nama objek lengkap, pemilik migrasi dipercayai dengan BYPASSRLS dan auth.uid() sebagai pelaku. PUBLIC/anon tidak mendapat EXECUTE; fungsi dalaman dan jadual persendirian tidak boleh dimutasi oleh authenticated. RPC yang boleh diakses authenticated tidak menerima ID pelaku.

Laporan workspace menggunakan `ua_teacher_workspace_records()` dengan SECURITY INVOKER dan RLS pengguna sebenar; ia tidak memanggil RPC laporan definer lama. Percubaan ditapis melalui student_id → profiles.class_id; jawapan melalui attempt_id → percubaan murid. Kuiz bersama tidak membuka rekod murid kelas lain. Perkongsian/pembatalan terikat pemilik sebenar. Workspace yang tidak aktif tidak boleh mencipta/berkongsi kelas melalui RPC.

**RLS tidak melindungi daripada semua fungsi/view lama yang memintasnya.** Semak setiap SECURITY DEFINER lama (termasuk helper yang dipanggilnya), trigger dan view dalam audit. Tolak fungsi yang mengambil acting teacher_id/role daripada pelanggan tanpa menyemak Auth, atau yang mengubah profil/keahlian secara arbitrari. Jangan hanya mempercayai nama fungsi.

Pintu `ua.reviewed_security_fingerprint` dalam migrasi sengaja kosong. Selepas isi audit disemak, masukkan fingerprint yang dihasilkan 01-audit.sql dalam baris SET LOCAL fail 02. Ia mengesan perubahan polisi/definer sejak semakan; fingerprint bukan bukti keselamatan dan jangan disalin sebelum membaca definisi. Jika tidak sepadan, transaksi gagal sebelum perubahan. Audit trigger/view juga perlu disemak secara manual. Jangan jalankan fail 02 dahulu.

## Kod portal yang disediakan

- verifiedProfile membaca profil dengan JWT pengguna, menggunakan cast class_id::text, kemudian membaca konteks workspace yang disahkan oleh database.
- `role` dalam respons aplikasi boleh menjadi teacher kerana workspace; `database_role` kekal student. Kod tidak menghantar UPDATE profiles.role.
- Login guru/confirmation callback meminta workspace sendiri sahaja; refresh mengesahkan semula konteks. Metadata requested_portal ialah permintaan, bukan kebenaran.
- Context mesti version 2, scope owned_classes, teacher_id sama dengan Auth uid dan class_ids rentetan bigint yang sah; konteks palsu ditolak.
- RPC workspace yang belum dipasang menghasilkan mesej setup_required bagi log masuk guru; tiada kejayaan palsu. Login pelajar/akaun legacy tetap berfungsi jika RPC konteks memang belum tersedia. Ralat kebenaran sebenar tidak disamakan dengan RPC tiada.
- Dashboard mempunyai Kelas Saya, muat semula dan borang cipta kelas. ID pemilik dalam body pelanggan diabaikan; backend hanya menghantar p_name. Mesej kejayaan hanya selepas database memulangkan kelas sebenar.
- Laporan workspace melalui RPC invoker baharu. Field markah di luar skema teras dibaca daripada rekod sebenar; field tiada dipaparkan kosong, bukan markah rekaan. Pemetaan lajur score/max_score/attempt_number/reflection perlu disahkan dalam staging daripada audit skema penuh.
- Auth cookies HttpOnly/Secure, pemeriksaan origin, validasi input, had permintaan asas, pemilihan avatar, log keluar dan pengesahan Auth asal dikekalkan.

## Pengaktifan selepas semakan sahaja

1. Simpan sandaran, jalankan audit baca sahaja dan semak skema, polisi, fungsi, view serta aliran pendaftaran murid. Jangan kongsi token/kata laluan.
2. Uji fail 02 dalam projek staging dengan skema/polisi sebenar. Prasyarat sengaja gagal jika skema atau fingerprint tidak sepadan.
3. Sahkan akaun A/B/pelajar, cipta kelas, larangan akses silang dan laluan kuiz/refleksi asal. Pastikan restrictive lama tidak menyekat bacaan sah; jangan buang polisi untuk menyembunyikan ralat.
4. Selepas SQL diluluskan dan ujian staging lulus, jalankan migrasi melalui SQL Editor sebagai postgres dan terbitkan patch portal yang telah diselaraskan dengan sumber terkini. Tidak memerlukan service_role key dalam frontend.
5. Daftar guru sebenar, sahkan e-mel, log masuk, cipta kelas dan semak ID/membership sebenar sebelum menyatakan sambungan produksi berjaya.

Rollback: hentikan/undur kod workspace dahulu, jalankan fail 03 yang disemak. Ia membuang RPC/polisi/trigger baharu sahaja dan menarik kebenaran private schema. Tiada kelas, rekod murid atau markah dipadam. Jadual workspace/pemilikan/kaunter disimpan sebagai arkib persendirian; tiada DROP CASCADE. Alokasi classes.id kembali kepada keadaan asal tanpa default (ID perlu dibekalkan oleh aliran lama). Migrasi baharu menolak skema arkib yang sudah wujud; reaktivasi memerlukan migrasi ke hadapan, bukan menjalankan semula fail 02 secara membuta tuli.
