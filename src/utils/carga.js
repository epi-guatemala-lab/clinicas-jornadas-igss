/**
 * Lectura de lo que devuelve `GET /api/cargas/{id}`.
 *
 * El resumen lo arma el servidor combinando dos procesos (epidemiología y
 * operación), así que puede llegar plano (`{personas_insertadas: 10, ...}`) o
 * separado por capa (`{epi: {...}, operativo: {...}}`). Acá se interpreta una
 * sola vez para que la pantalla no tenga que adivinar en cada dato.
 *
 * Dos reglas que rigen todo este archivo:
 *
 *  1. **Nada se descarta en silencio.** Los contadores llegan sueltos, pero
 *     también llegan LISTAS (qué empresas quedaron sin NIT de ejemplo, qué
 *     jornadas no tienen tamizaje que las respalde). Antes se perdían porque el
 *     aplanado saltaba todo lo que no fuera un número; ahora tienen su propia
 *     lectura (`listasResumen`).
 *  2. **Ningún nombre interno llega a la pantalla.** Cada clave del servidor
 *     (`persona_conflicto_no_aplicado`) tiene su etiqueta escrita a mano, en
 *     español y con tildes. Una clave que no conozcamos cae en una etiqueta
 *     legible genérica; el identificador crudo solo aparece dentro del bloque
 *     de detalle técnico, que está rotulado como tal.
 */

const CLAVES_CAPA_EPI = ['epi', 'epidemiologia'];
const CLAVES_CAPA_OPERATIVA = ['operativo', 'operativa'];
// El cierre de jornada envuelve su resumen en `cierre` (mismo papel que las
// capas del maestro): sin listarlo acá, planoResumen no vería ningún contador.
const CLAVES_CAPA_CIERRE = ['cierre'];
const CLAVES_CAPA = [...CLAVES_CAPA_EPI, ...CLAVES_CAPA_OPERATIVA, ...CLAVES_CAPA_CIERRE];
const CLAVES_ANIDADAS = ['totales', 'defectos', 'conflictos', 'bloqueos', 'cambios_jornadas'];

/** La rama epidemiológica del resumen (o el resumen entero si viene plano). */
export function capaEpi(resumen) {
  if (!resumen || typeof resumen !== 'object') return null;
  for (const k of CLAVES_CAPA_EPI) {
    if (resumen[k] && typeof resumen[k] === 'object') return resumen[k];
  }
  return resumen;
}

/** La rama operativa del resumen (o el resumen entero si viene plano). */
export function capaOperativa(resumen) {
  if (!resumen || typeof resumen !== 'object') return null;
  for (const k of CLAVES_CAPA_OPERATIVA) {
    if (resumen[k] && typeof resumen[k] === 'object') return resumen[k];
  }
  return resumen;
}

/** Aplana el resumen a un objeto de contadores simples (números, textos, sí/no). */
export function planoResumen(resumen) {
  const plano = {};
  if (!resumen || typeof resumen !== 'object') return plano;
  const absorber = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (CLAVES_CAPA.includes(k) || CLAVES_ANIDADAS.includes(k)) continue;
      if (v !== null && typeof v === 'object') continue;
      if (plano[k] === undefined) plano[k] = v;
    }
  };
  absorber(resumen);
  for (const capa of CLAVES_CAPA) absorber(resumen[capa]);
  return plano;
}

/** Totales acumulados en la base después de la carga. */
export function totalesResumen(resumen) {
  if (!resumen || typeof resumen !== 'object') return null;
  const t = resumen.totales
    || CLAVES_CAPA.map((c) => resumen[c]?.totales).find(Boolean);
  return t && typeof t === 'object' ? t : null;
}

/** Defectos detectados por el proceso (filas descartadas, campos ilegibles…). */
export function defectosResumen(resumen) {
  const out = {};
  if (!resumen || typeof resumen !== 'object') return out;
  const sumar = (d) => {
    if (!d || typeof d !== 'object') return;
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'number') out[k] = (out[k] || 0) + v;
      else if (out[k] === undefined) out[k] = v;
    }
  };
  sumar(resumen.defectos);
  for (const capa of CLAVES_CAPA) sumar(resumen[capa]?.defectos);
  return out;
}

// ── Etiquetas en español de TODA clave que el servidor puede mandar ────
/*
 * Un médico coordinador es quien lee esta pantalla. `persona_conflicto_no_
 * aplicado: 320` no le dice nada y además está sin tildes y en formato de
 * programador. Cada clave conocida tiene su frase; las que no estén acá caen
 * en `etiquetaDeClave`, que devuelve algo legible en vez del nombre interno.
 */
