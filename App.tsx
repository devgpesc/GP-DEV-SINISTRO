
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Events from './pages/Events.tsx';
import Quotations from './pages/Quotations.tsx';
import Vehicles from './pages/Vehicles.tsx';
import Catalog from './pages/Catalog.tsx';
import Suppliers from './pages/Suppliers.tsx';
import AIAssistant from './components/AIAssistant.tsx';

const Placeholder = ({ name }: { name: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 p-8 text-center">
    <div className="bg-slate-50 p-6 rounded-full mb-6">
       <BarChart3 size={48} className="text-slate-200" />
    </div>
    <h2 className="text-2xl font-bold text-slate-700">{name}</h2>
    <p className="mt-2 max-w-xs font-medium">Este módulo está sendo finalizado pela equipe de arquitetura e será entregue na V1.1.</p>
  </div>
);

import { BarChart3 } from 'lucide-react';

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
            <Route path="/entregas" element={<Placeholder name="Gestão de Entregas" />} />
            <Route path="/fornecedores" element={<Suppliers />} />
            <Route path="/veiculos" element={<Vehicles />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/relatorios" element={<Placeholder name="Central de Inteligência" />} />
            <Route path="/configuracoes" element={<Placeholder name="Configurações Avançadas" />} />
          </Routes>
        </Layout>
        <AIAssistant />
      </Router>
    </AuthProvider>
  );
};

export default App;
