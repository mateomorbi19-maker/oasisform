/**
 * El formulario: las secciones y las preguntas del PDF «Preguntas Oasis LP», en el mismo orden y
 * con el mismo número, para que el cliente pueda decir «la 21» y hablemos de lo mismo.
 *
 * Lo usan el navegador, para dibujarlo, y el servidor, para validar lo que llega y armar el mail.
 * Si cambia una pregunta, cambia acá y en ningún otro lado.
 *
 * Los ids no se reutilizan: las respuestas guardadas se buscan por id, así que una pregunta que se
 * saca deja su id libre para siempre.
 */

const texto = (numero, enunciado, extra = {}) => ({
  id: `p${numero}`,
  numero: String(numero),
  tipo: 'texto',
  texto: enunciado,
  ...extra,
})

const una = (numero, enunciado, opciones, extra = {}) => ({ ...texto(numero, enunciado, extra), tipo: 'una', opciones })

const varias = (numero, enunciado, opciones, extra = {}) => ({ ...texto(numero, enunciado, extra), tipo: 'varias', opciones })

const objecion = (numero, mensaje, nota = null) => ({
  id: `p${numero}`,
  numero: String(numero),
  tipo: 'chat',
  titulo: 'El cliente dice',
  mensaje,
  nota,
  etiqueta: 'Cómo la responde el mejor vendedor',
  texto: `«${mensaje}»${nota ? ` (${nota.toLowerCase()})` : ''}`,
})

const caso = (numero, tema, mensaje) => ({
  id: `p${numero}`,
  numero: String(numero),
  tipo: 'chat',
  titulo: `${tema}. Un cliente escribe`,
  mensaje,
  nota: null,
  etiqueta: 'Cómo responde el agente',
  texto: `${tema}. Un cliente escribe: «${mensaje}»`,
})

const documento = (codigo, enunciado, detalle) => ({
  id: codigo.toLowerCase(),
  numero: codigo,
  tipo: 'documento',
  texto: enunciado,
  detalle,
})