export const ETIQUETAS_CLAVE = {
  // ── Capa epidemiológica (tamizaje) ──
  personas_leidas: 'Personas leídas del archivo',
  personas_insertadas: 'Personas nuevas',
  hallazgos_leidos: 'Hallazgos leídos del archivo',
  hallazgos_insertados: 'Hallazgos nuevos',
  duplicados_personas_omitidos: 'Personas repetidas que se omiten',
  duplicados_hallazgos_omitidos: 'Hallazgos repetidos que se omiten',
  jornadas: 'Jornadas con tamizaje',
  batch_previo: 'Número del lote con el que ya se había cargado',
  mensaje: 'Mensaje del proceso',
  nota: 'Aviso del proceso',
  importado_por: 'Usuario que hizo la carga',

  // ── Defectos de la capa epidemiológica ──
  catalogo_patologias_duplicadas: 'Patologías repetidas en el catálogo',
  jornada_id_recuperado: 'Filas a las que se les recuperó el código de la jornada',
  dpi_invalido: 'Personas descartadas porque el documento de identidad es ilegible',
  sexo_no_reconocido: 'Personas con un sexo que no se pudo reconocer',
  grupo_etario_raro: 'Personas con una edad fuera de todo rango razonable',
  persona_conflicto_no_aplicado:
    'Datos de personas que el archivo corrige y NO se sobrescriben',
  hallazgo_dpi_invalido: 'Hallazgos descartados porque el documento de identidad es ilegible',
  hallazgo_patologia_vacia: 'Hallazgos sin patología escrita',
  hallazgo_patologia_desconocida: 'Hallazgos con una patología que no está en el catálogo',
  total_hallazgos_reconciliados: 'Personas a las que se les recalculó el total de hallazgos',
  jornada_fecha_futura_corregida: 'Jornadas con una fecha futura que se corrigió',

  // ── Empresas ──
  empresas_nuevas: 'Empresas nuevas',
  empresas_actualizadas: 'Empresas del archivo que ya existían',
  empresas_con_cambios: 'Empresas a las que les cambia algún dato',
  empresas_ejemplo_omitidas: 'Empresas a las que se les quitó el dato de ejemplo',

  // ── Personal del IGSS ──
  personal_nuevo: 'Personal nuevo',
  personal_actualizado: 'Personal del archivo que ya estaba registrado',
  personal_con_cambios: 'Personal al que le cambia algún dato',

  // ── Jornadas ──
  jornadas_nuevas: 'Jornadas nuevas',
  jornadas_actualizadas: 'Jornadas del archivo que ya existían',
  jornadas_con_cambios: 'Jornadas a las que les cambia algún dato',
  jornadas_filas: 'Jornadas leídas del archivo',
  jornadas_sin_match_epi: 'Jornadas sin tamizaje que las respalde',
  jornadas_sin_match_epi_n: 'Jornadas sin tamizaje que las respalde',
  plantilla_ejemplo_omitidas: 'Jornadas de ejemplo de la plantilla, descartadas',
  orden_incorrecto: 'Las dos capas se cargaron en el orden equivocado',
  bloqueo: 'Motivo por el que la carga se detuvo',

  // ── Personal asignado a cada jornada ──
  jornada_personal_insert: 'Asignaciones de personal a jornadas',
  jornada_personal_ya_estaban: 'Asignaciones que ya estaban registradas',
  jornada_personal_filas: 'Asignaciones leídas del archivo',
  jornada_personal_sin_jornada: 'Asignaciones sin jornada que las reciba',
  jornada_personal_sin_persona: 'Asignaciones sin persona registrada',

  // ── Viáticos ──
  viaticos_filas: 'Viáticos leídos del archivo',
  viaticos_upsert: 'Viáticos cargados o actualizados',
  viaticos_incompletos_cargados: 'Viáticos incompletos que entran',
  viaticos_incompletos_sin_correlativo: 'Viáticos incompletos (sin correlativo)',
  viaticos_incompletos_ya_cargados: 'Viáticos incompletos que ya estaban cargados',
  viaticos_incompletos_colapsados: 'Viáticos incompletos que se unificaron',
  viaticos_incompletos_completados: 'Viáticos incompletos a los que ya se les puso correlativo',
  viaticos_sin_identidad: 'Viáticos sin datos para identificar a quién le corresponden',
  viaticos_sin_jornada: 'Viáticos sin jornada que los reciba',
  viaticos_sin_persona: 'Viáticos sin persona registrada',
  viaticos_sin_mes: 'Viáticos sin mes indicado',
  viaticos_ejemplo_omitidos: 'Viáticos de ejemplo de la plantilla, descartados',
  viaticos_descuadre: 'Descuadre en el conteo de viáticos',

  // ── Ficha de la persona y laboratorio ──
  persona_detalle_actualizadas: 'Fichas de persona repasadas',
  persona_detalle_con_cambios: 'Fichas de persona a las que les cambia algún dato',
  persona_detalle_vacias_saltadas: 'Fichas vacías que se omiten',
  persona_detalle_filas: 'Fichas leídas del archivo',
  lab_resultados_insertados: 'Resultados de laboratorio nuevos',
  lab_resultados_filas: 'Resultados de laboratorio leídos del archivo',
  afiliados_derivados_de_epi: 'Jornadas a las que se les calculó el número de afiliados atendidos',

  // ── Patologías del catálogo ──
  patologias_desconocidas: 'Patologías que no están en el catálogo',

  // ── Cierre de jornada (análisis de datos por jornada) ──
  epi_jornada_codigo: 'Código epidemiológico de la jornada (N-YYYY)',
  jornada_operativa: 'Jornada operativa ancla',
  fecha_atencion: 'Fecha de atención del archivo',
  pacientes_triaje: 'Pacientes con triaje (hoja «Pacientes»)',
  con_laboratorio: 'Pacientes con laboratorio (hoja «Base Extraída»)',
  personas_ya_estaban: 'Personas que ya estaban cargadas',
  triaje_insertadas: 'Fichas de triaje nuevas (presión, IMC, frecuencia)',
  triaje_actualizadas: 'Fichas de triaje actualizadas',
  labs_insertados: 'Resultados de laboratorio nuevos',
  labs_actualizados: 'Resultados de laboratorio actualizados',
  hallazgos_ya_estaban: 'Hallazgos que ya estaban cargados',
  personas_con_hallazgo: 'Personas con al menos un hallazgo',
  encuestas_insertadas: 'Respuestas de encuesta nuevas',
  encuestas_ya_estaban: 'Respuestas de encuesta que ya estaban',
  encuestados_totales: 'Respuestas de encuesta del archivo',
  encuestados_sin_asistir: 'Encuestados que no asistieron a la jornada',
  // Las dos claves del cotejo cuentan lo MISMO —diferencias sin explicación
  // entre lo que calculó el portal y lo que trae el archivo— y por eso dicen lo
  // mismo: la de la raíz del resumen y la que viaja entre los avisos del
  // proceso. Las que sí tienen una causa conocida no entran en este conteo.
  divergencias_base_resumen: 'Diferencias sin explicación entre lo que calculó el portal y el archivo',
  divergencias_vs_base_resumen: 'Diferencias sin explicación entre lo que calculó el portal y el archivo',
  personas_enriquecidas: 'Personas a las que se les rellenó un dato vacío',
  atendidos_rellenados: 'Jornadas a las que se les completó «atendidos» (estaba vacío)',
  pacientes_sin_laboratorio: 'Pacientes del triaje sin resultado de laboratorio',
  pacientes_sin_triaje: 'Pacientes con laboratorio pero sin triaje',
  encuesta_dpi_reasignado_afiliacion:
    'Encuestas cuyo «DPI» era el número de afiliación: se reasignaron a la persona correcta',
  encuesta_duplicada_misma_persona: 'Personas que llenaron la encuesta más de una vez',
  encuesta_multiples_empresas: 'Empresas distintas mencionadas en las encuestas del archivo',
  encuesta_dpi_invalido: 'Encuestas descartadas porque el documento de identidad es ilegible',
  base_resumen_incompleta:
    'Personas con laboratorio que faltan en la hoja «Base Resumen» del archivo',
  hallazgos_preexistentes_del_maestro:
    'Hallazgos que ya trae el maestro y el archivo del cierre no incluye (se conservan)',
};

