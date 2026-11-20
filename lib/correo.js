import { randomBytes } from 'node:crypto'
import { createConnection, isIP } from 'node:net'
import { connect as conectarTls } from 'node:tls'

/**
 * Cliente SMTP mínimo, sin dependencias (viene del de CUESTIONARIO, con parte HTML opcional).
 * Gmail necesita una contraseña de aplicación: no implementa XOAUTH2.
 */

export class ErrorCorreo extends Error {
  constructor(mensaje, configuracion = false) {
    super(mensaje)
    this.name = 'ErrorCorreo'
    this.configuracion = configuracion
  }
}

const TIEMPO_MAXIMO_MS = 60_000
const esDireccion = (v) => /^[\x21-\x7e]+$/.test(v) && /^[^<>()",;:@\\]+@[^<>()",;:@\\]+$/.test(v)
const variable = (entorno, nombre) => entorno[nombre]?.trim() || null

function leerConfiguracion(entorno) {
  const host = variable(entorno, 'SMTP_HOST')
  const remitente = variable(entorno, 'SMTP_REMITENTE')
  const usuario = variable(entorno, 'SMTP_USUARIO')
  const clave = entorno.SMTP_CLAVE || null
  const puerto = Number(variable(entorno, 'SMTP_PUERTO') ?? 587)
  if (!host) return 'Falta SMTP_HOST: no hay servidor de correo configurado.'
  if (!remitente) return 'Falta SMTP_REMITENTE: no hay dirección desde la cual enviar.'
  if (!esDireccion(remitente)) return 'SMTP_REMITENTE tiene que ser una dirección sola, como vos@gmail.com.'
  if (!!usuario !== !!clave) return 'SMTP_USUARIO y SMTP_CLAVE van juntos. Con Gmail, SMTP_CLAVE es una contraseña de aplicación.'
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return 'SMTP_PUERTO tiene que ser un número, como 465 o 587.'
  const tls = variable(entorno, 'SMTP_TLS') ?? (puerto === 465 ? 'directo' : 'starttls')
  if (!['directo', 'starttls'].includes(tls)) return 'SMTP_TLS acepta directo o starttls.'
  return { host, puerto, usuario, clave, remitente, tls }
}

export function faltaParaCorreo(entorno = process.env) {
  const leida = leerConfiguracion(entorno)
  return typeof leida === 'string' ? leida : null
}

function leerRespuesta(socket, esperado) {
  return new Promise((resolver, rechazar) => {
    let acumulado = ''
    const alDato = (trozo) => {
      acumulado += trozo.toString('utf8')
      if (!acumulado.endsWith('\n')) return
      const lineas = acumulado.split(/\r?\n/).filter(Boolean)
      const ultima = lineas.at(-1)
      if (!ultima || !/^\d{3}(?: |$)/.test(ultima)) return
      limpiar()
      const codigo = Number(ultima.slice(0, 3))
      if (esperado.includes(codigo)) return resolver(acumulado)
      const texto = lineas.map((l) => l.slice(4).trim()).join(' ')
      const credenciales = codigo === 535 ? ' Revisá SMTP_USUARIO y SMTP_CLAVE (contraseña de aplicación).' : ''
      rechazar(new ErrorCorreo(`El servidor de correo respondió «${codigo} ${texto}».${credenciales}`, codigo === 535))
    }
    const alError = (err) => { limpiar(); rechazar(new ErrorCorreo(`Se cortó la conexión con el servidor de correo: ${err.message}`)) }
    const alCerrar = () => { limpiar(); rechazar(new ErrorCorreo('El servidor de correo cortó la conexión sin responder.')) }
    const limpiar = () => { socket.off('data', alDato); socket.off('error', alError); socket.off('close', alCerrar) }
    socket.on('data', alDato)
    socket.on('error', alError)
    socket.on('close', alCerrar)
  })
}

async function decir(socket, linea, esperado) {
  const respuesta = leerRespuesta(socket, esperado)
  socket.write(linea + '\r\n')
  return respuesta
}

