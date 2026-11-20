import { ITEMS, POR_ID, SECCIONES, SECCION_DE } from './preguntas.js'
import { LIMITES, NO_APLICA, OTRA, contarRespuestas, esNoAplica, estaRespondida } from './respuestas.js'

// ——— Utilidades de DOM

function h(etiqueta, props = {}, ...hijos) {
  const el = document.createElement(etiqueta)
  for (const [clave, valor] of Object.entries(props ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue
    if (clave === 'class') el.className = valor
    else if (clave === 'value') el.value = valor
    else if (clave === 'checked' || clave === 'disabled' || clave === 'hidden') el[clave] = Boolean(valor)
    else if (clave.startsWith('on') && typeof valor === 'function') el.addEventListener(clave.slice(2), valor)
    else el.setAttribute(clave, valor === true ? '' : valor)
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue
    el.append(hijo instanceof Node ? hijo : String(hijo))
  }
  return el
}

const TRAZOS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  izq: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  der: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  archivo: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  enviar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  guardado: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  noAplica: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  microfono: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  lista: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
}

function icono(nombre) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'icono')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = TRAZOS[nombre]
  return svg
}

let temporizadorToast
function toast(texto) {
  const el = document.querySelector('.toast')
  el.textContent = texto
  el.hidden = false
  clearTimeout(temporizadorToast)
  temporizadorToast = setTimeout(() => (el.hidden = true), 2600)
}

