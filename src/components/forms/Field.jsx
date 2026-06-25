/**
 * Field wrapper: label + input/select/textarea + error inline.
 * Reemplaza el patrón `<label className="label">...<input className="input">`
 * duplicado ~70 veces en el repo.
 */
export default function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  options,       // para type='select': [['val','Label'], ...] o [{value, label}]
  rows = 3,      // para textarea
  min, max, step,
  disabled,
  className = '',
  inputClassName = '',
  children,
}) {
  const id = name || label?.toLowerCase().replace(/\s+/g, '-');
  const errId = error ? `${id}-err` : undefined;

  const baseInput = `w-full px-3 py-2 rounded-md border bg-surface text-fg text-sm
                     focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     ${error ? 'border-danger' : 'border-line'}
                     ${inputClassName}`;

  const renderControl = () => {
    if (children) return children;

    if (type === 'select') {
      return (
        <select id={id} name={name} value={value ?? ''} onChange={onChange}
                disabled={disabled} className={baseInput}
                aria-invalid={!!error} aria-describedby={errId}>
          {(options || []).map((o) => {
            const val = Array.isArray(o) ? o[0] : o.value;
            const lbl = Array.isArray(o) ? o[1] : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      );
    }

    if (type === 'combobox') {
      // input libre + <datalist> de sugerencias (valores previos) — permite agregar nuevos.
      const listId = `${id}-list`;
      return (
        <>
          <input id={id} name={name} type="text" value={value ?? ''} onChange={onChange}
                 placeholder={placeholder} disabled={disabled} list={listId}
                 className={baseInput} aria-invalid={!!error} aria-describedby={errId} />
          <datalist id={listId}>
            {(options || []).map((o) => {
              const val = Array.isArray(o) ? o[0] : (o && typeof o === 'object' ? o.value : o);
              return <option key={val} value={val} />;
            })}
          </datalist>
        </>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea id={id} name={name} value={value ?? ''} onChange={onChange}
                  rows={rows} disabled={disabled} placeholder={placeholder}
                  className={baseInput}
                  aria-invalid={!!error} aria-describedby={errId} />
      );
    }

    if (type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input id={id} name={name} type="checkbox"
                 checked={!!value} onChange={onChange} disabled={disabled}
                 className="h-4 w-4 accent-accent" />
          <span className="text-sm text-fg">{placeholder || label}</span>
        </label>
      );
    }

    return (
      <input
        id={id} name={name} type={type} value={value ?? ''} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        min={min} max={max} step={step}
        className={baseInput}
        aria-invalid={!!error} aria-describedby={errId}
      />
    );
  };

  if (type === 'checkbox' && !error && !hint) {
    return <div className={className}>{renderControl()}</div>;
  }

  return (
    <div className={className}>
      {label && type !== 'checkbox' && (
        <label htmlFor={id} className="block text-sm font-medium text-fg-muted mb-1">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {renderControl()}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-[11px] text-danger" role="alert">{error}</p>
      )}
    </div>
  );
}
