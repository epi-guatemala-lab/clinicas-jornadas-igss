/**
 * Lo que el portal encontró al comprobar el archivo de cierre, ordenado por lo
 * que la operadora TIENE QUE HACER.
 *
 * El portal no confía en el .xlsm: recalcula cada resultado con su propio motor
 * clínico y después COTEJA lo suyo contra la hoja «Base Resumen» del archivo.
 * Lo que se guarda es SIEMPRE lo del motor; el cotejo es una verificación, no
 * una fuente de datos.
 *
 * El problema que resuelve este archivo no es técnico, es de comunicación. La
 * pantalla mostraba las 6 diferencias de una carga —sobre 3,014 comparaciones,
 * o sea 99.9% de coincidencia— en un recuadro de alarma, con el mismo color que
 * usa una carga que se detuvo en seco, y le pedía a la operadora que dedujera
 * sola si eran un error suyo, un error del sistema o algo ignorable, para
 * después decidir si molestaba al equipo técnico. Dos de esas 6 eran la MISMA
 * frase con la palabra «LOS» de más.
 *
 * ── Tres palabras, tres conceptos, siempre las mismas ──
 *
 *   BLOQUEO     → la carga se detuvo y no sigue hasta que alguien haga algo.
 *   DIFERENCIA  → dos valores que no coinciden (acá: el archivo contra el
 *                 motor del portal).
 *   AVISO       → nota de cómo salió el proceso. No exige nada de nadie.
 *
 * Nada de «divergencias», «conflictos» ni «defectos» en pantalla: eran cinco
 * nombres para tres cosas y hacían que la misma diferencia se leyera dos veces.
 *
 * ── Quién clasifica las diferencias ──
 *
 * El backend, no esta pantalla. El motor es el que sabe con qué valores de
 * laboratorio calculó cada celda, así que es el que puede afirmar que una
 * diferencia ya está entendida. Acá solo se leen sus tres cubetas —idénticas,
 * explicadas y sin explicación— y se muestran con el peso que les corresponde.
 *
 * ── Por qué la comparación de textos es EXACTA y nunca por parecido ──
 *
 * Aunque la comparación viva en el backend, la regla se escribe también acá
 * porque es la que impide que alguien «arregle» esto con un fuzzy match: las
 * etiquetas del motor incluyen «ARRIBA DE LIMITES NORMALES» y «ABAJO DE LIMITES
 * NORMALES», que difieren en UNA palabra de seis y son opuestos clínicos.
 * Cualquier tolerancia por similitud (Levenshtein, quitar palabras cortas,
 * comparar las últimas N palabras) las colapsa y esconde una inversión de
 * resultado. Lo único que se normaliza es lo que no puede cambiar el
 * significado —mayúsculas, tildes, espacios de más—; el resto es una tabla de
 * pares EXACTOS escrita a mano. Lo que no está en esa tabla se trata como
 * diferencia SIN explicación, que es el único caso que merece la atención de
 * alguien.
 */

