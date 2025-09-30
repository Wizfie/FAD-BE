// Utility untuk format dan parsing tanggal

// ===== Utilitas dasar =====
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const pad2 = (n) => String(n).padStart(2, "0");
const pad3 = (n) => String(n).padStart(3, "0");

// ===== Parser umum =====

// Parse format "YYYY-MM-DD" sebagai tanggal lokal
function parseYMDLocal(y, m, d) {
  const dt = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
  return dt.getFullYear() === Number(y) &&
    dt.getMonth() === Number(m) - 1 &&
    dt.getDate() === Number(d)
    ? dt
    : null;
}

// Parse datetime dengan berbagai format
// options.assume: "local" (default) | "utc"
function parseDateTime(str, options = { assume: "local" }) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();

  // Deteksi jika ada 'Z' (UTC) atau offset (+07:00, -03:30, dll)
  const hasExplicitZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);

  // Pola: YYYY-MM-DD[ T]HH:mm[:ss][.SSS][Z|±HH:MM]?
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?([zZ]|[+\-]\d{2}:\d{2})?$/
  );
  if (!m) {
    // fallback: coba parse tanggal saja
    const dOnly = tryParseDate(s);
    return dOnly;
  }

  const [, yy, MM, dd, HH, mm, ss = "0", SSS = "0", zone] = m;
  const y = Number(yy),
    mo = Number(MM) - 1,
    day = Number(dd);
  const h = Number(HH),
    mi = Number(mm),
    se = Number(ss),
    ms = Number(SSS.padEnd(3, "0"));

  if (hasExplicitZone) {
    // Serahkan ke Date parse ISO dengan 'T'
    const iso = `${yy}-${MM}-${dd}T${HH}:${mm}:${ss}.${pad3(ms)}${zone ?? ""}`;
    const d = new Date(iso);
    return isValidDate(d) ? d : null;
  }

  // Tanpa zona → sesuai opsi
  if (options.assume === "utc") {
    const t = Date.UTC(y, mo, day, h, mi, se, ms);
    const d = new Date(t);
    return d.getUTCFullYear() === y &&
      d.getUTCMonth() === mo &&
      d.getUTCDate() === day
      ? d
      : null;
  } else {
    const d = new Date(y, mo, day, h, mi, se, ms);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day
      ? d
      : null;
  }
}

/**
 * Parser ringan multi-format untuk tanggal (tanpa jam)
 * @param {string} s - String tanggal (YYYY-MM-DD, DD/MM/YYYY, DD/MM)
 * @returns {Date|null} - Objek Date atau null jika gagal parse
 */
const tryParseDate = (s) => {
  if (!s) return null;
  const t = String(s).trim();

  // YYYY-MM-DD atau YYYY/MM/DD
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const [, yy, mm, dd] = m;
    return parseYMDLocal(yy, mm, dd);
  }

  // DD-MM-YYYY atau DD/MM/YYYY
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    return parseYMDLocal(yy, mm, dd);
  }

  // DD/MM atau DD-MM (tanpa tahun) -> pakai tahun berjalan
  m = t.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const [, dd, mm] = m;
    const y = new Date().getFullYear();
    return parseYMDLocal(y, mm, dd);
  }

  return null;
};

/**
 * Parser bulan "YYYY-MM" atau "MM-YYYY" untuk rentang awal-akhir bulan
 * @param {string} s - String bulan (YYYY-MM atau MM-YYYY)
 * @returns {Object|null} - {start, end} tanggal atau null
 */
const tryParseMonth = (s) => {
  if (!s) return null;
  const t = s.trim();

  // YYYY-MM / YYYY/MM
  let m = t.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) {
    const yy = Number(m[1]),
      MM = Number(m[2]);
    if (MM >= 1 && MM <= 12) {
      const start = new Date(yy, MM - 1, 1, 0, 0, 0, 0);
      const end = new Date(yy, MM, 0, 23, 59, 59, 999);
      return { start, end };
    }
  }

  // MM-YYYY / MM/YYYY
  m = t.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) {
    const MM = Number(m[1]),
      yy = Number(m[2]);
    if (MM >= 1 && MM <= 12) {
      const start = new Date(yy, MM - 1, 1, 0, 0, 0, 0);
      const end = new Date(yy, MM, 0, 23, 59, 59, 999);
      return { start, end };
    }
  }

  return null;
};

