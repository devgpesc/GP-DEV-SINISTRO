import React, { ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles/app.css';
import { applyTypographyPreset, getStoredTypographyPreset } from './utils/typography';

applyTypographyPreset(getStoredTypographyPreset());

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const StartupMessage = ({ configuration = false }: { configuration?: boolean }) => (
  <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">
        {configuration ? 'Configuração indisponível' : 'Não foi possível carregar esta tela'}
      </h1>
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">
        {configuration
          ? 'O ambiente não está configurado corretamente. Contate o administrador.'
          : 'Tente novamente. Se o problema continuar, contate o administrador.'}
      </p>
      {!configuration && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Tentar novamente
        </button>
      )}
    </section>
  </main>
);

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) return <StartupMessage />;
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento raiz indisponível.');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      if (import.meta.env.DEV) console.error('[PWA]', error);
    });
  });
}

const root: Root = createRoot(rootElement);
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim();

if (!supabaseUrl || !supabaseKey) {
  root.render(<StartupMessage configuration />);
} else {
  import('./App.tsx')
    .then(({ default: App }) => {
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>,
      );
    })
    .catch((error) => {
      if (import.meta.env.DEV) console.error('[Startup]', error);
      root.render(<StartupMessage />);
    });
}
