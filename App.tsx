
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Events from './pages/Events.tsx';
import Quotations from './pages/Quotations.tsx';
import Vehicles from './pages/Vehicles.tsx';
import AIAssistant from './components/AIAssistant.tsx';

const Placeholder = ({ name }: { name: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
    <h2 className="text-2xl font-bold">{name}</h2>
    <p>Módulo em desenvolvimento para V1.1</p>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/cotacoes" element={<Quotations />} />
            <Route path="/compras" element={<Placeholder name="Ordens de Compra" />} />
            <Route path="/entregas" element={<Placeholder name="Entregas & Conformidade" />} />
            <Route path="/fornecedores" element={<Placeholder name="Fornecedores" />} />
            <Route path="/veiculos" element={<Vehicles />} />
            <Route path="/catalogo" element={<Placeholder name="Catálogo de Peças" />} />
            <Route path="/relatorios" element={<Placeholder name="Central de Relatórios" />} />
            <Route path="/configuracoes" element={<Placeholder name="Configurações do Sistema" />} />
          </Routes>
        </Layout>
        <AIAssistant />
      </Router>
    </AuthProvider>
  );
};

export default App;
