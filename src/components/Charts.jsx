import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import { fmtQ, fmtN } from '../utils/format';

// Paleta IGSS
const COLORS = ['#0066B3', '#00A99D', '#003F73', '#3b82f6', '#22c55e',
                 '#eab308', '#ef4444', '#a855f7', '#ec4899', '#14b8a6'];
const SEMAFORO_COLORS = {
  PROGRAMADA: '#9ca3af', EN_CURSO: '#3b82f6', EJECUTADA: '#eab308',
  CERRADA: '#22c55e', CANCELADA: '#ef4444', REPROGRAMADA: '#f59e0b',
};

function useChartData(path, params = {}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let mounted = true;
    api.get(`/api/charts/${path}`, { params })
      .then((r) => mounted && setData(r.data))
      .catch((e) => mounted && setErr(e.response?.status === 403 ? '403' : 'err'));
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(params)]);
  return { data, err };
}

function ChartCard({ title, subtitle, children, height = 300 }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

export function Serie12MesesChart() {
  const { data, err } = useChartData('serie-12-meses');
  if (err === '403') return null;
  if (!data) return <ChartCard title="Tendencia 12 meses"><div className="text-slate-400">Cargando…</div></ChartCard>;
  return (
    <ChartCard title="📈 Tendencia últimos 12 meses"
                subtitle="Pacientes atendidos vs programados — semáforo es % asistencia">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mes" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v) => fmtN(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="programados" name="Programados"
                 stroke="#9ca3af" fill="#e5e7eb" fillOpacity={0.5} />
          <Area type="monotone" dataKey="atendidos" name="Atendidos"
                 stroke="#0066B3" fill="#0066B3" fillOpacity={0.7} />
          <Line type="monotone" dataKey="afiliados" name="Afiliados atendidos"
                 stroke="#22c55e" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const TIPO_DISPLAY = {
  CE_JORNADA: { label: 'Jornada CE', color: '#0066B3' },
  SIPRESALUD_JORNADA: { label: 'Jornada SIPRESALUD', color: '#00A99D' },
  INAUGURACION_CON_JORNADA: { label: '🎉 Inauguración (coordinada)', color: '#22c55e' },
  INAUGURACION_SIN_JORNADA: { label: '⚠️ Inauguración SIN jornada', color: '#dc2626' },
  TALLER: { label: 'Taller', color: '#a855f7' },
  WEBINAR: { label: 'Webinar', color: '#ec4899' },
  VISITA_SEGUIMIENTO: { label: 'Visita seguimiento', color: '#3b82f6' },
  INFORME_OFICINA: { label: 'Informe/Oficina', color: '#9ca3af' },
};

export function TiposJornadaChart() {
  const { data, err } = useChartData('tipos-jornada');
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.map((d) => {
    const meta = TIPO_DISPLAY[d.tipo] || { label: d.tipo.replace(/_/g, ' '), color: '#9ca3af' };
    return {
      name: meta.label, value: d.n,
      atendidos: d.atendidos,
      color: meta.color,
      esAlerta: d.tipo === 'INAUGURACION_SIN_JORNADA',
    };
  });
  const totalAlertas = fmt.filter(f => f.esAlerta).reduce((s,f) => s + f.value, 0);
  return (
    <ChartCard title={`🍩 Distribución por tipo (mes actual)${totalAlertas > 0 ? ` — ⚠️ ${totalAlertas} alertas` : ''}`}
                height={300}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={fmt} dataKey="value" nameKey="name"
                outerRadius={95} innerRadius={45}
                label={(e) => e.esAlerta ? `⚠️ ${e.value}` : `${e.value}`}
                labelLine={false}>
            {fmt.map((entry, i) => (
              <Cell key={i} fill={entry.color}
                     stroke={entry.esAlerta ? '#7f1d1d' : '#fff'}
                     strokeWidth={entry.esAlerta ? 3 : 1} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v}`, n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopEmpresasChart() {
  const { data, err } = useChartData('top-empresas', { limit: 10 });
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.map((d) => ({
    nombre: d.nombre_legal.length > 30
      ? d.nombre_legal.slice(0, 28) + '…'
      : d.nombre_legal,
    atendidos: d.total_atendidos,
    jornadas: d.n_jornadas,
    amarrada: d.tiene_clinica_amarrada,
  }));
  return (
    <ChartCard title="🏆 Top 10 empresas por pacientes atendidos (año)"
                height={Math.max(280, 40 * fmt.length + 80)}>
      <ResponsiveContainer>
        <BarChart data={fmt} layout="vertical" margin={{ left: 30, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" fontSize={11} />
          <YAxis dataKey="nombre" type="category" width={160} fontSize={10} />
          <Tooltip formatter={(v) => fmtN(v)} />
          <Bar dataKey="atendidos" name="Atendidos" fill="#0066B3">
            {fmt.map((entry, i) => (
              <Cell key={i} fill={entry.amarrada ? '#22c55e' : '#0066B3'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const SEMAFORO_COLOR = {
  verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444', gris: '#9ca3af',
};

function DeptoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const semColor = SEMAFORO_COLOR[d.semaforo] || '#9ca3af';
  return (
    <div className="bg-white border border-slate-200 rounded shadow-lg p-3 text-sm">
      <div className="font-bold text-slate-800">{d.depto_full || d.depto}</div>
      <div className="text-teal-600">Atendidos: <b>{fmtN(d.atendidos)}</b></div>
      <div className="text-slate-600">Programados: <b>{fmtN(d.programados)}</b></div>
      <div className="text-slate-600">N° Jornadas: <b>{d.jornadas}</b></div>
      {d.programados > 0 && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full"
                 style={{ background: semColor }} />
          <span style={{ color: semColor, fontWeight: 600 }}>
            % asistencia: {d.pct_asistencia}%
          </span>
        </div>
      )}
    </div>
  );
}

export function DistribucionDepartamentoChart() {
  const { data, err } = useChartData('distribucion-departamento');
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.slice(0, 15).map((d) => ({
    depto: d.departamento.length > 12 ? d.departamento.slice(0, 11) + '…' : d.departamento,
    depto_full: d.departamento,
    atendidos: d.atendidos, jornadas: d.n_jornadas,
    programados: d.programados, pct_asistencia: d.pct_asistencia,
    semaforo: d.semaforo,
  }));
  return (
    <ChartCard title="🗺️ Pacientes atendidos por departamento (año)"
                subtitle="Color de barra = semáforo de % asistencia (verde ≥90, amarillo 80-89, rojo <80)"
                height={340}>
      <ResponsiveContainer>
        <BarChart data={fmt}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="depto" fontSize={10} angle={-45} textAnchor="end" height={70} />
          <YAxis fontSize={11} />
          <Tooltip content={<DeptoTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="atendidos" name="Atendidos">
            {fmt.map((entry, i) => (
              <Cell key={i} fill={SEMAFORO_COLOR[entry.semaforo] || '#00A99D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ProgresoDiarioMesChart() {
  const { data, err } = useChartData('serie-diaria-mes');
  if (err === '403' || !data) return null;
  const semColor = SEMAFORO_COLOR[data.semaforo] || '#9ca3af';
  return (
    <ChartCard
      title={`📅 Progreso diario del mes (${data.anio}-${String(data.mes).padStart(2,'0')})`}
      subtitle={
        data.meta_mes
          ? `Meta del mes: ${fmtN(data.meta_mes)} · Acumulado: ${fmtN(data.acumulado_atendidos)} · Falta: ${fmtN(data.falta_para_meta)} (${data.pct_meta}%)`
          : 'Sin meta configurada para este mes'
      }
      height={360}
    >
      <ResponsiveContainer>
        <BarChart data={data.serie}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="dia" fontSize={11} label={{ value: 'Día del mes', position: 'insideBottom', offset: -4, fontSize: 11 }} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v) => fmtN(v)}
                    labelFormatter={(d) => `Día ${d}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="atendidos" name="Atendidos del día" fill={semColor} />
          <Line type="monotone" dataKey="acumulado" name="Acumulado"
                 stroke="#0066B3" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="meta_acumulada" name="Meta acumulada"
                 stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} dot={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AlertaInauguracionesSinJornada() {
  const { data, err } = useChartData('inauguraciones-estado');
  if (err === '403' || !data) return null;
  const sinJor = data.sin_jornada_asociada_programadas;
  if (sinJor === 0) {
    return (
      <div className="card p-4 bg-green-50 border-green-200">
        <h3 className="font-semibold text-green-900">✓ Inauguraciones coordinadas</h3>
        <p className="text-sm text-green-700">
          Todas las {data.con_jornada_asociada} inauguraciones del año tienen
          jornada de tamizaje asociada.
        </p>
      </div>
    );
  }
  return (
    <div className="card p-4 bg-red-50 border-red-300 border-2">
      <h3 className="font-bold text-red-900 flex items-center gap-2">
        ⚠️ Inauguraciones SIN jornada asociada
        <span className="badge bg-red-600 text-white">{sinJor}</span>
      </h3>
      <p className="text-sm text-red-700 mb-2">
        Toda inauguración requiere coordinación con SIPRESALUD para llevar
        equipo médico. Las siguientes inauguraciones programadas NO tienen
        jornada de tamizaje asociada:
      </p>
      <ul className="text-sm space-y-1">
        {data.alertas.slice(0, 10).map((j) => (
          <li key={j.id} className="bg-white rounded p-2 border border-red-200">
            <span className="font-mono text-xs text-red-600">{j.codigo}</span>
            {' · '}
            <span className="font-medium">{j.empresa_nombre || '(sin empresa)'}</span>
            {' · '}
            <span className="text-slate-600">{j.fecha_inicio}</span>
            {j.departamento && <span className="text-slate-500"> · {j.departamento}</span>}
          </li>
        ))}
      </ul>
      {data.alertas.length > 10 && (
        <p className="text-xs text-red-600 mt-1">
          + {data.alertas.length - 10} más…
        </p>
      )}
    </div>
  );
}

export function EstadoJornadasChart() {
  const { data, err } = useChartData('estado-jornadas');
  if (err === '403' || !data || data.length === 0) return null;
  const ALERT_KEY = '⚠️ INAUG SIN JORNADA';
  const fmt = data.map((d) => ({
    name: d.estado, value: d.n,
    fill: d.estado === ALERT_KEY
      ? '#dc2626'  // rojo intenso para alerta
      : (SEMAFORO_COLORS[d.estado] || '#9ca3af'),
    esAlerta: d.estado === ALERT_KEY,
  }));
  const totalAlertas = fmt.filter(f => f.esAlerta).reduce((s,f) => s + f.value, 0);
  return (
    <ChartCard title={`🎯 Estado de jornadas (mes actual)${totalAlertas > 0 ? ` — ⚠️ ${totalAlertas} sin jornada` : ''}`}
                height={280}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={fmt} dataKey="value" nameKey="name"
                outerRadius={95}
                label={(e) => `${e.name}: ${e.value}`}>
            {fmt.map((e, i) => (
              <Cell key={i} fill={e.fill}
                     stroke={e.esAlerta ? '#7f1d1d' : '#fff'}
                     strokeWidth={e.esAlerta ? 3 : 1} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CostosMensualesChart() {
  // Solo gerencia/admin (endpoint require_gerencia → 403 a otros)
  const { data, err } = useChartData('costos-mensuales');
  if (err === '403' || !data) return null;
  return (
    <ChartCard title="💰 Costos mensuales acumulados (kit + personal + viáticos)"
                subtitle="Solo visible para gerencia y admin">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mes" fontSize={11} />
          <YAxis fontSize={11} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
          <Tooltip formatter={(v) => fmtQ(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="kit" name="Kit lab" stackId="a" fill="#0066B3" />
          <Bar dataKey="personal" name="Personal" stackId="a" fill="#00A99D" />
          <Bar dataKey="viaticos" name="Viáticos" stackId="a" fill="#eab308" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
