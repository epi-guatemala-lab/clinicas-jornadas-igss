import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'igss_theme';
// 'light' | 'dark' | 'system'
const VALID = new Set(['light', 'dark', 'system']);

export const ThemeContext = createContext({
  mode: 'system',
  effective: 'light',
  setMode: () => {},
  toggle: () => {},
  isDark: false,
});

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (VALID.has(v)) return v;
    // Default: modo oscuro (decisión institucional para el módulo). El usuario
    // puede cambiarlo con el toggle del header, que persiste su preferencia.
    return 'dark';
  } catch {
    return 'dark';
  }
}

function sysPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyClass(isDark) {
  const el = document.documentElement;
  if (isDark) el.classList.add('dark');
  else el.classList.remove('dark');
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStored());
  const [systemDark, setSystemDark] = useState(() => sysPrefersDark());

  // Escucha cambios del sistema (solo aplica si mode === 'system')
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemDark(e.matches);
    // Safari < 14 usa addListener / removeListener
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  const effective = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const isDark = effective === 'dark';

  // Aplica clase .dark en <html>
  useEffect(() => {
    applyClass(isDark);
  }, [isDark]);

  const setMode = useCallback((next) => {
    if (!VALID.has(next)) return;
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    // Ciclo simple: light → dark → light (system queda accesible por menú/longpress después)
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo(
    () => ({ mode, effective, setMode, toggle, isDark }),
    [mode, effective, setMode, toggle, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
