import { resolve } from 'node:path'
import { crearApp } from './lib/app.js'

const puerto = Number(process.env.PORT) || 3000
const dirDatos = resolve(process.env.DIR_DATOS?.trim() || 'data')
const codigoAcceso = process.env.CODIGO_ACCESO?.trim() || ''

if (!codigoAcceso && process.env.NODE_ENV === 'production') {
  console.warn('[aviso] Sin CODIGO_ACCESO: cualquiera con la dirección puede ver y editar el formulario.')
}

const { servidor } = await crearApp({ dirDatos, codigoAcceso })
servidor.listen(puerto, () => {
  console.log(`Formulario Oasis en http://localhost:${puerto}${codigoAcceso ? `/?c=${codigoAcceso}` : ''}`)
  console.log(`Datos en ${dirDatos}`)
})

process.on('SIGTERM', () => servidor.close(() => process.exit(0)))
