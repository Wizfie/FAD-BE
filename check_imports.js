import dataRoutes from './routes/dataRoutes.js'
import * as svc from './services/serviceFad.js'

console.log('dataRoutes ===', dataRoutes)
console.log('dataRoutes type ===', typeof dataRoutes)
console.log('service exports ===', Object.keys(svc))
console.log('shutdownPrisma type ===', typeof svc.shutdownPrisma)

if (svc.shutdownPrisma && typeof svc.shutdownPrisma === 'function') {
  console.log('shutdownPrisma callable')
}

process.exit(0)
