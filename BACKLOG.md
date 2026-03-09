# FAD Backend — Feature Backlog & Cleanup Tracker

> Last updated: 2026-03-09 (rev 5) — version **1.2.0**

---

## 📋 Table of Contents

1. [Completed (Session 2026-03-09)](#completed-session-2026-03-09)
2. [Feature Backlog](#feature-backlog)
3. [Technical Debt / Refactor](#technical-debt--refactor)
4. [Unused / Dead Code](#unused--dead-code)
5. [Notes](#notes)

---

## ✅ Completed (Session 2026-03-09)

### Auth / JWT Fix

| Item                                                | Keterangan                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cookie `maxAge` sinkron dengan `REFRESH_TOKEN_TTL`  | Sebelumnya hardcoded 1 hari, padahal JWT refresh 7 hari → sesi logout paksa setelah 1 hari   |
| Refresh token rotation pakai `prisma.$transaction`  | Mencegah race condition saat 2 tab refresh bersamaan                                         |
| `RefreshSession` schema disederhanakan              | Hapus `revoked`, `replacedById` — rotasi kini pakai DELETE+CREATE, lebih bersih              |
| `expiresAt` di `RefreshSession`                     | Session otomatis invalid di level DB tanpa perlu flag                                        |
| `revokeRefresh` pakai `jwt.decode` (bukan `verify`) | Token expired pun tetap bisa di-revoke saat logout                                           |
| Auto-cleanup session expired setiap 12 jam          | `setInterval` di `index.js` → panggil `cleanupExpiredSessions()`                             |
| Hapus `authenticate` dari route `POST /logout`      | Logout gagal jika access token sudah expired karena middleware reject 401 sebelum controller |
| Hapus `validateLogout` dari route `POST /logout`    | Validator cek `body("refreshToken")` padahal token ada di httpOnly cookie → selalu 422       |

### JWT Session Lifetime Fix

| Item                                                               | Keterangan                                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Rotasi refresh token tidak reset `expiresAt`                       | Bug: setiap rotasi buat session baru dengan `expiresAt = now + REFRESH_TTL` → sesi tidak pernah berakhir selama user aktif   |
| Fix: session baru mewarisi `expiresAt` dari session lama           | Total lifetime refresh token selalu terhitung sejak login, bukan dari rotasi terakhir                                         |
| JWT refresh TTL sinkron dengan sisa `expiresAt` session DB         | Bug: JWT baru selalu `expiresIn: REFRESH_TTL` (full) meski session DB hampir habis → jwt.verify() lolos padahal session mati |
| Fix: `signRefreshToken()` terima parameter `expiresAt` saat rotasi | JWT TTL = sisa detik dari `session.expiresAt - now`, bukan konstan REFRESH_TTL                                                |

### Security Audit Fixes

| Item                                                                         | Keterangan                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `rateLimiter.js` — hapus `securityLogger` (undefined, crash saat limit kena) | Semua `onLimitReached` callback pakai `securityLogger` yang tidak pernah didefinisikan → `ReferenceError` fatal |
| `rateLimiter.js` — import path salah (`../utils/Logger.js` → `logger.js`)    | Case-sensitive di Linux/WSL → module not found                                                                  |
| `rateLimiter.js` — `onLimitReached` dihapus di express-rate-limit v7         | Diganti dengan `handler` (API baru v7) — setiap limiter kini kirim response + log sendiri                       |
| `validateRefresh` cek `body("refreshToken")` → diganti array kosong          | Token ada di httpOnly cookie, bukan body → validator selalu gagal 422 di endpoint `/refresh`                    |
| Password minimum 4 karakter → dinaikkan ke **8 karakter**                    | 4 karakter terlalu lemah untuk produksi                                                                         |
| `authLimiter` diterapkan ke route login, register, refresh                   | Sebelumnya tidak ada rate limit di auth routes → brute-force tidak terlindungi                                  |
| `/uploads` static dilindungi `authenticate` + `requireAdmin`                 | Sebelumnya siapapun bisa akses URL foto tanpa login                                                             |

### Photo Upload

| Item                                         | Keterangan                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Kompresi original saat upload                | `compressOriginal()` di `photoService.js`: max 1600px, JPEG q82, auto-rotate EXIF, PNG → JPEG       |
| Script regenerasi thumbnail `regenThumbs.js` | Scan DB, skip yang sudah ada, generate ulang dari original, update `thumbFilename`+`thumbUrl` di DB |

### Backup & Maintenance

| Item                                          | Keterangan                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Auto backup DB harian jam 10:00 (`node-cron`) | `runBackup()` di `scripts/backupDb.js`, dijadwalkan via `cron.schedule` di `index.js`           |
| Fallback pure-JS jika `mysqldump` tidak ada   | Auto-detect: pakai `mysqldump` jika tersedia, fallback ke `mysql2` (sudah terpasang) jika tidak |
| Backup uploads foto incremental (`robocopy`)  | `runUploadsBackup()` — hanya copy file baru ke `uploads_backup/` sejajar dengan `uploads/`      |
| Rotasi backup DB otomatis                     | Hapus file `.sql` lebih dari `BACKUP_RETENTION_DAYS` hari (default 7, configurable via env)     |
| `npm run backup` untuk jalankan manual        | Jalankan DB backup + uploads backup sekaligus dari CLI                                          |
| `npm run thumbs:regen` / `thumbs:regen-all`   | Regenerasi thumbnail yang hilang / regenerasi semua secara paksa                                |

### Unused Code Dihapus

| File/Item                                                | Status     |
| -------------------------------------------------------- | ---------- |
| `check_imports.js`                                       | ✅ Dihapus |
| `migrations/` (folder root kosong)                       | ✅ Dihapus |
| `GET /admin` route (broken handler) di `authRoutes.js`   | ✅ Dihapus |
| `testLastLogin` controller + route `/test-login/:userId` | ✅ Dihapus |
| `scripts/migratePhotosToSubfolder.js`                    | ✅ Dihapus |
| `scripts/removeBaseUrlFromPhotos.js`                     | ✅ Dihapus |
| `scripts/update_program_info_urls.js`                    | ✅ Dihapus |

---

## Feature Backlog

### 🔐 Auth & Security

| #     | Feature                                                        | Priority   | Notes                                                                                              |
| ----- | -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| 1     | Password reset via email (forgot password flow)                | High       | Belum ada endpoint `/forgot-password` & `/reset-password`                                          |
| ~~2~~ | ~~Refresh token rotation~~                                     | ~~Medium~~ | ✅ **Done** — implemented dengan `prisma.$transaction`, cookie TTL fix, `expiresAt` di DB          |
| 3     | Account lockout setelah N kali gagal login                     | Medium     | Rate limiter sudah ada (IP-based), perlu per-user lockout                                          |
| 4     | Two-factor authentication (TOTP)                               | Low        | Future enhancement                                                                                 |
| 5     | Session management UI — list & revoke active sessions per user | Low        | `RefreshSession` table sudah ada, tinggal expose `GET /sessions` & `DELETE /sessions/:id` endpoint |

### 👤 User Management

| #   | Feature                                                        | Priority | Notes                                               |
| --- | -------------------------------------------------------------- | -------- | --------------------------------------------------- |
| 6   | Bulk user operations (activate/deactivate/delete)              | Medium   | Saat ini hanya single-user delete                   |
| 7   | User activity feed per-user (kapan login terakhir, aksi apa)   | Medium   | Data ada di changelog, tinggal filter by userId     |
| 8   | Endpoint update password oleh user sendiri (bukan SUPER_ADMIN) | High     | Saat ini hanya SUPER_ADMIN yang bisa ubah data user |

### 📦 FAD Data

| #   | Feature                                            | Priority | Notes                                                                  |
| --- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| 9   | Bulk import FAD via CSV/Excel upload               | Medium   | `importFadPrisma.js` sudah ada sebagai script, bisa dijadikan endpoint |
| 10  | Bulk delete FAD records                            | Medium   | Hanya ada single-record delete                                         |
| 11  | Soft delete FAD (restore/archive)                  | Low      | Saat ini delete adalah permanen                                        |
| 12  | Export FAD ke format Excel (.xlsx)                 | Medium   | Saat ini hanya CSV                                                     |
| 13  | Filter export FAD by status, vendor, tanggal range | Medium   | Saat ini export semua tanpa filter                                     |
| 14  | FAD history/audit trail per-record                 | Low      | Siapa yang ubah apa dan kapan                                          |

### 🗑️ TPS / Area

| #   | Feature                                         | Priority | Notes                                 |
| --- | ----------------------------------------------- | -------- | ------------------------------------- |
| 15  | Pagination untuk `GET /areas`                   | Medium   | Saat ini semua area diambil sekaligus |
| 16  | Search / filter area by nama                    | Low      | Berguna ketika area sudah banyak      |
| 17  | Export laporan TPS (summary area + foto) ke PDF | Low      | Perlu library PDF generator           |

### 📸 Photos

| #   | Feature                                                | Priority | Notes                                            |
| --- | ------------------------------------------------------ | -------- | ------------------------------------------------ |
| 18  | Kompresi gambar otomatis saat upload (resize/compress) | High     | Saat ini foto di-upload as-is, bisa sangat besar |
| 19  | Validation tipe file lebih ketat (hanya JPEG/PNG/WebP) | Medium   | Saat ini hanya cek MIME type dari multer         |
| 20  | Hapus file fisik saat photo record di-delete           | High     | Cek apakah sudah dilakukan di `photoService.js`  |

### 📊 Monitoring / Logging

| #   | Feature                                                | Priority | Notes                                           |
| --- | ------------------------------------------------------ | -------- | ----------------------------------------------- |
| 21  | UI endpoint untuk Security Logs (`/api/logs/security`) | Medium   | Endpoint sudah ada di BE, FE belum ada page-nya |
| 22  | Alert/notifikasi ketika ada event keamanan tinggi      | Low      | Email atau webhook                              |
| 23  | Log retention policy (auto-cleanup log files lama)     | Low      | Endpoint `DELETE /api/logs/cleanup` sudah ada   |

### 🔧 Infrastructure

| #   | Feature                                                       | Priority | Notes                                                         |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 24  | API versioning konsisten (`/v1/` prefix untuk semua endpoint) | Medium   | Saat ini FAD pakai `/v1/` tapi area, photos, dll tidak        |
| 25  | Response format standar `{ success, data, message, meta }`    | Medium   | Saat ini format response tidak konsisten antar controller     |
| 26  | Global error handler yang return format standar               | Medium   | `ApiError` sudah ada, perlu dipastikan semua controller pakai |
| 27  | Database backup endpoint (trigger manual backup)              | Low      | Ada script manual di `backups/` folder                        |
| 28  | Health-check endpoint `GET /health`                           | Low      | Untuk monitoring infrastruktur                                |

---

## Technical Debt / Refactor

| #   | Item                                                                                           | Priority | Notes                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| T1  | Dua logger berbeda: `utils/logger.js` vs `utils/unifiedLogger.js`                              | Medium   | Harus disatukan ke satu logger; `authController` & `dataController` pakai `unifiedLogger`, yang lain pakai `logger` |
| T2  | `changeLogController.js` — `getChangeLogs` di-import dua tempat (dataRoutes + changelogRoutes) | Low      | Duplikasi import, pertimbangkan pisahkan tanggung jawab                                                             |
| T3  | Pindahkan file SQL (`.sql`, `Query.txt`) ke folder `sql/` atau `docs/sql/`                     | Low      | Saat ini berserakan di root folder                                                                                  |
| T4  | Validasi input menggunakan `express-validator` belum konsisten di semua route                  | Medium   | Beberapa route tidak punya `validateSchema` middleware                                                              |
| T5  | `requireModule` & `requireAdmin` middleware — duplikasi logika dengan `authorize`              | Low      | Pertimbangkan gabungkan ke satu middleware yang lebih fleksibel                                                     |

---

## Unused / Dead Code

### 🔌 Endpoint yang Tidak Dikonsumsi FE

| Endpoint                                                              | File                                                  | Alasan                                                 | Rekomendasi                            |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Semua route di `logRoutes.js` (`/logs/security`, `/logs/audit`, dll.) | `routes/logRoutes.js`, `controllers/logController.js` | Endpoint lengkap di BE, **FE tidak punya halaman**-nya | **Buat halaman FE** (backlog #21)      |
| `getChangeLogStats` — `GET /changelog/stats`                          | `routes/changelogRoutes.js`                           | Tidak dipanggil dari view manapun yang aktif           | **Hubungkan ke view aktif atau hapus** |

### 📜 Scripts (Maintenance)

| File                              | Fungsi                        | Status               |
| --------------------------------- | ----------------------------- | -------------------- |
| `scripts/checkOrphanedFiles.js`   | Cek file foto tanpa record DB | Maintenance — simpan |
| `scripts/cleanupOrphanedFiles.js` | Hapus file foto orphan        | Maintenance — simpan |
| `scripts/checkPhotoDetails.js`    | Debug detail foto             | Pertimbangkan hapus  |
| `scripts/checkPhotos.js`          | Debug list foto               | Pertimbangkan hapus  |

---

## Notes

- **Server restart dibutuhkan** setelah perubahan BE: `npm run dev` di folder `FAD-BE/`
- **Schema change**: gunakan `npx prisma db push` (dev) atau `npx prisma migrate dev` (produksi)
- `services/importFadPrisma.js` adalah script import data manual — dijalankan via `npm run import:fad`
- `REFRESH_TOKEN_SECRET` wajib ada di `.env` — dipakai untuk sign/verify JWT refresh token

---

## 📋 Table of Contents

1. [Feature Backlog](#feature-backlog)
2. [Technical Debt / Refactor](#technical-debt--refactor)
3. [Unused / Dead Code (Candidates for Removal)](#unused--dead-code)
4. [Notes](#notes)

---

## Feature Backlog

### 🔐 Auth & Security

| #   | Feature                                                  | Priority | Notes                                                     |
| --- | -------------------------------------------------------- | -------- | --------------------------------------------------------- |
| 1   | Password reset via email (forgot password flow)          | High     | Belum ada endpoint `/forgot-password` & `/reset-password` |
| 2   | Refresh token rotation (invalidate old token on refresh) | Medium   | Saat ini refresh token tidak di-rotate setelah dipakai    |
| 3   | Account lockout setelah N kali gagal login               | Medium   | Rate limiter sudah ada (IP-based), perlu per-user lockout |
| 4   | Two-factor authentication (TOTP)                         | Low      | Future enhancement                                        |
| 5   | Session management — list & revoke active sessions       | Low      | Prisma model Token sudah ada, tinggal expose endpoint     |

### 👤 User Management

| #   | Feature                                                        | Priority | Notes                                               |
| --- | -------------------------------------------------------------- | -------- | --------------------------------------------------- |
| 6   | Bulk user operations (activate/deactivate/delete)              | Medium   | Saat ini hanya single-user delete                   |
| 7   | User activity feed per-user (kapan login terakhir, aksi apa)   | Medium   | Data ada di changelog, tinggal filter by userId     |
| 8   | Endpoint update password oleh user sendiri (bukan SUPER_ADMIN) | High     | Saat ini hanya SUPER_ADMIN yang bisa ubah data user |

### 📦 FAD Data

| #   | Feature                                            | Priority | Notes                                                                  |
| --- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| 9   | Bulk import FAD via CSV/Excel upload               | Medium   | `importFadPrisma.js` sudah ada sebagai script, bisa dijadikan endpoint |
| 10  | Bulk delete FAD records                            | Medium   | Hanya ada single-record delete                                         |
| 11  | Soft delete FAD (restore/archive)                  | Low      | Saat ini delete adalah permanen                                        |
| 12  | Export FAD ke format Excel (.xlsx)                 | Medium   | Saat ini hanya CSV                                                     |
| 13  | Filter export FAD by status, vendor, tanggal range | Medium   | Saat ini export semua tanpa filter                                     |
| 14  | FAD history/audit trail per-record                 | Low      | Siapa yang ubah apa dan kapan                                          |

### 🗑️ TPS / Area

| #   | Feature                                         | Priority | Notes                                 |
| --- | ----------------------------------------------- | -------- | ------------------------------------- |
| 15  | Pagination untuk `GET /areas`                   | Medium   | Saat ini semua area diambil sekaligus |
| 16  | Search / filter area by nama                    | Low      | Berguna ketika area sudah banyak      |
| 17  | Export laporan TPS (summary area + foto) ke PDF | Low      | Perlu library PDF generator           |

### 📸 Photos

| #   | Feature                                                | Priority | Notes                                            |
| --- | ------------------------------------------------------ | -------- | ------------------------------------------------ |
| 18  | Kompresi gambar otomatis saat upload (resize/compress) | High     | Saat ini foto di-upload as-is, bisa sangat besar |
| 19  | Validation tipe file lebih ketat (hanya JPEG/PNG/WebP) | Medium   | Saat ini hanya cek MIME type dari multer         |
| 20  | Hapus file fisik saat photo record di-delete           | High     | Cek apakah sudah dilakukan di `photoService.js`  |

### 📊 Monitoring / Logging

| #   | Feature                                                | Priority | Notes                                                                |
| --- | ------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| 21  | UI endpoint untuk Security Logs (`/api/logs/security`) | Medium   | Endpoint sudah ada di BE, FE belum ada page-nya (lihat seksi Unused) |
| 22  | Alert/notifikasi ketika ada event keamanan tinggi      | Low      | Email atau webhook                                                   |
| 23  | Log retention policy (auto-cleanup log files lama)     | Low      | Endpoint `DELETE /api/logs/cleanup` sudah ada                        |

### 🔧 Infrastructure

| #   | Feature                                                       | Priority | Notes                                                         |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 24  | API versioning konsisten (`/v1/` prefix untuk semua endpoint) | Medium   | Saat ini FAD pakai `/v1/` tapi area, photos, dll tidak        |
| 25  | Response format standar `{ success, data, message, meta }`    | Medium   | Saat ini format response tidak konsisten antar controller     |
| 26  | Global error handler yang return format standar               | Medium   | `ApiError` sudah ada, perlu dipastikan semua controller pakai |
| 27  | Database backup endpoint (trigger manual backup)              | Low      | Ada script manual di `backups/` folder                        |
| 28  | Health-check endpoint `GET /health`                           | Low      | Untuk monitoring infrastruktur                                |

---

## Technical Debt / Refactor

| #   | Item                                                                                           | Priority | Notes                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| T1  | Dua logger berbeda: `utils/logger.js` vs `utils/unifiedLogger.js`                              | Medium   | Harus disatukan ke satu logger; saat ini `authController` & `dataController` pakai `unifiedLogger`, yang lain pakai `logger` |
| T2  | `changeLogController.js` — `getChangeLogs` di-import dua tempat (dataRoutes + changelogRoutes) | Low      | Duplikasi import, pertimbangkan pisahkan tanggung jawab                                                                      |
| T3  | Pindahkan file SQL (`.sql`, `Query.txt`) ke folder `sql/` atau `docs/sql/`                     | Low      | Saat ini berserakan di root folder                                                                                           |
| T4  | Validasi input menggunakan `express-validator` belum konsisten di semua route                  | Medium   | Beberapa route tidak punya `validateSchema` middleware                                                                       |
| T5  | `requireModule` & `requireAdmin` middleware — duplikasi logika dengan `authorize`              | Low      | Pertimbangkan gabungkan ke satu middleware yang lebih fleksibel                                                              |

---

## Unused / Dead Code

> ⚠️ File/endpoint di bawah ini **tidak digunakan** dan dapat dihapus setelah dikonfirmasi.

### 🗂️ File yang Tidak Dipakai

| File                                                    | Alasan                                             | Rekomendasi      |
| ------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| `check_imports.js`                                      | Debug/test script sementara, bukan bagian produksi | **Hapus**        |
| `migrations/` (folder root, bukan `prisma/migrations/`) | Folder kosong, tidak ada isinya                    | **Hapus folder** |

### 🔌 Endpoint / Fungsi yang Tidak Dikonsumsi FE

| Endpoint / Fungsi                                                     | File                                                              | Alasan                                                                                                                                                                | Rekomendasi                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /admin` di `authRoutes.js`                                       | `routes/authRoutes.js` baris ~44                                  | **Bug**: callback `(req, res) => {}` tidak terhubung ke route handler (dipisahkan koma, bukan dipass sebagai argumen). Route ini tidak pernah merespons dengan benar. | **Perbaiki atau hapus**                                                                |
| `testLastLogin` — `GET /test-login/:userId`                           | `controllers/userController.js`, `routes/userRoutes.js`           | Fungsi debug/test, tidak ada halaman FE yang memanggilnya                                                                                                             | **Hapus** dari controller & routes                                                     |
| Semua route di `logRoutes.js` (`/logs/security`, `/logs/audit`, dll.) | `routes/logRoutes.js`, `controllers/logController.js`             | Endpoint sudah lengkap di BE, namun **FE tidak punya halaman** yang mengonsumsinya. Lihat `docs/LOG_UI_ACCESS.md` untuk rencana awal.                                 | **Buat halaman FE** (backlog item #21) atau tandai sebagai planned-not-yet-implemented |
| `getChangeLogStats` — `GET /changelog/stats`                          | `routes/changelogRoutes.js`, `controllers/changeLogController.js` | Hanya dipanggil dari `ChangelogViewer.vue` yang sudah orphan (tidak dipakai di FE)                                                                                    | **Refactor atau hubungkan ke view aktif**                                              |

### 📜 File Script (Maintenance Scripts)

File-file di folder `scripts/` adalah one-off maintenance scripts, **bukan bagian dari server runtime**:

| File                                  | Fungsi                        | Status                                       |
| ------------------------------------- | ----------------------------- | -------------------------------------------- |
| `scripts/checkOrphanedFiles.js`       | Cek file foto tanpa record DB | Maintenance — simpan tapi dokumentasikan     |
| `scripts/cleanupOrphanedFiles.js`     | Hapus file foto orphan        | Maintenance — simpan tapi dokumentasikan     |
| `scripts/checkPhotoDetails.js`        | Debug detail foto             | Pertimbangkan hapus jika sudah tidak relevan |
| `scripts/checkPhotos.js`              | Debug list foto               | Pertimbangkan hapus jika sudah tidak relevan |
| `scripts/migratePhotosToSubfolder.js` | One-time migration            | Sudah selesai dijalankan → **Hapus**         |
| `scripts/removeBaseUrlFromPhotos.js`  | One-time data fix             | Sudah selesai dijalankan → **Hapus**         |
| `scripts/update_program_info_urls.js` | One-time URL fix              | Sudah selesai dijalankan → **Hapus**         |

---

## Notes

- **Server restart dibutuhkan** setelah setiap perubahan di BE: `npm run dev` di folder `FAD-BE/`
- **Prisma migration**: setelah mengubah `schema.prisma`, jalankan `npx prisma migrate dev`
- File `services/importFadPrisma.js` adalah script import data manual — dijalankan via `npm run import:fad`, bukan bagian dari server runtime