/** Etiqueta legible de una clave del servidor. Nunca devuelve el nombre interno. */
export function etiquetaDeClave(clave) {
  return ETIQUETAS_CLAVE[clave] || 'Otro dato del proceso';
}

/** true si la clave tiene una etiqueta escrita a mano. */
export function tieneEtiqueta(clave) {
  return Object.prototype.hasOwnProperty.call(ETIQUETAS_CLAVE, clave);
}

/** Nombre en español de una columna de la base (para la tabla de cambios). */
export const ETIQUETA_CAMPO = {
  // jornadas
  tipo: 'Tipo de jornada',
  seccion_responsable: 'Sección responsable',
  empresa_id: 'Empresa',
  modalidad: 'Modalidad',
  tema: 'Tema',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de finalización',
  hora_inicio: 'Hora de inicio',
  departamento: 'Departamento',
  municipio: 'Municipio',
  zona: 'Zona',
  direccion: 'Dirección',
  programados: 'Personas programadas',
  atendidos: 'Personas atendidas',
  afiliados_atendidos: 'Afiliados atendidos',
  kits_consumidos: 'Kits de laboratorio consumidos',
  aplica_kit_lab: 'Lleva kit de laboratorio',
  estado: 'Estado de la jornada',
  inaugura_clinica: 'Inaugura clínica',
  lider_personal_id: 'Persona que lidera',
  viaticos_presupuesto: 'Viáticos presupuestados',
  viaticos_real: 'Viáticos ejecutados',
  justificacion_categoria: 'Categoría de la justificación',
  justificacion_texto: 'Texto de la justificación',
  notas: 'Notas',
  // personas del tamizaje
  sexo: 'Sexo',
  grupo_etario: 'Grupo etario',
  gremio: 'Gremio',
};

export function etiquetaDeCampo(campo) {
  if (campo == null || campo === '') return '—';
  if (ETIQUETA_CAMPO[campo]) return ETIQUETA_CAMPO[campo];
  // Último recurso (una forma que el servidor todavía no usaba): al menos se
  // lee como una frase y no como un identificador de programador.
  const txt = String(campo).replace(/_/g, ' ').trim();
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : '—';
}

// ── Secciones del comprobante ─────────────────────────────────────────
/*
 * Cada renglón declara de dónde sale su número:
 *   clave    → contador directo del servidor.
 *   real     → familia de «cambios de verdad» (ver CLAVES_CAMBIOS_REALES). El
 *              ETL cuenta sentencias UPDATE ejecutadas, que NO es lo mismo que
 *              registros cuyo contenido cambia: en una recarga del mismo mes
 *              ejecuta 231 UPDATE y cambia 6 jornadas. Mostrar 231 como
 *              «actualizadas» es inflar el número.
 */
export const SECCIONES_RESUMEN = [
  {
    titulo: 'Epidemiología (tamizaje)',
    nota: 'Capa protegida: lo que ya estaba cargado NO se sobrescribe. Una corrección del Excel se reporta como diferencia y la decide una persona.',
    items: [
      { clave: 'personas_insertadas' },
      { clave: 'hallazgos_insertados' },
      { clave: 'duplicados_personas_omitidos' },
      { clave: 'duplicados_hallazgos_omitidos' },
      { clave: 'personas_leidas' },
      { clave: 'hallazgos_leidos' },
      { clave: 'jornadas' },
    ],
  },
  {
    titulo: 'Empresas y personal',
    items: [
      { clave: 'empresas_nuevas' },
      { real: 'empresas' },
      { clave: 'empresas_actualizadas', ayuda: 'Se repasó su ficha una por una con lo que trae el archivo.' },
      { clave: 'personal_nuevo' },
      { real: 'personal' },
      { clave: 'personal_actualizado', ayuda: 'Se repasó su ficha una por una con lo que trae el archivo.' },
    ],
  },
  {
    titulo: 'Jornadas',
    items: [
      { clave: 'jornadas_nuevas' },
      { real: 'jornadas' },
      { clave: 'jornadas_actualizadas', ayuda: 'Se repasaron una por una contra el archivo; arriba está en cuántas cambia algún dato.' },
      { clave: 'jornada_personal_insert' },
      { clave: 'jornadas_sin_match_epi_n' },
      { clave: 'jornada_personal_sin_jornada' },
      { clave: 'jornada_personal_sin_persona' },
    ],
  },
  {
    titulo: 'Viáticos',
    items: [
      { clave: 'viaticos_upsert' },
      {
        clave: 'viaticos_incompletos_sin_correlativo',
        ayuda: 'Entran marcados como INCOMPLETO. SIPRESALUD les pone correlativo y monto desde la pantalla de Viáticos; el sistema nunca inventa un correlativo.',
      },
      { clave: 'viaticos_incompletos_ya_cargados' },
      { clave: 'viaticos_ejemplo_omitidos' },
    ],
  },
  {
    titulo: 'Laboratorio y ficha de la persona',
    items: [
      { clave: 'lab_resultados_insertados' },
      { clave: 'lab_resultados_filas' },
      { real: 'persona_detalle' },
      { clave: 'persona_detalle_actualizadas', ayuda: 'Se repasó la ficha completa de cada persona contra el archivo.' },
      { clave: 'persona_detalle_vacias_saltadas' },
      { clave: 'afiliados_derivados_de_epi' },
    ],
  },
];

