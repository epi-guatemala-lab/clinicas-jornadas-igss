import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './theme/ThemeProvider.jsx';

// SPA deep-link recovery: si el 404.html redirigió aquí, restaura la ruta.
// OJO: no confundir con `post_login` (lo escribe el interceptor de 401 en
// api/client.js). Son dos cosas distintas y no se pisan: `redirect` es un enlace
// profundo que GitHub Pages no sabe servir y se resuelve ACÁ, antes de montar
// nada; `post_login` es dónde estaba trabajando alguien cuando se le venció la
// sesión, y solo tiene sentido consumirlo DESPUÉS de volver a autenticarse.
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
          {/* Va DENTRO del tema y del router: si la pantalla de respaldo se
              montara fuera, se vería en claro sobre un portal en oscuro. */}
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