const megas = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`)
const fecha = (iso) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// ——— Red y autoguardado

const CLAVE_CODIGO = 'oasis.codigo'
const CLAVE_PENDIENTES = 'oasis.pendientes'
const local = {
  leer: (clave) => { try { return localStorage.getItem(clave) } catch { return null } },
  guardar: (clave, valor) => { try { valor === null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor) } catch {} },
}

const codigo = new URLSearchParams(location.search).get('c') || local.leer(CLAVE_CODIGO) || ''
if (codigo) local.guardar(CLAVE_CODIGO, codigo)
const linkParaSeguir = () => `${location.origin}${location.pathname}${codigo ? `?c=${encodeURIComponent(codigo)}` : ''}`

class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.estado = estado
  }
}

async function api(ruta, opciones = {}) {
  let respuesta
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: { 'x-codigo': codigo, ...(typeof opciones.body === 'string' ? { 'content-type': 'application/json' } : {}), ...opciones.headers },
    })
  } catch {
    throw new ErrorApi('Sin conexión con el servidor. Revisen internet y prueben de nuevo.', 0)
  }
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new ErrorApi(datos?.error ?? `El servidor respondió ${respuesta.status}.`, respuesta.status)
  return datos
}

const pendientes = new Map()
let guardando = null
let temporizadorGuardado
let reintentos = 0
let estadoGuardado = { tipo: 'ok', texto: 'Todo guardado' }

function respaldar() {
  local.guardar(CLAVE_PENDIENTES, pendientes.size ? JSON.stringify(Object.fromEntries(pendientes)) : null)
}

function mostrarGuardado(tipo, texto) {
  estadoGuardado = { tipo, texto }
  for (const el of document.querySelectorAll('[data-guardado]')) {
    el.dataset.tipo = tipo
    el.textContent = texto
  }
}

function programarGuardado(id, valor) {
  pendientes.set(id, valor)
  respaldar()
  mostrarGuardado('pendiente', 'Guardando…')
  clearTimeout(temporizadorGuardado)
  temporizadorGuardado = setTimeout(vaciar, 700)
}

async function vaciar() {
  clearTimeout(temporizadorGuardado)
  if (guardando) {
    await guardando
    return pendientes.size ? vaciar() : undefined
  }
  if (!pendientes.size) return
  const lote = Object.fromEntries(pendientes)
  guardando = api('/api/respuestas', { method: 'PATCH', body: JSON.stringify({ cambios: lote }) })
    .then(() => {
      for (const [id, valor] of Object.entries(lote)) if (pendientes.get(id) === valor) pendientes.delete(id)
      respaldar()
      reintentos = 0
      if (pendientes.size) temporizadorGuardado = setTimeout(vaciar, 300)
      else mostrarGuardado('ok', 'Todo guardado')
    })
    .catch((err) => {
      if (err.estado === 401) return location.reload()
      if (err.estado === 400 || err.estado === 413) return mostrarGuardado('error', `No se pudo guardar: ${err.message}`)
      reintentos++
      mostrarGuardado('error', navigator.onLine ? 'No se pudo guardar. Reintentando…' : 'Sin conexión. Se guarda cuando vuelva.')
      temporizadorGuardado = setTimeout(vaciar, Math.min(30000, 1000 * 2 ** reintentos))
    })
    .finally(() => (guardando = null))
  return guardando
}

window.addEventListener('online', vaciar)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pendientes.size) {
    fetch('/api/respuestas', {
      method: 'PATCH',
      keepalive: true,
      headers: { 'x-codigo': codigo, 'content-type': 'application/json' },
      body: JSON.stringify({ cambios: Object.fromEntries(pendientes) }),
    }).catch(() => undefined)
  }
})

// ——— Estado

const estado = { respuestas: {}, archivos: [], envios: [], subiendo: [] }
const corrigiendo = new Set()
const memoria = new Map() // lo último que escribieron antes de marcar «no aplica»
let confirmandoEnvio = false

const archivosDe = (id) => estado.archivos.filter((a) => a.seccion === id)
const respondida = (id) => estaRespondida(POR_ID.get(id), estado.respuestas[id], archivosDe(id).length)
const contar = () => contarRespuestas(estado.respuestas, estado.archivos)

function cambiar(id, valor) {
  if (valor === null) delete estado.respuestas[id]
  else estado.respuestas[id] = valor
  programarGuardado(id, valor)
  if (POR_ID.has(id)) refrescarProgreso(id)
}

function claseTesela(id) {
  return `tesela${respondida(id) ? ' llena' : ''}${esNoAplica(estado.respuestas[id]) ? ' na' : ''}`
}

function refrescarProgreso(id) {
  for (const el of document.querySelectorAll(`[data-tesela="${id}"]`)) el.className = claseTesela(id)
  const bloque = document.querySelector(`[data-pregunta="${id}"]`)
  if (bloque) bloque.toggleAttribute('data-respondida', respondida(id))
  const conteo = contar()
  for (const el of document.querySelectorAll('[data-cuenta-total]')) el.textContent = conteo.respondidas
  for (const seccion of SECCIONES) {
    for (const el of document.querySelectorAll(`[data-cuenta-seccion="${seccion.id}"]`)) el.textContent = conteo.porSeccion[seccion.id]
  }
}

// ——— Rutas

function rutaActual() {
  const [tipo, numero, pregunta] = location.hash.replace(/^#\/?/, '').split('/')
  if (tipo === 'seccion' && SECCIONES[Number(numero) - 1]) return { pantalla: 'seccion', indice: Number(numero) - 1, pregunta }
  if (tipo === 'revision') return { pantalla: 'revision' }
  if (tipo === 'listo') return { pantalla: 'listo' }
  return { pantalla: 'inicio' }
}

const app = document.getElementById('app')

function dibujar() {
  const ruta = rutaActual()
  confirmandoEnvio = false
  if (ruta.pantalla === 'inicio') app.replaceChildren(pantallaInicio())
  else if (ruta.pantalla === 'listo') app.replaceChildren(pantallaListo())
  else app.replaceChildren(marco(ruta))
  mostrarGuardado(estadoGuardado.tipo, estadoGuardado.texto)
  for (const area of document.querySelectorAll('textarea')) autoAlto(area)

  const destino = ruta.pregunta && document.getElementById(`pregunta-${ruta.pregunta}`)
  if (destino) {
    destino.scrollIntoView({ block: 'start' })
    destino.querySelector('textarea, input')?.focus({ preventScroll: true })
  } else {
    window.scrollTo(0, 0)
    document.getElementById('titulo-pantalla')?.focus({ preventScroll: true })
  }
}

// ——— Piezas comunes

const logo = (tamano) => h('span', { class: `baldosa-logo ${tamano}` }, h('img', { src: 'logo-oasis.jpg', alt: 'Piscinas Oasis LP', width: 150, height: 150 }))

function pileta() {
  const { respondidas, total } = contar()
  return h(
    'div',
    { class: 'pileta', role: 'img', 'aria-label': `${respondidas} de ${total} respondidas` },
    h('div', { class: 'pileta-agua' }, ITEMS.map((p) => h('span', { class: claseTesela(p.id), 'data-tesela': p.id })), h('span', { class: 'escalera' })),
  )
}

function primeraSeccionPendiente() {
  const indice = SECCIONES.findIndex((s) => s.preguntas.some((p) => !respondida(p.id)))
  return indice < 0 ? 0 : indice
}

function irATesela(evento) {
  const id = evento.target.closest('[data-tesela]')?.dataset.tesela
  if (!id) return
  evento.preventDefault()
  location.hash = `#/seccion/${SECCION_DE.get(id) + 1}/${id}`
}

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(linkParaSeguir())
    toast('Link copiado. Ábranlo en otro dispositivo para seguir.')
  } catch {
    prompt('Copien este link para seguir en otro dispositivo:', linkParaSeguir())
  }
}

