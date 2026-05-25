import { useEffect } from 'react';

/**
 * Modal con overlay glass, ESC para cerrar, click-outside, scroll lock.
 * Reemplaza los `<div className="fixed inset-0 bg-black/50">` duplicados en
 * NuevaJornada, EmpresaForm, PersonalForm, MetaForm, NuevoViatico.
 */
export default function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  size = 'md',          // 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop = true,
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${sizeClass} max-h-[90vh] flex flex-col
                    rounded-2xl border border-line bg-surface shadow-2xl
                    dark:shadow-glow-accent
                    ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-line-subtle">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            <button
              type="button" onClick={onClose}
              aria-label="Cerrar"
              className="text-fg-muted hover:text-fg p-1 -m-1 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line-subtle bg-surface-elev/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
