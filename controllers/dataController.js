import {
  saveDataFad,
  readDataFad,
  updateDataFad,
  deleteDataFad,
  saveDataVendor,
  readDataVendor,
  updateDataVendor,
  deleteDataVendor,
} from '../services/serviceFad.js'
import fs from 'fs/promises'
import dotenv from 'dotenv'
dotenv.config()

const logFilePath = process.env.DATA_LOG_PATH

// Fungsi untuk membaca log dari file
const readLogFile = async () => {
  try {
    const data = await fs.readFile(logFilePath, 'utf8')
    return data.trim() === '' ? [] : JSON.parse(data) // Jika file kosong, kembalikan array kosong
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('File log tidak ditemukan, membuat file baru.')
      await fs.writeFile(logFilePath, JSON.stringify([])) // Buat file log baru
      return []
    }
    console.error('Gagal membaca file log:', error)
    throw error
  }
}

// Fungsi untuk menulis log ke file
const writeLogFile = async (log) => {
  if (!Array.isArray(log)) {
    throw new Error('Log yang akan ditulis harus berupa array.')
  }
  try {
    await fs.writeFile(logFilePath, JSON.stringify(log, null, 2))
    console.log('Log berhasil ditulis ke file:', logFilePath)
  } catch (error) {
    console.error('Gagal menulis log ke file:', error)
    throw error
  }
}

// Tambahkan log saat menyimpan data
const saveDataHandler = async (req, res) => {
  try {
    const formData = req.body
    const created = await saveDataFad(formData)

    const logEntry = {
      action: 'CREATE',
      id: created.id,
      timestamp: new Date().toISOString(),
      description: `Data FAD dengan ID ${created.id} berhasil dibuat.`,
    }

    const logs = await readLogFile()
    logs.push(logEntry)
    await writeLogFile(logs)

    res.status(200).json({ message: 'created', data: created, logEntry })
  } catch (e) {
    res.status(500).json({
      error: e.message || 'internal server error',
    })
  }
}

// Controller untuk membaca data
const getDataHandler = async (req, res) => {
  try {
    const { q, page, limit, fields, status } = req.query
    // fields can be comma-separated string like 'noFad,item,deskripsi'
    const fieldList = fields
      ? String(fields)
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined
    const result = await readDataFad({
      search: q ?? '',
      page: page ?? 1,
      limit: limit ?? 50,
      fields: fieldList,
      status: status ?? undefined,
    })
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ message: 'Terjadi kesalahan saat membaca data', error: e.message })
  }
}

// Tambahkan log saat memperbarui data
const updateDataHandler = async (req, res) => {
  const { id } = req.params
  const updatedData = req.body
  try {
    const result = await updateDataFad(id, updatedData)

    const logEntry = {
      action: 'UPDATE',
      id,
      timestamp: new Date().toISOString(),
      description: `Data FAD dengan ID ${id} berhasil diperbarui.`,
    }

    const logs = await readLogFile()
    logs.push(logEntry)
    await writeLogFile(logs)

    res.status(200).json({ result, logEntry })
    // res.status(200).json({ result })
  } catch (e) {
    console.error('Gagal memperbarui data:', e)
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui data', error: e.message })
  }
}

// Tambahkan log saat menghapus data
const deleteDataHandler = async (req, res) => {
  const { id } = req.params
  try {
    const result = await deleteDataFad(id)

    const logEntry = {
      action: 'DELETE',
      id,
      timestamp: new Date().toISOString(),
      description: `Data FAD dengan ID ${id} berhasil dihapus.`,
    }

    const logs = await readLogFile()
    logs.push(logEntry)
    await writeLogFile(logs)

    res.status(200).json({ result, logEntry })
  } catch (e) {
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus data', error: e.message })
  }
}

const saveControllerVendor = async (req, res) => {
  try {
    const formData = req.body
    const created = await saveDataVendor(formData)
    res.status(200).json({ message: 'created', data: created })
  } catch (e) {
    res.status(500).json({
      error: e.message || 'internal server error',
    })
  }
}

const getControllerVendor = async (req, res) => {
  try {
    const data = await readDataVendor()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ message: 'Terjadi kesalahan saat membaca data', error: e.message })
  }
}

const updateControllerVendor = async (req, res) => {
  const { id } = req.params
  const updatedData = req.body

  console.log('ID yang akan diperbarui:', id) // Debugging
  console.log('Data yang diterima untuk update:', updatedData) // Debugging

  try {
    const result = await updateDataVendor(id, updatedData)
    res.status(200).json(result)
  } catch (e) {
    console.error('Gagal memperbarui data vendor:', e)
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui data', error: e.message })
  }
}

const deleteControllerVendor = async (req, res) => {
  const { id } = req.params
  try {
    const result = await deleteDataVendor(id)
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus data', error: e.message })
  }
}

// Endpoint untuk mendapatkan log update
const getUpdateLogHandler = async (req, res) => {
  const logs = await readLogFile()
  res.status(200).json(logs)
}

// Endpoint untuk mendapatkan last update
const getLastUpdateHandler = async (req, res) => {
  try {
    const logs = await readLogFile()
    if (logs.length === 0) {
      return res.status(200).json({ message: 'Belum ada log update.', lastUpdate: null })
    }

    // Ambil log terakhir berdasarkan timestamp
    const lastUpdate = logs[logs.length - 1]
    res.status(200).json({ lastUpdate })
  } catch (error) {
    console.error('Gagal mendapatkan last update:', error)
    res
      .status(500)
      .json({ message: 'Terjadi kesalahan saat mendapatkan last update', error: error.message })
  }
}

export {
  saveDataHandler,
  getDataHandler,
  updateDataHandler,
  deleteDataHandler,
  saveControllerVendor,
  getControllerVendor,
  updateControllerVendor,
  deleteControllerVendor,
  getUpdateLogHandler,
  getLastUpdateHandler, // Tambahkan handler ini ke ekspor
}
