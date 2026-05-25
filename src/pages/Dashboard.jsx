import { useEffect, useState } from 'react';
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
import { fmtQ, fmtN, TIPO_LABEL } from '../utils/format';
import ErrorState from '../components/feedback/ErrorState';
import LoadingState from '../components/feedback/LoadingState';
import { useThemedColors } from '../theme/useThemedColors';

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

  if (err) return <ErrorState message={err} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-surface-elev rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-surface-elev animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-surface-elev animate-pulse" />
      </div>
    );
  }

  // ───── Derivar KPIs unificados de las distintas shapes por rol ─────
  const kpi = derivarKpis(data, serieDiaria);

  return (
    <div className="space-y-4">
      {/* Header — período + período seleccionado */}
      <header className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">Resumen · <span className="tabular-nums">{data.periodo}</span></h1>
          <p className="text-xs text-fg-muted">Datos del mes en curso · semáforos en vivo</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Días restantes destacado en chip */}
          {kpi.diasRestantes != null && (
            <div className="text-xs bg-surface border border-line rounded-full px-3 py-1 text-fg-muted">
              <span className="tabular-nums font-semibold text-fg">{kpi.diasRestantes}</span> días restantes
            </div>
          )}
        </div>
      </header>

      {/* Alertas unificadas (críticas + warnings) */}
      {alertas && <AlertBanner items={alertas.alertas || []} defaultOpen maxVisible={5} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="% META MENSUAL"
          value={kpi.pctMeta ?? 0}
          format="percent"
          decimals={1}
          tone={kpi.pctMeta >= 90 ? 'success' : kpi.pctMeta >= 80 ? 'warning' : 'primary'}
          viz="gauge"
          vizData={{ value: kpi.pctMeta ?? 0 }}
          subLabel={kpi.metaMes ? `Meta ${fmtN(kpi.metaMes)}` : 'Sin meta configurada'}
          delta={kpi.pctMetaDelta != null ? { value: kpi.pctMetaDelta, unit: ' pp', decimals: 1 } : undefined}
          icon={<TargetIcon />}
        />
        <StatCard
          label="ATENDIDOS DEL MES"
          value={kpi.atendidos ?? 0}
          tone="accent-2"
          viz="spark"
          vizData={{
            data: (serieDiaria?.serie || []).map((d) => d.acumulado),
            color: t.accent.secondary,
            width: 100, height: 44,
          }}
          subLabel={kpi.faltaMeta > 0 ? `Faltan ${fmtN(kpi.faltaMeta)} para meta` : 'Meta cumplida'}
          icon={<UsersIcon />}
        />
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
            size: 68, thickness: 9,
            centerLabel: `${Math.round(kpi.pctAsistencia || 0)}%`,
          }}
          subLabel="Atendidos / programados"
          icon={<CheckCircleIcon />}
        />
        <StatCard
          label="DÍAS RESTANTES"
          value={kpi.diasRestantes ?? 0}
          unit="días"
          tone={kpi.diasRestantes <= 3 ? 'warning' : 'primary'}
          viz="bar"
          vizData={{
            value: kpi.diasConsumidos ?? 0,
            max: kpi.diasTotales ?? 30,
            label: `${kpi.diasConsumidos ?? 0} / ${kpi.diasTotales ?? 30} días`,
          }}
          subLabel={kpi.jornadasRestantes != null ? `${kpi.jornadasRestantes} jornadas pendientes` : ''}
          icon={<CalendarIcon />}
        />
      </div>

      {/* Layout principal: chart grande + sidebar próximas jornadas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <ProgresoDiarioMesChart />

        {/* Sidebar próximas jornadas */}
        <MiniChartCard
          title="Próximas jornadas"
          subtitle="Las siguientes 5 programadas"
          density="compact"
          bodyClassName="-mx-1"
        >
          <DataList
            items={(data.proximas_jornadas || []).slice(0, 5)}
            renderItem={(j) => <JornadaRow jornada={j} />}
            empty="Sin próximas jornadas"
            density="comfortable"
          />
        </MiniChartCard>
      </div>

      {/* Mini-charts en grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <TiposJornadaChart />
        <EstadoJornadasChart />
        <TopEmpresasChart limit={5} />
      </div>

      {/* Desglose de costos (solo gerencia) */}
      {data.costos && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg">Desglose de costos del mes</h2>
            <span className="text-[10px] text-fg-muted">Solo gerencia / admin</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <CostBox label="Kit de laboratorio" value={data.costos.kit} tone="accent-3" t={t} />
            <CostBox label="Personal" value={data.costos.personal} tone="accent-2" t={t} />
            <CostBox label="Viáticos" value={data.costos.viaticos} tone="warning" t={t} />
            <CostBox label="Total" value={data.costos.total} tone="primary" t={t} bold />
          </div>
        </div>
      )}

      {/* Scroll inferior — gráficas secundarias */}
      <details className="rounded-2xl border border-line-subtle bg-surface" open>
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg">
          Análisis histórico
        </summary>
        <div className="p-4 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Serie12MesesChart />
          <DistribucionDepartamentoChart />
          <CostosMensualesChart />
        </div>
      </details>
    </div>
  );
}

function CostBox({ label, value, tone, t, bold }) {
  const toneColor = {
    primary: t.accent.primary,
    'accent-2': t.accent.secondary,
    'accent-3': t.accent.tertiary,
    warning: t.status.warning,
  }[tone] || t.text.primary;
  return (
    <div className="rounded-lg p-3 bg-surface-elev border border-line-subtle">
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`text-lg ${bold ? 'font-extrabold' : 'font-bold'} tabular-nums`}
           style={{ color: toneColor }}>
        {fmtQ(value)}
      </div>
    </div>
  );
}

// ───────────── Helper: deriva KPIs uniformes ────────────────────────
function derivarKpis(data, serieDiaria) {
  const aux = data.aux || {};
  const kpis = data.kpis || [];

  // % asistencia: viene como kpi label '% Asistencia'
  const kAsist = kpis.find((k) => /asistencia/i.test(k.label || ''));
  const pctAsistencia = kAsist?.value;

  // % meta + acumulado: viene como kpi 'Pacientes atendidos (mes)' en sipresalud
  // ó del endpoint serie-diaria-mes
  const kPac = kpis.find((k) => /pacientes/i.test(k.label || '') || /atendidos/i.test(k.label || ''));
  const pctMeta = serieDiaria?.pct_meta ?? kPac?.pct_meta;
  const metaMes = serieDiaria?.meta_mes ?? kPac?.meta;
  const atendidos = serieDiaria?.acumulado_atendidos ?? kPac?.value;
  const faltaMeta = serieDiaria?.falta_para_meta;

  // pct meta mes anterior para delta
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

// ───────────── Iconos simples (inline SVG, no librería) ─────────────
function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
