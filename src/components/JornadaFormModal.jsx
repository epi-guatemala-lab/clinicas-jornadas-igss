import { useEffect, useMemo, useState } from 'react';
import {
  apiListEmpresas, apiListPersonal, apiListJornadas,
  apiCreateJornada, apiUpdateJornada, apiSetCharlas, apiDisponibilidadPersonal,
  apiSorteoPropuesta, apiAnterioresEnRuta, apiGetJornada,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { fmtFecha, isoLocalDate, TIPOS_ACTIVIDAD_UI } from '../utils/format';
// Traductor ÚNICO de errores del backend (incluye el aplanado por campo de los
// 422 de Pydantic). Este archivo tenía su propia copia con el mismo nombre y
// semántica opuesta en el segundo argumento —texto por defecto acá, acción en
// infinitivo allá—, así que el mismo error se leía distinto según la pantalla.
import { mensajeDeError } from '../utils/apiError';
import { norm } from '../utils/norm';
import SearchableSelect from './filters/SearchableSelect';

const ROLES_JOR = ['LIDER', 'MEDICO', 'ADMIN', 'ENFERMERIA', 'NUTRICIONISTA', 'LABORATORISTA', 'DIGITADOR', 'ENCUESTADOR'];

// Estados de jornada en los que todavía tiene sentido armar el equipo. Una
// jornada cerrada o cancelada ya pasó: proponerle personal no es una ayuda.
const ESTADOS_SORTEABLES = ['PROGRAMADA', 'REPROGRAMADA'];

/**
 * Profesión del roster (`personal_igss.rol_default`, texto libre) → rol de
 * jornada del catálogo.
 *
 * El campo trae cosas como «Médico y cirujano», «ENFERMERA» o «Perito
 * Contador», así que el cotejo va por raíz y sin tildes (`norm`). Antes toda
 * fila nueva nacía como MEDICO, que es lo que después aparecía mal en el
 * listado de personal de la jornada.
 */
function rolPorDefecto(rolDefault) {
  const t = norm(rolDefault);
  // En el roster real hay perfiles que YA son roles del catálogo (ADMIN,
  // ENFERMERIA, LIDER…). ADMIN no contiene ninguna de las raíces de abajo y
  // caía en DIGITADOR, que es justo el error que esta función vino a evitar.
  if (ROLES_JOR.includes(t)) return t;
  if (t.includes('MEDIC')) return 'MEDICO';
  if (t.includes('ENFERM')) return 'ENFERMERIA';
  if (t.includes('NUTRI')) return 'NUTRICIONISTA';
  if (t.includes('LIDER')) return 'LIDER';
  return 'DIGITADOR';
}

/**
 * Fila de personal tal como la acepta el servidor.
 * Las llaves que empiezan con `_` son marcas de la pantalla (de dónde salió la
 * fila, si el rol se puso solo) y no tienen por qué viajar al backend.
 */
const filaPersonalPayload = (p) => ({
  personal_id: Number(p.personal_id),
  rol_jornada: p.rol_jornada,
  dias_asignados: p.dias_asignados ?? 1.0,
  funcion_extra: p.funcion_extra || null,
});

// Campos de texto que el navegador devuelve como '' cuando quedan vacíos. Sin
// convertirlos, la BD termina con cadenas vacías donde debería haber NULL y
// todo filtro o reporte tiene que preguntar por las dos cosas.
const TEXTOS_OPCIONALES = ['hora_inicio', 'hora_fin', 'tema', 'departamento', 'municipio',
  'zona', 'direccion', 'qr_link', 'transporte_ida_salida', 'transporte_ida_llegada',
  'transporte_regreso_salida', 'transporte_regreso_llegada'];

// Tramos del transporte. El servidor guarda «YYYY-MM-DD HH:MM» y el control
// `datetime-local` usa la `T`; se traduce en los dos sentidos.
const TRAMOS_TRANSPORTE = [
  ['transporte_ida_salida', 'Ida · salida'],
  ['transporte_ida_llegada', 'Ida · llegada'],
  ['transporte_regreso_salida', 'Regreso · salida'],
  ['transporte_regreso_llegada', 'Regreso · llegada'],
];
const aControl = (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');
const aServidor = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : null);
// Hora de fin cuando no se escribe: una jornada normal termina a mediodía y una
// con odontología a media tarde (la misma regla que aplica el servidor).
const horaFinPorDefecto = (f) => (f.odontologia ? '15:00' : '12:00');

/**
 * Charlas tal como vienen del servidor → filas del formulario.
 * `charla_tema` se CONSERVA: es el texto libre de las charlas antiguas (las que
 * no traen código de catálogo) y sin él, guardar cualquier edición las borraba,
 * porque el payload descartaba toda fila sin código.
 */
function charlasDesdeJornada(jornada) {
  return (jornada?.charlas || []).map((c) => ({
    charla_codigo: c.charla_codigo || '',
    charla_tema: c.charla_tema || '',
    responsable_personal_id: c.responsable_personal_id || '',
  }));
}

/** Filas del formulario → payload de charlas que acepta el servidor. */
function charlasPayload(lista) {
  return (lista || [])
    .filter((c) => c.charla_codigo || c.charla_tema)
    .map((c) => ({
      charla_codigo: c.charla_codigo || null,
      // Con código, el título lo deriva el servidor del catálogo (fuente única);
      // el texto libre solo viaja cuando NO hay código.
      charla_tema: c.charla_codigo ? null : (c.charla_tema || null),
      responsable_personal_id: c.responsable_personal_id ? Number(c.responsable_personal_id) : null,
    }));
}

/** Firma comparable del set de charlas, para saber si la sección cambió. */
const firmaCharlas = (lista) => JSON.stringify(charlasPayload(lista));

/**
 * Formulario de jornada — CREA (jornada=null) o EDITA (jornada=objeto hidratado).
 * En edición guarda los campos centrales (PUT /jornadas/{id}) y, por separado,
 * el set de charlas (PUT /jornadas/{id}/charlas). El backend gatea quién puede:
 * jornadas CERRADAS solo Berkin (E1); charlas solo editores de la sección (E2).
 */
export default function JornadaFormModal({ jornada = null, onClose, onSaved }) {
  const { user, canWrite } = useAuth();
  const isEdit = !!jornada;
  const [empresas, setEmpresas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [jornadasSipre, setJornadasSipre] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState({
    fecha_traslado_previo: null, conflictos: [],
  });
  const [consultandoDisponibilidad, setConsultandoDisponibilidad] = useState(false);
  const [err, setErr] = useState('');

  // ── Sorteo de personal ───────────────────────────────────────────
  // `sorteo` es la última propuesta que devolvió el servidor (cupos, faltantes,
  // avisos y el id de corrida que viaja al guardar). `excluidos` acumula a las
  // personas que quien programa fue descartando con el botón de cada fila: sin
  // acumularlas, volver a sortear podía devolver a la misma persona.
  //
  // `excluidos` SOBREVIVE a «Quitar propuestos»: descartar a alguien con el 🎲
  // de su fila es una decisión de quien programa, no parte de la propuesta que
  // ese botón deshace. Vaciarlo ahí hacía que el ciclo más natural del formulario
  // —«esta persona no» → «quitar propuestos» → «proponer equipo»— la devolviera
  // al equipo, con la sensación de que el sorteo la reponía a propósito. Se
  // limpia solo desde el chip «N personas descartadas · restablecer».
  const [sorteo, setSorteo] = useState(null);
  const [sorteando, setSorteando] = useState(false);
  const [excluidos, setExcluidos] = useState([]);
  // Ids que el sorteo propuso en algún momento de esta edición. La procedencia
  // se acumula acá y no se lee de la última respuesta: al volver a sortear una
  // fila, todas las demás viajan como FIJAS y el servidor las devuelve como
  // «manual» —correcto de su lado— y eso borraba el 🎲 de todo el equipo, dejaba
  // sin botón de re-sorteo y hacía que al guardar ya no se mandara la corrida.
  const [idsPropuestos, setIdsPropuestos] = useState(() => []);
  // Líder que había ANTES de la primera propuesta, para poder deshacerla entera.
  const [liderPrevio, setLiderPrevio] = useState(null);
  // Firma de los datos de los que salen los cupos al momento de la propuesta:
  // si cambian, lo que dice el bloque de resultado ya no es de esta jornada.
  const [sorteoPara, setSorteoPara] = useState(null);
  // Se incrementa tras cada propuesta para volver a pedir la agenda: el equipo
  // recién propuesto cambia quién queda libre en esas fechas.
  const [refrescoAgenda, setRefrescoAgenda] = useState(0);

  const [form, setForm] = useState(() => isEdit ? {
    tipo: jornada.tipo,
    seccion_responsable: jornada.seccion_responsable,
    empresa_id: jornada.empresa_id || null,
    modalidad: jornada.modalidad || 'PRESENCIAL',
    tema: jornada.tema || '',
    fecha_inicio: jornada.fecha_inicio,
    fecha_fin: jornada.fecha_fin || '',
    hora_inicio: jornada.hora_inicio || '',
    hora_fin: jornada.hora_fin || '',
    // Los horarios del transporte se hidratan por la misma razón que la
    // dirección: el PUT reemplaza la fila y, si no, cada edición los borraba.
    transporte_ida_salida: aControl(jornada.transporte_ida_salida),
    transporte_ida_llegada: aControl(jornada.transporte_ida_llegada),
    transporte_regreso_salida: aControl(jornada.transporte_regreso_salida),
    transporte_regreso_llegada: aControl(jornada.transporte_regreso_llegada),
    departamento: jornada.departamento || '',
    municipio: jornada.municipio || '',
    zona: jornada.zona || '',
    // Hidratar la dirección es obligatorio: el PUT REEMPLAZA la fila completa,
    // así que si no se lee de la jornada viaja vacía y cada edición borraba la
    // dirección del lugar donde se hace la actividad, sin que nadie la tocara.
    direccion: jornada.direccion || '',
    es_departamental: !!jornada.es_departamental,
    requiere_dia_traslado_previo: !!jornada.requiere_dia_traslado_previo,
    programados: jornada.programados ?? 0,
    aplica_kit_lab: !!jornada.aplica_kit_lab,
    tamizaje_vih: !!jornada.tamizaje_vih,
    vacunacion: !!jornada.vacunacion,
    // Hidratar los servicios NUEVOS es obligatorio: si no se leen de la jornada,
    // arrancan apagados y la primera edición apaga el flag que ya estaba puesto.
    odontologia: !!jornada.odontologia,
    nutricion: !!jornada.nutricion,
    qr_link: jornada.qr_link || '',
    inaugura_clinica: !!jornada.inaugura_clinica,
    inauguracion_jornada_id: jornada.inauguracion_jornada_id || null,
    lider_personal_id: jornada.lider_personal_id || null,
    viaticos_presupuesto: jornada.viaticos_presupuesto ?? 0,
    notas: jornada.notas || '',
    // Gerencia recibe `observaciones` en null (el servidor se las quita), así que
    // acá queda '' y la llave NO se manda al guardar — ver `submit`.
    observaciones: jornada.observaciones || '',
    personal: (jornada.personal || []).map((p) => ({
      personal_id: p.personal_id, rol_jornada: p.rol_jornada,
      dias_asignados: p.dias_asignados ?? 1.0, funcion_extra: p.funcion_extra || null,
    })),
    charlas: charlasDesdeJornada(jornada),
  } : {
    tipo: 'SIPRESALUD_JORNADA',
    seccion_responsable: 'SIPRESALUD',   // siempre SIPRESALUD (no se hacen jornadas CE)
    modalidad: 'PRESENCIAL',
    es_departamental: null, // se pregunta explícitamente; no asumir capital
    requiere_dia_traslado_previo: false,
    fecha_inicio: isoLocalDate(),
    hora_fin: '',
    transporte_ida_salida: '',
    transporte_ida_llegada: '',
    transporte_regreso_salida: '',
    transporte_regreso_llegada: '',
    programados: 0,
    aplica_kit_lab: true,
    tamizaje_vih: false,
    vacunacion: false,
    odontologia: false,
    nutricion: false,
    qr_link: '',
    inaugura_clinica: false,
    viaticos_presupuesto: 0,
    observaciones: '',
    personal: [],
    charlas: [],
  });

  // Foto de las charlas al abrir el modal: si al guardar no cambiaron, ni se
  // llama al endpoint. Cada llamada BORRA e inserta la tabla de charlas de la
  // jornada, y hacerlo en toda edición era reescribir datos ajenos sin motivo.
  const [charlasAlAbrir] = useState(() => firmaCharlas(charlasDesdeJornada(jornada)));

  useEffect(() => {
    apiListEmpresas({ activa: true }).then(setEmpresas);
    apiListPersonal({ activo: true }).then(setPersonal);
    apiListJornadas({ seccion: 'SIPRESALUD' }).then(setJornadasSipre);
  }, []);

  // La UI avisa y deshabilita personas ocupadas; el backend vuelve a validar al
  // guardar para cerrar la carrera entre dos usuarios que editan a la vez.
  useEffect(() => {
    if (!form.fecha_inicio) return undefined;
    let cancelled = false;
    setConsultandoDisponibilidad(true);
    apiDisponibilidadPersonal({
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || undefined,
      hora_inicio: form.hora_inicio || undefined,
      hora_fin: form.hora_fin || undefined,
      odontologia: !!form.odontologia,
      requiere_dia_traslado_previo: !!form.requiere_dia_traslado_previo,
      ...Object.fromEntries(TRAMOS_TRANSPORTE
        .filter(([k]) => form[k])
        .map(([k]) => [k, aServidor(form[k])])),
      jornada_id: isEdit ? jornada.id : undefined,
      seccion: form.seccion_responsable,
    }).then((d) => {
      if (!cancelled) setDisponibilidad(d || { fecha_traslado_previo: null, conflictos: [] });
    }).catch(() => {
      if (!cancelled) setDisponibilidad({ fecha_traslado_previo: null, conflictos: [] });
    }).finally(() => { if (!cancelled) setConsultandoDisponibilidad(false); });
    return () => { cancelled = true; };
  }, [form.fecha_inicio, form.fecha_fin, form.hora_inicio, form.hora_fin,
    form.odontologia, form.requiere_dia_traslado_previo, form.transporte_ida_salida,
    form.transporte_ida_llegada, form.transporte_regreso_salida,
    form.transporte_regreso_llegada, form.seccion_responsable, isEdit, jornada?.id,
    refrescoAgenda]);

  // `user?.rol`: si el token venció mientras el modal estaba abierto, el
  // contexto se vacía y leer `user.rol` a secas revienta el render — que es
  // justamente el error de pantalla en blanco que se está corrigiendo.
  const personalDisponible = personal.filter((p) =>
    (user?.rol === 'admin' || user?.rol === 'gerencia') ? true : p.seccion === form.seccion_responsable
  );
  // Índice del roster por id: hace falta para leer la profesión (`rol_default`)
  // de la persona que se acaba de elegir en una fila.
  const personalPorId = useMemo(() => {
    const m = new Map();
    for (const p of personal) m.set(Number(p.id), p);
    return m;
  }, [personal]);
  const conflictosPorPersona = useMemo(() => {
    const out = new Map();
    for (const c of disponibilidad.conflictos || []) {
      const id = Number(c.personal_id);
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(c);
    }
    return out;
  }, [disponibilidad]);

  const razonOcupado = (id) => (conflictosPorPersona.get(Number(id)) || [])
    .map((c) => c.detalle).join(' · ');

  function opcionesPersonal(actualId = null) {
    const elegidos = new Set((form.personal || []).map((p) => Number(p.personal_id)));
    return personalDisponible.map((p) => {
      const ocupado = conflictosPorPersona.has(Number(p.id));
      const repetido = elegidos.has(Number(p.id)) && Number(actualId) !== Number(p.id);
      return {
        value: p.id,
        label: `${p.nombre_completo} (${p.seccion})`,
        disabled: ocupado || repetido,
        description: ocupado ? razonOcupado(p.id) : (repetido ? 'Ya está agregado a esta jornada' : null),
      };
    });
  }

  const opcionesLider = personalDisponible.map((p) => ({
    value: p.id,
    label: `${p.nombre_completo} (${p.rol_default || 'sin rol'})`,
    disabled: conflictosPorPersona.has(Number(p.id)),
    description: razonOcupado(p.id) || null,
  }));

  const ocupadosSeleccionados = useMemo(() => {
    const ids = new Set((form.personal || []).map((p) => Number(p.personal_id)));
    if (form.lider_personal_id) ids.add(Number(form.lider_personal_id));
    return [...ids].filter((id) => conflictosPorPersona.has(id));
  }, [form.personal, form.lider_personal_id, conflictosPorPersona]);
  const fechaEsFutura = !!form.fecha_inicio && form.fecha_inicio > isoLocalDate();
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const { data: catCharlas } = useApi('/api/catalogos/charlas');
  const { data: deptosCat } = useApi('/api/catalogos/departamentos');
  const { data: munisCat } = useApi('/api/catalogos/municipios',
    { departamento: form.departamento || '' }, { enabled: !!form.departamento });

  function addCharla() { setField('charlas', [...form.charlas, { charla_codigo: '', charla_tema: '', responsable_personal_id: '' }]); }
  function updCharla(i, k, v) { const c = [...form.charlas]; c[i] = { ...c[i], [k]: v }; setField('charlas', c); }
  function removeCharla(i) { setField('charlas', form.charlas.filter((_, idx) => idx !== i)); }
  function addPersona() {
    const elegidos = new Set(form.personal.map((p) => Number(p.personal_id)));
    const primero = personalDisponible.find((p) =>
      !elegidos.has(Number(p.id)) && !conflictosPorPersona.has(Number(p.id)));
    if (!primero) {
      alert(`No hay más personal disponible en la sección ${form.seccion_responsable}`);
      return;
    }
    // `_rol_auto`: el rol lo puso la pantalla, no una persona. Mientras siga
    // así, cambiar de persona en la fila vuelve a derivarlo de su profesión.
    setField('personal', [...form.personal, {
      personal_id: primero.id,
      rol_jornada: rolPorDefecto(primero.rol_default),
      dias_asignados: 1.0,
      _rol_auto: true,
    }]);
  }
  function updPersona(i, k, v) {
    if (sorteando) return;
    const c = [...form.personal];
    const fila = { ...c[i], [k]: v };
    if (k === 'personal_id') {
      // Elegir otra persona en una fila cuyo rol se puso solo vuelve a
      // derivarlo: si no, una enfermera heredaba el «MEDICO» de quien estaba
      // antes. Y la fila deja de ser del sorteo: la eligió una persona.
      if (fila._rol_auto) {
        fila.rol_jornada = rolPorDefecto(personalPorId.get(Number(v))?.rol_default);
      }
      fila._origen = undefined;
      setIdsPropuestos((ids) => ids.filter((x) => x !== Number(c[i]?.personal_id)));
    }
    // Tocar el rol a mano lo congela, pero NO desengancha la fila del sorteo:
    // la persona sigue siendo la que el sorteo propuso, solo con otro rol.
    if (k === 'rol_jornada') fila._rol_auto = false;
    c[i] = fila;
    setField('personal', c);
  }
  function removePersona(i) {
    if (sorteando) return;
    const id = Number(form.personal[i]?.personal_id);
    setIdsPropuestos((ids) => ids.filter((x) => x !== id));
    setField('personal', form.personal.filter((_, idx) => idx !== i));
  }

  /**
   * Cuerpo de la jornada tal como lo espera el servidor, SIN las charlas (que
   * viajan por su propio endpoint) y sin las marcas internas de las filas.
   *
   * Lo comparten el guardado y el sorteo a propósito: es la MISMA jornada, y
   * tener dos copias del armado era garantizar que tarde o temprano se
   * separaran (el sorteo cotizaría cupos para una jornada distinta de la que
   * después se guarda).
   */
  function payloadBase() {
    const campos = { ...form };
    delete campos.charlas;
    const base = {
      ...campos,
      inaugura_clinica: form.tipo === 'INAUGURACION' || !!form.inaugura_clinica,
      programados: Number(form.programados) || 0,
      viaticos_presupuesto: Number(form.viaticos_presupuesto) || 0,
      empresa_id: form.empresa_id || null,
      lider_personal_id: form.lider_personal_id || null,
      fecha_fin: form.fecha_fin || null,
      inauguracion_jornada_id: form.tipo === 'INAUGURACION' ? (form.inauguracion_jornada_id || null) : null,
      personal: (form.personal || []).map(filaPersonalPayload),
      charla_tema: null,
      charla_responsable: null,
    };
    for (const k of TEXTOS_OPCIONALES) {
      if (k in base) base[k] = (typeof base[k] === 'string' ? base[k].trim() : base[k]) || null;
    }
    for (const [k] of TRAMOS_TRANSPORTE) base[k] = aServidor(base[k]);
    // Gerencia no ve las observaciones (el servidor se las devuelve en null),
    // así que si su formulario las mandara vacías borraría lo que escribió otro.
    // El servidor ya ignora la llave para ese rol; acá ni se envía.
    if (user?.rol === 'gerencia') delete base.observaciones;
    // `observaciones` NO entra en TEXTOS_OPCIONALES a propósito: al editar, el
    // servidor conserva el valor anterior cuando recibe null, así que mandar
    // null en vez de '' dejaría sin forma de BORRAR una observación. Al crear no
    // hay nada que conservar y sí conviene guardar NULL en vez de cadena vacía.
    if (!isEdit && 'observaciones' in base) base.observaciones = base.observaciones.trim() || null;
    return base;
  }

  // ── Sorteo: quién puede pedirlo y cuándo ─────────────────────────
  const hayPropuestos = (form.personal || []).some((p) => p._origen === 'sorteo');
  // Nombres de las personas descartadas, para el `title` del chip. Se resuelven
  // contra el roster ya cargado; si alguna no está (se desactivó mientras la
  // pantalla estaba abierta) se muestra su id antes que dejar un hueco mudo.
  const nombresExcluidos = excluidos
    .map((id) => personal.find((p) => Number(p.id) === Number(id))?.nombre_completo || `#${id}`)
    .join(', ');
  // Los cupos salen de estos seis datos: si alguno cambió después de sortear,
  // los faltantes y el «equipo mínimo» que se muestran son de otra jornada.
  const firmaCupos = (f) => JSON.stringify([f.fecha_inicio, f.fecha_fin,
    f.es_departamental, Number(f.programados) || 0, !!f.nutricion,
    !!f.requiere_dia_traslado_previo]);
  const sorteoDesactualizado = !!sorteo && sorteoPara !== firmaCupos(form);
  // ¿La propuesta dejó algo que atender —cupos sin cubrir, avisos, equipo
  // mínimo por presión del día, o una jornada que cambió después—? Solo
  // entonces el bloque se pinta en ámbar: un resultado limpio en color de
  // advertencia se lee como un error que no hubo.
  const hayQueMirar = !!sorteo && (
    sorteoDesactualizado
    || (sorteo.faltantes || []).length > 0
    || (sorteo.avisos || []).length > 0
    || sorteo.presion_dia?.cupo_usado === 'MINIMO');
  // El botón se muestra siempre que la jornada admita sorteo; la fecha entra en
  // el motivo de bloqueo y no en la visibilidad, para que borrarla explique qué
  // falta en vez de hacer desaparecer el botón del encabezado.
  const puedeSortear = !!canWrite
    && (!isEdit || ESTADOS_SORTEABLES.includes(jornada.estado));
  // Un solo motivo por vez, el primero que corresponda: el `title` del botón
  // tiene que decir QUÉ falta, no «no se puede».
  const motivoSorteoBloqueado = !form.fecha_inicio
    ? 'Indicá primero la fecha de inicio de la jornada.'
    : form.fecha_inicio < isoLocalDate()
      ? 'El sorteo es solo para jornadas de hoy en adelante.'
      : form.es_departamental == null
      ? 'Indicá primero si la jornada es departamental.'
      : sorteando
        ? 'Se está armando la propuesta…'
        : consultandoDisponibilidad
          ? 'Esperá a que termine de revisarse la agenda del personal.'
          : '';
  const sorteoDeshabilitado = !!motivoSorteoBloqueado;

  /**
   * Pide una propuesta de equipo y la vuelca en el formulario.
   *
   * @param {{fijos?:Array, excluir?:number[]}} opts
   *   `fijos` = filas que se conservan tal cual (por defecto, las que ya están);
   *   `excluir` = personas descartadas a mano, acumuladas entre llamadas;
   *   `lider` = líder fijo (se pasa `null` para pedir que el sorteo elija otra).
   */
  async function proponerEquipo({ fijos = form.personal, excluir = excluidos,
    lider = form.lider_personal_id } = {}) {
    if (!puedeSortear || sorteoDeshabilitado) return false;
    setErr('');
    setSorteando(true);
    const esLaPrimera = !sorteo;
    try {
      const d = await apiSorteoPropuesta({
        ...payloadBase(),
        charlas: charlasPayload(form.charlas),
        jornada_id: isEdit ? jornada.id : null,
        personal: (fijos || []).map(filaPersonalPayload),
        lider_personal_id: lider || null,
        modo: 'COMPLETAR',
        excluir_personal_ids: excluir,
      });
      if (esLaPrimera) setLiderPrevio(form.lider_personal_id || null);
      setSorteo(d);
      setSorteoPara(firmaCupos(form));
      // Las filas que mandé como fijas vuelven TAL CUAL: el servidor solo emite
      // seis roles de catálogo, así que aceptar su versión de una fila puesta a
      // mano le cambiaba el rol (ADMIN y LABORATORISTA volvían como DIGITADOR o
      // ENCUESTADOR) y la marcaba como automática, sin avisar y para guardarla.
      const fijas = new Map((fijos || []).map((p) => [Number(p.personal_id), p]));
      const devueltos = (d.personal || []).map((p) => Number(p.personal_id));
      // Procedencia acumulada: lo que NO mandé como fijo lo puso el sorteo, más
      // lo que ya venía de una propuesta anterior y sigue en el equipo.
      const delSorteo = new Set([
        ...idsPropuestos.filter((id) => devueltos.includes(id)),
        ...devueltos.filter((id) => !fijas.has(id)),
      ]);
      setIdsPropuestos([...delSorteo]);
      setForm((f) => ({
        ...f,
        lider_personal_id: d.lider_personal_id ?? null,
        personal: (d.personal || []).map((p) => {
          const id = Number(p.personal_id);
          if (fijas.has(id)) {
            const fija = fijas.get(id);
            return delSorteo.has(id) ? { ...fija, _origen: 'sorteo' } : fija;
          }
          return {
            personal_id: id,
            rol_jornada: p.rol_jornada,
            dias_asignados: p.dias_asignados ?? 1.0,
            funcion_extra: p.funcion_extra || null,
            _origen: 'sorteo',
            _rol_auto: true,
          };
        }),
      }));
      // El equipo recién propuesto cambia quién queda libre esas fechas: se
      // vuelve a pedir la agenda para que la pantalla no muestre datos viejos.
      setRefrescoAgenda((n) => n + 1);
      return true;
    } catch (e2) {
      setErr(mensajeDeError(e2, 'proponer el equipo'));
      return false;
    } finally {
      setSorteando(false);
    }
  }

  /** «Esta persona no» — la descarta y vuelve a sortear solo esa fila. */
  function volverASortear(i) {
    const id = Number(form.personal[i]?.personal_id);
    if (!id) return;
    const nuevos = excluidos.includes(id) ? excluidos : [...excluidos, id];
    // Si a quien se descarta es la líder, hay que soltar además el puesto de
    // líder: mandarlo fijo la devolvía al equipo y el botón no hacía nada.
    const eraLider = Number(form.lider_personal_id) === id;
    // La exclusión se anota DESPUÉS y solo si el sorteo corrió: si la llamada
    // falla (o ni sale), la persona seguía en el equipo pero ya no se la podía
    // volver a proponer, y nada lo explicaba.
    proponerEquipo({
      fijos: form.personal.filter((_, idx) => idx !== i),
      excluir: nuevos,
      lider: eraLider ? null : form.lider_personal_id,
    }).then((ok) => { if (ok) setExcluidos(nuevos); });
  }

  /**
   * Deshace la propuesta entera y deja el equipo como estaba.
   *
   * NO toca `excluidos`: a quien se descartó con el 🎲 de su fila se lo
   * descartó a mano, y este botón deshace lo que propuso el sorteo, no las
   * decisiones de quien programa. El chip de al lado dice cuántas hay y es el
   * único lugar desde donde se restablecen.
   */
  function quitarPropuestos() {
    setForm((f) => ({
      ...f,
      personal: (f.personal || []).filter((p) => p._origen !== 'sorteo'),
      lider_personal_id: liderPrevio,
    }));
    setSorteo(null);
    setSorteoPara(null);
    setIdsPropuestos([]);
    setLiderPrevio(null);
    setRefrescoAgenda((n) => n + 1);
  }

  /**
   * Vuelve a permitir que el sorteo proponga a las personas descartadas.
   *
   * No re-sortea: quien programa decide cuándo pedir la propuesta nueva. Si hay
   * una propuesta en pantalla queda igual —esas personas no estaban en ella—,
   * así que no hay nada que recalcular hasta el próximo «Proponer».
   */
  function restablecerDescartados() {
    setExcluidos([]);
  }

  // ── Copiar el equipo de la jornada anterior (en ruta) ─────────────
  // `anteriores` = null (cerrado) o la lista de jornadas de las que se puede
  // copiar. Copiar no salta ningún chequeo: la agenda se revisa igual y el
  // servidor vuelve a validar al guardar.
  const [anteriores, setAnteriores] = useState(null);
  const [buscandoAnteriores, setBuscandoAnteriores] = useState(false);
  async function abrirAnteriores() {
    if (!form.fecha_inicio) { setErr('Indicá primero la fecha de inicio de la jornada.'); return; }
    setErr('');
    setBuscandoAnteriores(true);
    try {
      setAnteriores(await apiAnterioresEnRuta({
        fecha_inicio: form.fecha_inicio,
        seccion: form.seccion_responsable,
        jornada_id: isEdit ? jornada.id : undefined,
      }) || []);
    } catch (e2) {
      setErr(mensajeDeError(e2, 'buscar la jornada anterior'));
    } finally {
      setBuscandoAnteriores(false);
    }
  }
  async function copiarEquipoDe(id) {
    if (form.personal.length > 0
        && !window.confirm('La jornada ya tiene personal asignado. ¿Reemplazarlo por el equipo de la jornada anterior?')) {
      return;
    }
    try {
      const previa = await apiGetJornada(id);
      const dias = form.fecha_fin && form.fecha_fin > form.fecha_inicio
        ? (new Date(form.fecha_fin) - new Date(form.fecha_inicio)) / 86400000 + 1 : 1;
      setForm((f) => ({
        ...f,
        lider_personal_id: previa.lider_personal_id || null,
        personal: (previa.personal || []).map((p) => ({
          personal_id: p.personal_id,
          rol_jornada: p.rol_jornada,
          dias_asignados: dias,
          funcion_extra: p.funcion_extra || null,
        })),
      }));
      setIdsPropuestos([]);
      setSorteo(null);
      setSorteoPara(null);
      setAnteriores(null);
      setRefrescoAgenda((n) => n + 1);
    } catch (e2) {
      setErr(mensajeDeError(e2, 'copiar el equipo'));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (form.es_departamental == null) {
      setErr('Indicá si la jornada es departamental (fuera de la capital).');
      return;
    }
    if (ocupadosSeleccionados.length > 0) {
      setErr('Hay personal ocupado en una jornada o traslado para estas fechas. Quitalo o cambiá la programación.');
      return;
    }
    // `charlas` sale del cuerpo de la jornada: el PUT las IGNORA a propósito
    // (viajan por su propio endpoint) y mandarlas era el origen del 422 —
    // un responsable vacío ('') que el modelo espera como entero.
    const base = payloadBase();
    // Trazabilidad del sorteo: solo si en la jornada quedó al menos una persona
    // que propuso el sorteo. Le sirve al servidor para marcar esa corrida como
    // adoptada y anotar qué se cambió; es inocuo si la corrida ya no existe.
    if (sorteo?.corrida_id && hayPropuestos) base.sorteo_corrida_id = sorteo.corrida_id;

    const charlas = charlasPayload(form.charlas);
    try {
      if (isEdit) {
        await apiUpdateJornada(jornada.id, base);
        // Solo si la sección de charlas cambió (ver `charlasAlAbrir`).
        if (JSON.stringify(charlas) !== charlasAlAbrir) {
          await apiSetCharlas(jornada.id, charlas);
        }
      } else {
        await apiCreateJornada({ ...base, charlas });
      }
      onSaved?.();
    } catch (e2) {
      setErr(mensajeDeError(
        e2, isEdit ? 'guardar los cambios' : 'crear la actividad'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-line dark:shadow-glow-accent" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="border-b border-line-subtle p-4">
            <h2 className="text-xl font-bold">{isEdit ? `Editar jornada ${jornada.codigo}` : 'Nueva jornada'}</h2>
            {isEdit && jornada.estado === 'CERRADA' && (
              <p className="text-xs text-warning mt-1">Editando una jornada CERRADA (acción reservada al coordinador).</p>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Actividad *</label>
                <select className="input" value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                  {TIPOS_ACTIVIDAD_UI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></div>
              <div><label className="label">Sección responsable *</label>
                {/* Siempre SIPRESALUD (no se hacen jornadas CE) — fuente Berkin. */}
                <select className="input" value="SIPRESALUD" disabled
                  onChange={(e) => setField('seccion_responsable', e.target.value)}>
                  <option value="SIPRESALUD">SIPRESALUD</option>
                </select></div>
              <div><label className="label">Empresa</label>
                <SearchableSelect value={form.empresa_id || ''}
                  onChange={(v) => setField('empresa_id', v ? Number(v) : null)}
                  placeholder="— Sin empresa (webinar/oficina) —"
                  options={empresas.map((e) => ({ value: e.id, label: e.nombre_legal }))} />
              </div>
              {/* Sin casilla «Tema»: al crear, el servidor lo deriva (empresa,
                  primera charla o la actividad). En edición el valor que ya
                  tenga la jornada viaja intacto en `form.tema` y se conserva. */}
              <div><label className="label">Fecha inicio *</label>
                <input className="input" type="date" value={form.fecha_inicio}
                  onChange={(e) => setField('fecha_inicio', e.target.value)} required /></div>
              <div><label className="label">Fecha fin</label>
                <input className="input" type="date" value={form.fecha_fin || ''}
                  onChange={(e) => setField('fecha_fin', e.target.value)} /></div>
              <div><label className="label">Hora inicio</label>
                <input className="input" type="time" value={form.hora_inicio || ''}
                  onChange={(e) => setField('hora_inicio', e.target.value)} /></div>
              <div><label className="label">Hora de finalización</label>
                <input className="input" type="time" value={form.hora_fin || ''}
                  onChange={(e) => setField('hora_fin', e.target.value)} />
                {!form.hora_fin && (
                  <span className="block text-[11px] text-fg-subtle mt-0.5">
                    Si se deja vacía: {horaFinPorDefecto(form)}
                    {form.odontologia ? ' (jornada con odontología)' : ' (jornada normal)'}.
                  </span>
                )}</div>
              <div><label className="label">Modalidad</label>
                <select className="input" value={form.modalidad} onChange={(e) => setField('modalidad', e.target.value)}>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="VIRTUAL">Virtual</option>
                  <option value="MIXTA">Mixta</option>
                </select></div>
              <div><label className="label">Afiliados proyectados</label>
                <input className="input" type="number" min="0" value={form.programados}
                  onChange={(e) => setField('programados', e.target.value)} /></div>
              <div><label className="label">Departamento</label>
                <select className="input" value={form.departamento || ''}
                  onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value, municipio: '' }))}>
                  <option value="">— Seleccione —</option>
                  {(deptosCat?.items || []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div><label className="label">Municipio</label>
                <select className="input" value={form.municipio || ''}
                  onChange={(e) => setField('municipio', e.target.value)}>
                  <option value="">{form.departamento ? '— Seleccione —' : '(elija departamento)'}</option>
                  {(munisCat?.items || []).map((m) => <option key={m} value={m}>{m}</option>)}
                </select></div>
              <div><label className="label">Zona</label>
                <input className="input" value={form.zona || ''} onChange={(e) => setField('zona', e.target.value)} /></div>
              <div><label className="label">Viáticos presupuesto (Q)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.viaticos_presupuesto}
                  onChange={(e) => setField('viaticos_presupuesto', e.target.value)} /></div>
              {/* Cierra el bloque de ubicación (departamento/municipio/zona): es
                  la dirección exacta del lugar donde se monta la actividad, la
                  que necesita el equipo para llegar. Va acá abajo, a lo ancho,
                  porque no cabe en media columna. */}
              <div className="col-span-2"><label className="label">Dirección</label>
                <input className="input" value={form.direccion || ''}
                  placeholder="Dirección exacta del lugar de la actividad"
                  onChange={(e) => setField('direccion', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Líder de jornada</label>
                <SearchableSelect value={form.lider_personal_id || ''}
                  onChange={(v) => setField('lider_personal_id', v ? Number(v) : null)}
                  placeholder="— Sin líder asignado —"
                  options={opcionesLider} />
              </div>
            </div>

            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="label">¿La jornada es departamental? *</label>
                  <select className="input" required
                    value={form.es_departamental == null ? '' : (form.es_departamental ? 'SI' : 'NO')}
                    onChange={(e) => {
                      const es = e.target.value === '' ? null : e.target.value === 'SI';
                      setForm((f) => ({
                        ...f,
                        es_departamental: es,
                        requiere_dia_traslado_previo: es ? f.requiere_dia_traslado_previo : false,
                      }));
                    }}>
                    <option value="">— Seleccione —</option>
                    <option value="NO">No, se realiza en la capital</option>
                    <option value="SI">Sí, se realiza fuera de la capital</option>
                  </select>
                </div>
                {form.es_departamental === true && !form.transporte_ida_salida && (
                  <label className="flex items-start gap-2 rounded-md border border-line bg-surface p-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5"
                      checked={!!form.requiere_dia_traslado_previo}
                      disabled={!fechaEsFutura && !form.requiere_dia_traslado_previo}
                      onChange={(e) => setField('requiere_dia_traslado_previo', e.target.checked)} />
                    <span>
                      <span className="block font-semibold">🚐 Requiere día de traslado previo</span>
                      <span className="block text-xs text-fg-muted">
                        {fechaEsFutura || form.requiere_dia_traslado_previo
                          ? 'Sin horario de transporte, bloquea a todo el equipo el día anterior completo.'
                          : 'Disponible únicamente para jornadas futuras.'}
                      </span>
                    </span>
                  </label>
                )}
              </div>
              {form.es_departamental != null && (
                <div>
                  <div className="text-sm font-semibold text-fg">
                    🚐 Horario del transporte <span className="text-fg-subtle font-normal">(salida y llegada de cada tramo)</span>
                  </div>
                  <p className="text-xs text-fg-muted mb-2">
                    El equipo queda ocupado desde que sale hasta que regresa. Con el horario
                    documentado se puede asignar a alguien a otra jornada que termine antes de
                    la salida o que empiece después del regreso.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TRAMOS_TRANSPORTE.map(([k, etiqueta]) => (
                      <div key={k}><label className="label">{etiqueta}</label>
                        <input className="input" type="datetime-local" value={form[k] || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((f) => {
                              const nuevo = { ...f, [k]: v };
                              // La fecha de salida dice si hay día de traslado previo.
                              if (k === 'transporte_ida_salida' && v && f.fecha_inicio) {
                                nuevo.requiere_dia_traslado_previo = v.slice(0, 10) < f.fecha_inicio;
                              }
                              return nuevo;
                            });
                          }} /></div>
                    ))}
                  </div>
                </div>
              )}
              {form.requiere_dia_traslado_previo && disponibilidad.fecha_traslado_previo && (
                <div className="rounded-md bg-info-soft px-3 py-2 text-sm text-info">
                  🚐 Traslado programado para el <b>{fmtFecha(disponibilidad.fecha_traslado_previo)}</b>
                  {form.transporte_ida_salida
                    ? <> a las <b>{form.transporte_ida_salida.slice(11, 16)}</b>. Ese día el personal queda
                      ocupado desde la salida; antes puede atender otra actividad.</>
                    : <>. Ese día aparecerá en el calendario y el personal no podrá asignarse a otra actividad.</>}
                </div>
              )}
            </div>

            {/* Charlas de educación en salud — MÚLTIPLES, desde catálogo */}
            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-fg">
                  Charlas de educación en salud <span className="text-fg-subtle font-normal">(opcional · múltiples)</span>
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={addCharla}>+ Agregar charla</button>
              </div>
              {form.charlas.length === 0 && <div className="text-xs text-fg-subtle">Sin charlas.</div>}
              <div className="space-y-2">
                {form.charlas.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <select className="input" value={c.charla_codigo}
                        onChange={(e) => updCharla(i, 'charla_codigo', e.target.value)}>
                        <option value="">— Tema (catálogo) —</option>
                        {(catCharlas?.items || []).map((o) => (
                          <option key={o.codigo} value={o.codigo}>{o.codigo} · {o.titulo}</option>
                        ))}
                      </select>
                      {/* Charla vieja de texto libre (anterior al catálogo): el
                          desplegable no la puede representar y sin este aviso la
                          fila se ve vacía. Se conserva tal cual al guardar. */}
                      {!c.charla_codigo && c.charla_tema && (
                        <div className="text-[11px] text-fg-subtle mt-1 truncate" title={c.charla_tema}>
                          Tema escrito a mano: «{c.charla_tema}» — se conserva.
                        </div>
                      )}
                    </div>
                    <SearchableSelect value={c.responsable_personal_id || ''}
                      onChange={(v) => updCharla(i, 'responsable_personal_id', v)}
                      placeholder="— Responsable —"
                      options={personalDisponible.map((p) => ({ value: p.id, label: p.nombre_completo }))} />
                    <button type="button" className="text-danger px-2" title="Quitar" onClick={() => removeCharla(i)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Servicios que se prestan durante la actividad. Van en su propio
                recuadro (el mismo del panel de charlas) para que se lean como un
                bloque: sueltas, las casillas se confundían con la de inauguración,
                que NO es un servicio y por eso queda fuera. Estos flags son los
                que el calendario pinta como emojis en el chip de cada evento. */}
            <div className="rounded-lg border border-line-subtle bg-surface-elev p-3">
              <div className="text-sm font-semibold text-fg mb-2">
                Servicios de la actividad <span className="text-fg-subtle font-normal">(opcional · varios)</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.aplica_kit_lab}
                    onChange={(e) => setField('aplica_kit_lab', e.target.checked)} />
                  🧪 Laboratorio
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.tamizaje_vih}
                    onChange={(e) => setField('tamizaje_vih', e.target.checked)} />
                  🩸 Tamizaje VIH
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.vacunacion}
                    onChange={(e) => setField('vacunacion', e.target.checked)} />
                  💉 Vacunación
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.odontologia}
                    onChange={(e) => setField('odontologia', e.target.checked)} />
                  🦷 Odontología
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.nutricion}
                    onChange={(e) => setField('nutricion', e.target.checked)} />
                  🥕 Nutrición
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {form.tipo === 'INAUGURACION' ? (
                <span className="text-success font-medium flex items-center gap-1">🎉 Inaugura clínica permanente (automático por tipo)</span>
              ) : (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.inaugura_clinica}
                    onChange={(e) => setField('inaugura_clinica', e.target.checked)} />
                  ✂️ Esta jornada también inaugura una clínica
                </label>
              )}
            </div>

            <div><label className="label">QR Link (encuesta)</label>
              <input className="input" type="url" inputMode="url" placeholder="https://… (link de la encuesta)"
                value={form.qr_link || ''} onChange={(e) => setField('qr_link', e.target.value)} /></div>

            {form.tipo === 'INAUGURACION' && (
              <div className="bg-warning-soft border-l-4 border-warning p-3 rounded">
                <label className="label">Jornada SIPRESALUD asociada</label>
                <SearchableSelect value={form.inauguracion_jornada_id || ''}
                  onChange={(v) => setField('inauguracion_jornada_id', v ? Number(v) : null)}
                  placeholder="— Sin asociar (generará alerta roja) —"
                  options={jornadasSipre.map((j) => ({ value: j.id, label: `${j.codigo} · ${j.fecha_inicio} · ${(j.empresa_nombre || j.tema || '').slice(0, 35)}` }))} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <h3 className="font-semibold">Personal asignado</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {consultandoDisponibilidad && <span className="text-xs text-fg-muted">Revisando agenda…</span>}
                  {/* Las personas descartadas con el 🎲 de su fila siguen fuera
                      aunque se quiten los propuestos, así que tienen que estar a
                      la vista: sin este chip la exclusión era invisible y quien
                      programa no tenía forma de deshacerla. Se muestra también
                      cuando ya no hay propuesta en pantalla —es justo cuando más
                      falta hace— y el `title` dice de quiénes se trata. */}
                  {excluidos.length > 0 && (
                    <span className="text-xs text-fg-muted flex items-center gap-1 rounded bg-surface-elev px-1.5 py-0.5"
                      title={`El sorteo no va a proponer a: ${nombresExcluidos}`}>
                      {excluidos.length === 1
                        ? '1 persona descartada'
                        : `${excluidos.length} personas descartadas`}
                      <span aria-hidden="true">·</span>
                      <button type="button" className="text-accent hover:underline disabled:text-fg-subtle"
                        disabled={sorteando}
                        title="Vuelve a permitir que el sorteo las proponga. No re-sortea: para eso, pulsá «Proponer equipo»."
                        onClick={restablecerDescartados}>restablecer</button>
                    </span>
                  )}
                  {hayPropuestos && (
                    <button type="button" className="text-fg-muted text-xs hover:underline"
                      onClick={quitarPropuestos}>Quitar propuestos</button>
                  )}
                  {puedeSortear && (
                    <button type="button" className="btn-secondary text-xs"
                      disabled={sorteoDeshabilitado}
                      title={motivoSorteoBloqueado
                        || 'Propone el equipo entre el personal disponible en esas fechas.'}
                      onClick={() => proponerEquipo()}>
                      {sorteando
                        ? '🎲 Armando la propuesta…'
                        : (form.personal.length > 0 ? '🎲 Completar cupos' : '🎲 Proponer equipo')}
                    </button>
                  )}
                  {canWrite && (
                    <button type="button" className="btn-secondary text-xs"
                      disabled={sorteando || buscandoAnteriores}
                      title="Trae el equipo de una jornada que termina el mismo día o hasta dos días antes, para cuando el equipo va en ruta."
                      onClick={abrirAnteriores}>
                      {buscandoAnteriores ? '🚌 Buscando…' : '🚌 Copiar equipo de la jornada anterior'}
                    </button>
                  )}
                  <button type="button" className="text-accent text-sm hover:underline"
                    disabled={sorteando} onClick={addPersona}>+ Añadir persona</button>
                </div>
              </div>
              {anteriores && (
                <div className="mb-2 rounded-md border border-line bg-surface-elev p-2 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">¿De qué jornada copiar el equipo?</span>
                    <button type="button" className="text-fg-muted text-xs hover:underline"
                      onClick={() => setAnteriores(null)}>Cerrar</button>
                  </div>
                  {anteriores.length === 0 ? (
                    <div className="text-xs text-fg-muted">
                      No hay jornadas con equipo que terminen el mismo día o en los dos días anteriores.
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {anteriores.map((a) => (
                        <li key={a.id}>
                          <button type="button"
                            className="w-full text-left rounded px-2 py-1 hover:bg-surface"
                            onClick={() => copiarEquipoDe(a.id)}>
                            <b>{a.codigo}</b> · {fmtFecha(a.fecha_fin || a.fecha_inicio)}
                            {' · '}{a.empresa || a.municipio || a.departamento || 'sin lugar'}
                            {' · '}{a.n_equipo === 1 ? '1 persona' : `${a.n_equipo} personas`}
                            {a.lider_nombre ? ` · lidera ${a.lider_nombre}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {ocupadosSeleccionados.length > 0 && (
                <div className="mb-2 rounded-md border border-danger/40 bg-danger-soft p-2 text-xs text-danger">
                  Hay personal seleccionado que ya está ocupado en estas fechas. Quitalo o cambiá la programación antes de guardar.
                </div>
              )}
              {/* Mientras se arma la propuesta las filas quedan inertes: la
                  respuesta reemplaza el equipo entero, así que lo que se tocara
                  en esos segundos (con la VPN del IGSS no son milisegundos) se
                  perdía sin un solo mensaje. */}
              <fieldset disabled={sorteando} className="space-y-2 min-w-0">
                {form.personal.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center bg-surface-elev p-2 rounded">
                    {p._origen === 'sorteo' && (
                      <span className="shrink-0 rounded bg-accent-soft text-accent text-xs px-1.5 py-1"
                        role="img" aria-label="Propuesto por el sorteo"
                        title="Esta persona la propuso el sorteo">🎲</span>
                    )}
                    <SearchableSelect className="flex-1" value={p.personal_id}
                      onChange={(v) => updPersona(i, 'personal_id', Number(v))}
                      allowEmpty={false}
                      options={opcionesPersonal(p.personal_id)} />
                    <select className="input w-32" value={p.rol_jornada}
                      onChange={(e) => updPersona(i, 'rol_jornada', e.target.value)}>
                      {ROLES_JOR.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="input w-20" type="number" step="0.5" min="0.5" value={p.dias_asignados}
                      onChange={(e) => updPersona(i, 'dias_asignados', Number(e.target.value))} title="Días asignados" />
                    {puedeSortear && p._origen === 'sorteo' && (
                      <button type="button" className="text-accent text-sm px-1 disabled:text-fg-subtle"
                        disabled={sorteoDeshabilitado}
                        aria-label="Proponer a otra persona para esta fila"
                        title={motivoSorteoBloqueado
                          || 'Proponer a otra persona para esta fila'}
                        onClick={() => volverASortear(i)}>🎲</button>
                    )}
                    <button type="button" className="text-danger text-sm" onClick={() => removePersona(i)}>✕</button>
                  </div>
                ))}
                {form.personal.length === 0 && <div className="text-fg-subtle text-sm">Sin personal asignado</div>}
              </fieldset>

              {/* Resultado de la última propuesta: lo que faltó, lo que hay que
                  mirar y cómo se armó. Va debajo de las filas porque se lee
                  DESPUÉS del equipo, no antes. */}
              {sorteo && (
                <div className={`mt-2 rounded p-3 text-sm border-l-4 ${
                  hayQueMirar
                    ? 'bg-warning-soft border-warning text-warning'
                    : 'bg-surface-elev border-line text-fg-muted'}`}>
                  {sorteoDesactualizado && (
                    <div className="mb-1">
                      La jornada cambió después de esta propuesta: volvé a sortear
                      para recalcular los cupos.
                    </div>
                  )}
                  {(sorteo.faltantes || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-0.5">
                      {sorteo.faltantes.map((f, i) => (
                        <li key={`falta-${i}`}>{f.mensaje}</li>
                      ))}
                    </ul>
                  )}
                  {(sorteo.avisos || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-0.5 mt-1">
                      {sorteo.avisos.map((a, i) => <li key={`aviso-${i}`}>{a}</li>)}
                    </ul>
                  )}
                  {sorteo.presion_dia?.cupo_usado === 'MINIMO' && (
                    <div className="mt-1">
                      Ese día hay {sorteo.presion_dia.sin_equipo}{' '}
                      {sorteo.presion_dia.sin_equipo === 1 ? 'jornada más' : 'jornadas más'} sin
                      equipo: se propuso el equipo mínimo.
                    </div>
                  )}
                  {/* El botón «Proponer equipo» es idempotente: con los mismos
                      datos, los mismos fijos y los mismos descartados, el
                      servidor arma el mismo equipo. Hay que decirlo, porque el
                      reflejo natural ante una propuesta que no convence es
                      pulsarlo otra vez a ver si sale distinta, y así solo se
                      gastan corridas contra el tope por hora. La vía real para
                      cambiar a alguien es el 🎲 de su fila.
                      No se muestra cuando la propuesta quedó desactualizada:
                      ahí los datos de la jornada cambiaron y volver a proponer
                      sí devuelve otro equipo, así que la frase sería falsa. */}
                  {!sorteoDesactualizado && (
                    <div className="text-xs text-fg-subtle mt-2">
                      Volver a proponer da el mismo equipo. Para cambiar a alguien,
                      usá el 🎲 de su fila.
                    </div>
                  )}
                  {sorteo.explicacion && (
                    <div className="text-xs text-fg-subtle mt-2">{sorteo.explicacion}</div>
                  )}
                </div>
              )}
            </div>

            <textarea className="input" rows="2" placeholder="Notas internas (opcional)"
              value={form.notas || ''} onChange={(e) => setField('notas', e.target.value)} />

            {/* Observaciones de campo. A Gerencia el servidor se las devuelve en
                null en TODAS partes (ficha, listados, tableros, bitácora), así
                que a ese rol ni se le ofrece el campo: lo vería siempre vacío y
                al guardar borraría lo que escribió otra persona. */}
            {user?.rol !== 'gerencia' && (
              <div>
                <label className="label">Observaciones (no visible para Gerencia)</label>
                <textarea className="input" rows="2"
                  placeholder="Observaciones de la actividad — las ven SIPRESALUD, Clínicas de Empresa y administración."
                  value={form.observaciones || ''}
                  onChange={(e) => setField('observaciones', e.target.value)} />
              </div>
            )}

            {err && <div className="bg-danger-soft text-danger p-2 rounded text-sm whitespace-pre-wrap">{err}</div>}
          </div>
          <div className="border-t border-line-subtle p-3 flex justify-end gap-2 bg-surface-elev">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{isEdit ? 'Guardar cambios' : 'Crear jornada'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
