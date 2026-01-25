
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
import Purchases from './pages/Purchases.tsx';
import Deliveries from './pages/Deliveries.tsx';
import Reports from './pages/Reports.tsx';
import Settings from './pages/Settings.tsx';
import AIAssistant from './components/AIAssistant.tsx';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/cotacoes" element={<Quotations />} />
            <Route path="/compras" element={<Purchases />} />
            <Route path="/entregas" element={<Deliveries />} />
            <Route path="/fornecedores" element={<Suppliers />} />
            <Route path="/veiculos" element={<Vehicles />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/relatorios" element={<Reports />} />
            <Route path="/configuracoes" element={<Settings />} />
          </Routes>
        </Layout>
        <AIAssistant />
      </Router>
    </AuthProvider>
  );
};

export default App;
