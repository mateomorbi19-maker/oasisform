import { SECCIONES } from '../public/preguntas.js'
import { contarRespuestas, estaRespondida, partesDeValor } from '../public/respuestas.js'

/** Arma el mail con todas las respuestas: texto, HTML y un Markdown adjunto para el prompt del agente. */

const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
export const formatearFecha = (fecha) => fechaLarga.format(new Date(fecha))
export const megas = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`)
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function recorrer(estado) {
  return SECCIONES.map((seccion, i) => ({
    numero: i + 1,
    seccion,
    items: seccion.preguntas.map((pregunta) => {
      const valor = estado.respuestas[pregunta.id]
      const archivos = estado.archivos.filter((a) => a.seccion === pregunta.id)
      return { pregunta, partes: partesDeValor(pregunta, valor), archivos, respondida: estaRespondida(pregunta, valor, archivos.length) }
    }),
  }))
}

const quienDe = (estado) => (typeof estado.respuestas.quien === 'string' && estado.respuestas.quien.trim()) || 'no lo dijeron'

export function armarMarkdown(estado, { fecha = new Date(), numero = null } = {}) {
  const { respondidas, total } = contarRespuestas(estado.respuestas, estado.archivos)
  const l = [
    '# Piscinas Oasis LP: formulario de iniciación del agente de WhatsApp',
    '',
    `- Completó: ${quienDe(estado)}`,
    `- ${numero ? `Envío ${numero}` : 'Copia'}: ${formatearFecha(fecha)}`,
    `- Respondidas: ${respondidas} de ${total}`,
    '',
  ]
  for (const { numero: n, seccion, items } of recorrer(estado)) {
    l.push(`## ${n}. ${seccion.titulo}`, '')
    for (const { pregunta, partes, archivos } of items) {
      l.push(`### ${pregunta.numero}. ${pregunta.texto}`, '')
      if (pregunta.conocido) l.push(`Lo que teníamos: ${pregunta.conocido}`, '')
      if (!partes.length) l.push('_Sin responder_', '')
      else if (pregunta.tipo === 'varias' && partes[0] !== 'No aplica') l.push(...partes.map((p) => `- ${p}`), '')
      else l.push(`${pregunta.etiqueta ? `**${pregunta.etiqueta}:** ` : ''}${partes[0]}`, '')
      if (archivos.length) l.push(`Archivos: ${archivos.map((a) => a.nombre).join(', ')}`, '')
    }
  }
  return l.join('\n')
}

export function armarTexto(estado, { fecha, numero }) {
  const { respondidas, total } = contarRespuestas(estado.respuestas, estado.archivos)
  const l = [`Formulario de Piscinas Oasis LP (envío ${numero})`, `${respondidas} de ${total} respondidas · Completó: ${quienDe(estado)} · ${formatearFecha(fecha)}`, '']
  for (const { numero: n, seccion, items } of recorrer(estado)) {
    l.push(`${n}. ${seccion.titulo.toUpperCase()}`, '')
    for (const { pregunta, partes, archivos } of items) {
      l.push(`${pregunta.numero}. ${pregunta.texto}`)
      if (pregunta.conocido) l.push(`   Lo que teníamos: ${pregunta.conocido}`)
      l.push(`   ${partes.length ? partes.join(' · ').replace(/\n/g, '\n   ') : '(sin responder)'}`)
      if (archivos.length) l.push(`   Archivos: ${archivos.map((a) => a.nombre).join(', ')}`)
      l.push('')
    }
  }
  return l.join('\n')
}

export function armarHtml(estado, { fecha, numero, adjuntos }) {
  const { respondidas, total, porSeccion } = contarRespuestas(estado.respuestas, estado.archivos)
  const secciones = recorrer(estado).map(({ numero: n, seccion, items }) => {
    const preguntas = items.map(({ pregunta, partes, archivos }) => {
      const respuesta = partes.length
        ? pregunta.tipo === 'varias' && partes[0] !== 'No aplica'
          ? `<ul style="margin:4px 0 0;padding-left:20px;">${partes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
          : `<div style="margin-top:4px;">${esc(partes[0]).replace(/\r?\n/g, '<br>')}</div>`
        : '<div style="margin-top:4px;color:#8aa0a4;font-style:italic;">Sin responder</div>'
      return `<div style="margin:0 0 16px;">
<div style="font-weight:bold;">${esc(pregunta.numero)}. ${esc(pregunta.texto)}</div>
${pregunta.conocido ? `<div style="color:#56737a;font-size:13px;">Lo que teníamos: ${esc(pregunta.conocido)}</div>` : ''}
${pregunta.etiqueta && partes.length ? `<div style="color:#56737a;font-size:13px;">${esc(pregunta.etiqueta)}:</div>` : ''}
${respuesta}
${archivos.length ? `<div style="color:#56737a;font-size:13px;margin-top:4px;">Archivos adjuntos: ${archivos.map((a) => esc(a.nombre)).join(', ')}</div>` : ''}
</div>`
    })
    return `<h2 style="font-size:18px;color:#0a4a50;border-bottom:2px solid #d4f0f2;padding-bottom:6px;margin:28px 0 14px;">${n}. ${esc(seccion.titulo)} <span style="font-weight:normal;font-size:14px;color:#56737a;">${porSeccion[seccion.id]} de ${seccion.preguntas.length}</span></h2>${preguntas.join('')}`
  })
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5fafa;"><div style="max-width:680px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#10292c;font-size:15px;line-height:1.5;">
<div style="background:#0a4a50;color:#fff;border-radius:12px;padding:20px 24px;">
<div style="font-size:14px;color:#a7e1e5;">Piscinas Oasis LP · Formulario del agente de WhatsApp · envío ${numero}</div>
<div style="font-size:24px;font-weight:bold;margin-top:4px;">${respondidas} de ${total} respondidas</div>
<div style="font-size:14px;color:#d4f0f2;margin-top:6px;">Completó: ${esc(quienDe(estado))} · ${esc(formatearFecha(fecha))}</div>
</div>
<p>Adjuntos: ${adjuntos.map((a) => `${esc(a.nombre)} (${megas(a.bytes)})`).join(', ')}. El .md tiene todas las respuestas, listo para armar el prompt del agente.</p>
${secciones.join('\n')}
</div></body></html>`
}

/** Reparte los archivos en tandas que entren en un mail (el tope del SMTP es de 20 MB codificados). */
export function repartir(archivos, tope = 13 * 1048576) {
  const tandas = [[]]
  let peso = 0
  for (const a of archivos) {
    if (tandas.at(-1).length && peso + a.bytes > tope) { tandas.push([]); peso = 0 }
    tandas.at(-1).push(a)
    peso += a.bytes
  }
  return tandas
}