/**
 * Parser tanggal generik dengan fallback ke Date bawaan
 * @param {*} v - Input tanggal (string, Date, atau lainnya)
 * @returns {Date|null} - Objek Date yang valid atau null
 */
function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isValidDate(v) ? v : null;

  // coba format spesifik datetime dulu
  const asDT = parseDateTime(String(v));
  if (asDT) return asDT;

  // fallback: Date bawaan
  const d = new Date(v);
  return isValidDate(d) ? d : null;
}

// ===== Formatter =====

/**
 * Format tanggal ke "DD/MM/YYYY" - contoh: 27/08/2025
 * @param {*} v - Input tanggal
 * @returns {string} - Format DD/MM/YYYY atau "-" jika invalid
 */
function fmtDateToDDMMYYYY(v) {
  const d = v instanceof Date ? v : parseDate(v);
  if (!isValidDate(d)) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Format waktu ke "HH:mm:ss" - contoh: 03:06:04
 * @param {*} v - Input tanggal/waktu
 * @returns {string} - Format HH:mm:ss atau "-" jika invalid
 */
function fmtTimeToHHmmss(v) {
  const d = v instanceof Date ? v : parseDate(v);
  if (!isValidDate(d)) return "-";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;
}

/**
 * Format tanggal dan waktu ke "DD/MM/YYYY HH:mm:ss" - contoh: 27/08/2025 03:06:04
 * @param {*} v - Input tanggal/waktu
 * @returns {string} - Format DD/MM/YYYY HH:mm:ss atau "-" jika invalid
 */
function fmtDateTimeDDMMYYYY_HHmmss(v) {
  const d = v instanceof Date ? v : parseDate(v);
  if (!isValidDate(d)) return "-";
  return `${fmtDateToDDMMYYYY(d)} ${fmtTimeToHHmmss(d)}`;
}

/**
 * Format tanggal waktu untuk SQL "YYYY-MM-DD HH:mm:ss.SSS" - contoh: 2025-08-27 03:06:04.527
 * @param {*} v - Input tanggal/waktu
 * @returns {string} - Format SQL timestamp atau "-" jika invalid
 */
function fmtDateTimeSQL(v) {
  const d = v instanceof Date ? v : parseDate(v);
  if (!isValidDate(d)) return "-";
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
      d.getSeconds()
    )}.${pad3(d.getMilliseconds())}`
  );
}

// ===== Range harian =====

/**
 * Dapatkan awal hari (00:00:00.000) dari tanggal
 * @param {*} input - Input tanggal
 * @returns {Date|null} - Date pada awal hari atau null
 */
const startOfDay = (input) => {
  const d = input instanceof Date ? new Date(input) : parseDate(input);
  if (!isValidDate(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Dapatkan akhir hari (23:59:59.999) dari tanggal
 * @param {*} input - Input tanggal
 * @returns {Date|null} - Date pada akhir hari atau null
 */
const endOfDay = (input) => {
  const d = input instanceof Date ? new Date(input) : parseDate(input);
  if (!isValidDate(d)) return null;
  d.setHours(23, 59, 59, 999);
  return d;
};

// ===== Ekspor =====
export {
  // parser
  parseDate,
  parseDateTime,
  tryParseDate,
  tryParseMonth,

  // formatter
  fmtDateToDDMMYYYY,
  fmtTimeToHHmmss,
  fmtDateTimeDDMMYYYY_HHmmss,
  fmtDateTimeSQL,

  // util
  startOfDay,
  endOfDay,
  isValidDate,
};
