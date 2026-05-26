import { useEffect, useMemo, useState } from 'react';
import { apiDashboard, apiAlertasUnificadas, apiSerieDiariaMes } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import StatCard from '../components/cards/StatCard';
import MiniChartCard from '../components/cards/MiniChartCard';
import DataList from '../components/lists/DataList';
import JornadaRow from '../components/lists/JornadaRow';
import {
  Serie12MesesChart, DistribucionDepartamentoChart, CostosMensualesChart,
  ProgresoDiarioMesChart, EstadoJornadasChart,
} from '../components/Charts';
import { fmtQ, fmtN } from '../utils/format';
import ErrorState from '../components/feedback/ErrorState';
import { useThemedColors } from '../theme/useThemedColors';
import { severityOf } from '../utils/derived';

const ENDPOINT_POR_ROL = {
  admin: 'gerencia', gerencia: 'gerencia', ce: 'ce', sipresalud: 'sipresalud',
};

export default function Dashboard() {
  const { user } = useAuth();
  const t = useThemedColors();
  const [data, setData] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [serieDiaria, setSerieDiaria] = useState(null);
  const [err, setErr] = useState('');
  const [histOpen, setHistOpen] = useState(false);  // lazy-load análisis histórico

  useEffect(() => {
    const rol = ENDPOINT_POR_ROL[user.rol];
    Promise.all([
      apiDashboard(rol),
      apiAlertasUnificadas().catch(() => ({ alertas: [], counts: { total: 0 } })),
      apiSerieDiariaMes().catch(() => null),
    ])
      .then(([d, a, s]) => { setData(d); setAlertas(a); setSerieDiaria(s); })
      .catch((e) => setErr(e.response?.data?.detail || 'Error cargando dashboard'));
  }, [user.rol]);

  // HOOKS — siempre llamarlos ANTES de cualquier early return
  const alertItems = alertas?.alertas || [];
  const sortedAlertas = useMemo(
    () => [...alertItems].sort((a, b) => severityOf(a) - severityOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertas],
  );

  const splitAlertas = useMemo(() => {
    const cancel = sortedAlertas.filter((a) => a.source === 'CANCELADA');
    const inaug = sortedAlertas.filter((a) => a.source === 'INAUGURACION_SIN_JORNADA');
    const warn = sortedAlertas.filter((a) => a.severity === 'warning');
    return { cancel, inaug, warn };
  }, [sortedAlertas]);

  const proximasInfo = useMemo(() => {
    const all = data?.proximas_jornadas || [];
    if (!all.length) return { items: [], showingFallback: false, nextDate: null };
    const now = new Date();
    const hoy = now.toISOString().slice(0, 10);
    const tmp = new Date(now); tmp.setDate(tmp.getDate() + 1);
    const manana = tmp.toISOString().slice(0, 10);
    const hoyManana = all.filter((j) => j.fecha_inicio === hoy || j.fecha_inicio === manana);
    if (hoyManana.length > 0) {
      return { items: hoyManana, showingFallback: false, nextDate: null };
    }
    // Fallback: si no hay hoy/mañana, mostrar las próximas 3 con badge "futura"
    return { items: all.slice(0, 3), showingFallback: true, nextDate: all[0].fecha_inicio };
  }, [data]);

  if (err) return <ErrorState message={err} />;
  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-64 bg-surface-elev rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-surface-elev" />)}
        </div>
        <div className="h-72 rounded-2xl bg-surface-elev" />
      </div>
    );
  }

  const kpi = derivarKpis(data, serieDiaria);
  const pctAusentismo = kpi.pctAsistencia != null
    ? Math.max(0, Math.round((100 - kpi.pctAsistencia) * 10) / 10)
    : null;

  return (
    <div className="space-y-3">
      {/* HEADER slim */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold text-fg leading-none">
            Resumen · <span className="tabular-nums">{data.periodo}</span>
          </h1>
          <span className="text-[11px] text-fg-muted">Mes en curso · semáforos en vivo</span>
        </div>
        <div className="flex items-center gap-2">
          {kpi.diasRestantes != null && (
            <div className={`text-xs rounded-full px-2.5 py-1 border tabular-nums
                            ${kpi.diasRestantes <= 3 ? 'border-warning/50 bg-warning-soft text-warning' : 'border-line bg-surface text-fg-muted'}`}>
              <span className="font-bold">{kpi.diasRestantes}</span> días restantes
            </div>
          )}
        </div>
      </header>

      {/* ALERTAS SEPARADAS: 2 cards rojas (cancelación + inaug-sin-jornada) */}
      {(splitAlertas.cancel.length > 0 || splitAlertas.inaug.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AlertCard
            title="Jornadas canceladas"
            count={splitAlertas.cancel.length}
            items={splitAlertas.cancel}
            icon="🚨"
          />
          <AlertCard
            title="Inauguración sin jornada coordinada"
            count={splitAlertas.inaug.length}
            items={splitAlertas.inaug}
            icon="⚠️"
          />
        </div>
      ) : alertas && (
        <div className="rounded-xl border border-success/40 bg-success-soft/30 px-3 py-1.5 text-xs text-success flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Sin alertas pendientes — todo al día</span>
        </div>
      )}

      {/* MAIN GRID 2D — responsive:
          - xl (≥1280): grid 5cols [4 KPIs + sidebar 280px row-span-3] (desktop intacto)
          - lg (1024-1279): grid 4cols (sidebar abajo, no a la derecha)
          - md (768-1023): grid 2cols
          - mobile (<768): stack 1col
      */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
                      xl:[grid-template-columns:repeat(4,minmax(0,1fr))_minmax(240px,280px)]">
        {/* ── Row 1: 4 KPIs (mobile: stack, tablet: 2×2, lg+: 4 en fila) ── */}
        <div className="min-h-[132px]">
          <StatCard
            label="% META MENSUAL"
            value={kpi.pctMeta ?? 0}
            format="percent"
            decimals={1}
            tone={kpi.pctMeta >= 90 ? 'success' : kpi.pctMeta >= 80 ? 'warning' : 'primary'}
            viz="gauge"
            vizData={{ value: kpi.pctMeta ?? 0, size: 70, thickness: 8 }}
            subLabel={kpi.metaMes ? `Meta ${fmtN(kpi.metaMes)}` : 'Sin meta'}
            delta={kpi.pctMetaDelta != null ? { value: kpi.pctMetaDelta, unit: ' pp', decimals: 1 } : undefined}
            icon={<TargetIcon />}
            compact
          />
        </div>
        <div className="min-h-[132px]">
          <StatCard
            label="ATENDIDOS"
            value={kpi.atendidos ?? 0}
            tone="accent-2"
            viz="spark"
            vizData={{
              data: (serieDiaria?.serie || []).map((d) => d.acumulado),
              color: t.accent.secondary,
              width: 90, height: 38,
            }}
            subLabel={kpi.faltaMeta > 0 ? `Faltan ${fmtN(kpi.faltaMeta)}` : 'Meta cumplida'}
            icon={<UsersIcon />}
            compact
          />
        </div>
        <div className="min-h-[132px]">
          <StatCard
            label="% AUSENTISMO"
            value={pctAusentismo ?? 0}
            format="percent"
            decimals={1}
            tone={pctAusentismo == null ? 'neutral' : pctAusentismo <= 10 ? 'success' : pctAusentismo <= 20 ? 'warning' : 'danger'}
            viz="donut"
            vizData={{
              value: pctAusentismo ?? 0,
              max: 100,
              color: pctAusentismo <= 10 ? t.status.success : pctAusentismo <= 20 ? t.status.warning : t.status.danger,
              size: 60, thickness: 8,
              centerLabel: pctAusentismo != null ? `${Math.round(pctAusentismo)}%` : '—',
            }}
            subLabel={kpi.pctAsistencia != null ? `${kpi.pctAsistencia.toFixed(1)}% asistencia` : 'Sin jornadas cerradas'}
            icon={<UserMinusIcon />}
            compact
          />
        </div>
        <div className="min-h-[132px]">
          <StatCard
            label="DÍAS RESTANTES"
            value={kpi.diasRestantes ?? 0}
            unit="d"
            tone={kpi.diasRestantes <= 3 ? 'warning' : 'primary'}
            viz="bar"
            vizData={{
              value: kpi.diasConsumidos ?? 0,
              max: kpi.diasTotales ?? 30,
              label: `${kpi.diasConsumidos ?? 0}/${kpi.diasTotales ?? 30}`,
            }}
            subLabel={kpi.jornadasRestantes != null ? `${kpi.jornadasRestantes} pendientes` : ''}
            icon={<CalendarIcon />}
            compact
          />
        </div>

        {/* Sidebar derecho — Próximas jornadas
            - xl: row-span 3 (a la derecha de TODOS los KPIs + chart + mini-charts)
            - lg y abajo: ocupa toda la fila debajo
        */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-1 xl:row-span-3
                        min-h-[200px] xl:min-h-0">
          <MiniChartCard
            title="Próximas jornadas"
            subtitle={
              proximasInfo.showingFallback
                ? `Siguiente: ${proximasInfo.nextDate}`
                : `Hoy y mañana · ${proximasInfo.items.length}`
            }
            density="compact"
            bodyClassName="-mx-1 overflow-y-auto overflow-x-hidden"
            className="h-full flex flex-col"
          >
            <DataList
              items={proximasInfo.items}
              renderItem={(j) => <JornadaRow jornada={j} dense />}
              empty="Sin jornadas programadas"
              density="compact"
            />
          </MiniChartCard>
        </div>

        {/* ── Row 2: Chart hero
            - mobile: col-span-1
            - sm: col-span-2
            - lg+: col-span-4 (ancho completo de los 4 KPIs)
        */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-4"
             style={{ height: 280 }}>
          <ProgresoDiarioMesChart compact />
        </div>

        {/* ── Row 3: Promedios + Estado + Costos/Depto (4 cards) ────────── */}
        <div className="min-h-[220px]">
          <PromedioCard
            label="PROMEDIO POR JORNADA"
            value={kpi.promedioPorJornada}
            subLabel={kpi.promedioPorEmpresa != null ? `${fmtN(kpi.promedioPorEmpresa)} por empresa` : ''}
            tone="primary"
            t={t}
          />
        </div>
        <div className="min-h-[220px]">
          <PromedioCard
            label="EMPRESAS ACTIVAS"
            value={kpi.nEmpresasActivas ?? 0}
            valueFmt="number"
            subLabel="Con jornadas cerradas este mes"
            tone="accent-2"
            t={t}
          />
        </div>
        <div className="min-h-[220px]">
          <EstadoJornadasChart />
        </div>
        <div className="min-h-[220px]">
          {data.costos
            ? <CostosCard costos={data.costos} t={t} />
            : <DistribucionDepartamentoChart />}
        </div>
      </div>

      {/* Análisis histórico — LAZY LOAD: solo se montan los charts al expandir */}
      <details
        className="rounded-2xl border border-line-subtle bg-surface mt-2"
        open={histOpen}
        onToggle={(e) => setHistOpen(e.target.open)}
      >
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg flex items-center gap-2 select-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               className={`h-4 w-4 transition-transform ${histOpen ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Análisis histórico · serie 12 meses · distribución por departamento
          {data.costos && ' · costos mensuales'}
          <span className="text-[10px] text-fg-subtle ml-1">(carga al expandir)</span>
        </summary>
        {histOpen && (
          <div className="p-4 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Serie12MesesChart />
            <DistribucionDepartamentoChart />
            {data.costos && <CostosMensualesChart />}
          </div>
        )}
      </details>
    </div>
  );
}

// ───────────── Alert card: 1 sola severidad (cancelación o inaug-sin) ─────────
function AlertCard({ title, count, items, icon }) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  const visible = open ? items.slice(0, 4) : [];

  return (
    <div className="rounded-2xl border-2 border-danger/50 bg-danger-soft/30 relative overflow-hidden">
      <div aria-hidden
           className="absolute left-0 inset-y-0 w-1 bg-danger jornada-alerta-pulse" />
      <div className="pl-3 pr-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg leading-none">{icon}</span>
            <span className="font-bold text-fg text-sm truncate">{title}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white flex-shrink-0">
              {count}
            </span>
          </div>
          <button onClick={() => setOpen(!open)}
                  className="text-[10px] font-semibold text-fg-muted hover:text-fg transition-colors flex-shrink-0">
            {open ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        {open && (
          <ul className="space-y-1">
            {visible.map((a) => (
              <li key={a.id}
                  className="flex items-start gap-2 text-[11px] rounded px-1.5 py-1 hover:bg-surface/60">
                <span aria-hidden className="flex-shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-danger" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-fg">
                    {a.codigo && <span className="font-mono text-[10px] mr-1 text-fg-muted">{a.codigo}</span>}
                    {a.title}
                  </div>
                  {a.detail && <div className="text-fg-muted truncate">{a.detail}</div>}
                </div>
                {a.fecha && <span className="text-[9px] text-fg-muted tabular-nums flex-shrink-0 mt-0.5">{a.fecha}</span>}
              </li>
            ))}
            {items.length > 4 && (
              <li className="text-[10px] text-fg-muted px-1.5">+{items.length - 4} más</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ───────────── Promedio card (big number + sublabel) ─────────────
function PromedioCard({ label, value, valueFmt = 'number', subLabel, tone, t }) {
  const toneColor = {
    primary: t.accent.primary,
    'accent-2': t.accent.secondary,
    'accent-3': t.accent.tertiary,
  }[tone] || t.accent.primary;

  const fmt = (v) =>
    valueFmt === 'percent' ? `${v}%` : Number(v ?? 0).toLocaleString('es-GT', { maximumFractionDigits: 1 });

  return (
    <div className="h-full rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between
                    hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                    dark:hover:shadow-glow-accent-lg group relative overflow-hidden">
      <span aria-hidden
            className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(90deg, transparent, ${toneColor}, transparent)` }} />
      <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">{label}</div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="font-extrabold tabular-nums leading-none"
             style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: toneColor }}>
          {value != null ? fmt(value) : '—'}
        </div>
        {subLabel && <div className="text-[11px] text-fg-muted mt-2">{subLabel}</div>}
      </div>
    </div>
  );
}