/**
 * Claves que traen el número de registros REALMENTE modificados, por familia.
 *
 * El primer nombre que exista manda. Se aceptan varias formas porque el ETL
 * está incorporando estos contadores: mientras no llegue ninguno, la pantalla
 * no inventa el dato — para las jornadas lo saca del detalle de cambios (que
 * sí viene) y para el resto simplemente no muestra el renglón.
 */
const CLAVES_CAMBIOS_REALES = {
  jornadas: ['jornadas_con_cambios', 'jornadas_cambiadas', 'jornadas_modificadas',
    'jornadas_actualizadas_reales'],
  empresas: ['empresas_con_cambios', 'empresas_cambiadas', 'empresas_modificadas',
    'empresas_actualizadas_reales'],
  personal: ['personal_con_cambios', 'personal_cambiado', 'personal_modificado',
    'personal_actualizado_real'],
  persona_detalle: ['persona_detalle_con_cambios', 'persona_detalle_cambiadas',
    'persona_detalle_modificadas'],
};

/** Etiqueta del renglón de cambios reales de cada familia. */
const ETIQUETA_CAMBIOS_REALES = {
  jornadas: 'Jornadas a las que les cambia algún dato',
  empresas: 'Empresas a las que les cambia algún dato',
  personal: 'Personal al que le cambia algún dato',
  persona_detalle: 'Fichas de persona a las que les cambia algún dato',
};

/**
 * Número de registros que el archivo REALMENTE modifica en una familia.
 * @returns {{valor:number, clave:string}|null} null si el servidor no lo informa.
 */
export function cambiosReales(resumen, familia) {
  const plano = planoResumen(resumen);
  for (const clave of (CLAVES_CAMBIOS_REALES[familia] || [])) {
    const v = plano[clave];
    if (typeof v === 'number') return { valor: v, clave };
  }
  if (familia === 'jornadas') {
    // El detalle de cambios ya viene con su total desde siempre: es la fuente
    // fiable mientras el contador suelto no exista.
    const op = capaOperativa(resumen);
    const t = op?.cambios_jornadas?.total;
    if (typeof t === 'number') return { valor: t, clave: 'cambios_jornadas' };
  }
  return null;
}

/** Renglones de una sección, ya resueltos contra el resumen concreto. */
export function renglonesDeSeccion(seccion, resumen) {
  const plano = planoResumen(resumen);
  const out = [];
  for (const item of seccion.items) {
    if (item.real) {
      const c = cambiosReales(resumen, item.real);
      if (!c) continue;
      out.push({
        id: `real:${item.real}`,
        etiqueta: ETIQUETA_CAMBIOS_REALES[item.real] || etiquetaDeClave(item.real),
        valor: c.valor,
        ayuda: item.ayuda,
        destacado: true,
      });
      continue;
    }
    const v = plano[item.clave];
    if (v === undefined || v === null) continue;
    out.push({
      id: item.clave,
      etiqueta: etiquetaDeClave(item.clave),
      valor: v,
      ayuda: item.ayuda,
    });
  }
  return out;
}

/** Claves que ya salen en alguna sección (para no repetirlas en el detalle). */
const CLAVES_EN_SECCIONES = new Set(
  SECCIONES_RESUMEN.flatMap((s) => s.items.map((i) => i.clave).filter(Boolean)),
);

/** Claves internas que no le dicen nada a quien carga el archivo. */
const CLAVES_OCULTAS = new Set([
  'status', 'applied', 'aplicado', 'file_sha', 'file_sha256', 'mensaje',
  'batch_id', 'batch_previo', 'modo', 'estado', 'orden_incorrecto', 'bloqueo',
]);

/**
 * Contadores que el servidor mandó y ninguna sección muestra. Van al bloque de
 * detalle técnico: cada uno con su etiqueta en español y, para quien tenga que
 * reportarlo al equipo técnico, su identificador interno.
 */
