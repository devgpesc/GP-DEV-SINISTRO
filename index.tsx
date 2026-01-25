
import React from 'react';
import ReactDOM from 'react-dom/client';
// Importação com extensão .tsx para compatibilidade ESM pura
import App from './App.tsx';

// Shim para garantir que o acesso a process.env não quebre a aplicação no navegador
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