function riel(ruta) {
  const conteo = contar()
  return h(
    'aside',
    { class: 'riel', id: 'riel', 'aria-label': 'Secciones del formulario' },
    h(
      'div',
      { class: 'riel-marca' },
      h('a', { href: '#/', class: 'riel-logo', 'aria-label': 'Volver al inicio' }, logo('chico')),
      h('div', { class: 'riel-nombre' }, h('strong', {}, 'Piscinas Oasis LP'), h('span', {}, 'Formulario del agente de WhatsApp')),
      h('button', { type: 'button', class: 'riel-cerrar', 'aria-label': 'Cerrar', onclick: cerrarMenu }, icono('cerrar')),
    ),
    h('p', { class: 'riel-cuenta' }, h('strong', { 'data-cuenta-total': '' }, conteo.respondidas), ` de ${conteo.total} respondidas`),
    h(
      'nav',
      { 'aria-label': 'Secciones' },
      h(
        'ol',
        { class: 'riel-lista' },
        SECCIONES.map((s, i) =>
          h(
            'li',
            {},
            h(
              'a',
              { href: `#/seccion/${i + 1}`, class: 'riel-item', 'aria-current': ruta.indice === i ? 'page' : null, onclick: irATesela },
              h('span', { class: 'riel-num' }, i + 1),
              h('span', { class: 'riel-titulo' }, s.titulo),
              h('span', { class: 'riel-conteo' }, h('span', { 'data-cuenta-seccion': s.id }, conteo.porSeccion[s.id]), `/${s.preguntas.length}`),
              h('span', { class: 'teselas', 'aria-hidden': 'true' }, s.preguntas.map((p) => h('span', { class: claseTesela(p.id), 'data-tesela': p.id }))),
            ),
          ),
        ),
        h('li', {}, h('a', { href: '#/revision', class: 'riel-item riel-revision', 'aria-current': ruta.pantalla === 'revision' ? 'page' : null }, icono('enviar'), 'Revisar y enviar')),
      ),
    ),
    h(
      'div',
      { class: 'riel-pie' },
      h('p', { class: 'guardado', 'data-guardado': '' }),
      h('button', { type: 'button', class: 'riel-link', onclick: copiarLink }, icono('enlace'), 'Copiar link para seguir en otro dispositivo'),
    ),
  )
}

function abrirMenu() {
  document.querySelector('.marco')?.setAttribute('data-menu', 'abierto')
  document.querySelector('.riel-cerrar')?.focus()
}
function cerrarMenu() {
  document.querySelector('.marco')?.setAttribute('data-menu', 'cerrado')
}
document.addEventListener('keydown', (e) => e.key === 'Escape' && cerrarMenu())

function marco(ruta) {
  const conteo = contar()
  const esSeccion = ruta.pantalla === 'seccion'
  return h(
    'div',
    { class: 'marco', 'data-menu': 'cerrado' },
    riel(ruta),
    h('div', { class: 'velo', onclick: cerrarMenu }),
    h(
      'div',
      { class: 'contenido' },
      h(
        'header',
        { class: 'barra' },
        h('button', { type: 'button', class: 'barra-menu', 'aria-label': 'Ver secciones', 'aria-controls': 'riel', onclick: abrirMenu }, icono('menu')),
        logo('mini'),
        h('span', { class: 'barra-titulo' }, esSeccion ? `Sección ${ruta.indice + 1} de ${SECCIONES.length}` : 'Revisar y enviar'),
        h('span', { class: 'barra-cuenta' }, h('span', { 'data-cuenta-total': '' }, conteo.respondidas), `/${conteo.total}`),
        h(
          'div',
          { class: 'guarda', 'aria-hidden': 'true' },
          SECCIONES.map((s) => h('span', { class: 'guarda-grupo', style: `flex: ${s.preguntas.length}` },s.preguntas.map((p) => h('span', { class: claseTesela(p.id), 'data-tesela': p.id })))),
        ),
      ),
      h('main', { class: 'principal' }, esSeccion ? pantallaSeccion(ruta.indice) : pantallaRevision()),
    ),
  )
}

// ——— Pantallas

