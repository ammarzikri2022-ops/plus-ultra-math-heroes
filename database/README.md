# Pelan pengaktifan semasa

Gunakan docs/complete-site-activation-review.md sebagai panduan semakan.

Urutan cadangan (BELUM dijalankan):
1. teacher-workspace-v2/01-audit.sql (baca sahaja)
2. teacher-workspace-v2/02-proposed-migration-DO-NOT-RUN-YET.sql (selepas audit/kelulusan)
3. learning-activation/03-learning-and-classes-review.sql (selepas 2 diluluskan)

Rollback: learning-activation/04-rollback-learning-review.sql, kemudian
teacher-workspace-v2/03-rollback-review.sql. Semua data disimpan.

Fail review-auth-reflections.sql, activate-student-entry-log.sql dan
self-teacher-workspaces-review.sql ialah cadangan sejarah yang BUKAN pelan semasa.
Jangan gunakan: sebahagiannya merujuk UUID kelas/guest log/kelulusan lama.
Tiada fail SQL dalam repo ini dijalankan oleh build atau deployment.
