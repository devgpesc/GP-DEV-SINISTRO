

import React, { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

// SHIM GLOBAL ABSOLUTO - DEVE SER O PRIMEIRO CÓDIGO A EXECUTAR
console.log('[AutoClaims] Inicializando shims...');
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

import App from './App.tsx';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Explicitly inheriting from React.Component and using a constructor to resolve 'Property props does not exist' error.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) { 
    return { hasError: true, error }; 
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AutoClaims] Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', background: '#f8fafc', padding: '20px'}}>
          <h2 style={{color: '#1e293b'}}>Ops! Algo deu errado ao carregar o sistema.</h2>
          <pre style={{background: '#fee2e2', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#b91c1c'}}>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{marginTop: '20px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>Atualizar Sistema</button>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[AutoClaims] Localizando elemento root...');
const rootElement = document.getElementById('root');

if (rootElement) {
  console.log('[AutoClaims] Elemento root encontrado. Criando raiz do React...');
  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log('[AutoClaims] Renderização inicial disparada.');
  } catch (err) {
    console.error('[AutoClaims] Erro fatal durante createRoot:', err);
  }
} else {
  console.error('[AutoClaims] ERRO CRÍTICO: Não foi possível encontrar o elemento <div id="root"> no HTML.');
  document.body.innerHTML = '<div style="color: red; padding: 20px; font-weight: bold;">Erro de Inicialização: Elemento #root não encontrado.</div>';
}
