import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

// SHIM GLOBAL ABSOLUTO - DEVE SER O PRIMEIRO CÓDIGO A EXECUTAR
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

import App from './App.tsx';

interface ErrorBoundaryProps {
  // Fix: Make children optional to resolve "Property 'children' is missing" errors in some TS configurations
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Simples Error Boundary para evitar tela branca total
// Use the Component type directly from React to ensure proper generic binding
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Explicitly declare state to resolve Property 'state' does not exist error on lines 28 and 35
  public state: ErrorBoundaryState = { hasError: false };

  // Fix: Use standard constructor to ensure proper initialization of props and resolve Property 'props' does not exist error on line 36
  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    // Explicitly destructure from this to help TS inference
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', background: '#f8fafc'}}>
          <h2 style={{color: '#1e293b'}}>Ops! Algo deu errado ao carregar o sistema.</h2>
          <p style={{color: '#64748b'}}>Tente atualizar a página ou verifique sua conexão.</p>
          <button onClick={() => window.location.reload()} style={{marginTop: '20px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>Atualizar Sistema</button>
        </div>
      );
    }
    return children;
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