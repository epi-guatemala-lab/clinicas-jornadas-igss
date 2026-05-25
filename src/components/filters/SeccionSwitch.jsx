import FilterChip from './FilterChip';

/**
 * Switch CE / SIPRESALUD (con o sin "Todas") — consolida 3 patterns ad-hoc
 * dispersos en Calendario, Jornadas, Personal.
 */
export default function SeccionSwitch({
  value,
  onChange,
  includeAll = true,
  size = 'md',
  className = '',
}) {
  const opts = [];
  if (includeAll) opts.push(['', 'Todas']);
  opts.push(['CE', 'CE'], ['SIPRESALUD', 'SIPRESALUD']);

  return (
    <div className={`inline-flex gap-1 ${className}`} role="group" aria-label="Filtrar por sección">
      {opts.map(([val, label]) => (
        <FilterChip
          key={val || 'all'}
          active={value === val}
          onClick={() => onChange(val)}
        >
          {label}
        </FilterChip>
      ))}
    </div>
  );
}