export function extrasResumen(resumen) {
  const plano = planoResumen(resumen);
  const usadas = new Set([...CLAVES_EN_SECCIONES]);
  Object.values(CLAVES_CAMBIOS_REALES).flat().forEach((k) => usadas.add(k));
  return Object.entries(plano)
    .filter(([k, v]) => !usadas.has(k) && !CLAVES_OCULTAS.has(k) && v !== null && v !== '')
    .map(([k, v]) => ({ clave: k, etiqueta: etiquetaDeClave(k), valor: v, conocida: tieneEtiqueta(k) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

// ── Listas que el servidor manda y antes se perdían ───────────────────
/*
 * `empresas_ejemplo_omitidas` es la evidencia de que a tres empresas REALES
 * (Seguros G&T, Ingenio Magdalena, APROFAM) se les descartó el NIT y los
 * contactos inventados que traía la plantilla. Es un cambio sobre datos que ya
 * estaban: tiene que verse, no desaparecer porque el aplanado solo miraba
 * números.
 */
const LISTAS_CONOCIDAS = {
  empresas_nuevas_nombres: {
    etiqueta: 'Empresas nuevas que traería este archivo',
    ayuda: 'Revisá que sean clientes de verdad nuevos y no un cliente que ya está cargado con otro nombre (una sigla, un acrónimo, o el nombre completo en vez del comercial). Si aparece una empresa que ya conocés, avisá antes de aplicar: crearía una ficha duplicada y le partiría el historial de jornadas en dos.',
    destacada: true,
  },
  empresas_ejemplo_omitidas: {
    etiqueta: 'Empresas a las que se les quitó el NIT y los contactos de ejemplo',
    ayuda: 'La plantilla original traía NIT y contactos inventados sobre empresas reales. Se descartan esos seis campos y el resto de la ficha entra normal; los huecos quedan vacíos hasta que llegue el dato verdadero. El sistema nunca inventa un NIT.',
    destacada: true,
  },
  plantilla_ejemplo_omitidas: {
    etiqueta: 'Jornadas de ejemplo de la plantilla, descartadas',
    ayuda: 'Filas de ejemplo que reutilizan códigos de jornadas reales con datos inventados. Se reconocen porque no traen fecha de inicio.',
    destacada: true,
  },
  jornadas_sin_match_epi: {
    etiqueta: 'Jornadas del archivo sin tamizaje que las respalde',
    ayuda: 'No se pudieron enlazar con la capa epidemiológica, así que no entran. Revisá que el código de la jornada exista en la hoja de tamizaje.',
    destacada: false,
  },
  patologias_desconocidas: {
    etiqueta: 'Patologías que no están en el catálogo',
    ayuda: 'Hay que darlas de alta en el catálogo antes de aplicar la carga.',
    destacada: false,
  },
};

/** Texto legible de un elemento de lista (cadena o ficha con nombre y filas). */
function textoDeElemento(el) {
  if (el == null) return null;
  if (typeof el !== 'object') return String(el);
  const nombre = ['nombre', 'nombre_canonico', 'codigo', 'jornada', 'jornada_id',
    'empresa', 'valor', 'texto', 'mensaje']
    .map((k) => el[k]).find((v) => typeof v === 'string' && v.trim());
  const filas = ['filas', 'conteo', 'cantidad', 'total']
    .map((k) => el[k]).find((v) => typeof v === 'number');
  if (nombre) return filas != null ? `${nombre.trim()} (${filas} filas)` : nombre.trim();
  return JSON.stringify(el);
}

/**
 * Listas de detalle del resumen, con etiqueta en español.
 * @returns {Array<{clave, etiqueta, ayuda, destacada, elementos:string[]}>}
 */
export function listasResumen(resumen) {
  const salida = [];
  const vistas = new Set();
  const absorber = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (!Array.isArray(v) || v.length === 0 || vistas.has(k)) continue;
      const elementos = v.map(textoDeElemento).filter(Boolean);
      if (!elementos.length) continue;
      vistas.add(k);
      const meta = LISTAS_CONOCIDAS[k];
      salida.push({
        clave: k,
        etiqueta: meta?.etiqueta || etiquetaDeClave(k),
        ayuda: meta?.ayuda || '',
        destacada: Boolean(meta?.destacada),
        conocida: Boolean(meta) || tieneEtiqueta(k),
        elementos,
      });
    }
  };
  absorber(resumen);
  for (const capa of CLAVES_CAPA) absorber(resumen?.[capa]);
  // Primero lo que toca datos que ya estaban en la base.
  return salida.sort((a, b) => Number(b.destacada) - Number(a.destacada));
}

// ── Resultado combinado de las DOS capas ──────────────────────────────
/** Contadores que solo pueden ser >0 si de verdad se escribió algo nuevo. */
const CLAVES_ESCRITURA_NUEVA = [
  'personas_insertadas', 'hallazgos_insertados',
  'empresas_nuevas', 'personal_nuevo', 'jornadas_nuevas',
  'jornada_personal_insert', 'viaticos_upsert', 'viaticos_incompletos_cargados',
  'viaticos_incompletos_completados', 'viaticos_incompletos_colapsados',
  'lab_resultados_insertados', 'afiliados_derivados_de_epi',
];

/** Contadores de sentencias UPDATE: prueban que se tocó la fila, no que cambió. */
const CLAVES_REPASO = [
  'empresas_actualizadas', 'personal_actualizado', 'jornadas_actualizadas',
  'persona_detalle_actualizadas',
];

/**
 * Qué pasó (o pasaría) mirando las DOS capas, no solo la epidemiológica.
 *
 * La capa epidemiológica es idempotente por archivo: si el mismo Excel ya se
 * cargó, devuelve `status: NOOP` y no escribe. La capa operativa NO tiene esa
 * marca y vuelve a pasar por encima de jornadas, empresas, viáticos y fichas.
 * Anunciar «este archivo ya se había cargado, no se duplicó nada» mirando solo
 * el epi es faltar a la verdad justo cuando se acaban de sobrescribir jornadas.
 *
 * @returns {{
 *   epiNoop:boolean, lotePrevio:number|null,
 *   escrituraNueva:number, cambiosJornadas:number|null, repaso:number,
 *   sinNingunCambio:boolean, soloEpiSinCambios:boolean,
 * }}
 */
export function resultadoCarga(resumen) {
  const plano = planoResumen(resumen);
  const epi = capaEpi(resumen);
  const num = (k) => (typeof plano[k] === 'number' ? plano[k] : 0);

  const escrituraNueva = CLAVES_ESCRITURA_NUEVA.reduce((a, k) => a + num(k), 0);
  const repaso = CLAVES_REPASO.reduce((a, k) => a + num(k), 0);
  const cj = cambiosReales(resumen, 'jornadas');
  const cambiosJornadas = cj ? cj.valor : null;
  const listas = listasResumen(resumen).filter((l) => l.destacada);
  const cambiosDeOtrasFamilias = ['empresas', 'personal', 'persona_detalle']
    .map((f) => cambiosReales(resumen, f))
    .filter(Boolean);
  const cambiosMedidos = cambiosDeOtrasFamilias.reduce((a, c) => a + c.valor, 0)
    + (cambiosJornadas || 0);
  // ¿Se puede afirmar que ninguna fila existente cambió? Solo si el servidor
  // midió los cambios de todas las familias que ejecutó UPDATE.
  const familiasSinMedir = [
    ['empresas_actualizadas', 'empresas'],
    ['personal_actualizado', 'personal'],
    ['persona_detalle_actualizadas', 'persona_detalle'],
    ['jornadas_actualizadas', 'jornadas'],
  ].filter(([clave, familia]) => num(clave) > 0 && !cambiosReales(resumen, familia));

  return {
    epiNoop: String(epi?.status ?? resumen?.status ?? '') === 'NOOP',
    lotePrevio: typeof plano.batch_previo === 'number' ? plano.batch_previo : null,
    escrituraNueva,
    cambiosJornadas,
    cambiosMedidos,
    repaso,
    limpiezasDePlantilla: listas.reduce((a, l) => a + l.elementos.length, 0),
    familiasSinMedir: familiasSinMedir.map(([, f]) => f),
    // Nada, de verdad nada: ni altas, ni cambios medidos, ni siquiera un UPDATE.
    sinNingunCambio: escrituraNueva === 0 && repaso === 0 && cambiosMedidos === 0
      && listas.length === 0,
    // El tamizaje ya estaba, pero la capa operativa igual volvió a escribir.
    operativaVolvioAEscribir: repaso > 0 || escrituraNueva > 0 || cambiosMedidos > 0
      || listas.length > 0,
  };
}

// ── Bloqueos ──────────────────────────────────────────────────────────
const CLAVES_PATOLOGIA = [
  'patologias', 'patologias_no_catalogadas', 'patologias_desconocidas',
  'patologias_faltantes', 'patologias_sin_catalogar', 'sin_catalogar',
];
const CAMPOS_NOMBRE = ['nombre', 'nombre_canonico', 'patologia', 'valor', 'texto', 'label'];
const CAMPOS_CONTEO = ['filas', 'conteo', 'n', 'cantidad', 'total', 'veces', 'ocurrencias'];

function aPatologia(item) {
  if (item == null) return null;
  if (typeof item === 'string') return { nombre: item, filas: null };
  if (typeof item !== 'object') return { nombre: String(item), filas: null };
  const nombre = CAMPOS_NOMBRE.map((k) => item[k]).find((v) => typeof v === 'string' && v.trim());
  if (!nombre) return null;
  const filas = CAMPOS_CONTEO.map((k) => item[k]).find((v) => typeof v === 'number');
  return { nombre: nombre.trim(), filas: filas ?? null };
}

/** Listas anidadas donde el servidor mete el detalle de un bloqueo agrupado. */
const CLAVES_LISTA_ANIDADA = ['valores', ...CLAVES_PATOLOGIA];

/** Texto legible de un bloqueo que NO es una patología. Nunca JSON crudo si
 *  el servidor mandó un mensaje en español (que es lo que Berkin tiene que leer). */
function aTextoDeBloqueo(item) {
  if (item == null) return null;
  if (typeof item !== 'object') return String(item);
  const txt = [item.mensaje, item.detalle, item.motivo, item.error]
    .find((v) => typeof v === 'string' && v.trim());
  return txt ? txt.trim() : JSON.stringify(item);
}

/**
 * Devuelve `{patologias:[{nombre, filas}], otros:[texto]}` sea cual sea la
 * forma en que llegue `bloqueos_json`.
 */
export function normalizarBloqueos(bloqueos) {
  const patologias = [];
  const otros = [];
  const agregarPatologias = (lista) => {
    (Array.isArray(lista) ? lista : [lista]).forEach((it) => {
      const p = aPatologia(it);
      if (p) patologias.push(p);
    });
  };

  if (!bloqueos) return { patologias, otros };

  if (Array.isArray(bloqueos)) {
    bloqueos.forEach((it) => {
      if (it == null) return;
      if (typeof it !== 'object') { otros.push(String(it)); return; }

      // 1. Bloqueo AGRUPADO: el detalle viene en una lista anidada
      //    (`{tipo:'patologias_desconocidas', mensaje, valores:[{nombre, filas}]}`).
      //    Antes se perdía entero: `esItemDePatologia` acertaba con el tipo pero
      //    después buscaba el nombre en el contenedor, que no lo tiene, y el
      //    item se descartaba sin ir a `otros` — la pantalla de bloqueo quedaba
      //    en blanco justo cuando hay que decir qué corregir.
      let anidadas = 0;
      CLAVES_LISTA_ANIDADA.forEach((k) => {
        if (!Array.isArray(it[k])) return;
        it[k].forEach((x) => { const p = aPatologia(x); if (p) { patologias.push(p); anidadas += 1; } });
      });
      if (anidadas) return;      // el mensaje del contenedor solo repetiría la lista

      // 2. Bloqueo de UNA patología suelta (`{nombre, filas, mensaje}`).
      const p = aPatologia(it);
      if (p) { patologias.push(p); return; }

      // 3. Cualquier otro bloqueo (p. ej. el orden de capas invertido): se
      //    muestra su mensaje en español, no el objeto serializado.
      const txt = aTextoDeBloqueo(it);
      if (txt) otros.push(txt);
    });
    return { patologias, otros };
  }

  if (typeof bloqueos === 'object') {
    for (const [k, v] of Object.entries(bloqueos)) {
      if (v == null || (Array.isArray(v) && v.length === 0)) continue;
      if (CLAVES_PATOLOGIA.includes(k)) { agregarPatologias(v); continue; }
      if (typeof v === 'string') { otros.push(v); continue; }
      if (Array.isArray(v)) {
        v.forEach((x) => { const t = aTextoDeBloqueo(x); if (t) otros.push(t); });
        continue;
      }
      otros.push(aTextoDeBloqueo(v) || `${etiquetaDeClave(k)}: ${JSON.stringify(v)}`);
    }
    return { patologias, otros };
  }

  otros.push(String(bloqueos));
  return { patologias, otros };
}

// ── Bloqueo que se resuelve DECIDIENDO, no corrigiendo el archivo ─────
/*
 * El cotejo de empresa del cierre (backend: `empresa_match.entrada_bloqueo`)
 * manda un bloqueo con forma propia:
 *
 *   {origen:'cierre', tipo:'empresa_sin_confirmar', confirmable:true,
 *    accion:'confirmar_empresa', nivel:3, motivo, mensaje,
 *    empresa_archivo, empresas_en_archivo:[{empresa, filas}],
 *    parecido_pct, jornada:{id, codigo, fecha_inicio, fecha_fin},
 *    empresa_jornada:{empresa_id, nombre_legal, nombre_comercial, nit,
 *                     parecido_pct, coincidencia},
 *    candidatas:[{empresa_id, nombre_legal, nombre_comercial, parecido_pct,
 *                 coincidencia, jornadas:[{id, codigo, fecha_inicio, …}]}]}
 *
 * `normalizarBloqueos` lo dejaría como un renglón de texto en «otros motivos
 * del bloqueo» —correcto pero sin salida—, así que se aparta antes: la pantalla
 * lo muestra con los dos nombres y los dos botones.
 */

/**
 * Aparta el bloqueo de empresa (el que la operadora puede resolver decidiendo)
 * del resto, que se corrigen en el archivo.
 * @returns {{empresa:object|null, resto:any}}
 */
export function separarBloqueoEmpresa(bloqueos) {
  if (!Array.isArray(bloqueos)) return { empresa: null, resto: bloqueos };
  let empresa = null;
  const resto = [];
  bloqueos.forEach((b) => {
    const esEmpresa = b && typeof b === 'object'
      && b.tipo === 'empresa_sin_confirmar' && b.confirmable;
    if (esEmpresa && !empresa) empresa = b;
    else resto.push(b);
  });
  return { empresa, resto };
}

// ── Diferencias entre el archivo y lo que ya está cargado ─────────────
/*
 * Forma REAL que entrega el servidor (`conflictos_json`), ya normalizada por él
 * a partir de lo que devuelve cada ETL:
 *
 *   [{origen:'epi',       tipo:'personas',
 *     total:60, ejemplos:[{jornada, campo, en_bd, en_excel}]},
 *    {origen:'operativo', tipo:'jornadas_con_cambios',
 *     total:6, ejemplos:[{jornada_id, codigo, empresa,
 *                         cambios:[{campo, antes, despues}]}]}]
 *
 * Son CONTENEDORES, no filas: cada uno agrupa N diferencias y trae solo una
 * muestra (tope de 50 por tipo).
 *
 * Las dos capas NO son lo mismo y mezclarlas en una sola tabla escondía lo
 * único que hay que decidir: las 6 jornadas que SÍ se sobrescriben quedaban
 * debajo de 50 filas de epidemiología que no se aplican nunca. Por eso
 * `separarConflictos` las devuelve en dos grupos.
 */

function cantidadEjemplos(cont) {
  const e = Array.isArray(cont.ejemplos) ? cont.ejemplos
    : Array.isArray(cont.valores) ? cont.valores : [];
  return e.length;
}

function contenedores(conflictos) {
  if (!conflictos) return [];
  if (Array.isArray(conflictos)) return conflictos.filter((c) => c && typeof c === 'object');
  if (typeof conflictos === 'object') {
    // Tolerancia: el dict crudo de un ETL (`{personas: {total, ejemplos}}`).
    return Object.entries(conflictos)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([k, v]) => ({ tipo: k, origen: CLAVES_CAPA.includes(k) ? k : undefined, ...v }));
  }
  return [];
}

/** true si el contenedor viene de la capa epidemiológica (la que NO se pisa). */
function esDeEpi(cont) {
  return String(cont.origen || cont.capa || '').toLowerCase().startsWith('epi');
}

/*
 * Contenedores que NO tocan ningún dato guardado: son la CONSTANCIA de una
 * decisión. Hoy solo el cotejo de empresa del cierre (`empresa_del_archivo`),
 * que se emite cuando el nombre del archivo no era idéntico al del portal —lo
 * aceptó el sistema por parecido, o lo confirmó una persona—. Sin separarlos
 * caían en el grupo «se van a sobrescribir», que para este aviso es falso: no
 * se cambia ni un dato de la empresa.
 */
const TIPOS_CONSTANCIA = ['empresa_del_archivo'];

function esConstancia(cont) {
  return TIPOS_CONSTANCIA.includes(String(cont.tipo || ''));
}

function filasDeContenedor(cont) {
  const capa = cont.origen || cont.capa || null;
  const ejemplos = Array.isArray(cont.ejemplos) ? cont.ejemplos
    : Array.isArray(cont.valores) ? cont.valores : [];
  const filas = [];
  ejemplos.forEach((ej) => {
    if (ej == null) return;
    if (typeof ej !== 'object') { filas.push({ capa, detalle: String(ej) }); return; }
    const registro = ej.codigo || ej.jornada || ej.jornada_id || ej.entidad || ej.clave || null;
    const empresa = ej.empresa || null;
    const persona = ej.persona || null;
    if (Array.isArray(ej.cambios) && ej.cambios.length) {
      // Operativo: una jornada, empresa o persona con varios campos que
      // cambian. `empresa`/`persona` quedan null salvo que el ETL las traiga
      // (cambios_jornadas trae empresa; cambios_empresas trae empresa=nombre;
      // cambios_personal trae persona=nombre) — cada tabla mezclada muestra
      // solo la columna que le corresponde a cada fila.
      ej.cambios.forEach((c) => filas.push({
        capa, entidad: registro, empresa, persona, campo: c.campo,
        actual: c.antes, nuevo: c.despues,
      }));
      return;
    }
    if (ej.campo !== undefined) {
      // Epi: un campo por ejemplo.
      filas.push({
        capa, entidad: registro, empresa, campo: ej.campo,
        actual: ej.en_bd !== undefined ? ej.en_bd : ej.antes,
        nuevo: ej.en_excel !== undefined ? ej.en_excel : ej.despues,
      });
      return;
    }
    // Forma desconocida: se muestra entera antes que perderla.
    filas.push(capa && !ej.capa ? { capa, ...ej } : ej);
  });
  return filas;
}

/** Quita las columnas que quedan vacías en TODAS las filas del grupo. */
function limpiarColumnas(filas) {
  const usadas = new Set();
  filas.forEach((f) => Object.entries(f).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') usadas.add(k);
  }));
  return filas.map((f) => Object.fromEntries(
    Object.entries(f).filter(([k]) => usadas.has(k))));
}

