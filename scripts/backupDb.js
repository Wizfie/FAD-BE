/**
 * scripts/backupDb.js
 *
 * Backup MySQL database menggunakan mysqldump + backup uploads (foto) pakai robocopy.
 * Dipanggil dari cron job di index.js, atau bisa dijalankan manual:
 *   node scripts/backupDb.js
 *
 * DB Output  : backups/backup_db_fad_YYYYMMDD_HHMMSS.sql
 * DB Rotasi  : hapus backup lebih dari BACKUP_RETENTION_DAYS hari (default 7)
 * Foto Output: backups/uploads/  (incremental mirror — hanya copy file baru)
 */

import { spawn, execFile } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, "../backups");
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);

/**
 * Backup folder uploads secara incremental menggunakan robocopy (Windows built-in).
 * Hanya menyalin file baru — file yang sudah ada di dest di-skip.
 * Dest: folder saudara di sebelah uploads/ — misal uploads/ → uploads_backup/
 */
export async function runUploadsBackup() {
  const uploadDir = process.env.UPLOAD_DIR;
  if (!uploadDir) throw new Error("UPLOAD_DIR tidak di-set di environment");

  // Simpan di folder saudara: .../uploads_backup/ (sejajar dengan uploads/)
  const destDir = path.join(path.dirname(uploadDir), "uploads_backup");
  fs.mkdirSync(destDir, { recursive: true });

  // /E  = copy subdirs termasuk kosong
  // /XO = skip file yang sudah ada di dest (incremental)
  // /R:1 /W:1 = retry 1x, tunggu 1 detik
  // /NP = no progress percentage (cleaner log)
  const args = [uploadDir, destDir, "/E", "/XO", "/R:1", "/W:1", "/NP"];

  return new Promise((resolve, reject) => {
    const proc = spawn("robocopy", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));

    proc.on("close", (code) => {
      // robocopy exit code < 8 = sukses (0=nothing new, 1=copied, 2=extra, 3=both, dll)
      if (code >= 8) {
        return reject(
          new Error(
            `robocopy gagal dengan exit code ${code}:\n${stdout.trim()}`,
          ),
        );
      }

      // Hitung jumlah file yang di-copy dari output robocopy
      const match = stdout.match(/Files\s*:\s*(\d+)/);
      const filesCopied = match ? parseInt(match[1], 10) : 0;

      resolve({ dest: destDir, filesCopied });
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error("robocopy tidak ditemukan. Pastikan berjalan di Windows."),
        );
      } else {
        reject(err);
      }
    });
  });
}

/** Parse DATABASE_URL → { host, port, user, password, database } */
function parseDbUrl(url) {
  // Format: mysql://user:password@host:port/database
  //         mysql://user@host:port/database  (tanpa password)
  const match = url.match(
    /^mysql:\/\/([^:@]+)(?::([^@]*))?@([^:/]+):(\d+)\/(.+)$/,
  );
  if (!match) throw new Error(`DATABASE_URL format tidak dikenali: ${url}`);
  const [, user, password = "", host, port, database] = match;
  return { user, password, host, port, database };
}

/** Format Date → YYYYMMDD_HHmmss (untuk nama file) */
function formatDateForFilename(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Hapus backup yang lebih lama dari RETENTION_DAYS */
function rotateOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.startsWith("backup_") || !file.endsWith(".sql")) continue;
    const filePath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  return deleted;
}

/** Cek apakah mysqldump tersedia di PATH */
function isMysqldumpAvailable() {
  return new Promise((resolve) => {
    execFile("mysqldump", ["--version"], (err) => resolve(!err));
  });
}

/**
 * Fallback: backup murni JS via mysql2 (tanpa binary eksternal).
 * Generate file .sql berisi DROP+CREATE TABLE dan INSERT rows per tabel.
 */
