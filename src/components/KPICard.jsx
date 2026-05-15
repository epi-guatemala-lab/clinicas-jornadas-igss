import { SEMAFORO_DOT, fmtN, fmtQ, fmtPct } from '../utils/format';

export default function KPICard({ kpi }) {
  const isCurrency = /costo/i.test(kpi.label);
  const isPct = /asistencia|\%/i.test(kpi.label);
  const valueFmt = isCurrency ? fmtQ(kpi.value)
                  : isPct ? fmtPct(kpi.value)
                  : fmtN(kpi.value);
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-600 text-xs uppercase tracking-wide">
        <span className={`w-2.5 h-2.5 rounded-full ${SEMAFORO_DOT[kpi.semaforo] || 'bg-slate-300'}`} />
        {kpi.label}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{valueFmt}</div>
      {kpi.meta != null && (
        <div className="mt-1 text-xs text-slate-500">
          Meta: <span className="font-medium">{fmtN(kpi.meta)}</span>
          {kpi.pct_meta != null && (
            <> · Progreso: <span className="font-medium">{fmtPct(kpi.pct_meta)}</span></>
          )}
        </div>
      )}
    </div>
  );
}
