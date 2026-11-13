# Konfigurasi U.A. Hero LMS

Kod laman telah disediakan, tetapi rekod murid tidak boleh disimpan sehingga sambungan Google Sheets dan rahsia pelayan dipasang. Jangan memasukkan rahsia dalam frontend atau fail Git.

## Google Sheets

Cipta satu spreadsheet peribadi dengan tiga tab dan baris pertama **tepat** seperti berikut:

- `KEHADIRAN`: `Session_ID,Nama_Murid,Kelas,Tarikh_Masuk,Masa_Masuk`
- `MARKAH_KUIZ`: `Session_ID,Nama_Murid,Kelas,Markah,Jumlah_Soalan,Peratus,Percubaan,Tarikh_Masa,Submission_ID,Tahap`
- `REFLEKSI`: `Session_ID,Nama_Murid,Kelas,Refleksi_1,Refleksi_2,Refleksi_3,Tarikh_Masa,Submission_ID`

Dua lajur tambahan `Submission_ID` dan `Tahap` menyokong percubaan berulang, idempotensi dan tiga tahap kuiz. Jangan kongsi spreadsheet kepada umum. Aktifkan Google Sheets API dalam projek Google Cloud sekolah; cipta akaun perkhidmatan dan kongsi spreadsheet kepada e-mel akaun itu sebagai Editor.

Tetapkan rahsia persekitaran pelayan Sites:

- `HERO_SPREADSHEET_ID`: ID dalam URL spreadsheet.
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`: kandungan JSON penuh kelayakan akaun perkhidmatan, termasuk private key.
- `HERO_GUEST_SESSION_SECRET`: nilai rawak sekurang-kurangnya 32 aksara untuk menandatangani sesi murid.
- `HERO_TEACHER_EMAIL`: e-mel guru tunggal yang telah disahkan oleh Supabase Auth, digunakan apabila UUID belum ditetapkan.
- `HERO_TEACHER_USER_ID`: UUID pengguna guru dalam Supabase Auth. Jika ditetapkan, UUID ini mengambil keutamaan atas e-mel.

Kekalkan `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` sedia ada. Wujudkan akaun guru dalam Supabase Auth melalui pentadbir, kemudian sahkan `profiles.role = 'teacher'` untuk UUID yang sama. Tiada pendaftaran guru awam dalam UI/API baharu. **Semak polisi RLS dan RPC Supabase sedia ada sebelum mengaktifkan produksi:** fungsi seperti `ua_register_teacher_workspace` mungkin masih boleh dipanggil terus melalui Supabase walaupun UI pendaftaran ditutup. Perubahan SQL untuk mengunci RPC tersebut perlu disemak dahulu, bukan dijalankan secara automatik.

## Pengesahan selepas konfigurasi

Gunakan identiti ujian yang diluluskan sekolah: masuk sebagai murid; lihat satu rekod di `KEHADIRAN`; jawab kuiz dua kali dan semak dua baris `MARKAH_KUIZ`; hantar refleksi dan semak `REFLEKSI`. Cuba semula penghantaran dengan ID yang sama untuk mengesahkan tiada baris berganda. Log masuk guru yang dibenarkan, cuba akaun bukan guru, periksa carian/penapis, CSV/XLSX dan log keluar. Tanpa sesi guru, GET `/api/hero-records?action=teacher` mesti menolak akses. Jangan gunakan data sebenar murid untuk ujian awam.

Pelayan menunjukkan ralat jika Sheets/rahsia belum disediakan; UI tidak mendakwa rekod berjaya disimpan dalam keadaan itu. Kehadiran dan cubaan kuiz disimpan di Sheets, bukan localStorage sahaja. Sesi murid cookie bertandatangan tamat selepas lapan jam. Rekod boleh dipadam oleh guru mengikut ID sesi melalui Dashboard.