const base64EnLineas = (datos) => (datos.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n')

function asunto(valor) {
  const limpio = valor.replace(/[\x00-\x1f\x7f]+/g, ' ')
  if (/^[\x20-\x7e]*$/.test(limpio) && limpio.length < 68) return limpio
  const palabras = []
  let actual = ''
  for (const c of limpio) {
    if (Buffer.byteLength(actual + c) > 45) { palabras.push(actual); actual = '' }
    actual += c
  }
  palabras.push(actual)
  return palabras.map((p) => `=?UTF-8?B?${Buffer.from(p, 'utf8').toString('base64')}?=`).join('\r\n ')
}

const nombreAscii = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_')
const nombrePorcentual = (n) => encodeURIComponent(n).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

function parteTexto(tipo, texto) {
  return [`Content-Type: ${tipo}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', base64EnLineas(Buffer.from(texto, 'utf8'))]
}

export function armarMensaje(remitente, mensaje) {
  if (!esDireccion(mensaje.para)) throw new ErrorCorreo(`La dirección ${mensaje.para} no es válida (MAIL_AVISO).`, true)
  const dominio = remitente.slice(remitente.lastIndexOf('@') + 1)
  const cabeceras = [
    `From: "Formulario Oasis" <${remitente}>`,
    `To: ${mensaje.para}`,
    `Subject: ${asunto(mensaje.asunto)}`,
    `Date: ${new Date().toUTCString().replace(/GMT$/, '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${dominio}>`,
    'MIME-Version: 1.0',
  ]
  let cuerpo = parteTexto('text/plain', mensaje.cuerpo)
  if (mensaje.html) {
    const alt = `alt-${randomBytes(12).toString('hex')}`
    cuerpo = [`Content-Type: multipart/alternative; boundary="${alt}"`, '', `--${alt}`, ...cuerpo, `--${alt}`, ...parteTexto('text/html', mensaje.html), `--${alt}--`]
  }
  const adjuntos = mensaje.adjuntos ?? []
  if (!adjuntos.length) return [...cabeceras, ...cuerpo].join('\r\n')
  const sep = `mix-${randomBytes(16).toString('hex')}`
  const partes = adjuntos.flatMap((a) => {
    const contenido = typeof a.contenido === 'string' ? Buffer.from(a.contenido, 'utf8') : a.contenido
    const tipo = typeof a.contenido === 'string' && /^text\//.test(a.tipo) ? `${a.tipo}; charset=UTF-8` : a.tipo
    return [
      `--${sep}`,
      `Content-Type: ${tipo}; name="${nombreAscii(a.nombre)}"`,
      `Content-Disposition: attachment; filename="${nombreAscii(a.nombre)}";`,
      ` filename*=UTF-8''${nombrePorcentual(a.nombre)}`,
      'Content-Transfer-Encoding: base64',
      '',
      base64EnLineas(contenido),
    ]
  })
  return [...cabeceras, `Content-Type: multipart/mixed; boundary="${sep}"`, '', `--${sep}`, ...cuerpo, ...partes, `--${sep}--`].join('\r\n')
}

/** Manda un correo. Si vuelve sin error, el servidor lo aceptó. */
export async function enviarCorreo(mensaje, entorno = process.env) {
  const cfg = leerConfiguracion(entorno)
  if (typeof cfg === 'string') throw new ErrorCorreo(cfg, true)
  const datos = armarMensaje(cfg.remitente, mensaje)
  const servername = isIP(cfg.host) ? undefined : cfg.host
  const inicial = cfg.tls === 'directo'
    ? conectarTls({ host: cfg.host, port: cfg.puerto, servername })
    : createConnection({ host: cfg.host, port: cfg.puerto })
  inicial.on('error', () => undefined)
  let socket = inicial
  let temporizador
  const vencido = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ErrorCorreo(`El servidor ${cfg.host}:${cfg.puerto} no respondió a tiempo.`)), TIEMPO_MAXIMO_MS)
  })
  const conversar = async () => {
    await new Promise((resolver, rechazar) => {
      inicial.once(cfg.tls === 'directo' ? 'secureConnect' : 'connect', resolver)
      inicial.once('error', (err) => rechazar(new ErrorCorreo(`No se pudo conectar con ${cfg.host}:${cfg.puerto} (${err.message}).`)))
    })
    await leerRespuesta(socket, [220])
    await decir(socket, 'EHLO oasisform', [250])
    if (cfg.tls === 'starttls') {
      await decir(socket, 'STARTTLS', [220])
      socket = conectarTls({ socket: inicial, servername })
      socket.on('error', () => undefined)
      await new Promise((resolver, rechazar) => { socket.once('secureConnect', resolver); socket.once('error', rechazar) })
      await decir(socket, 'EHLO oasisform', [250])
    }
    if (cfg.usuario) {
      await decir(socket, 'AUTH LOGIN', [334])
      await decir(socket, Buffer.from(cfg.usuario).toString('base64'), [334])
      await decir(socket, Buffer.from(cfg.clave).toString('base64'), [235])
    }
    await decir(socket, `MAIL FROM:<${cfg.remitente}>`, [250])
    await decir(socket, `RCPT TO:<${mensaje.para}>`, [250, 251])
    await decir(socket, 'DATA', [354])
    const aceptado = leerRespuesta(socket, [250])
    socket.write(`${datos}\r\n.\r\n`)
    await aceptado
  }
  try {
    await Promise.race([conversar(), vencido])
    await Promise.race([decir(socket, 'QUIT', [221]), vencido]).catch(() => undefined)
  } finally {
    clearTimeout(temporizador)
    inicial.destroy()
    socket.destroy()
  }
}
