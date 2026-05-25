/**
 * Skeleton shimmer reusable. Para usar dentro de cards/charts mientras cargan datos.
 */
export default function LoadingState({ lines = 3, height = 16, className = '' }) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rounded bg-surface-elev"
          style={{ height, width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ChartLoading({ height = 200 }) {
  return (
    <div
      className="flex items-end gap-1 animate-pulse p-2"
      style={{ height }}
      aria-label="Cargando gráfica"
    >
      {[40, 70, 55, 85, 60, 75, 50, 90, 65, 80, 45, 70].map((h, i) => (
        <div
          key={i}
          className="flex-1 bg-surface-elev rounded-t"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
