import {
  BarChart, Bar, Line, ComposedChart, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { useThemedColors } from '../theme/useThemedColors';
import { useChartTheme } from './charts/useChartTheme';
import ThemedTooltip from './charts/ThemedTooltip';
import MiniChartCard from './cards/MiniChartCard';
import AlertBanner from './cards/AlertBanner';
import { fmtQ, fmtN } from '../utils/format';

function useChartData(path, params = {}) {
  const r = useApi(`/api/charts/${path}`, params);
  return { data: r.data, err: r.error, loading: r.loading };
}

function tipoDisplay(t) {
  return {
    CE_JORNADA: { label: 'Jornada CE', tone: t.accent.tertiary },
    SIPRESALUD_JORNADA: { label: 'Jornada SIPRESALUD', tone: t.accent.secondary },
    INAUGURACION_CON_JORNADA: { label: 'Inauguración (coordinada)', tone: t.status.success },
    INAUGURACION_SIN_JORNADA: { label: '⚠️ Inauguración SIN jornada', tone: t.status.danger },
    TALLER: { label: 'Taller', tone: t.accent.primary },
    WEBINAR: { label: 'Webinar', tone: t.chart.series[6] },
    VISITA_SEGUIMIENTO: { label: 'Visita seguimiento', tone: t.status.info },
    INFORME_OFICINA: { label: 'Informe/Oficina', tone: t.status.neutral },
  };
}

const ESTADO_KEY_COLOR = (t) => ({
  PROGRAMADA: t.status.neutral,
  EN_CURSO: t.status.info,
  EJECUTADA: t.status.warning,
  CERRADA: t.status.success,
  CANCELADA: t.status.danger,
  REPROGRAMADA: t.status.warning,
});

function semKeyToColor(t, sem) {
  if (sem === 'verde') return t.status.success;
  if (sem === 'naranja' || sem === 'amarillo') return t.status.warning;
  if (sem === 'rojo') return t.status.danger;
  if (sem === 'azul') return t.status.info;
  return t.status.neutral;
}

// ───────────────────────────── 12 meses ─────────────────────────────
export function Serie12MesesChart() {
  const { data, err, loading } = useChartData('serie-12-meses');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  return (
    <MiniChartCard
      title="Tendencia últimos 12 meses"
      subtitle="Pacientes atendidos vs programados"
      height={260}
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && (!data || data.length === 0)}
    >
      {data && data.length > 0 && (
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="mes" {...ct.axisProps} />
            <YAxis {...ct.axisProps} />
            <Tooltip content={<ThemedTooltip formatter={(v) => fmtN(v)} />} />
            <Legend {...ct.legendProps} />
            <Area type="monotone" dataKey="programados" name="Programados"
                  stroke={t.status.neutral} fill={t.status.neutral} fillOpacity={0.18} />
            <Area type="monotone" dataKey="atendidos" name="Atendidos"
                  stroke={t.accent.tertiary} fill={t.accent.tertiary} fillOpacity={0.5} />
            <Line type="monotone" dataKey="afiliados" name="Afiliados atendidos"
                  stroke={t.accent.secondary} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────────────── tipos jornada ────────────────────────
export function TiposJornadaChart() {
  const { data, err, loading } = useChartData('tipos-jornada');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const DISP = tipoDisplay(t);
  const fmt = (data || []).map((d) => {
    const m = DISP[d.tipo] || { label: d.tipo.replace(/_/g, ' '), tone: t.status.neutral };
    return {
      name: m.label, value: d.n, atendidos: d.atendidos, color: m.tone,
      esAlerta: d.tipo === 'INAUGURACION_SIN_JORNADA',
    };
  });
  const totalAlertas = fmt.filter((f) => f.esAlerta).reduce((s, f) => s + f.value, 0);
  return (
    <MiniChartCard
      title={`Tipos de jornada${totalAlertas > 0 ? ` · ${totalAlertas} ⚠` : ''}`}
      subtitle="Mes en curso · click para detalle"
      className="h-full"
      density="compact"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <PieChart>
            <Pie data={fmt} dataKey="value" nameKey="name"
                 cx="40%" cy="50%"
                 outerRadius="78%" innerRadius="50%" paddingAngle={3}
                 labelLine={false}>
              {fmt.map((entry, i) => (
                <Cell key={i} fill={entry.color}
                      stroke={entry.esAlerta ? t.status.danger : t.bg.surface}
                      strokeWidth={entry.esAlerta ? 3 : 1} />
              ))}
            </Pie>
            <Tooltip content={<ThemedTooltip formatter={(v) => fmtN(v)} />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              iconSize={8}
              wrapperStyle={{ fontSize: 10, color: t.text.secondary, paddingLeft: 4 }}
              formatter={(value, entry) => {
                const v = entry?.payload?.value;
                const name = String(value || '').replace('⚠️ ', '').replace('Jornada ', '');
                return `${name.length > 18 ? name.slice(0, 16) + '…' : name} · ${v}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────────────── top empresas ─────────────────────────
export function TopEmpresasChart({ limit = 10 }) {
  const { data, err, loading } = useChartData('top-empresas', { limit });
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const fmt = (data || []).map((d) => ({
    nombre: d.nombre_legal.length > 30 ? d.nombre_legal.slice(0, 28) + '…' : d.nombre_legal,
    atendidos: d.total_atendidos,
    jornadas: d.n_jornadas,
    clinicaJornada: d.tiene_clinica_amarrada,    // rename interno; el campo BD se mantiene
  }));
  return (
    <MiniChartCard
      title="Top 5 empresas"
      subtitle="Año en curso · verde = Clínica + Jornada"
      className="h-full"
      density="compact"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} layout="vertical" margin={{ left: 20, right: 24 }}>
            <CartesianGrid {...ct.gridProps} horizontal={false} vertical />
            <XAxis type="number" {...ct.axisProps} />
            <YAxis dataKey="nombre" type="category" width={150} {...ct.axisProps}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <Tooltip content={<ThemedTooltip formatter={(v) => fmtN(v)} />} />
            <Bar dataKey="atendidos" name="Atendidos" radius={[0, 4, 4, 0]}>
              {fmt.map((entry, i) => (
                <Cell key={i}
                      fill={entry.clinicaJornada ? t.status.success : t.accent.tertiary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────────────── distribución depto ───────────────────
function DeptoTooltip(props) {
  const { active, payload } = props;
  const t = useThemedColors();
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const semColor = semKeyToColor(t, d.semaforo);
  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 8, padding: '8px 12px', color: t.text.primary,
      fontSize: 12, boxShadow: '0 8px 20px -8px rgba(0,0,0,0.25)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.depto_full || d.depto}</div>
      <div style={{ color: t.accent.secondary }}>Atendidos: <b>{fmtN(d.atendidos)}</b></div>
      <div style={{ color: t.text.secondary }}>Programados: <b>{fmtN(d.programados)}</b></div>
      <div style={{ color: t.text.secondary }}>N° Jornadas: <b>{d.jornadas}</b></div>
      {d.programados > 0 && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: semColor }} />
          <span style={{ color: semColor, fontWeight: 600 }}>
            % asistencia: {d.pct_asistencia}%
          </span>
        </div>
      )}
    </div>
  );
}

export function DistribucionDepartamentoChart() {
  const { data, err, loading } = useChartData('distribucion-departamento');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  // Mapear rojo legacy a naranja (warning), rojo solo para casos críticos
  const fmt = (data || []).slice(0, 15).map((d) => ({
    depto: d.departamento.length > 12 ? d.departamento.slice(0, 11) + '…' : d.departamento,
    depto_full: d.departamento,
    atendidos: d.atendidos, jornadas: d.n_jornadas,
    programados: d.programados, pct_asistencia: d.pct_asistencia,
    // <80% se ve naranja en lugar de rojo
    semaforo: d.semaforo === 'rojo' ? 'naranja' : d.semaforo,
  }));
  return (
    <MiniChartCard
      title="Atendidos por departamento"
      subtitle="Año en curso · verde ≥90 · naranja <80"
      className="h-full"
      density="compact"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={fmt} margin={{ left: 10, right: 12, bottom: 12 }}>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="depto" {...ct.axisProps}
                   angle={-45} textAnchor="end" height={60}
                   tick={{ ...ct.axisProps.tick, fontSize: 10 }} />
            <YAxis {...ct.axisProps} />
            <Tooltip content={<DeptoTooltip />} />
            <Bar dataKey="atendidos" name="Atendidos" radius={[4, 4, 0, 0]}>
              {fmt.map((entry, i) => (
                <Cell key={i} fill={semKeyToColor(t, entry.semaforo) || t.accent.secondary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────── progreso diario del mes ──────────────────────
export function ProgresoDiarioMesChart({ compact = false }) {
  const { data, err, loading } = useChartData('serie-diaria-mes');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;

  // Barras siempre en azul IGSS (rojo era confuso con cancelado/alerta)
  const barColor = t.accent.tertiary;
  const accentColor = t.accent.primary;
  const metaColor = t.accent.secondary;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const hoyData = data?.serie?.find((d) => d.fecha === hoyStr);

  return (
    <MiniChartCard
      title="Progreso diario del mes"
      subtitle={
        data?.meta_mes
          ? `Meta: ${fmtN(data.meta_mes)} · Acumulado: ${fmtN(data.acumulado_atendidos)} · ${data.pct_meta}% · Falta: ${fmtN(data.falta_para_meta)}`
          : 'Sin meta configurada'
      }
      className={compact ? 'h-full' : ''}
      density={compact ? 'compact' : 'comfortable'}
      height={compact ? undefined : 320}
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && !data}
    >
      {data && (
        <ResponsiveContainer>
          <ComposedChart data={data.serie} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={barColor} stopOpacity={1} />
                <stop offset="100%" stopColor={barColor} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="dia" {...ct.axisProps}
                   label={{ value: 'Día del mes', position: 'insideBottom', offset: -2, fill: ct.axisColor, fontSize: 10 }} />
            <YAxis {...ct.axisProps} />
            <Tooltip content={<ThemedTooltip
              formatter={(v) => fmtN(v)}
              labelFormatter={(d) => `Día ${d}`}
            />} />
            <Legend {...ct.legendProps} />
            {hoyData && (
              <ReferenceLine x={hoyData.dia} stroke={accentColor} strokeDasharray="3 3"
                             label={{ value: 'HOY', position: 'top', fill: accentColor, fontSize: 10, fontWeight: 700 }} />
            )}
            <Bar dataKey="atendidos" name="Atendidos del día"
                 fill="url(#barGrad)" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="acumulado" name="Acumulado"
                  stroke={accentColor} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="meta_acumulada" name="Meta acumulada"
                  stroke={metaColor} strokeDasharray="5 5" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────── alerta inauguración (legacy wrapper) ─────────
// El Dashboard rediseñado usa AlertBanner con datos del endpoint /alertas-unificadas.
// Este export se mantiene por compatibilidad pero ahora consume el mismo endpoint
// y delega al AlertBanner.
export function AlertaInauguracionesSinJornada() {
  const { data, err } = useApi('/api/charts/alertas-unificadas');
  if (err === '403' || !data) return null;
  return <AlertBanner items={data.alertas} defaultOpen />;
}

// ───────────────────────────── estado jornadas ──────────────────────
export function EstadoJornadasChart() {
  const { data, err, loading } = useChartData('estado-jornadas');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403') return null;
  const ALERT_KEY = '⚠️ INAUG SIN JORNADA';
  const ESTADO_COLOR = ESTADO_KEY_COLOR(t);
  const fmt = (data || []).map((d) => ({
    name: d.estado, value: d.n,
    fill: d.estado === ALERT_KEY ? t.status.danger : (ESTADO_COLOR[d.estado] || t.status.neutral),
    esAlerta: d.estado === ALERT_KEY,
  }));
  const totalAlertas = fmt.filter((f) => f.esAlerta).reduce((s, f) => s + f.value, 0);
  return (
    <MiniChartCard
      title={`Estado de jornadas${totalAlertas > 0 ? ` · ${totalAlertas} ⚠` : ''}`}
      subtitle="Mes en curso"
      className="h-full"
      density="compact"
      loading={loading}
      error={err && err !== '403' ? err : null}
      empty={!loading && fmt.length === 0}
    >
      {fmt.length > 0 && (
        <ResponsiveContainer>
          <PieChart>
            <Pie data={fmt} dataKey="value" nameKey="name"
                 cx="40%" cy="50%"
                 outerRadius="78%" innerRadius="50%" paddingAngle={3}
                 labelLine={false}>
              {fmt.map((e, i) => (
                <Cell key={i} fill={e.fill}
                      stroke={e.esAlerta ? t.status.danger : t.bg.surface}
                      strokeWidth={e.esAlerta ? 2.5 : 1} />
              ))}
            </Pie>
            <Tooltip content={<ThemedTooltip />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              iconSize={8}
              wrapperStyle={{ fontSize: 10, color: t.text.secondary, paddingLeft: 4 }}
              formatter={(value, entry) => {
                const v = entry?.payload?.value;
                const name = String(value || '').replace('⚠️ ', '');
                return `${name} · ${v}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}

// ───────────────────────────── costos mensuales (gerencia) ──────────
export function CostosMensualesChart() {
  const { data, err, loading } = useChartData('costos-mensuales');
  const t = useThemedColors();
  const ct = useChartTheme();
  if (err === '403' || !data) return null;
  // Detectar empty real: incluso si data.length=12, todos pueden ser 0
  const totalSum = (data || []).reduce((s, d) => s + (d.kit || 0) + (d.personal || 0) + (d.viaticos || 0), 0);
  // Si no hay costos registrados, ocultar TODO el card (no mostrar solo
  // título vacío que confunde — la imagen del usuario reportaba esto).
  if (!loading && totalSum === 0) return null;
  return (
    <MiniChartCard
      title="Costos mensuales"
      subtitle="Kit lab + personal + viáticos · últimos 12 meses"
      height={260}
      loading={loading}
      error={err && err !== '403' ? err : null}
    >
      {data && data.length > 0 && (
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid {...ct.gridProps} />
            <XAxis dataKey="mes" {...ct.axisProps} />
            <YAxis {...ct.axisProps} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
            <Tooltip content={<ThemedTooltip formatter={(v) => fmtQ(v)} />} />
            <Legend {...ct.legendProps} />
            <Bar dataKey="kit" name="Kit lab" stackId="a" fill={t.accent.tertiary} radius={[0, 0, 0, 0]} />
            <Bar dataKey="personal" name="Personal" stackId="a" fill={t.accent.secondary} />
            <Bar dataKey="viaticos" name="Viáticos" stackId="a" fill={t.status.warning} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </MiniChartCard>
  );
}