function pantallaInicio() {
  const conteo = contar()
  const empezado = conteo.respondidas > 0
  const ultimo = estado.envios.at(-1)
  return h(
    'div',
    { class: 'portada' },
    h(
      'div',
      { class: 'portada-agua' },
      h(
        'div',
        { class: 'portada-centro' },
        logo('grande'),
        h('h1', { class: 'portada-titulo', id: 'titulo-pantalla', tabindex: '-1' }, 'Formulario de iniciación del agente de WhatsApp'),
        h('p', { class: 'portada-lead' }, 'Respondan como le explicarían el negocio a un vendedor nuevo el primer día, con modelos, medidas, precios y condiciones reales.'),
      ),
    ),
    h(
      'div',
      { class: 'portada-cuerpo' },
      h('figure', { class: 'pileta-figura' }, pileta(), h('figcaption', {}, h('strong', {}, `${conteo.respondidas} de ${conteo.total}`), ' · Cada respuesta pone una venecita en la pileta.')),
      ultimo && h('p', { class: 'aviso' }, `Ya lo enviaron el ${fecha(ultimo.fecha)}. Pueden seguir cambiando y volver a enviar.`),
      h(
        'ul',
        { class: 'portada-datos' },
        [
          ['guardado', 'Se guarda solo', 'Pueden dejarlo y seguir otro día desde este mismo link, en el celular o en la compu.'],
          ['noAplica', 'Si algo no aplica', 'Toquen «No aplica» y sigan con la próxima.'],
          ['microfono', '¿Prefieren hablar?', 'En el celular, toquen el micrófono del teclado y dicten la respuesta.'],
          ['lista', 'Nada es obligatorio', 'Antes de enviar ven qué quedó sin responder.'],
        ].map(([ic, titulo, texto]) => h('li', {}, h('span', { class: 'dato-icono' }, icono(ic)), h('div', {}, h('strong', {}, titulo), h('span', {}, texto)))),
      ),
      h(
        'div',
        { class: 'portada-quien' },
        h('label', { for: 'quien' }, '¿Quién completa el formulario?'),
        h('input', {
          id: 'quien',
          class: 'entrada',
          placeholder: 'Nombre y rol. Por ejemplo: Laura, dueña',
          maxlength: LIMITES.caracteresQuien,
          autocomplete: 'name',
          value: estado.respuestas.quien ?? '',
          oninput: (e) => cambiar('quien', e.target.value.trim() ? e.target.value : null),
        }),
      ),
      h('a', { class: 'boton boton-principal grande', href: `#/seccion/${primeraSeccionPendiente() + 1}` }, empezado ? 'Seguir donde quedaron' : 'Empezar', icono('der')),
    ),
  )
}

function pantallaSeccion(indice) {
  const seccion = SECCIONES[indice]
  const anterior = SECCIONES[indice - 1]
  const siguiente = SECCIONES[indice + 1]
  return h(
    'div',
    { class: 'seccion' },
    h(
      'header',
      { class: 'seccion-cabeza' },
      h('span', { class: 'seccion-num', 'aria-hidden': 'true' }, indice + 1),
      h(
        'div',
        {},
        h('h1', { class: 'seccion-titulo', id: 'titulo-pantalla', tabindex: '-1' }, seccion.titulo),
        h('p', { class: 'seccion-bajada' }, seccion.bajada),
        h('p', { class: 'seccion-cuenta' }, h('span', { 'data-cuenta-seccion': seccion.id }, contar().porSeccion[seccion.id]), ` de ${seccion.preguntas.length} respondidas`),
      ),
    ),
    h('div', { class: 'preguntas' }, seccion.preguntas.map(bloquePregunta)),
    h(
      'nav',
      { class: 'pie-nav', 'aria-label': 'Navegación entre secciones' },
      anterior
        ? h('a', { class: 'boton boton-suave', href: `#/seccion/${indice}` }, icono('izq'), h('span', { class: 'solo-ancho' }, 'Anterior'))
        : h('a', { class: 'boton boton-suave', href: '#/' }, icono('izq'), h('span', { class: 'solo-ancho' }, 'Inicio')),
      h('span', { class: 'guardado', 'data-guardado': '' }),
      siguiente
        ? h('a', { class: 'boton boton-principal', href: `#/seccion/${indice + 2}` }, 'Siguiente', icono('der'))
        : h('a', { class: 'boton boton-principal', href: '#/revision' }, 'Revisar y enviar', icono('der')),
    ),
  )
}

