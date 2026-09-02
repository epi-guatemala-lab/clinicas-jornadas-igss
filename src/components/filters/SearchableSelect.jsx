import { useEffect, useMemo, useRef, useState } from 'react';
import { normIncludes } from '../../utils/norm';

/**
 * Combobox drop-in para reemplazar <select> con muchas opciones. Filtrado
 * client-side accent-insensitive, navegación por teclado, click-fuera-cierra,
 * y manejo de valor que no está en la lista (legacy/FK inactivo).
 *
 * Contrato compatible con <select>:
 *   <SearchableSelect value={x} onChange={(v)=>set('x', v)} options={[{value,label}]}
 *                     placeholder="— Sin empresa —" />
 *   `onChange` recibe el value crudo como STRING (igual que e.target.value).
 *
 * options: [{value, label, disabled?, description?}] o [[value, label]] o
 * [value] (label=value). Un item disabled se muestra con la razón pero no se
 * puede elegir; se usa para explicar jornadas/traslados que ocupan al personal.
 * placeholder: texto del option vacío (value=''). allowEmpty (default true) lo incluye.
 * filterKeys: si querés buscar también por value (ej. NIT), pasar ['value'].
 * formatOption(o): devuelve el label a mostrar (default o.label).
 *
 * Caso legacy (value no en options): inyecta un item al tope "Valor actual (ID …)"
 * con fondo warning, para NO perder el FK al editar.
 */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => {
    if (Array.isArray(o)) return { value: String(o[0]), label: String(o[1] ?? o[0]) };
    if (o && typeof o === 'object') return {
      ...o, value: String(o.value), label: String(o.label ?? o.value),
      disabled: o.disabled === true,
    };
    return { value: String(o), label: String(o) };
  });
}

export default function SearchableSelect({
  value, onChange, options, placeholder = '— Seleccione —',
  allowEmpty = true, disabled = false, className = '',
  id, name, 'aria-label': ariaLabel, filterKeys = [], formatOption,
}) {
  const hostRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const opts = useMemo(() => normalizeOptions(options), [options]);
  const valueStr = String(value ?? '');

  // Item seleccionado actualmente (lookup por value) + detección legacy.
  const current = opts.find((o) => o.value === valueStr);
  const isLegacy = !!valueStr && !current;
  const fmt = (o) => (formatOption ? formatOption(o) : o.label);

  // Lista visible: item legacy (si hay) + item vacío (si allowEmpty) + filtrados.
  const visible = useMemo(() => {
    let base = opts;
    if (query) {
      base = opts.filter((o) =>
        normIncludes(fmt(o), query) || filterKeys.some((k) => normIncludes(o[k], query)));
    }
    const head = [];
    if (isLegacy) {
      head.push({ value: valueStr, label: `Valor actual (ID ${valueStr})`, _legacy: true });
    }
    if (allowEmpty) {
      head.push({ value: '', label: placeholder });
    }
    return [...head, ...base];
  }, [opts, query, isLegacy, allowEmpty, placeholder, filterKeys]); // eslint-disable-line

  const currentLabel = isLegacy ? `Valor actual (ID ${valueStr})` : (current ? fmt(current) : '');

  // Items de cabecera al inicio de `visible` (legacy + placeholder vacío).
  const headLen = (isLegacy ? 1 : 0) + (allowEmpty ? 1 : 0);

  // Al escribir para filtrar, posar el activo en el primer item REAL (saltando la
  // cabecera). Sin esto, un Enter reflejo tras teclear seleccionaría el placeholder
  // vacío y vaciaría el FK silenciosamente.
  useEffect(() => {
    if (!open || !query) return;
    setActiveIndex(visible.length > headLen ? headLen : -1);
  }, [query]); // eslint-disable-line

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (hostRef.current && !hostRef.current.contains(e.target)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Scroll al item activo.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector?.('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    // pre-seleccionar el item actualmente elegido (o el primero).
    const idx = Math.max(0, visible.findIndex((o) => o.value === valueStr));
    setActiveIndex(idx);
  };

  const select = (o) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openMenu(); return; }
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // El Enter NUNCA sale de este control. Con el desplegable abierto elige el
      // item activo; con el desplegable CERRADO no hace nada. Antes ese segundo
      // caso caía al <form> padre y guardaba la jornada entera: como el control
      // es un <input>, un Enter después de escribir para filtrar (o tras cerrar
      // con Escape) enviaba el formulario a medio llenar sin que nadie lo pidiera.
      e.preventDefault();
      if (open && activeIndex >= 0 && visible[activeIndex] && !visible[activeIndex].disabled) {
        select(visible[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); setQuery(''); }
    } else if (e.key === 'Tab') {
      if (open && visible.length === 1 && visible[0].value !== '' && !visible[0]._legacy) {
        select(visible[0]);
      } else if (open) {
        setOpen(false); setQuery('');
      }
    }
  };

  const shown = open ? query : (currentLabel || '');
  const triggerPlaceholder = currentLabel || placeholder;

  return (
    <div className={`relative ${className}`} ref={hostRef}>
      <input
        id={id} name={name} type="text" role="combobox" aria-expanded={open}
        aria-label={ariaLabel} aria-disabled={disabled}
        autoComplete="off"
        className={`input cursor-pointer ${isLegacy ? 'border-warning' : ''}`}
        value={shown}
        placeholder={triggerPlaceholder}
        disabled={disabled}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(e) => { if (!open) setOpen(true); setQuery(e.target.value); }}
        onKeyDown={onKeyDown}
      />
      {/* chevron */}
      <svg viewBox="0 0 24 24" fill="none" aria-hidden
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none">
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open && (
        <ul ref={listRef} role="listbox"
          className="absolute z-[60] left-0 right-0 mt-1 max-h-60 overflow-auto bg-surface border border-line rounded-md shadow-lg">
          {visible.length === 0 && (
            <li className="px-3 py-2 text-sm text-fg-muted">Sin coincidencias</li>
          )}
          {visible.map((o, i) => (
            <li key={`${o.value}-${i}`} role="option" aria-selected={o.value === valueStr}
              aria-disabled={o.disabled || undefined}
              data-active={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); if (!o.disabled) select(o); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-1.5 text-sm flex items-center justify-between gap-2
                ${o.disabled ? 'cursor-not-allowed opacity-55 bg-sunken/60' : 'cursor-pointer'}
                ${i === activeIndex && !o.disabled ? 'bg-accent text-white' : ''}
                ${o._legacy ? '!bg-warning-soft !text-warning' : ''}
                ${!o._legacy && o.value === '' ? 'text-fg-muted italic' : ''}`}>
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                {o.description && (
                  <span className="block text-[10px] leading-tight opacity-90 truncate">
                    {o.description}
                  </span>
                )}
              </span>
              {o.disabled && <span className="text-[10px] uppercase flex-shrink-0">Ocupado</span>}
              {o._legacy && <span className="text-[10px] uppercase opacity-80">no visible</span>}
              {!o._legacy && o.value === valueStr && valueStr !== '' && (
                <span className="text-xs">✓</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
