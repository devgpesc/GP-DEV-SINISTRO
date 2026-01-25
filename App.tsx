
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Quotations from './pages/Quotations';
import AIAssistant from './components/AIAssistant';

// Placeholder for other pages to be implemented in a real scenario
const Placeholder = ({ name }: { name: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
    <h2 className="text-2xl font-bold">{name}</h2>
    <p>Módulo em desenvolvimento para V1.1</p>
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/cotacoes" element={<Quotations />} />
          <Route path="/compras" element={<Placeholder name="Ordens de Compra" />} />
          <Route path="/entregas" element={<Placeholder name="Entregas & Conformidade" />} />
          <Route path="/fornecedores" element={<Placeholder name="Fornecedores" />} />
          <Route path="/veiculos" element={<Placeholder name="Gestão de Veículos" />} />
          <Route path="/catalogo" element={<Placeholder name="Catálogo de Peças" />} />
          <Route path="/relatorios" element={<Placeholder name="Central de Relatórios" />} />
          <Route path="/configuracoes" element={<Placeholder name="Configurações do Sistema" />} />
        </Routes>
      </Layout>
      <AIAssistant />
    </Router>
  );
};

export default App;
