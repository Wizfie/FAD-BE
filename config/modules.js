/**
 * Application Modules Configuration
 *
 * ⚠️ CARA MENAMBAH MODULE BARU:
 * 1. Tambahkan module baru di object MODULES di bawah ini
 *    Contoh: NEW_MODULE: "NEW_MODULE",
 *
 * 2. Update juga file frontend: FAD-FE/src/constants/permissions.js
 *    Tambahkan di array MODULES dengan format:
 *    { value: 'NEW_MODULE', label: 'Label', description: 'Deskripsi', color: 'warna' }
 *
 * 3. Restart server backend dan frontend setelah perubahan
 */

export const MODULES = {
  FAD: "FAD",
  TPS: "TPS",
  // Tambahkan module baru di sini:
  // CONTOH: "CONTOH",
};

export const getAllModules = () => Object.values(MODULES);

export const isValidModule = (moduleName) => {
  return getAllModules().includes(moduleName);
};