export const NIVEL = {
  FRENA: 'frena',
  REVISAR: 'revisar',
  INFO: 'info',
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const entero = (v, porDefecto = 0) => num(v) ?? porDefecto;

/**
 * Normalización que NO puede cambiar el significado de una etiqueta clínica:
 * mayúsculas, tildes y espacios repetidos. Nada más. No quita palabras.
 * Se usa solo para AGRUPAR ejemplos que dicen lo mismo, nunca para decidir si
 * dos resultados clínicos son equivalentes (eso lo hace el motor, con tabla).
 */
function clave(v) {
  if (v == null) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // marcas diacríticas (tildes)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto de porcentaje que NUNCA redondea a 100% habiendo algo que no coincide. */
function pctTexto(parte, total) {
  if (!total) return null;
  const pct = (parte / total) * 100;
  if (parte >= total) return '100%';
  return `${Math.min(99.9, Math.round(pct * 10) / 10).toFixed(1)}%`;
}

/** Cuenta por campo `{campo: n}` → lista ordenada de mayor a menor. */
function listaPorCampo(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .map(([campo, total]) => ({ campo, total: entero(total) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Agrupa la muestra de diferencias sin explicación por (campo, valor del
 * archivo, valor del portal), NO por persona.
 *
 * Seis viñetas con documentos enmascarados al lado no le dicen a nadie qué
 * pasó, y el documento enmascarado es lo peor de los dos mundos: no protege más
 * que un identificador interno y tampoco le permite ir a ver de quién se trata.
 * Los documentos siguen viajando en el texto para el equipo técnico —ahí ubicar
 * la fila es justamente para lo que sirven—, pero no se muestran en pantalla.
 */
function agruparEjemplos(avisos) {
  const mapa = new Map();
  avisos.forEach((a) => {
    if (!a || typeof a !== 'object') return;
    const id = `${clave(a.campo)}|${clave(a.en_archivo)}|${clave(a.calculado_portal)}`;
    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        campo: a.campo || '—',
        enArchivo: a.en_archivo ?? '—',
        calculado: a.calculado_portal ?? '—',
        casos: 0,
        documentos: [],
      });
    }
    const g = mapa.get(id);
    g.casos += 1;
    if (a.dpi != null && String(a.dpi).trim()) g.documentos.push(String(a.dpi).trim());
  });
  return [...mapa.values()].sort((a, b) => b.casos - a.casos);
}

/** Las causas ya entendidas que manda el backend, en la forma que usa la pantalla. */
function leerExplicadas(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((e) => ({
      causa: String(e?.causa || ''),
      total: entero(e?.total),
      campos: listaPorCampo(e?.campos),
      titulo: (e?.titulo || '').trim() || null,
      explicacion: (e?.explicacion || '').trim() || null,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Cargas anteriores al bloque `cotejo`: el resumen quedó guardado en la base
 * con la forma vieja y el historial las sigue mostrando. Ahí no se sabe cuántas
 * comparaciones se hicieron ni cuáles tenían causa conocida, así que se leen
 * todas como diferencias sin explicación —el lado seguro— y la pantalla se
 * calla lo que no puede afirmar (el porcentaje que salió bien).
 */
function cotejoDeCargaVieja(cierre) {
  const avisos = Array.isArray(cierre.avisos_base_resumen) ? cierre.avisos_base_resumen : [];
  const sinExplicacion = entero(cierre.divergencias_base_resumen, avisos.length);
  if (!sinExplicacion && !avisos.length) return null;
  return {
    comparaciones: null,
    identicas: null,
    equivalentes_por_redaccion: null,
    coinciden: null,
    explicadas: [],
    explicadas_total: 0,
    sin_explicacion: sinExplicacion,
    por_campo: cierre.divergencias_por_campo || null,
    avisos,
    avisos_listados: entero(cierre.avisos_listados, avisos.length),
    avisos_no_listados: entero(cierre.avisos_no_listados,
      Math.max(0, sinExplicacion - avisos.length)),
    // A propósito SIN la `nota_avisos` que quedó guardada: la escribió el
    // servidor viejo para la pantalla vieja y dice «se muestran arriba»
    // señalando una lista que ahora va abajo, más «MOTOR DEL PORTAL» en
    // mayúsculas. Un texto que apunta a donde no hay nada es peor que el
    // genérico de la pantalla, que al menos es cierto en los dos diseños.
    nota: null,
    _legado: true,
  };
}

/**
 * El cotejo contra el archivo, listo para mostrar.
 *
 * @returns {null|{
 *   personas:number|null, campos:number|null,
 *   comparaciones:number|null, coinciden:number|null, porcentaje:string|null,
 *   explicadas:Array, explicadasTotal:number,
 *   sinExplicacion:number, porCampo:Array, ejemplos:Array,
 *   ejemplosNoListados:number, nota:string|null,
 *   hayQueReportar:boolean, completo:boolean, nadaQueCotejar:boolean,
 * }}
 */
export function leerCotejo(cierre) {
  if (!cierre || typeof cierre !== 'object') return null;
  const crudo = (cierre.cotejo && typeof cierre.cotejo === 'object')
    ? cierre.cotejo
    : cotejoDeCargaVieja(cierre);
  if (!crudo) return null;

  const comparaciones = num(crudo.comparaciones);
  const coinciden = num(crudo.coinciden);
  const explicadas = leerExplicadas(crudo.explicadas);
  const explicadasTotal = entero(crudo.explicadas_total,
    explicadas.reduce((a, e) => a + e.total, 0));
  const sinExplicacion = entero(crudo.sin_explicacion);
  const avisos = Array.isArray(crudo.avisos) ? crudo.avisos : [];
  const ejemplos = agruparEjemplos(avisos);
  // El conteo por campo va SIEMPRE completo aunque la lista de ejemplos esté
  // topada: es lo único que delata que una columna entera se calculó distinto.
  const porCampo = listaPorCampo(crudo.por_campo);

  // Ni una sola celda comparada: el archivo no traía la hoja «Base Resumen», o
  // ninguna de sus filas cruzó con las personas de la jornada. No es un error
  // —los datos entran igual, porque salen del laboratorio y no de esa hoja—,
  // pero tampoco se puede callar: si el recuadro verde es la señal de «el
  // portal se verificó a sí mismo», su ausencia en silencio se lee como que
  // salió bien, y acá no salió de ninguna manera. Se marca para que la pantalla
  // lo diga en una línea, sin alarma y sin inventar un porcentaje.
  // Nunca para una carga vieja: ahí no es que no se haya cotejado, es que el
  // resumen guardado no trae el denominador. Son cosas distintas y decir la
  // primera sobre la segunda sería afirmar algo que no pasó.
  const nadaQueCotejar = !crudo._legado
    && !comparaciones && !sinExplicacion && !explicadasTotal;

  return {
    nadaQueCotejar,
    personas: num(crudo.personas),
    campos: num(crudo.campos),
    comparaciones,
    coinciden,
    porcentaje: (comparaciones && coinciden != null) ? pctTexto(coinciden, comparaciones) : null,
    explicadas,
    explicadasTotal,
    sinExplicacion,
    // Nunca se deduce del muestreo: un conteo sacado de la muestra topada se
    // leería como total y sería mentira. Si el servidor no lo manda, no se dice.
    porCampo,
    ejemplos,
    ejemplosNoListados: entero(crudo.avisos_no_listados,
      Math.max(0, sinExplicacion - ejemplos.reduce((a, e) => a + e.casos, 0))),
    // El texto lo escribe el servidor: es el que sabe qué comparó. Salvo en una
    // carga vieja, donde el que quedó guardado describe la pantalla anterior
    // (ver `cotejoDeCargaVieja`) y conviene el genérico de acá.
    nota: crudo._legado
      ? null
      : (crudo.nota || crudo.nota_avisos || cierre.nota_avisos || '').trim() || null,
    // Lo único que justifica molestar a nadie. Todo lo demás es constancia.
    hayQueReportar: sinExplicacion > 0,
    // `> 0`, no `!= null`: con cero comparaciones el recuadro verde diría
    // «0 de 0 valores coinciden», que es peor que no decir nada.
    completo: comparaciones > 0 && !crudo._legado,
  };
}

// ── Los avisos del proceso (los «defectos» que cuenta el servidor) ────
/*
 * Mismo criterio que arriba: lo que ordena la lista no es de dónde sale el
 * dato, sino si ella tiene que hacer algo.
 *
 * `divergencias_vs_base_resumen` NO está acá a propósito: es exactamente lo
 * mismo que ya cuenta el cotejo. Mostrarlo en los dos lugares hacía que 6
 * diferencias se leyeran como 12 problemas distintos.
 */
/*
 * Cada texto se escribe ENTERO en las dos formas, singular y plural, en vez de
 * pegarle un número a una frase plural. Cuando solo se elegía la cabeza de la
 * oración salían cosas como «Una persona tiene resultados de laboratorio pero
 * no pasaron por triaje» o «le faltan 1 persona»: el resto de la frase quedaba
 * en plural y se leía como un sistema mal hecho, que es justo lo contrario de
 * lo que esta pantalla tiene que transmitir.
 */
const AVISOS_PROCESO = {
  // ── Conviene mirarlo antes de aplicar ──
  // El más importante de esta lista: el resultado ESTÁ en el archivo y el
  // portal no lo entiende, así que se pierde el hallazgo sin que se note. Pasa
  // cuando el laboratorio marca lo anormal con un asterisco («6.8*») o pega la
  // unidad al número. Justamente los valores marcados son los alterados.
  resultados_ilegibles: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'Un resultado del archivo no se pudo leer: trae algo que no es un número.'
      : `${n} resultados del archivo no se pudieron leer: traen algo que no es un número.`),
    queHacer: (n) => (n === 1
      ? 'Ese examen no se va a clasificar, así que si estaba alterado no va a aparecer en los '
        + 'hallazgos. Pedile a Sipresalud el archivo con ese valor como número, sin símbolos.'
      : 'Esos exámenes no se van a clasificar, así que si estaban alterados no van a aparecer '
        + 'en los hallazgos. Pedile a Sipresalud el archivo con esos valores como números, '
        + 'sin símbolos.'),
  },
  personas_sin_el_dato_de_ayuno: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'De una persona no se sabe si llegó en ayunas: la casilla viene vacía.'
      : `De ${n} personas no se sabe si llegaron en ayunas: la casilla viene vacía.`),
    queHacer: () => 'Sin ese dato no se puede saber si su colesterol, sus triglicéridos y su '
      + 'glucosa son confiables. El resto de sus resultados entra normal. Si querés que queden '
      + 'completas, pedile a Sipresalud el archivo con la casilla de ayuno llena.',
  },
  pacientes_sin_laboratorio: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'Una persona pasó por triaje pero el archivo no trae sus resultados de laboratorio.'
      : `${n} personas pasaron por triaje pero el archivo no trae sus resultados de `
        + 'laboratorio.'),
    queHacer: (n) => (n === 1
      ? 'Entra igual, con lo que sí trae el archivo. Si sabés que a esa persona sí le sacaron '
        + 'muestra, revisalo con el laboratorio.'
      : 'Entran igual, con lo que sí trae el archivo. Si sabés que a esas personas sí les '
        + 'sacaron muestra, revisalo con el laboratorio.'),
  },
  pacientes_sin_triaje: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'Una persona tiene resultados de laboratorio pero no pasó por triaje: no trae presión '
        + 'ni peso.'
      : `${n} personas tienen resultados de laboratorio pero no pasaron por triaje: no traen `
        + 'presión ni peso.'),
    queHacer: (n) => (n === 1
      ? 'Entra igual. Sus hallazgos de laboratorio se calculan normal; los de presión y peso '
        + 'no se pueden calcular.'
      : 'Entran igual. Sus hallazgos de laboratorio se calculan normal; los de presión y peso '
        + 'no se pueden calcular.'),
  },
  // El servidor manda acá la CANTIDAD DE EMPRESAS, y solo cuando son más de una
  // (si fuera una sola no habría nada que contar), así que el plural es seguro.
  encuesta_multiples_empresas: {
    nivel: NIVEL.REVISAR,
    texto: (n) => `Las encuestas del archivo mencionan ${n} empresas distintas.`,
    queHacer: (n, aplicado) => 'Un cierre es de una sola jornada, o sea de una sola empresa. El '
      + 'sistema ya comprobó que el archivo corresponde a esta jornada. Si ves un nombre que no '
      + (aplicado ? 'tiene nada que ver, avisá: los datos ya entraron.'
        : 'tiene nada que ver, mejor no apliques y avisá.'),
  },
  encuesta_dpi_invalido: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'Una encuesta venía con el documento de identidad ilegible, así que no se pudo saber '
        + 'de quién era.'
      : `${n} encuestas venían con el documento de identidad ilegible, así que no se pudo `
        + 'saber de quiénes eran.'),
    queHacer: (n) => (n === 1
      ? 'Esa encuesta no entra. El resto del archivo entra normal.'
      : 'Esas encuestas no entran. El resto del archivo entra normal.'),
  },
  base_resumen_incompleta: {
    nivel: NIVEL.REVISAR,
    texto: (n) => (n === 1
      ? 'A la hoja «Base Resumen» del archivo le falta una persona que sí tiene laboratorio.'
      : `A la hoja «Base Resumen» del archivo le faltan ${n} personas que sí tienen laboratorio.`),
    queHacer: () => 'Los datos entran igual, porque el portal los calcula de los resultados de '
      + 'laboratorio y no de esa hoja. Lo que no se pudo hacer es compararlos contra el archivo.',
  },

  // ── Ya está resuelto: no requiere nada de ella ──
  encuesta_dpi_reasignado_afiliacion: {
    nivel: NIVEL.INFO,
    texto: (n) => (n === 1
      ? 'Una encuesta traía el número de afiliación escrito en la casilla del documento de '
        + 'identidad. El portal la asignó a la persona correcta.'
      : `${n} encuestas traían el número de afiliación escrito en la casilla del documento de `
        + 'identidad. El portal las asignó a las personas correctas.'),
  },
  encuesta_duplicada_misma_persona: {
    nivel: NIVEL.INFO,
    texto: (n) => (n === 1
      ? 'Una persona llenó la encuesta más de una vez. Se guardan todas las respuestas tal '
        + 'como vinieron.'
      : `${n} personas llenaron la encuesta más de una vez. Se guardan todas las respuestas `
        + 'tal como vinieron.'),
  },
  atendidos_rellenados: {
    nivel: NIVEL.INFO,
    texto: () => 'La jornada no tenía anotado cuántas personas se atendieron. El portal lo '
      + 'completó con las del archivo.',
  },
  hallazgos_preexistentes_del_maestro: {
    nivel: NIVEL.INFO,
    texto: (n) => (n === 1
      ? 'Un hallazgo que ya estaba cargado de antes no viene en este archivo. Se conserva: no '
        + 'se borra nada.'
      : `${n} hallazgos que ya estaban cargados de antes no vienen en este archivo. Se `
        + 'conservan: no se borra nada.'),
  },
};

