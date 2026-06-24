import { useRef, useState } from 'react';
import { apiUploadEpi } from '../api/endpoints';
import { fmtN } from '../utils/format';

/**
 * Cargador de la base epidemiológica (BASE_EPIDE) — SOLO admin.
 *
 * Flujo: elegir .xlsx → PREVIEW automático (apply=false, no escribe) → el usuario
 * ve cuántas filas NUEVAS entrarían y cuántos duplicados se omiten → "Aplicar".
 * Idempotente (mismo archivo = NO-OP) + agregatorio (solo suma; nunca borra).
 */
export default function EpiUploader({ onApplied }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);   // summary dry-run
  const [result, setResult] = useState(null);     // summary apply
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  function reset() {
    setFile(null); setPreview(null); setResult(null); setErr('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function pick(f) {
    if (!f) return;
    setErr(''); setResult(null); setPreview(null); setFile(f); setBusy(true);
    try {
      setPreview(await apiUploadEpi(f, false));   // dry-run
    } catch (e) {
      setErr(e.response?.data?.detail || 'No se pudo leer el archivo.');
    } finally { setBusy(false); }
  }

  async function aplicar() {
    if (!file) return;
    setErr(''); setBusy(true);
    try {
      const r = await apiUploadEpi(file, true);
      setResult(r);
      onApplied?.(r);
    } catch (e) {
      setErr(e.response?.data?.detail || 'No se pudo aplicar la carga.');
    } finally { setBusy(false); }
  }

  const nuevas = preview && preview.status === 'OK';
  const noop = (preview && preview.status === 'NOOP') || (result && result.status === 'NOOP');

  return (
    <div className="card border border-line">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left">
        <span className="font-semibold text-fg flex items-center gap-2">⬆️ Cargar / actualizar base epidemiológica</span>
        <span className="text-xs text-fg-muted">{open ? '▲ ocultar' : '▼ mostrar'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-fg-muted">
            Subí el Excel (BASE_EPIDE, hojas <code>BASE_PERSONAS</code> y <code>BASE_HALLAZGOS</code>).
            Primero verás una <b>previsualización</b> de lo que se agregaría. La carga es
            <b> idempotente</b> (el mismo archivo no se duplica) y <b>agregatoria</b> (solo suma; nunca borra).
          </p>

          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm"
              className="text-sm" disabled={busy}
              onChange={(e) => pick(e.target.files?.[0])} />
            {(file || preview || result) && (
              <button className="btn-secondary text-xs" onClick={reset} disabled={busy}>Limpiar</button>
            )}
          </div>

          {busy && <div className="text-sm text-fg-muted">Procesando…</div>}
          {err && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">{err}</div>}

          {noop && (
            <div className="text-sm rounded p-2 bg-surface-elev border border-line">
              ✅ {(result || preview).mensaje} (no se duplica nada)
            </div>
          )}

          {nuevas && !result && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-success">Previsualización (no se ha escrito nada)</div>
              <Row k="Personas nuevas a agregar" v={fmtN(preview.personas_insertadas)} />
              <Row k="Hallazgos nuevos a agregar" v={fmtN(preview.hallazgos_insertados)} />
              <Row k="Duplicados que se omiten (personas / hallazgos)"
                   v={`${fmtN(preview.duplicados_personas_omitidos)} / ${fmtN(preview.duplicados_hallazgos_omitidos)}`} />
              <Row k="Jornadas afectadas" v={fmtN(preview.jornadas)} />
              <div className="text-[11px] text-fg-muted pt-1">
                Total tras aplicar ≈ {fmtN(preview.totales.personas + preview.personas_insertadas)} personas ·
                {' '}{fmtN(preview.totales.hallazgos + preview.hallazgos_insertados)} hallazgos
              </div>
              <button className="btn-primary text-sm mt-2" onClick={aplicar} disabled={busy}>
                Aplicar carga
              </button>
            </div>
          )}

          {result && result.status === 'OK' && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-success">✅ Carga aplicada (batch {result.batch_id})</div>
              <Row k="Personas agregadas" v={fmtN(result.personas_insertadas)} />
              <Row k="Hallazgos agregados" v={fmtN(result.hallazgos_insertados)} />
              <Row k="Total en BD" v={`${fmtN(result.totales.personas)} personas · ${fmtN(result.totales.hallazgos)} hallazgos`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-fg-muted">{k}</span>
      <span className="font-semibold text-fg tabular-nums">{v}</span>
    </div>
  );
}