function pantallaRevision() {
  const conteo = contar()
  const ultimo = estado.envios.at(-1)
  const faltan = conteo.total - conteo.respondidas
  const zonaEnvio = h('div', { class: 'revision-enviar' })

  function dibujarZonaEnvio(error = '') {
    const boton = (texto, alClic, clase = 'boton-principal') => h('button', { type: 'button', class: `boton ${clase} grande`, onclick: alClic }, texto)
    zonaEnvio.replaceChildren(
      confirmandoEnvio
        ? h(
            'div',
            { class: 'confirmar' },
            h('p', {}, h('strong', {}, `Faltan ${faltan} respuestas.`), ' ¿Envían igual? Después pueden completarlas y volver a enviar.'),
            h('div', { class: 'acciones' }, boton([icono('enviar'), 'Enviar igual'], enviarFormulario), boton('Seguir completando', () => { confirmandoEnvio = false; dibujarZonaEnvio() }, 'boton-suave')),
          )
        : boton([icono('enviar'), ultimo ? 'Volver a enviar' : 'Enviar respuestas'], () => {
            if (faltan > 0) { confirmandoEnvio = true; return dibujarZonaEnvio() }
            enviarFormulario()
          }),
      h('p', { class: 'ayuda' }, 'Nos llega todo por mail, con los archivos adjuntos. Si después cambian algo, pueden volver a enviar.'),
      error && h('p', { class: 'error', role: 'alert' }, error),
    )
  }

  async function enviarFormulario() {
    for (const b of zonaEnvio.querySelectorAll('button')) b.disabled = true
    try {
      await vaciar()
      if (pendientes.size) throw new Error('Hay cambios que todavía no se guardaron. Revisen la conexión y prueben de nuevo.')
      const envio = await api('/api/enviar', { method: 'POST' })
      estado.envios.push(envio)
      location.hash = '#/listo'
    } catch (err) {
      dibujarZonaEnvio(err.message)
    }
  }

  dibujarZonaEnvio()
  return h(
    'div',
    { class: 'revision' },
    h(
      'header',
      { class: 'seccion-cabeza sin-num' },
      h(
        'div',
        {},
        h('h1', { class: 'seccion-titulo', id: 'titulo-pantalla', tabindex: '-1' }, 'Revisar y enviar'),
        h(
          'p',
          { class: 'seccion-bajada' },
          faltan === 0 ? 'Está todo respondido. Cuando quieran, envíen.' : `Respondieron ${conteo.respondidas} de ${conteo.total}. Lo que falta lo pueden completar ahora o enviar igual y seguir después.`,
        ),
        ultimo && h('p', { class: 'aviso' }, `Último envío: ${fecha(ultimo.fecha)}.`),
      ),
    ),
    pileta(),
    h(
      'ol',
      { class: 'revision-lista' },
      SECCIONES.map((s, i) => {
        const sinResponder = s.preguntas.filter((p) => !respondida(p.id))
        return h(
          'li',
          { class: 'revision-item' },
          h(
            'a',
            { href: `#/seccion/${i + 1}`, class: 'revision-seccion' },
            h('span', { class: 'riel-num' }, i + 1),
            h('span', { class: 'revision-titulo' }, s.titulo),
            h('span', { class: `revision-conteo${sinResponder.length ? '' : ' completa'}` }, sinResponder.length ? `${s.preguntas.length - sinResponder.length} de ${s.preguntas.length}` : [icono('check'), 'Completa']),
          ),
          sinResponder.length > 0 &&
            h('p', { class: 'revision-faltan' }, 'Falta: ', sinResponder.map((p, j) => [j ? ', ' : '', h('a', { href: `#/seccion/${i + 1}/${p.id}` }, p.numero)])),
        )
      }),
    ),
    zonaEnvio,
  )
}

function pantallaListo() {
  return h(
    'div',
    { class: 'portada' },
    h(
      'div',
      { class: 'portada-agua' },
      h(
        'div',
        { class: 'portada-centro' },
        logo('grande'),
        h('h1', { class: 'portada-titulo', id: 'titulo-pantalla', tabindex: '-1' }, '¡Listo, gracias!'),
        h('p', { class: 'portada-lead' }, 'Recibimos las respuestas. Con esto armamos el agente con el contexto real de Oasis.'),
      ),
    ),
    h(
      'div',
      { class: 'portada-cuerpo' },
      h('figure', { class: 'pileta-figura llenando' }, pileta()),
      h('p', { class: 'centrado' }, 'Si quieren cambiar o sumar algo, entren al mismo link, completen y vuelvan a enviar.'),
      h(
        'div',
        { class: 'acciones centrado' },
        h('button', { type: 'button', class: 'boton boton-suave', onclick: descargarCopia }, icono('descargar'), 'Descargar una copia'),
        h('a', { class: 'boton boton-suave', href: '#/revision' }, 'Volver al formulario'),
      ),
    ),
  )
}