/** Claves que ya cuenta el cotejo: repetirlas acá duplicaría el mismo problema. */
const YA_CONTADAS = new Set(['divergencias_vs_base_resumen']);

/**
 * Los avisos del proceso, separados por lo que exigen de ella.
 *
 * @param {object} cierre resumen del cierre (`resumen.cierre`)
 * @param {function} etiquetaFallback traductor de claves que esta pantalla
 *        todavía no conoce — `etiquetaDeClave` de utils/carga.js. Es
 *        obligatorio: el servidor manda hoy diez claves y esta tabla nombra
 *        nueve, y una clave cruda en pantalla (`encuesta_multiples_empresas: 2`)
 *        es exactamente lo que la operadora no tiene por qué descifrar.
 * @param {boolean} aplicado si la carga ya se aplicó. El mismo aviso no puede
 *        decir «mejor no apliques» en el comprobante de algo que ya entró: eso
 *        es mandar a hacer a tiempo algo que ya no se puede, y enseña a no leer.
 * @returns {{revisar:Array, info:Array}}
 */
export function leerAvisosProceso(cierre, etiquetaFallback, aplicado = false) {
  const revisar = [];
  const info = [];
  const defectos = (cierre && typeof cierre.defectos === 'object' && cierre.defectos) || {};
  const traducir = typeof etiquetaFallback === 'function'
    ? etiquetaFallback
    : () => 'Otro dato del proceso';
  Object.entries(defectos).forEach(([k, v]) => {
    const n = num(v);
    if (!n || YA_CONTADAS.has(k)) return;
    const d = AVISOS_PROCESO[k];
    const fila = d
      ? { clave: k, texto: d.texto(n), queHacer: d.queHacer ? d.queHacer(n, aplicado) : null }
      // Clave que el servidor agregó después de esta pantalla: se muestra con su
      // etiqueta en español y se trata como «mirala», que es el lado seguro.
      : { clave: k, texto: `${traducir(k)}: ${n}.`, queHacer: null, desconocida: true };
    (d?.nivel === NIVEL.INFO ? info : revisar).push(fila);
  });
  return { revisar, info };
}

