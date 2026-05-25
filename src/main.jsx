import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './theme/ThemeProvider.jsx';

// SPA deep-link recovery: si el 404.html redirigió aquí, restaura la ruta.
const _redirect = sessionStorage.getItem('redirect');
if (_redirect) {
  sessionStorage.removeItem('redirect');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const target = _redirect.startsWith(base) ? _redirect.slice(base.length) : _redirect;
  if (target && target !== '/') window.history.replaceState(null, '', base + target);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