export const SECCIONES = [
  {
    id: 'negocio',
    titulo: 'Datos del negocio',
    bajada: 'Lo básico que el agente tiene que tener a mano. Lo que ya figura en sus redes viene cargado: revísenlo.',
    preguntas: [
      texto(1, 'Nombre comercial y razón social', { conocido: 'Piscinas Oasis LP' }),
      texto(2, 'Dirección del local, depósito o showroom donde se pueden ver las piletas', { conocido: 'Ringuelet, La Plata' }),
      texto(3, '¿El cliente puede ir a ver las piletas en persona? ¿Dónde y cómo se coordina?'),
      texto(4, 'Días y horarios de atención'),
      texto(5, 'WhatsApp de ventas donde va a trabajar el agente', { conocido: '+54 9 221 586-8866' }),
      texto(6, 'Mail de contacto'),
      texto(7, 'Web y redes', { conocido: 'Instagram: @piscinas.oasislp · Instagram anterior: @piletas.oasis.lp' }),
      texto(8, 'Cuántos años llevan en el rubro y cómo arrancó Oasis'),
      texto(9, 'Por qué alguien de La Plata le compra la pileta a Oasis y no a otro'),
      texto(10, 'Hasta dónde llegan a instalar y si cobran distinto según la distancia'),
    ],
  },
  {
    id: 'voz',
    titulo: 'Marca y voz del agente',
    bajada: 'Cómo suena. La voz define si la conversación se siente como Oasis o como un bot genérico.',
    preguntas: [
      texto(11, '¿El agente tiene nombre propio? ¿Cuál?'),
      una(
        12,
        'Qué tono quieren que tenga el agente',
        [
          'Cercano y de barrio, como el vecino que te recomienda dónde comprar',
          'Directo y práctico, va a la medida y al precio',
          'Cálido y paciente, explica todo sin apurar',
          'Profesional de empresa constructora',
        ],
        { otra: true },
      ),
      varias(
        13,
        'Personalidad del agente en 3 adjetivos',
        ['Confiable', 'Resolutivo', 'Cálido', 'Directo', 'Paciente', 'Entusiasta', 'Preciso', 'Sin vueltas', 'Cercano', 'Didáctico'],
        { maximo: 3 },
      ),
      una(14, 'Tutea o trata de usted', ['Tutea siempre', 'Usted siempre', 'Se adapta a cómo le escriben']),
      una(15, 'Usa emojis', ['Nada', 'Solo al saludar', 'Sí, cuando aporta']),
      texto(16, 'Con qué frase abre la conversación'),
      texto(17, 'Con qué frase cierra cuando el cliente confirma la seña o la fecha de instalación'),
      texto(18, 'Palabras o frases que NUNCA usa'),
      texto(19, '3 a 5 frases que SÍ son parte del ADN de Oasis'),
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Modelos y catálogo',
    bajada: 'El agente tiene que conocer cada modelo con sus medidas reales para no ofrecer una pileta que no entra ni inventar un precio.',
    preguntas: [
      varias(
        20,
        'Qué venden',
        [
          'Piletas de fibra de vidrio',
          'Sistemas de filtrado',
          'Luces LED',
          'Kits de limpieza',
          'Cascadas o hidromasaje',
          'Climatización',
          'Cobertores',
          'Decks y solárium',
        ],
        { otra: true },
      ),
      texto(21, 'Qué modelos tienen y en qué medidas (largo, ancho y profundidad)'),
      texto(22, '¿Las fabrican ustedes o las compran a un fabricante? ¿Cuál?'),
      texto(23, 'En qué colores vienen y si el color cambia el precio'),
      texto(24, 'Qué modelos son los que más consultan y los que más venden'),
      texto(25, '¿Los precios que publican incluyen flete, instalación y filtrado? ¿Qué queda afuera?'),
      texto(26, 'Cada cuánto cambian los precios y quién los actualiza'),
      texto(27, '¿Hay stock inmediato o se fabrican a pedido? ¿Cuánto tarda cada modelo?'),
      texto(28, 'Qué NO venden o NO hacen'),
      una(
        29,
        'Qué hace el agente si preguntan por un modelo o medida que no tienen',
        ['Ofrece el modelo más parecido', 'Toma los datos para avisar cuando haya', 'Deriva a un vendedor'],
        { otra: true },
      ),
      varias(
        30,
        'Qué material puede mandar el agente de cada modelo',
        ['Fotos', 'Videos de instalaciones', 'Planos con medidas', 'Ficha técnica', 'Link a Instagram'],
        { otra: true },
      ),
    ],
  },
  {
    id: 'calificar',
    titulo: 'Calificar al cliente',
    bajada: 'El corazón del agente: entender el patio y para qué la quieren antes de tirar un modelo y un precio.',
    preguntas: [
      texto(31, 'Qué preguntas hace el agente antes de recomendar un modelo'),
      varias(
        32,
        'Qué datos tiene que tener la ficha que le llega al vendedor',
        [
          'Nombre',
          'Zona o localidad',
          'Medidas del patio',
          'Modelo que le interesa',
          'Quién la va a usar',
          'Extras (LED, kit)',
          'Acceso al terreno',
          'Forma de pago',
          'Para cuándo la quiere',
          'Fotos del patio',
        ],
        { otra: true },
      ),
      texto(33, 'Cuánto espacio libre alrededor de la pileta recomiendan dejar'),
      texto(34, 'Cuándo un cliente está caliente y hay que pasarlo ya al vendedor'),
      texto(35, 'Cuándo es una consulta fría o de curioso y cómo la trata'),
      texto(36, 'Familia con chicos chicos: qué modelo le recomienda'),
      texto(37, 'Adultos que quieren nadar o hacer largos: qué le recomienda'),
      texto(38, 'Patio chico o poco presupuesto: qué le ofrece'),
    ],
  },
  {
    id: 'instalacion',
    titulo: 'Instalación y terreno',
    bajada: 'Una de las preguntas que más aparecen. El agente explica cómo es, la visita y la fecha las confirma una persona.',
    preguntas: [
      texto(39, 'Cómo es la instalación paso a paso, desde que confirman hasta que la pileta queda andando'),
      texto(40, '¿Qué significa «instalación en el día»? ¿Qué se hace antes y qué ese mismo día?'),
      texto(41, '¿Quién hace el pozo, el relleno y la platea? ¿Está incluido o se cobra aparte?'),
      texto(42, 'Qué acceso necesita el terreno para que entre la pileta (ancho de paso, camión, grúa)'),
      texto(43, '¿Hacen visita técnica al terreno antes de vender? ¿Se cobra? ¿Cómo se coordina?'),
      texto(44, 'Qué fotos o datos del patio pide el agente'),
      texto(45, 'Con cuánta anticipación hay que reservar fecha y cómo cambia en temporada alta'),
      texto(46, 'El agua y la conexión eléctrica del filtrado: quién se encarga'),
    ],
  },
  {
    id: 'pagos',
    titulo: 'Financiación y pagos',
    bajada: 'Lo que define si la venta avanza. El agente explica opciones, los números finales los confirma el equipo.',
    preguntas: [
      varias(
        47,
        'Formas de pago que aceptan',
        [
          'Efectivo',
          'Transferencia',
          'Dólares',
          'Tarjeta de crédito',
          'Cuotas sin interés',
          'Cuotas con interés',
          'Mercado Pago',
          'Financiación propia',
        ],
        { otra: true },
      ),
      texto(48, 'En cuántas cuotas y con qué tarjetas o bancos'),
      texto(49, 'Cuánto se seña para reservar la fecha y cuándo se paga el resto'),
      texto(50, '¿Hay precio distinto en efectivo o transferencia?'),
      texto(51, '¿El agente puede dar una cuota estimada? ¿Cómo la calcula o qué dice?'),
      texto(52, 'Promociones de pretemporada o descuentos que el agente SÍ puede ofrecer'),
      texto(53, 'Lo que el agente NUNCA negocia'),
    ],
  },
  {
    id: 'postventa',
    titulo: 'Garantía, filtrado y postventa',
    bajada: 'Las preguntas que aparecen cuando el cliente ya se imagina adentro del agua.',
    preguntas: [
      texto(54, 'Qué garantía tiene la pileta y qué cubre'),
      texto(55, 'Qué incluye el sistema fijo de filtrado (bomba, filtro, cañerías, potencia)'),
      texto(56, 'Luces LED, kit de limpieza y otros extras: qué incluye cada uno y cuánto sale'),
      texto(57, 'Qué mantenimiento necesita la pileta y qué le explican al cliente'),
      texto(58, 'En qué consiste el seguimiento post venta'),
      texto(59, 'Cómo se maneja un reclamo o un problema después de instalada'),
      texto(60, 'Qué se hace con la pileta en invierno (invernada, vaciado, cobertor)'),
      texto(61, 'Los videos de clientes que suben a Instagram: ¿el agente los puede mandar como ejemplo?'),
    ],
  },
  {
    id: 'objeciones',
    titulo: 'Objeciones típicas',
    bajada: 'Las frases que más aparecen antes de cerrar. Escriban cómo las responde hoy el mejor vendedor.',
    preguntas: [
      objecion(62, 'Está caro, vi otra más barata en Marketplace'),
      objecion(63, 'Prefiero una de material, la de fibra dura menos'),
      objecion(64, 'Cuál es el último precio en efectivo?'),
      objecion(65, 'La quiero ya, para la semana que viene', 'En plena temporada'),
      objecion(66, 'No sé si me entra en el patio'),
      objecion(67, 'Lo hablo en casa y te confirmo', 'Y desaparece'),
    ],
  },
  {
    id: 'derivacion',
    titulo: 'Derivación a humano',
    bajada: 'Cuándo el agente deja de actuar y pasa el caso a una persona del equipo.',
    preguntas: [
      varias(
        68,
        'Casos que SIEMPRE se derivan',
        [
          'Cliente pide hablar con alguien',
          'Visita técnica al terreno',
          'Terreno con acceso difícil',
          'Último precio o descuento',
          'Cliente listo para señar',
          'Fecha de instalación',
          'Reclamo o problema postventa',
          'Zonas fuera de cobertura',
          'Pedidos para countries o empresas',
        ],
        { otra: true },
      ),
      texto(69, 'Con qué frase deriva'),
      texto(70, 'Horario en el que hay alguien para recibir la derivación y qué hace el agente fuera de ese horario'),
      texto(71, 'Cómo se entera el vendedor de que tiene un caso (WhatsApp, grupo, planilla, CRM)'),
    ],
  },
  {
    id: 'sistemas',
    titulo: 'Integraciones y sistemas',
    bajada: 'Qué herramientas ya usan y con qué se conecta el agente.',
    preguntas: [
      varias(
        72,
        'Por dónde entran las consultas hoy',
        ['WhatsApp', 'Instagram', 'Facebook', 'Marketplace', 'Mercado Libre', 'Web', 'Llamadas', 'Recomendados'],
        { otra: true },
      ),
      texto(73, 'Cuántas consultas reciben por día o por semana, más o menos, en temporada y fuera de temporada'),
      texto(74, 'Quién responde hoy las consultas y cuánto tarda'),
      texto(75, 'Dónde anotan las fechas de instalación (agenda, Google Calendar, planilla, cuaderno)'),
      texto(76, '¿Usan algún CRM o planilla para seguir a los clientes?'),
      texto(77, '¿Hacen publicidad paga? ¿Dónde y qué publican?'),
      texto(78, 'Qué tendría que pasar para que digan que el agente funciona'),
    ],
  },
  {
    id: 'validacion',
    titulo: 'Casos de validación',
    bajada: 'Seis mensajes que el agente va a recibir todos los días. Escriban cómo tendría que responder cada uno.',
    preguntas: [
      caso(79, 'Precio', 'Hola, cuánto sale la de 5,20 instalada?'),
      caso(80, 'Medidas', 'Tengo un patio de 6 x 4, qué pileta me entra?'),
      caso(81, 'Instalación', 'Cuánto tardan en instalarla? Hay que hacer el pozo antes?'),
      caso(82, 'Cuotas', 'La puedo pagar en cuotas con tarjeta?'),
      caso(83, 'Zona', 'Soy de Berazategui, llegan hasta acá?'),
      caso(84, 'Extras', 'Cuánto me suman las luces LED y el kit de limpieza?'),
    ],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    bajada: 'Pueden subirlos como foto, PDF o Excel, o pegar el texto.',
    preguntas: [
      documento('D1', 'Lista de modelos y precios', 'Modelo, medidas, profundidad, color y precio instalada. Un modelo por línea.'),
      documento(
        'D2',
        'Extras y accesorios con precio',
        'Luces LED, kits de limpieza, cascadas, cobertores, climatización. Qué incluye cada uno y cuánto sale.',
      ),
      documento('D3', 'Condiciones de pago por escrito', 'Como se las explican al cliente: seña, cuotas, tarjetas, descuento por efectivo.'),
      documento('D4', 'Política de garantía', 'Si tienen un texto o un contrato, peguen la parte importante.'),
      documento('D5', 'Promociones de temporada vigentes', 'Qué hay hoy, hasta cuándo y quién puede acceder.'),
      documento('D6', 'Preguntas que más se repiten y su respuesta', 'Las que contestan diez veces por día en temporada.'),
      documento('D7', 'Links útiles para el agente', 'Instagram, ubicación en Google Maps, videos de instalaciones, publicaciones fijadas.'),
    ],
  },
  {
    id: 'conversaciones',
    titulo: 'Conversaciones y equipo',
    bajada: 'Pueden subir capturas o pegar el texto. Tapen apellidos y teléfonos si quieren.',
    preguntas: [
      documento(
        'C1',
        'Conversaciones que terminaron en venta',
        'Manden 2 o 3 capturas o chats copiados de conversaciones que terminaron en una pileta vendida, una seña o una fecha de instalación.',
      ),
      documento(
        'C2',
        'Quiénes reciben las derivaciones',
        'La lista de personas que van a recibir las derivaciones del agente: nombre, rol, WhatsApp, horario y qué casos recibe cada una.',
      ),
    ],
  },
]

/** Todas las preguntas, en orden: las 84 numeradas y después los documentos. */
export const ITEMS = SECCIONES.flatMap((seccion) => seccion.preguntas)

export const POR_ID = new Map(ITEMS.map((pregunta) => [pregunta.id, pregunta]))

/** El índice de la sección de cada pregunta, para saltar directo a ella. */
export const SECCION_DE = new Map(SECCIONES.flatMap((seccion, indice) => seccion.preguntas.map((pregunta) => [pregunta.id, indice])))
