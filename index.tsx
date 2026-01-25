
import React from 'react';
import ReactDOM from 'react-dom/client';

// SHIM GLOBAL ABSOLUTO - DEVE SER O PRIMEIRO CÓDIGO A EXECUTAR
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

import App from './App.tsx';

interface ErrorBoundaryProps {
  // Fix: Make children optional to resolve "Property 'children' is missing" errors in some TS configurations
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Simples Error Boundary para evitar tela branca total
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Remove redundant manual declarations of props and state that shadow React.Component's internal types
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', background: '#f8fafc'}}>
          <h2 style={{color: '#1e293b'}}>Ops! Algo deu errado ao carregar o sistema.</h2>
          <p style={{color: '#64748b'}}>Tente atualizar a página ou verifique sua conexão.</p>
          <button onClick={() => window.location.reload()} style={{marginTop: '20px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>Atualizar Sistema</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
