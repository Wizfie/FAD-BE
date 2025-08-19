This folder contains Prisma schema and an import script to migrate the JSON `dataFad.json` into MySQL.

Steps to run:

1. Copy `.env.example` to `.env` and update `DATABASE_URL` and `DATA_FAD_PATH`.

2. Install dependencies in `server` folder:

`````bash
````markdown
Folder ini berisi skema Prisma dan skrip import untuk memigrasikan file JSON `dataFad.json` ke MySQL.

Langkah menjalankan migrasi:

1. Salin `.env.example` menjadi `.env` lalu isi `DATABASE_URL` dan `DATA_FAD_PATH` sesuai lingkungan Anda.

2. Instal dependensi di folder `server`:

```bash
cd server
npm install
`````

3. Generate Prisma client dan jalankan migrasi database:

```bash
npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate dev --name init --schema=./prisma/schema.prisma
```

4. Jalankan proses import data dari JSON ke database:

```bash
npm run import:fad
```

Catatan:

- Skrip import melakukan insert dalam batch (default 500) dan akan melewati duplikat bila memungkinkan.
- Pastikan database sudah dibuat dan `DATABASE_URL` benar sebelum menjalankan migrasi.
- Jika ingin mengecek data terlebih dahulu, buka `dataFad.json` di editor untuk meninjau beberapa record.

```

```
