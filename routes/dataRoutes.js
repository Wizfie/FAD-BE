import express from 'express'
import {
  saveDataHandler,
  getDataHandler,
  updateDataHandler,
  deleteDataHandler,
  saveControllerVendor,
  updateControllerVendor,
  getControllerVendor,
  deleteControllerVendor,
  getLastUpdateHandler,
} from '../controllers/dataController.js'

const router = express.Router()

// Rute untuk menyimpan data
router.post('/v1/save-fad', saveDataHandler)

// Rute untuk mengambil data
router.get('/v1/get-fad', getDataHandler)

// Rute untuk memperbarui data berdasarkan ID
router.put('/v1/update-fad/:id', updateDataHandler)

// Rute untuk menghapus data berdasarkan ID
router.delete('/v1/delete-fad/:id', deleteDataHandler)

// Router Vendor
router.post('/v1/save-vendor', saveControllerVendor)

router.put('/v1/update-vendor/:id', updateControllerVendor)

router.get('/v1/get-vendor', getControllerVendor)

router.delete('/v1/delete-vendor/:id', deleteControllerVendor)

router.get('/v1/get-log-update', getLastUpdateHandler)

export default router
