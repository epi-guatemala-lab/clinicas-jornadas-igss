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

export function TiposJornadaChart() {
  const { data, err } = useChartData('tipos-jornada');
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.map((d) => ({
    name: d.tipo.replace(/_/g, ' '), value: d.n,
    atendidos: d.atendidos,
  }));
  return (
    <ChartCard title="🍩 Distribución por tipo (mes actual)" height={280}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={fmt} dataKey="value" nameKey="name"
                outerRadius={90} innerRadius={45} label={(e) => `${e.value}`}>
            {fmt.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
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

export function DistribucionDepartamentoChart() {
  const { data, err } = useChartData('distribucion-departamento');
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.slice(0, 15).map((d) => ({
    depto: d.departamento.length > 12 ? d.departamento.slice(0, 11) + '…' : d.departamento,
    atendidos: d.atendidos, jornadas: d.n_jornadas,
  }));
  return (
    <ChartCard title="🗺️ Pacientes atendidos por departamento (año)" height={320}>
      <ResponsiveContainer>
        <BarChart data={fmt}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="depto" fontSize={10} angle={-45} textAnchor="end" height={70} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v) => fmtN(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="atendidos" name="Atendidos" fill="#00A99D" />
          <Bar dataKey="jornadas" name="N° Jornadas" fill="#0066B3" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function EstadoJornadasChart() {
  const { data, err } = useChartData('estado-jornadas');
  if (err === '403' || !data || data.length === 0) return null;
  const fmt = data.map((d) => ({
    name: d.estado, value: d.n,
    fill: SEMAFORO_COLORS[d.estado] || '#9ca3af',
  }));
  return (
    <ChartCard title="🎯 Estado de jornadas (mes actual)" height={260}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={fmt} dataKey="value" nameKey="name"
                outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
            {fmt.map((e, i) => <Cell key={i} fill={e.fill} />)}
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
