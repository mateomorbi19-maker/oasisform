import { createServer } from 'node:http'
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { setTimeout as esperar } from 'node:timers/promises'
import { POR_ID } from '../public/preguntas.js'
import { LIMITES, contarRespuestas, errorDeValor } from '../public/respuestas.js'
import { ErrorCorreo, enviarCorreo, faltaParaCorreo } from './correo.js'
import { armarHtml, armarMarkdown, armarTexto, megas, repartir } from './mail.js'

/**
 * El servidor del formulario: guarda las respuestas en un JSON (es un solo negocio y un solo
 * formulario), recibe archivos y, al enviar, manda todo por mail a MAIL_AVISO.
 */

const DIR_PUBLICO = fileURLToPath(new URL('../public/', import.meta.url))
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
const SEGURIDAD = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
}

export class ErrorUsuario extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje)
    this.estado = estado
  }
}

const estadoNuevo = () => ({ respuestas: {}, archivos: [], envios: [], modificado: new Date().toISOString() })

// En Windows, OneDrive o el antivirus pueden tener el archivo abierto justo al reemplazarlo.
async function renombrar(desde, hacia) {
  for (let intento = 1; ; intento++) {
    try {
      return await rename(desde, hacia)
    } catch (err) {
      if (intento >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err
      await esperar(50 * intento)
    }
  }
}

export async function crearApp({ dirDatos, codigoAcceso = '', entorno = process.env, enviar = enviarCorreo, registro = console }) {
  const rutaEstado = join(dirDatos, 'respuestas.json')
  const dirArchivos = join(dirDatos, 'archivos')
  await mkdir(dirArchivos, { recursive: true })
  let estado
  try {
    estado = { ...estadoNuevo(), ...JSON.parse(await readFile(rutaEstado, 'utf8')) }
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`No se pudo leer ${rutaEstado}: ${err.message}. Si está roto, renombralo y la app arranca vacía.`)
    estado = estadoNuevo()
  }

  let cola = Promise.resolve()
  function guardar() {
    estado.modificado = new Date().toISOString()
    const escritura = cola.then(async () => {
      await writeFile(`${rutaEstado}.tmp`, JSON.stringify(estado, null, 2))
      await renombrar(`${rutaEstado}.tmp`, rutaEstado)
    })
    cola = escritura.catch(() => undefined)
    return escritura
  }

  // ——— Aviso por mail
  const enCurso = new Set()

  function prepararMails(envio) {
    const fecha = new Date(envio.fecha)
    const markdown = armarMarkdown(estado, { fecha, numero: envio.numero })
    const archivos = estado.archivos.map((a) => ({ ...a, nombre: `${POR_ID.get(a.seccion)?.numero ?? ''} - ${a.nombre}` }))
    const tandas = repartir(archivos)
    const md = { nombre: 'oasis-respuestas.md', tipo: 'text/markdown', bytes: Buffer.byteLength(markdown), contenido: markdown }
    return tandas.map((tanda, i) =>
      i === 0
        ? {
            asunto: `Oasis LP: respuestas del formulario (${envio.respondidas} de ${envio.total})${envio.numero > 1 ? `, envío ${envio.numero}` : ''}`,
            cuerpo: armarTexto(estado, { fecha, numero: envio.numero }),
            html: armarHtml(estado, { fecha, numero: envio.numero, adjuntos: [md, ...tanda] }),
            adjuntos: [md, ...tanda],
          }
        : {
            asunto: `Oasis LP: archivos del formulario (${i + 1} de ${tandas.length})`,
            cuerpo: `Siguen los archivos del envío ${envio.numero} que no entraron en el primer mail:\n\n${tanda.map((a) => `- ${a.nombre} (${megas(a.bytes)})`).join('\n')}\n`,
            adjuntos: tanda,
          },
    )
  }

  async function avisar(numero) {
    const envio = estado.envios.find((e) => e.numero === numero)
    if (!envio || envio.aviso.estado !== 'pendiente') return
    const destino = entorno.MAIL_AVISO?.trim()
    const falta = destino ? faltaParaCorreo(entorno) : 'Falta MAIL_AVISO: no hay a quién mandarle las respuestas.'
    const mails = prepararMails(envio)

    if (falta) {
      if (entorno.NODE_ENV === 'production') {
        envio.aviso = { ...envio.aviso, estado: 'error', error: falta }
        registro.error(`[aviso ${numero}] ${falta}`)
        return guardar()
      }
      // En local, sin SMTP, el mail queda como archivo para verlo en el navegador.
      const dir = join(dirDatos, 'correos')
      await mkdir(dir, { recursive: true })
      const base = join(dir, `envio-${numero}`)
      await writeFile(`${base}.html`, mails[0].html)
      await writeFile(`${base}.md`, mails[0].adjuntos[0].contenido)
      envio.aviso = { ...envio.aviso, estado: 'prueba', archivo: `${base}.html` }
      registro.log(`[aviso ${numero}] ${falta} Modo prueba: el mail quedó en ${base}.html`)
      return guardar()
    }

    try {
      for (let i = envio.aviso.partes ?? 0; i < mails.length; i++) {
        const adjuntos = []
        for (const a of mails[i].adjuntos) {
          const contenido = a.contenido ?? (await readFile(join(dirArchivos, a.id)).catch(() => null))
          if (contenido) adjuntos.push({ nombre: a.nombre, tipo: a.tipo, contenido })
        }
        await enviar({ para: destino, asunto: mails[i].asunto, cuerpo: mails[i].cuerpo, html: mails[i].html, adjuntos }, entorno)
        envio.aviso.partes = i + 1
        await guardar()
      }
      envio.aviso = { ...envio.aviso, estado: 'enviado', error: null, enviadoEn: new Date().toISOString() }
      registro.log(`[aviso ${numero}] Mail enviado a MAIL_AVISO.`)
    } catch (err) {
      const intentos = (envio.aviso.intentos ?? 0) + 1
      const reintenta = !(err instanceof ErrorCorreo && err.configuracion) && intentos < 5
      envio.aviso = { ...envio.aviso, estado: reintenta ? 'pendiente' : 'error', intentos, error: err.message }
      registro.error(`[aviso ${numero}] No se pudo mandar (intento ${intentos}): ${err.message}`)
      if (reintenta) setTimeout(() => lanzarAviso(numero), 10 * 60_000).unref()
    }
    return guardar()
  }

  function lanzarAviso(numero) {
    const promesa = avisar(numero)
      .catch((err) => registro.error(`[aviso ${numero}]`, err))
      .finally(() => enCurso.delete(promesa))
    enCurso.add(promesa)
    return promesa
  }

  for (const envio of estado.envios) if (envio.aviso?.estado === 'pendiente') setTimeout(() => lanzarAviso(envio.numero), 5000).unref()

  // ——— HTTP
  const huella = (t) => createHash('sha256').update(String(t)).digest()
  const accesoValido = (req) => !codigoAcceso || timingSafeEqual(huella(req.headers['x-codigo'] ?? ''), huella(codigoAcceso))
  const enviosRecientes = []

  function json(res, estadoHttp, datos) {
    res.writeHead(estadoHttp, { ...SEGURIDAD, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(datos))
  }

  async function leerJson(req, tope = 512 * 1024) {
    const trozos = []
    let total = 0
    for await (const trozo of req) {
      total += trozo.length
      if (total > tope) throw new ErrorUsuario('El pedido es demasiado grande.', 413)
      trozos.push(trozo)
    }
    try {
      return JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}')
    } catch {
      throw new ErrorUsuario('El cuerpo del pedido no es JSON válido.')
    }
  }

  const vistaEstado = () => ({
    respuestas: estado.respuestas,
    archivos: estado.archivos,
    envios: estado.envios.map(({ numero, fecha }) => ({ numero, fecha })),
    modificado: estado.modificado,
  })

  async function api(req, res, url) {
    const ruta = url.pathname
    if (ruta === '/api/salud' && req.method === 'GET') {
      const ultimo = estado.envios.at(-1)
      const falta = entorno.MAIL_AVISO?.trim() ? faltaParaCorreo(entorno) : 'Falta MAIL_AVISO.'
      return json(res, 200, {
        ok: true,
        correo: { listo: !falta, falta },
        acceso: codigoAcceso ? 'con código' : 'abierto',
        ultimoEnvio: ultimo ? { numero: ultimo.numero, fecha: ultimo.fecha, aviso: ultimo.aviso.estado, error: ultimo.aviso.error ?? null } : null,
      })
    }
    if (!accesoValido(req)) throw new ErrorUsuario('Para entrar hace falta el link completo que les mandamos.', 401)

    if (ruta === '/api/estado' && req.method === 'GET') return json(res, 200, vistaEstado())

    if (ruta === '/api/respuestas' && req.method === 'PATCH') {
      const { cambios } = await leerJson(req)
      if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) throw new ErrorUsuario('Falta «cambios»: el id de cada pregunta con su respuesta.')
      for (const [id, valor] of Object.entries(cambios)) {
        if (id === 'quien') {
          if (valor !== null && (typeof valor !== 'string' || valor.length > LIMITES.caracteresQuien)) throw new ErrorUsuario(`El nombre va con hasta ${LIMITES.caracteresQuien} caracteres.`)
          continue
        }
        const pregunta = POR_ID.get(id)
        if (!pregunta) throw new ErrorUsuario(`No existe la pregunta «${id}». Recarguen la página.`)
        const error = errorDeValor(pregunta, valor)
        if (error) throw new ErrorUsuario(error)
      }
      for (const [id, valor] of Object.entries(cambios)) {
        if (valor === null) delete estado.respuestas[id]
        else estado.respuestas[id] = valor
      }
      await guardar()
      return json(res, 200, { modificado: estado.modificado })
    }

    if (ruta === '/api/archivos' && req.method === 'POST') {
      const seccion = url.searchParams.get('seccion') ?? ''
      if (POR_ID.get(seccion)?.tipo !== 'documento') throw new ErrorUsuario('Falta la sección del archivo (d1 a d7, c1 o c2).')
      let nombre = ''
      try {
        nombre = decodeURIComponent(req.headers['x-nombre'] ?? '')
      } catch {}
      nombre = nombre.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim().slice(0, 120)
      if (!nombre) throw new ErrorUsuario('Falta el nombre del archivo.')
      let tipo = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
      if (!/^[\w.+-]+\/[\w.+-]+$/.test(tipo)) tipo = 'application/octet-stream'
      if (estado.archivos.length >= LIMITES.archivosEnTotal) throw new ErrorUsuario(`Ya hay ${LIMITES.archivosEnTotal} archivos, que es el tope. Borren alguno o manden el resto por WhatsApp.`, 409)
      const usados = estado.archivos.reduce((s, a) => s + a.bytes, 0)
      const declarado = Number(req.headers['content-length']) || 0
      if (declarado > LIMITES.bytesPorArchivo) throw new ErrorUsuario(`«${nombre}» pesa ${megas(declarado)} y el tope es ${megas(LIMITES.bytesPorArchivo)}. Si es un video, mándenlo por WhatsApp.`, 413)
      if (usados + declarado > LIMITES.bytesEnTotal) throw new ErrorUsuario('Ya se llegó al tope de archivos subidos. Manden el resto por WhatsApp.', 409)

      const id = randomUUID()
      const destino = join(dirArchivos, id)
      const archivo = await open(destino, 'wx')
      let bytes = 0
      try {
        for await (const trozo of req) {
          bytes += trozo.length
          if (bytes > LIMITES.bytesPorArchivo) throw new ErrorUsuario(`«${nombre}» supera el tope de ${megas(LIMITES.bytesPorArchivo)}.`, 413)
          await archivo.write(trozo)
        }
      } catch (err) {
        await archivo.close()
        await rm(destino, { force: true })
        throw err
      }
      await archivo.close()
      if (!bytes) {
        await rm(destino, { force: true })
        throw new ErrorUsuario(`«${nombre}» está vacío.`)
      }
      const meta = { id, seccion, nombre, tipo, bytes, subido: new Date().toISOString() }
      estado.archivos.push(meta)
      await guardar()
      return json(res, 201, meta)
    }

    const borrar = ruta.match(/^\/api\/archivos\/([\w-]+)$/)
    if (borrar && req.method === 'DELETE') {
      const indice = estado.archivos.findIndex((a) => a.id === borrar[1])
      if (indice < 0) throw new ErrorUsuario('Ese archivo ya no está.', 404)
      estado.archivos.splice(indice, 1)
      await guardar()
      await rm(join(dirArchivos, borrar[1]), { force: true })
      return json(res, 200, { ok: true })
    }

    if (ruta === '/api/enviar' && req.method === 'POST') {
      const ahora = Date.now()
      while (enviosRecientes.length && ahora - enviosRecientes[0] > 10 * 60_000) enviosRecientes.shift()
      if (enviosRecientes.length >= 5) throw new ErrorUsuario('Ya se envió varias veces seguidas. Esperen unos minutos y prueben de nuevo.', 429)
      enviosRecientes.push(ahora)
      const { respondidas, total } = contarRespuestas(estado.respuestas, estado.archivos)
      const envio = { numero: estado.envios.length + 1, fecha: new Date().toISOString(), respondidas, total, aviso: { estado: 'pendiente', intentos: 0 } }
      estado.envios.push(envio)
      await guardar()
      lanzarAviso(envio.numero)
      return json(res, 200, { numero: envio.numero, fecha: envio.fecha })
    }

    if (ruta === '/api/exportar' && req.method === 'GET') {
      res.writeHead(200, {
        ...SEGURIDAD,
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': 'attachment; filename="oasis-respuestas.md"',
      })
      return res.end(armarMarkdown(estado))
    }

    throw new ErrorUsuario('No existe esa ruta.', 404)
  }

  async function estatico(req, res, url) {
    let relativa
    try {
      relativa = decodeURIComponent(url.pathname)
    } catch {
      throw new ErrorUsuario('Dirección inválida.')
    }
    if (relativa === '/') relativa = '/index.html'
    const absoluta = resolve(DIR_PUBLICO, `.${relativa}`)
    if (!absoluta.startsWith(DIR_PUBLICO.endsWith(sep) ? DIR_PUBLICO : DIR_PUBLICO + sep)) throw new ErrorUsuario('No existe.', 404)
    try {
      const datos = await readFile(absoluta)
      res.writeHead(200, { ...SEGURIDAD, 'content-type': TIPOS[extname(absoluta)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
      res.end(req.method === 'HEAD' ? undefined : datos)
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') throw new ErrorUsuario('No existe.', 404)
      throw err
    }
  }

  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/api/')) await api(req, res, url)
      else if (req.method === 'GET' || req.method === 'HEAD') await estatico(req, res, url)
      else throw new ErrorUsuario('Método no permitido.', 405)
    } catch (err) {
      if (!(err instanceof ErrorUsuario)) registro.error(err)
      if (res.headersSent) return res.destroy()
      json(res, err.estado ?? 500, {
        error: err instanceof ErrorUsuario ? err.message : 'Hubo un error en el servidor. Prueben de nuevo en un momento; lo que ya escribieron está guardado.',
      })
    }
  })

  return { servidor, esperarAvisos: () => Promise.allSettled([...enCurso]), esperarEscrituras: () => cola }
}
