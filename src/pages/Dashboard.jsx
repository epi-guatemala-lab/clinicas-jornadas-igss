import { useEffect, useState } from 'react';
import { apiDashboard } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import KPICard from '../components/KPICard';
import {
  Serie12MesesChart, TiposJornadaChart, TopEmpresasChart,
  DistribucionDepartamentoChart, EstadoJornadasChart, CostosMensualesChart,
} from '../components/Charts';
import { fmtQ, fmtN, fmtPct, TIPO_LABEL, SEMAFORO_DOT } from '../utils/format';

const ENDPOINT_POR_ROL = {
  admin: 'gerencia', gerencia: 'gerencia', ce: 'ce', sipresalud: 'sipresalud',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const rol = ENDPOINT_POR_ROL[user.rol];
    apiDashboard(rol).then(setData).catch((e) =>
      setErr(e.response?.data?.detail || 'Error cargando dashboard'),
    );
  }, [user.rol]);

  if (err) return <div className="bg-red-50 text-red-700 p-3 rounded">{err}</div>;
  if (!data) return <div className="text-slate-500">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resumen — {data.periodo}</h1>
        <p className="text-sm text-slate-500">Datos del mes en curso. Los semáforos se actualizan en vivo según cierres.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.kpis.map((k, i) => <KPICard key={i} kpi={k} />)}
      </div>

      {/* Sección de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Serie12MesesChart />
        <DistribucionDepartamentoChart />
        <TiposJornadaChart />
        <EstadoJornadasChart />
      </div>
      <TopEmpresasChart />
      <CostosMensualesChart />

      {user.rol === 'sipresalud' && data.distribucion_departamento && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Atendidos por departamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {data.distribucion_departamento.map((d) => (
              <div key={d.depto} className="flex justify-between border-b py-1">
                <span>{d.depto}</span>
                <span><b>{fmtN(d.atendidos)}</b> ({d.n_jornadas} jornadas)</span>
              </div>
            ))}
            {data.distribucion_departamento.length === 0 && <div className="text-slate-400">Sin jornadas cerradas este mes</div>}
          </div>
        </div>
      )}

      {data.costos && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Desglose de costos del mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <CostBox label="Kit de laboratorio" value={data.costos.kit} color="bg-blue-50 text-blue-800" />
            <CostBox label="Personal (prorrateado)" value={data.costos.personal} color="bg-emerald-50 text-emerald-800" />
            <CostBox label="Viáticos" value={data.costos.viaticos} color="bg-amber-50 text-amber-800" />
            <CostBox label="Total" value={data.costos.total} color="bg-igss-light text-igss-dark font-bold" />
          </div>
        </div>
      )}

      {data.alertas && data.alertas.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">⚠️ Alertas</h2>
          <ul className="space-y-1 text-sm">
            {data.alertas.map((a, i) => (
              <li key={i} className="flex gap-2 items-start border-b py-1">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${SEMAFORO_DOT[a.color] || 'bg-slate-300'}`} />
                <div className="flex-1">
                  <b>{a.codigo}</b> · {a.tipo}{a.razon && ` · ${a.razon}`} · {a.fecha}
                  {a.detalle && <div className="text-slate-500 text-xs">{a.detalle}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.proximas_jornadas && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Próximas jornadas</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left py-1">Fecha</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Empresa</th>
                <th className="text-left">Lugar</th>
                <th className="text-right">Programados</th>
              </tr>
            </thead>
            <tbody>
              {data.proximas_jornadas.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="py-1">{j.fecha_inicio} {j.hora_inicio?.slice(0,5)}</td>
                  <td>{TIPO_LABEL[j.tipo] || j.tipo}</td>
                  <td>{j.empresa_nombre || '—'}</td>
                  <td>{[j.departamento, j.municipio].filter(Boolean).join(', ')}</td>
                  <td className="text-right">{fmtN(j.programados)}</td>
                </tr>
              ))}
              {data.proximas_jornadas.length === 0 && (
                <tr><td colSpan="5" className="text-slate-400 py-2 text-center">Sin próximas jornadas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CostBox({ label, value, color }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-semibold">{fmtQ(value)}</div>
    </div>
  );
}
