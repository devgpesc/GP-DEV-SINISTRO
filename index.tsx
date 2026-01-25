
import React from 'react';
import ReactDOM from 'react-dom/client';

// Shim de emergência: deve rodar antes de qualquer lógica de negócio que use process.env
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

// Importação dinâmica ou após o shim para garantir que o ambiente esteja pronto
import App from './App.tsx';

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
