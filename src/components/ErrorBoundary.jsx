import React from 'react';

/**
 * Red de seguridad para errores de render. ÚNICO componente de clase del
 * proyecto: React no expone la captura de errores como hook, así que aquí la
 * clase no es estilo viejo sino la única forma que hay.
 *
 * Por qué existe (incidente «cuando le dan edición se sale», agosto 2026):
 * al guardar una jornada con una charla sin responsable el servidor respondía
 * 422 con `detail` como ARRAY de Pydantic, el modal metía ese arreglo directo
 * en el JSX del mensaje de error y React reventaba con «Objects are not valid
 * as a React child». Cuando nadie captura un error de render, React 18
 * DESMONTA EL ÁRBOL COMPLETO: el portal se quedaba en blanco y quien lo usaba
 * lo leía como que se le había cerrado la sesión. Ese 422 ya está corregido de
 * raíz (formulario + validadores del servidor), pero sin esta barrera el
 * siguiente error de render —el que sea— vuelve a tumbar el portal entero en
 * lugar de una sola pantalla.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // No hay servicio de telemetría: la consola del navegador es lo único con
    // lo que se puede reconstruir un reporte de «se puso en blanco».
    console.error('[ErrorBoundary] Error de render no capturado:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
        <div className="card max-w-lg w-full p-6 text-center">
          <div className="text-4xl mb-3" aria-hidden>⚠️</div>
          <h1 className="text-xl font-bold text-fg">Algo falló en esta pantalla</h1>
          <p className="text-sm text-fg-muted mt-2">
            El portal encontró un error que no supo manejar. Los datos que ya
            estaban guardados no se vieron afectados, pero lo que estabas
            escribiendo en esta pantalla se perdió.
          </p>
          <p className="text-sm text-fg-muted mt-2">
            Recargá la página y volvé a intentarlo. Si vuelve a pasar en el
            mismo punto, avisá al administrador del portal indicando qué
            estabas haciendo.
          </p>
          {/* El detalle técnico va plegado y como TEXTO (String(error)): meter
              el objeto crudo en el JSX es justamente lo que provocó el fallo
              que este componente atrapa. */}
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-fg-subtle hover:underline">
              Detalle técnico
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-danger-soft p-2 text-[11px] text-danger whitespace-pre-wrap break-words">
              {String(error?.message || error)}
            </pre>
          </details>
          <button type="button" className="btn-primary w-full mt-5"
            onClick={() => window.location.reload()}>
            Recargar la página
          </button>
        </div>
      </div>
    );
  }
}