function armarGrupo(conts) {
  const filas = limpiarColumnas(conts.flatMap(filasDeContenedor));
  const total = conts.reduce((acc, c) => {
    const n = Number(c.total);
    return acc + (Number.isFinite(n) && n > 0 ? n : cantidadEjemplos(c));
  }, 0);
  const truncado = conts.some((c) => {
    const n = Number(c.total);
    return Number.isFinite(n) && n > cantidadEjemplos(c);
  });
  return { filas, total, truncado };
}

/**
 * Separa las diferencias en las que SÍ pisan datos guardados (capa operativa),
 * las que solo se reportan (capa epidemiológica) y las que son constancia de
 * una decisión (el cotejo de empresa del cierre), que no pisan nada.
 * @returns {{sobrescriben:{filas,total,truncado},
 *            informativas:{filas,total,truncado},
 *            constancias:{filas,total,truncado}}}
 */
export function separarConflictos(conflictos) {
  const conts = contenedores(conflictos);
  const diferencias = conts.filter((c) => !esConstancia(c));
  return {
    sobrescriben: armarGrupo(diferencias.filter((c) => !esDeEpi(c))),
    informativas: armarGrupo(diferencias.filter(esDeEpi)),
    constancias: armarGrupo(conts.filter(esConstancia)),
  };
}