async function descargarCopia() {
  try {
    const respuesta = await fetch('/api/exportar', { headers: { 'x-codigo': codigo } })
    if (!respuesta.ok) throw new Error()
    const url = URL.createObjectURL(await respuesta.blob())
    h('a', { href: url, download: 'oasis-respuestas.md' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch {
    toast('No se pudo descargar. Prueben de nuevo en un momento.')
  }
}

function pantallaMensaje(titulo, texto, accion) {
  return h(
    'div',
    { class: 'portada' },
    h('div', { class: 'portada-agua' }, h('div', { class: 'portada-centro' }, logo('grande'), h('h1', { class: 'portada-titulo' }, titulo), h('p', { class: 'portada-lead' }, texto), accion)),
  )
}

// ——— Preguntas

function autoAlto(area) {
  area.style.height = 'auto'
  area.style.height = `${area.scrollHeight + 2}px`
}

function redibujarPregunta(id, foco) {
  const viejo = document.querySelector(`[data-pregunta="${id}"]`)
  if (!viejo) return
  const nuevo = bloquePregunta(POR_ID.get(id))
  viejo.replaceWith(nuevo)
  for (const area of nuevo.querySelectorAll('textarea')) autoAlto(area)
  nuevo.querySelector(foco)?.focus()
}

function alternarNoAplica(id) {
  const actual = estado.respuestas[id]
  if (esNoAplica(actual)) cambiar(id, memoria.get(id) ?? null)
  else {
    if (actual !== undefined) memoria.set(id, actual)
    cambiar(id, NO_APLICA)
  }
  redibujarPregunta(id, '.no-aplica')
}

function area(pregunta, extra = {}) {
  const valor = estado.respuestas[pregunta.id]
  const el = h('textarea', {
    id: `campo-${pregunta.id}`,
    class: `area ${extra.clase ?? ''}`,
    rows: 3,
    maxlength: LIMITES.caracteresPorRespuesta,
    placeholder: extra.placeholder,
    'aria-labelledby': extra.etiquetaId ?? `texto-${pregunta.id}`,
    value: typeof valor === 'string' ? valor : (extra.inicial ?? ''),
  })
  el.addEventListener('input', () => {
    autoAlto(el)
    cambiar(pregunta.id, el.value.trim() ? el.value : null)
  })
  return el
}

function controlConocido(pregunta) {
  const valor = estado.respuestas[pregunta.id]
  const confirmado = valor === pregunta.conocido
  if (corrigiendo.has(pregunta.id) || (typeof valor === 'string' && !confirmado)) {
    return h('div', { class: 'corrigiendo' }, area(pregunta, { inicial: pregunta.conocido }), h('p', { class: 'ayuda' }, `Teníamos: ${pregunta.conocido}`))
  }
  return h(
    'div',
    { class: `conocido${confirmado ? ' confirmado' : ''}` },
    h('p', { class: 'conocido-etiqueta' }, confirmado ? [icono('check'), 'Confirmado'] : 'Lo que tenemos'),
    h('p', { class: 'conocido-valor' }, pregunta.conocido),
    h(
      'div',
      { class: 'acciones' },
      !confirmado && h('button', { type: 'button', class: 'boton boton-principal chico', onclick: () => { cambiar(pregunta.id, pregunta.conocido); redibujarPregunta(pregunta.id, '.corregir') } }, icono('check'), 'Está bien'),
      h('button', { type: 'button', class: 'boton boton-suave chico corregir', onclick: () => { corrigiendo.add(pregunta.id); redibujarPregunta(pregunta.id, 'textarea') } }, 'Corregir'),
    ),
  )
}

function controlOpciones(pregunta) {
  const multiple = pregunta.tipo === 'varias'
  const valor = estado.respuestas[pregunta.id] ?? {}
  const elegidas = multiple ? (valor.opciones ?? []) : valor.opcion != null ? [valor.opcion] : []
  const opciones = pregunta.otra ? [...pregunta.opciones, OTRA] : pregunta.opciones
  const otra = h('input', {
    type: 'text',
    class: 'entrada otra',
    placeholder: '¿Cuál?',
    maxlength: LIMITES.caracteresOtra,
    'aria-label': `Otra opción para la pregunta ${pregunta.numero}`,
    value: valor.otra ?? '',
    hidden: !elegidas.includes(OTRA),
  })
  const ayuda = h('p', { class: 'ayuda' })
  const largas = opciones.some((o) => o.length > 26)
  const lista = h(
    'div',
    { class: `opciones${largas ? ' columna' : ''}`, role: multiple ? 'group' : 'radiogroup', 'aria-labelledby': `texto-${pregunta.id}` },
    opciones.map((opcion) =>
      h(
        'label',
        { class: `opcion${multiple ? '' : ' radio'}` },
        h('input', { type: multiple ? 'checkbox' : 'radio', name: `campo-${pregunta.id}`, value: opcion, checked: elegidas.includes(opcion) }),
        h('span', { class: 'opcion-marca', 'aria-hidden': 'true' }, multiple ? icono('check') : h('span', { class: 'punto' })),
        h('span', {}, opcion),
      ),
    ),
  )

  function leer() {
    const marcadas = [...lista.querySelectorAll('input:checked')].map((i) => i.value)
    otra.hidden = !marcadas.includes(OTRA)
    if (multiple && pregunta.maximo) {
      for (const input of lista.querySelectorAll('input')) input.disabled = !input.checked && marcadas.length >= pregunta.maximo
      ayuda.textContent = `Elijan hasta ${pregunta.maximo} · ${marcadas.length} ${marcadas.length === 1 ? 'elegida' : 'elegidas'}`
    }
    return marcadas
  }

  lista.addEventListener('change', (e) => {
    const marcadas = leer()
    const nada = marcadas.length === 0
    cambiar(pregunta.id, nada ? null : multiple ? { opciones: marcadas, otra: otra.value } : { opcion: marcadas[0], otra: otra.value })
    if (e.target.value === OTRA && e.target.checked) otra.focus()
  })
  otra.addEventListener('input', () => {
    const marcadas = leer()
    cambiar(pregunta.id, multiple ? { opciones: marcadas, otra: otra.value } : { opcion: marcadas[0] ?? null, otra: otra.value })
  })
  ayuda.textContent = multiple ? (pregunta.maximo ? `Elijan hasta ${pregunta.maximo}` : 'Pueden elegir varias') : 'Elijan una'
  leer()
  return [ayuda, lista, otra]
}

function controlChat(pregunta) {
  return h(
    'div',
    { class: 'chat' },
    h('p', { class: 'burbuja-cliente', id: `mensaje-${pregunta.id}` }, pregunta.mensaje),
    pregunta.nota && h('p', { class: 'chat-nota' }, pregunta.nota),
    h(
      'div',
      { class: 'chat-respuesta' },
      h('label', { class: 'chat-etiqueta', id: `etiqueta-${pregunta.id}`, for: `campo-${pregunta.id}` }, pregunta.etiqueta),
      area(pregunta, { clase: 'burbuja-respuesta', etiquetaId: `etiqueta-${pregunta.id} mensaje-${pregunta.id}` }),
    ),
  )
}

function listaAdjuntos(pregunta) {
  const items = [
    ...archivosDe(pregunta.id).map((a) =>
      h(
        'li',
        { class: 'adjunto' },
        icono('archivo'),
        h('span', { class: 'adjunto-nombre' }, a.nombre, h('span', { class: 'adjunto-meta' }, megas(a.bytes))),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Borrar ${a.nombre}`, onclick: () => borrarArchivo(a) }, icono('basura')),
      ),
    ),
    ...estado.subiendo
      .filter((s) => s.seccion === pregunta.id)
      .map((s) =>
        h(
          'li',
          { class: `adjunto${s.error ? ' con-error' : ''}` },
          icono('archivo'),
          h(
            'span',
            { class: 'adjunto-nombre' },
            s.nombre,
            s.error ? h('span', { class: 'adjunto-meta error' }, s.error) : h('span', { class: 'adjunto-barra' }, h('span', { 'data-barra': s.clave })),
          ),
          s.error && h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Quitar', onclick: () => { estado.subiendo = estado.subiendo.filter((x) => x !== s); refrescarAdjuntos(pregunta.id) } }, icono('cerrar')),
        ),
      ),
  ]
  return h('ul', { class: 'adjuntos-lista', 'data-adjuntos': pregunta.id }, items)
}

function refrescarAdjuntos(id) {
  document.querySelector(`[data-adjuntos="${id}"]`)?.replaceWith(listaAdjuntos(POR_ID.get(id)))
  refrescarProgreso(id)
}

async function comprimirSiEsFoto(archivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size < 1.5 * 1048576) return archivo
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, 2400 / Math.max(imagen.width, imagen.height))
    const lienzo = h('canvas', { width: Math.round(imagen.width * escala), height: Math.round(imagen.height * escala) })
    lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', 0.85))
    return blob && blob.size < archivo.size ? new File([blob], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : archivo
  } catch {
    return archivo
  }
}

function subir(archivo, seccion, alProgreso) {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/archivos?seccion=${encodeURIComponent(seccion)}`)
    xhr.setRequestHeader('x-codigo', codigo)
    xhr.setRequestHeader('x-nombre', encodeURIComponent(archivo.name))
    xhr.setRequestHeader('content-type', archivo.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && alProgreso(e.loaded / e.total)
    xhr.onload = () => {
      let datos = null
      try { datos = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolver(datos)
      else rechazar(new Error(datos?.error ?? `No se pudo subir (error ${xhr.status}).`))
    }
    xhr.onerror = () => rechazar(new Error('Se cortó la subida. Prueben de nuevo con mejor señal.'))
    xhr.send(archivo)
  })
}

async function adjuntar(seccion, archivos) {
  const nuevos = [...archivos].map((archivo) => ({ clave: crypto.randomUUID(), seccion, nombre: archivo.name, archivo, error: null }))
  estado.subiendo.push(...nuevos)
  refrescarAdjuntos(seccion)
  for (const s of nuevos) {
    try {
      const listo = await comprimirSiEsFoto(s.archivo)
      if (listo.size > LIMITES.bytesPorArchivo) throw new Error(`Pesa ${megas(listo.size)} y el tope es ${megas(LIMITES.bytesPorArchivo)}. Si es un video, mándenlo por WhatsApp.`)
      const meta = await subir(listo, seccion, (p) => {
        const barra = document.querySelector(`[data-barra="${s.clave}"]`)
        if (barra) barra.style.width = `${Math.round(p * 100)}%`
      })
      estado.archivos.push(meta)
      estado.subiendo = estado.subiendo.filter((x) => x !== s)
    } catch (err) {
      s.error = err.message
    }
    refrescarAdjuntos(seccion)
  }
}

async function borrarArchivo(archivo) {
  try {
    await api(`/api/archivos/${archivo.id}`, { method: 'DELETE' })
  } catch (err) {
    if (err.estado !== 404) return toast(err.message)
  }
  estado.archivos = estado.archivos.filter((a) => a.id !== archivo.id)
  refrescarAdjuntos(archivo.seccion)
}

function controlDocumento(pregunta) {
  const selector = h('input', { type: 'file', multiple: true, hidden: true, onchange: (e) => { adjuntar(pregunta.id, e.target.files); e.target.value = '' } })
  const zona = h(
    'div',
    { class: 'documento' },
    area(pregunta, { placeholder: 'Peguen el texto acá, o adjunten el archivo abajo' }),
    listaAdjuntos(pregunta),
    h(
      'div',
      { class: 'adjuntar' },
      h('button', { type: 'button', class: 'boton boton-suave chico', onclick: () => selector.click() }, icono('clip'), 'Adjuntar archivos'),
      h('span', { class: 'ayuda' }, `Foto, PDF, Excel o Word · hasta ${megas(LIMITES.bytesPorArchivo)} cada uno`),
      selector,
    ),
  )
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.setAttribute('data-arrastrando', '') })
  zona.addEventListener('dragleave', () => zona.removeAttribute('data-arrastrando'))
  zona.addEventListener('drop', (e) => {
    e.preventDefault()
    zona.removeAttribute('data-arrastrando')
    if (e.dataTransfer.files.length) adjuntar(pregunta.id, e.dataTransfer.files)
  })
  return zona
}

function bloquePregunta(pregunta) {
  const id = pregunta.id
  const noAplica = esNoAplica(estado.respuestas[id])
  let control
  if (noAplica) {
    control = h('p', { class: 'aviso-no-aplica' }, icono('noAplica'), 'Marcada como «no aplica». ', h('button', { type: 'button', class: 'boton-texto', onclick: () => alternarNoAplica(id) }, 'Deshacer'))
  } else if (pregunta.tipo === 'una' || pregunta.tipo === 'varias') control = controlOpciones(pregunta)
  else if (pregunta.tipo === 'chat') control = controlChat(pregunta)
  else if (pregunta.tipo === 'documento') control = controlDocumento(pregunta)
  else if (pregunta.conocido) control = controlConocido(pregunta)
  else control = area(pregunta)

  const etiquetaEsLabel = !noAplica && pregunta.tipo !== 'una' && pregunta.tipo !== 'varias' && pregunta.tipo !== 'chat' && !(pregunta.conocido && !corrigiendo.has(id) && typeof estado.respuestas[id] !== 'string')
  return h(
    'section',
    { class: `pregunta pregunta-${pregunta.tipo}`, id: `pregunta-${id}`, 'data-pregunta': id, 'data-respondida': respondida(id) },
    h('span', { class: 'pregunta-num', 'aria-hidden': 'true' }, pregunta.numero),
    h(
      'div',
      { class: 'pregunta-cabeza' },
      h(
        etiquetaEsLabel ? 'label' : 'p',
        { class: 'pregunta-texto', id: `texto-${id}`, for: etiquetaEsLabel ? `campo-${id}` : null },
        h('span', { class: 'solo-lector' }, `Pregunta ${pregunta.numero}: `),
        pregunta.titulo ?? pregunta.texto,
      ),
      h('button', { type: 'button', class: 'no-aplica', 'aria-pressed': String(noAplica), onclick: () => alternarNoAplica(id) }, 'No aplica'),
    ),
    pregunta.detalle && !noAplica && h('p', { class: 'ayuda detalle' }, pregunta.detalle),
    h('div', { class: 'pregunta-cuerpo' }, control),
  )
}

// ——— Arranque

async function arrancar() {
  try {
    Object.assign(estado, await api('/api/estado'))
  } catch (err) {
    if (err.estado === 401) {
      return app.replaceChildren(pantallaMensaje('Este formulario necesita el link completo', 'Ábranlo desde el link que les mandamos por WhatsApp. Si no lo encuentran, pídannoslo de nuevo.'))
    }
    return app.replaceChildren(
      pantallaMensaje('No pudimos cargar el formulario', err.message, h('button', { type: 'button', class: 'boton boton-suave', onclick: () => location.reload() }, 'Probar de nuevo')),
    )
  }
  // Lo que no llegó al servidor la última vez (sin conexión, pestaña cerrada) sigue acá.
  try {
    for (const [id, valor] of Object.entries(JSON.parse(local.leer(CLAVE_PENDIENTES) ?? '{}'))) cambiar(id, valor)
  } catch {}
  window.addEventListener('hashchange', dibujar)
  dibujar()
}

arrancar()
