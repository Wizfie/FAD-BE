# Migration Guide: Move Photos to TPS Subfolder

## Overview

Memindahkan semua foto TPS dari `/uploads` ke `/uploads/TPS` untuk organisasi yang lebih baik.

## Steps

### 1. Backup Database (PENTING!)

Sebelum melakukan migrasi, backup database Anda:

```bash
# Windows - menggunakan MySQL
mysqldump -u root db_fad > backup_db_fad_before_migration.sql
```

### 2. Run Migration Script

Script ini akan:

- Membuat folder `/uploads/TPS` jika belum ada
- Memindahkan semua file foto (original + thumbnail) ke subfolder TPS
- Update database (kolom `url`, `thumbUrl`, `filename`, `thumbFilename`) untuk semua foto
- Update tabel `Photo` dan `ProgramInfoImage`

```bash
cd FAD-BE
node scripts/migratePhotosToSubfolder.js
```

### 3. Verify Migration

Script akan menampilkan summary:

```
📋 MIGRATION SUMMARY
============================================================
✅ Files moved: 200
✅ Database records updated: 100
⏭️  Records skipped (already migrated): 0
❌ Errors: 0
```

### 4. Test Application

1. Start backend: `npm run dev` di folder FAD-BE
2. Start frontend: `npm run dev` di folder FAD-FE
3. Buka aplikasi dan verifikasi:
   - Foto-foto lama masih dapat ditampilkan
   - Upload foto baru tersimpan di `/uploads/TPS/`
   - Thumbnail ter-generate dengan benar

### 5. Post-Migration Check

Periksa struktur folder:

```
uploads/
├── TPS/
│   ├── abc123.jpg
│   ├── abc123_thumb.jpg
│   ├── def456.jpeg
│   ├── def456_thumb.jpeg
│   └── ...
└── (file lain yang tidak terkait foto TPS)
```

## What Changed

### Backend Files Modified:

1. **config/multer.js** - Upload destination ke `TPS_UPLOAD_DIR`
2. **services/photoService.js** - Path dan URL menggunakan `/uploads/TPS/`
3. **services/programInfoService.js** - Path dan URL menggunakan `/uploads/TPS/`

### Database Changes:

- Table `Photo`:

  - `url`: dari `/uploads/xxx.jpg` → `/uploads/TPS/xxx.jpg`
  - `thumbUrl`: dari `/uploads/xxx_thumb.jpg` → `/uploads/TPS/xxx_thumb.jpg`

- Table `ProgramInfoImage`:
  - `url`: dari `/uploads/info_xxx.jpg` → `/uploads/TPS/info_xxx.jpg`
  - `thumbUrl`: dari `/uploads/info_xxx_thumb.jpg` → `/uploads/TPS/info_xxx_thumb.jpg`

## Rollback Plan (if needed)

Jika ada masalah:

1. Restore database dari backup:

```bash
mysql -u root db_fad < backup_db_fad_before_migration.sql
```

2. Pindahkan file kembali dari TPS ke uploads:

```bash
# Windows PowerShell
cd C:\MyLocal\Project\OK\FAD-grm\uploads\TPS
Move-Item * ..\
```

3. Revert code changes (git reset atau manual)

## Benefits

✅ **Better Organization** - Foto TPS terpisah dari file lainnya  
✅ **Scalability** - Mudah tambahkan kategori folder baru (FAD, vendor, dll)  
✅ **Performance** - Folder lebih terstruktur, lebih cepat access  
✅ **Maintenance** - Lebih mudah backup per kategori

## Notes

- Migration script aman dijalankan multiple kali (skip yang sudah migrate)
- Frontend tetap menggunakan useImageUrl composable (tidak perlu update)
- Express static middleware otomatis serve subfolder
- Foto baru otomatis masuk ke `/uploads/TPS/`