// ───────────── Costos card vertical compacta ─────────────
function CostosCard({ costos, t }) {
  const items = [
    { label: 'Kit lab', value: costos.kit, color: t.accent.tertiary },
    { label: 'Personal', value: costos.personal, color: t.accent.secondary },
    { label: 'Viáticos', value: costos.viaticos, color: t.status.warning },
  ];
  const total = costos.total || items.reduce((s, i) => s + (i.value || 0), 0);
  return (
    <div className="h-full flex flex-col rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-fg">Costos del mes</h3>
        <span className="text-[10px] text-fg-muted">Gerencia</span>
      </div>
      <div className="mb-3">
        <div className="text-2xl font-extrabold tabular-nums text-accent">{fmtQ(total)}</div>
        <div className="text-[10px] text-fg-muted">Total acumulado</div>
      </div>
      <div className="flex-1 space-y-1.5">
        {items.map((it) => {
          const pct = total ? (it.value / total) * 100 : 0;
          return (
            <div key={it.label}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-fg-muted">{it.label}</span>
                <span className="font-semibold text-fg tabular-nums">{fmtQ(it.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-elev overflow-hidden">
                <div className="h-full transition-all duration-700"
                     style={{ width: `${pct}%`, background: it.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Helper: deriva KPIs uniformes ────────────────────────
function derivarKpis(data, serieDiaria) {
  const aux = data.aux || {};
  const kpis = data.kpis || [];

  const kAsist = kpis.find((k) => /asistencia/i.test(k.label || ''));
  const pctAsistencia = kAsist?.value;

  const kPac = kpis.find((k) => /pacientes/i.test(k.label || '') || /atendidos/i.test(k.label || ''));
  const pctMeta = serieDiaria?.pct_meta ?? kPac?.pct_meta;
  const metaMes = serieDiaria?.meta_mes ?? kPac?.meta;
  const atendidos = serieDiaria?.acumulado_atendidos ?? kPac?.value;
  const faltaMeta = serieDiaria?.falta_para_meta;

  const pctMetaPrev = aux.pct_meta_mes_anterior;
  const pctMetaDelta = (pctMeta != null && pctMetaPrev != null && pctMetaPrev > 0)
    ? Number((pctMeta - pctMetaPrev).toFixed(1))
    : null;

  return {
    pctMeta, pctMetaDelta, metaMes, atendidos, faltaMeta,
    pctAsistencia,
    diasRestantes: aux.dias_restantes_mes,
    diasConsumidos: aux.dias_consumidos_mes,
    diasTotales: aux.dias_totales_mes,
    jornadasRestantes: aux.jornadas_programadas_restantes,
    promedioPorJornada: aux.promedio_por_jornada,
    promedioPorEmpresa: aux.promedio_por_empresa,
    nEmpresasActivas: aux.n_empresas_activas,
  };
}

// ───────────── Iconos inline ─────────────
function TargetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8z" /></svg>;
}
function UserMinusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0zm-6-4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
