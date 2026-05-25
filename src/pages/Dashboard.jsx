import { useEffect, useMemo, useState } from 'react';
import { apiDashboard, apiAlertasUnificadas, apiSerieDiariaMes } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import StatCard from '../components/cards/StatCard';
import MiniChartCard from '../components/cards/MiniChartCard';
import AlertBanner from '../components/cards/AlertBanner';
import DataList from '../components/lists/DataList';
import JornadaRow from '../components/lists/JornadaRow';
import {
  Serie12MesesChart, TiposJornadaChart, TopEmpresasChart,
  DistribucionDepartamentoChart, EstadoJornadasChart, CostosMensualesChart,
  ProgresoDiarioMesChart,
} from '../components/Charts';
import { fmtQ, fmtN } from '../utils/format';
import ErrorState from '../components/feedback/ErrorState';
import { useThemedColors } from '../theme/useThemedColors';
import { severityOf } from '../utils/derived';

const ENDPOINT_POR_ROL = {
  admin: 'gerencia', gerencia: 'gerencia', ce: 'ce', sipresalud: 'sipresalud',
};

/**
 * Dashboard single-view 1920×1080 (sin scroll en pantallas anchas).
 *
 * Layout CSS Grid 2D:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ HEADER (chip días + título)                       50px           │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ ALERTBANNER (slim/colapsable)                     60-90px        │
 *   ├──────┬──────┬──────┬──────┬──────────────────────────────────────┤
 *   │ KPI1 │ KPI2 │ KPI3 │ KPI4 │ ┐                                   │
 *   ├──────┴──────┴──────┴──────┤ │ SIDEBAR R                          │
 *   │ ProgresoDiarioMes hero    │ │ Próximas 5 jornadas                │
 *   │ (col-span 4)              │ │ (row-span 3)                       │
 *   ├──────┬──────┬──────┬──────┤ │                                    │
 *   │ Tipos│Estado│Top 5 │ Cost │ ┘                                   │
 *   └──────┴──────┴──────┴──────┴──────────────────────────────────────┘
 *   Total alturas: 130 + 280 + 220 = 630px + 60 alert + 50 hdr + 32 ftr = 772px → cabe en 1080
 */
export default function Dashboard() {
  const { user } = useAuth();
  const t = useThemedColors();
  const [data, setData] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [serieDiaria, setSerieDiaria] = useState(null);
  const [err, setErr] = useState('');

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

  // IMPORTANTE: TODOS los hooks deben llamarse en el mismo orden cada render.
  // No mover useMemo después de early returns — React #310.
  const alertItems = alertas?.alertas || [];
  const sortedAlertas = useMemo(
    () => [...alertItems].sort((a, b) => severityOf(a) - severityOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertas],
  );

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
  const proximas = (data.proximas_jornadas || []).slice(0, 5);

  return (
    <div className="space-y-3">
      {/* HEADER — fila slim con título + chip días restantes + filtros futuros */}
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

      {/* ALERT BANNER — slim, abierto solo si hay alertas, máx 3 visibles inline */}
      {alertItems.length > 0 && (
        <AlertBanner items={sortedAlertas} defaultOpen maxVisible={3} />
      )}
      {alertItems.length === 0 && alertas && (
        <div className="rounded-xl border border-success/40 bg-success-soft/30 px-3 py-1.5 text-xs text-success flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Sin alertas pendientes — todo al día</span>
        </div>
      )}

      {/* MAIN GRID 2D — 5 cols × 3 rows, sidebar derecho row-span-3 */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) minmax(240px, 280px)',
          gridTemplateRows: 'auto auto auto',
        }}
      >
        {/* ── Row 1: 4 KPIs + arranque sidebar (row-span 3) ───────────── */}
        <div style={{ height: 132 }}>
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
        <div style={{ height: 132 }}>
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
        <div style={{ height: 132 }}>
          <StatCard
            label="% ASISTENCIA"
            value={kpi.pctAsistencia ?? 0}
            format="percent"
            decimals={1}
            tone="accent-3"
            viz="donut"
            vizData={{
              value: kpi.pctAsistencia ?? 0,
              max: 100,
              color: t.accent.tertiary,
              size: 60, thickness: 8,
              centerLabel: `${Math.round(kpi.pctAsistencia || 0)}%`,
            }}
            subLabel="Aten / progr"
            icon={<CheckCircleIcon />}
            compact
          />
        </div>
        <div style={{ height: 132 }}>
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

        {/* Sidebar derecho — Próximas 5 jornadas (row-span 3) */}
        <div className="row-span-3 min-h-0">
          <MiniChartCard
            title="Próximas jornadas"
            subtitle={`Las siguientes ${proximas.length}`}
            density="compact"
            bodyClassName="-mx-1 overflow-y-auto"
            className="h-full flex flex-col"
          >
            <DataList
              items={proximas}
              renderItem={(j) => <JornadaRow jornada={j} dense />}
              empty="Sin próximas jornadas"
              density="compact"
            />
          </MiniChartCard>
        </div>

        {/* ── Row 2: Chart hero (col-span 4) ──────────────────────────── */}
        <div className="col-span-4" style={{ height: 280 }}>
          <ProgresoDiarioMesChart compact />
        </div>

        {/* ── Row 3: 4 mini-charts ────────────────────────────────────── */}
        <div style={{ height: 230 }}>
          <TiposJornadaChart />
        </div>
        <div style={{ height: 230 }}>
          <EstadoJornadasChart />
        </div>
        <div style={{ height: 230 }}>
          <TopEmpresasChart limit={5} />
        </div>
        <div style={{ height: 230 }}>
          {data.costos
            ? <CostosCard costos={data.costos} t={t} />
            : <DistribucionDepartamentoChart />}
        </div>
      </div>

      {/* Análisis histórico — colapsado por default, fuera del viewport prime */}
      <details className="rounded-2xl border border-line-subtle bg-surface mt-2">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Análisis histórico · serie 12 meses · distribución por departamento
          {data.costos && ' · costos mensuales'}
        </summary>
        <div className="p-4 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Serie12MesesChart />
          <DistribucionDepartamentoChart />
          {data.costos && <CostosMensualesChart />}
        </div>
      </details>
    </div>
  );
}

// ───────────── Card compacta de costos para Row 3 col 4 ─────────────
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
  const pctMetaDelta = (pctMeta != null && pctMetaPrev != null)
    ? Number((pctMeta - pctMetaPrev).toFixed(1))
    : null;

  return {
    pctMeta, pctMetaDelta, metaMes, atendidos, faltaMeta,
    pctAsistencia,
    diasRestantes: aux.dias_restantes_mes,
    diasConsumidos: aux.dias_consumidos_mes,
    diasTotales: aux.dias_totales_mes,
    jornadasRestantes: aux.jornadas_programadas_restantes,
  };
}

// ───────────── Iconos inline ─────────────
function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
