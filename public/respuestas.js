import { ITEMS, SECCIONES } from './preguntas.js'

/**
 * Qué forma tiene una respuesta, cuándo cuenta como respondida y cómo se lee en el mail.
 *
 * Lo comparten el navegador, para avisar antes de mandar, y el servidor, que es el que decide.
 *
 *   texto, chat, documento → un string
 *   una                    → { opcion, otra }       opcion: una de las opciones, «Otra» o null
 *   varias                 → { opciones, otra }     opciones: lista sin repetidos
 *   cualquiera             → { noAplica: true }
 */

export const LIMITES = Object.freeze({
  caracteresPorRespuesta: 20_000,
  caracteresOtra: 500,
  caracteresQuien: 200,
  // Un mail de Gmail entra hasta 25 MB codificados: un archivo de 10 MB viaja solo sin problema.
  bytesPorArchivo: 10 * 1024 * 1024,
  archivosEnTotal: 40,
  bytesEnTotal: 80 * 1024 * 1024,
})

export const OTRA = 'Otra'

export const NO_APLICA = Object.freeze({ noAplica: true })

export const esNoAplica = (valor) => valor !== null && typeof valor === 'object' && valor.noAplica === true

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor)

const conTexto = (valor) => typeof valor === 'string' && valor.trim() !== ''

const miles = (numero) => numero.toLocaleString('es-AR')

/** Qué hay que arreglar en el valor, dicho para quien lo escribió, o null si sirve. null borra la respuesta. */
export function errorDeValor(pregunta, valor) {
  const n = pregunta.numero
  if (valor === null) return null
  if (esNoAplica(valor)) {
    return Object.keys(valor).length === 1 ? null : `La respuesta ${n} está marcada como «no aplica» y no puede traer otros datos.`
  }

  if (pregunta.tipo === 'una' || pregunta.tipo === 'varias') {
    if (!esObjeto(valor)) return `La respuesta ${n} tiene que ser una elección entre las opciones.`
    const validas = pregunta.otra ? [...pregunta.opciones, OTRA] : pregunta.opciones
    const otra = valor.otra ?? ''
    if (typeof otra !== 'string' || otra.length > LIMITES.caracteresOtra) {
      return `En la pregunta ${n}, lo que va en «Otra» tiene que ser texto de hasta ${LIMITES.caracteresOtra} caracteres.`
    }
    const clave = pregunta.tipo === 'una' ? 'opcion' : 'opciones'
    if (Object.keys(valor).some((k) => k !== clave && k !== 'otra')) return `La respuesta ${n} trae datos que esta pregunta no usa.`

    if (pregunta.tipo === 'una') {
      if (valor.opcion !== null && !validas.includes(valor.opcion)) {
        return `«${valor.opcion}» no es una opción de la pregunta ${n}. Recarguen la página: puede que el formulario haya cambiado.`
      }
      return null
    }

    const { opciones } = valor
    if (!Array.isArray(opciones) || opciones.some((opcion) => !validas.includes(opcion))) {
      return `Alguna de las opciones elegidas en la pregunta ${n} no existe. Recarguen la página: puede que el formulario haya cambiado.`
    }
    if (new Set(opciones).size !== opciones.length) return `En la pregunta ${n} hay una opción elegida dos veces.`
    if (pregunta.maximo && opciones.length > pregunta.maximo) return `En la pregunta ${n} se eligen hasta ${pregunta.maximo}.`
    return null
  }

  if (typeof valor !== 'string') return `La respuesta ${n} tiene que ser texto.`
  if (valor.length > LIMITES.caracteresPorRespuesta) {
    return `La respuesta ${n} es muy larga: el tope es de ${miles(LIMITES.caracteresPorRespuesta)} caracteres. Si es una lista larga, súbanla como archivo en Documentos.`
  }
  return null
}

/** Un documento cuenta como respondido con texto o con al menos un archivo. */
export function estaRespondida(pregunta, valor, cantidadArchivos = 0) {
  if (esNoAplica(valor)) return true
  switch (pregunta.tipo) {
    case 'una':
      return esObjeto(valor) && valor.opcion != null && (valor.opcion !== OTRA || conTexto(valor.otra))
    case 'varias':
      return esObjeto(valor) && Array.isArray(valor.opciones) && valor.opciones.some((opcion) => opcion !== OTRA || conTexto(valor.otra))
    case 'documento':
      return conTexto(valor) || cantidadArchivos > 0
    default:
      return conTexto(valor)
  }
}

/** La respuesta en partes legibles: una por opción elegida, o una sola con el texto. Vacía si no hay respuesta. */
export function partesDeValor(pregunta, valor) {
  if (valor === undefined || valor === null) return []
  if (esNoAplica(valor)) return ['No aplica']
  const conOtra = (opcion) => (opcion === OTRA ? `Otra: ${(valor.otra ?? '').trim() || '(sin aclarar cuál)'}` : opcion)
  if (pregunta.tipo === 'una') return esObjeto(valor) && valor.opcion != null ? [conOtra(valor.opcion)] : []
  if (pregunta.tipo === 'varias') return esObjeto(valor) && Array.isArray(valor.opciones) ? valor.opciones.map(conOtra) : []
  return conTexto(valor) ? [valor.trim()] : []
}

/** Cuántas respondidas hay en total y en cada sección. */
export function contarRespuestas(respuestas, archivos = []) {
  const archivosPorPregunta = new Map()
  for (const archivo of archivos) archivosPorPregunta.set(archivo.seccion, (archivosPorPregunta.get(archivo.seccion) ?? 0) + 1)

  const porSeccion = {}
  let respondidas = 0
  for (const seccion of SECCIONES) {
    const cuenta = seccion.preguntas.filter((pregunta) =>
      estaRespondida(pregunta, respuestas[pregunta.id], archivosPorPregunta.get(pregunta.id) ?? 0),
    ).length
    porSeccion[seccion.id] = cuenta
    respondidas += cuenta
  }
  return { respondidas, total: ITEMS.length, porSeccion }
}