async function backupWithMysql2(dbConfig, outputPath) {
  const mysql = (await import("mysql2/promise")).default;
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: Number(dbConfig.port),
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    multipleStatements: true,
  });

  const write = (str) => fs.appendFileSync(outputPath, str, "utf8");

  write(
    `-- FAD DB Backup (pure-JS fallback)\n` +
      `-- Generated: ${new Date().toISOString()}\n` +
      `-- Database: ${dbConfig.database}\n\n` +
      `SET FOREIGN_KEY_CHECKS=0;\n\n`,
  );

  const [tables] = await conn.query("SHOW TABLES");
  const tableKey = `Tables_in_${dbConfig.database}`;

  for (const row of tables) {
    const table = row[tableKey];

    // CREATE TABLE
    const [[createRow]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = createRow["Create Table"];
    write(`DROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n\n`);

    // INSERT rows (batch 500)
    const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
    if (rows.length === 0) continue;

    const cols = Object.keys(rows[0])
      .map((c) => `\`${c}\``)
      .join(", ");

    const escape = (v) => {
      if (v === null || v === undefined) return "NULL";
      if (v instanceof Date)
        return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
      if (typeof v === "number" || typeof v === "bigint") return String(v);
      if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
      return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
    };

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = batch
        .map((r) => `(${Object.values(r).map(escape).join(", ")})`)
        .join(",\n  ");
      write(`INSERT INTO \`${table}\` (${cols}) VALUES\n  ${values};\n`);
    }
    write("\n");
  }

  write("SET FOREIGN_KEY_CHECKS=1;\n");
  await conn.end();
}

/** Jalankan mysqldump dan simpan output ke file */
async function backupWithMysqldump(dbConfig, outputPath) {
  const { user, password, host, port, database } = dbConfig;
  const writeStream = fs.createWriteStream(outputPath);

  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    ...(password ? [`--password=${password}`] : []),
    "--single-transaction",
    "--routines",
    "--triggers",
    database,
  ];

  return new Promise((resolve, reject) => {
    const dump = spawn("mysqldump", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    dump.stdout.pipe(writeStream);

    let stderrOutput = "";
    dump.stderr.on("data", (data) => (stderrOutput += data.toString()));

    dump.on("close", (code) => {
      writeStream.close();
      if (code !== 0) {
        try {
          fs.unlinkSync(outputPath);
        } catch {}
        return reject(
          new Error(`mysqldump exit code ${code}: ${stderrOutput.trim()}`),
        );
      }
      resolve();
    });

    dump.on("error", (err) => {
      writeStream.close();
      try {
        fs.unlinkSync(outputPath);
      } catch {}
      reject(err);
    });
  });
}

export async function runBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL tidak di-set di environment");

  const dbConfig = parseDbUrl(dbUrl);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const filename = `backup_${dbConfig.database}_${formatDateForFilename(new Date())}.sql`;
  const outputPath = path.join(BACKUP_DIR, filename);

  const hasMysqldump = await isMysqldumpAvailable();
  let method;

  if (hasMysqldump) {
    method = "mysqldump";
    await backupWithMysqldump(dbConfig, outputPath);
  } else {
    method = "pure-js (mysql2)";
    // Hapus file kosong dulu agar appendFileSync mulai bersih
    try {
      fs.unlinkSync(outputPath);
    } catch {}
    await backupWithMysql2(dbConfig, outputPath);
  }

  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  const deleted = rotateOldBackups();

  return {
    filename,
    path: outputPath,
    sizeMB,
    deletedOldBackups: deleted,
    method,
  };
}

// ─── Jalankan langsung jika dipanggil sebagai script ───────────────────────
// node scripts/backupDb.js
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  // Load .env jika ada (untuk kemudahan run manual)
  try {
    const { config } = await import("dotenv");
    config({ path: path.resolve(__dirname, "../.env") });
  } catch {}

  runBackup()
    .then((result) => {
      console.log(
        `✅ DB backup berhasil: ${result.filename} (${result.sizeMB} MB) [${result.method}]`,
      );
      if (result.deletedOldBackups > 0)
        console.log(
          `🗑  ${result.deletedOldBackups} backup DB lama dihapus (>=${RETENTION_DAYS} hari)`,
        );
    })
    .catch((err) => {
      console.error("❌ DB backup gagal:", err.message);
    });

  runUploadsBackup()
    .then((result) => {
      console.log(
        `✅ Uploads backup berhasil: ${result.filesCopied} file baru disalin → ${result.dest}`,
      );
    })
    .catch((err) => {
      console.error("❌ Uploads backup gagal:", err.message);
    });
}