/** Encabezados legibles de la tabla de diferencias. */
export const ETIQUETA_COLUMNA = {
  capa: 'Capa',
  tabla: 'Tabla',
  entidad: 'Jornada',
  empresa: 'Empresa',
  persona: 'Persona',
  hoja: 'Hoja del Excel',
  fila: 'Fila',
  clave: 'Clave',
  campo: 'Dato',
  valor_actual: 'Valor cargado hoy',
  valor_nuevo: 'Valor del Excel',
  valor_excel: 'Valor del Excel',
  actual: 'Valor cargado hoy',
  nuevo: 'Valor del Excel',
  accion: 'Qué hace el sistema',
  detalle: 'Detalle',
  motivo: 'Motivo',
  jornada_id: 'Jornada',
  dpi_hash: 'Persona (identificador cifrado)',
};

/** Cómo se llama cada capa para el usuario. */
export const NOMBRE_CAPA = {
  epi: 'Epidemiología',
  epidemiologia: 'Epidemiología',
  operativo: 'Operativa',
  operativa: 'Operativa',
  cierre: 'Cierre de jornada',
};

/** Etiqueta de estado de una carga. */
export const ESTADO_CARGA = {
  EN_COLA: { texto: 'En cola', clase: 'badge-info' },
  EN_PROCESO: { texto: 'En proceso', clase: 'badge-info' },
  OK: { texto: 'Correcta', clase: 'badge-success' },
  BLOQUEADA: { texto: 'Bloqueada', clase: 'badge-warning' },
  FALLIDA: { texto: 'Fallida', clase: 'badge-danger' },
};

export const MODO_CARGA = {
  PREVIEW: 'Previsualización',
  APLICAR: 'Aplicada',
};

/** Tipo de carga (maestro histórico vs cierre de una jornada). */
export const TIPO_CARGA = {
  MAESTRO: 'Excel maestro',
  CIERRE_JORNADA: 'Cierre de jornada',
};

export function etiquetaTipoCarga(tipo) {
  return TIPO_CARGA[tipo] || 'Excel maestro';
}

/** Tamaño de archivo legible. */
export function fmtBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const b = Number(n);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// `fmtFechaHora` se mudó a utils/format.js: los sellos de tiempo en UTC que hay
// que mostrar en hora de Guatemala no son solo del historial de cargas (también
// material entregado, auditoría, cierres), y dos copias de esa conversión es
// justo como reaparece el bug de las 6 horas. Se re-exporta desde acá para no
// romper a quien ya la importa de utils/carga.
export { fmtFechaHora } from './format';