/**
 * Texto que la operadora puede copiar y mandarle al equipo técnico cuando —y
 * solo cuando— hay diferencias SIN explicación. Si todas están entendidas no
 * hay nada que reportar y el botón ni siquiera aparece.
 *
 * Acá sí van los documentos enmascarados: el técnico los necesita para ubicar
 * la fila en el .xlsm, que es todo lo que se le pide a ese identificador.
 */
export function textoParaReportar({ jornada, cargaId, archivo, cotejo }) {
  const lineas = [
    'Diferencias sin explicación entre el motor del portal y el archivo de cierre',
    `Jornada: ${jornada || '—'}`,
    `Carga: #${cargaId ?? '—'}`,
    `Archivo: ${archivo || '—'}`,
  ];
  if (cotejo?.comparaciones) {
    lineas.push(`Comparaciones: ${cotejo.comparaciones} · coinciden ${cotejo.coinciden ?? '—'}`
      + ` · con causa conocida ${cotejo.explicadasTotal} · sin explicación ${cotejo.sinExplicacion}`);
  }
  lineas.push('');

  const hayPorCampo = Boolean(cotejo?.porCampo?.length);
  if (hayPorCampo) {
    lineas.push('Sin explicación, por columna (conteo completo):');
    cotejo.porCampo.forEach((c) => lineas.push(`  · ${c.campo}: ${c.total}`));
    lineas.push('');
  }
  (cotejo?.ejemplos || []).forEach((g) => {
    const docs = g.documentos.length ? ` — ${g.documentos.join(', ')}` : '';
    lineas.push(`· ${g.campo}: el archivo dice «${g.enArchivo}» y el portal calculó `
      + `«${g.calculado}» — ${g.casos} ${g.casos === 1 ? 'caso' : 'casos'}${docs}`);
  });
  if (cotejo?.ejemplosNoListados > 0) {
    // Sin la lista por columna no se puede prometer que arriba esté el total:
    // en una carga guardada por el backend viejo ese conteo no viaja, y decirlo
    // igual mandaba al técnico a buscar una tabla que no existe.
    const n = cotejo.ejemplosNoListados;
    lineas.push('', `(hay ${n} ${n === 1 ? 'caso más' : 'casos más'} que el servidor no incluyó `
      + `en la muestra${hayPorCampo ? '; el conteo por columna de arriba sí es el total' : ''})`);
  }
  return lineas.join('\n');
}
