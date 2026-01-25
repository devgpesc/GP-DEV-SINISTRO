
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { PrivateRoute } from './components/PrivateRoute.tsx';
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
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import AIAssistant from './components/AIAssistant.tsx';

const App: React.FC = () => {
  useEffect(() => {
    console.log('[AutoClaims] Produção: Supabase Ativo.');
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rotas Privadas (Protegidas) */}
          <Route path="/*" element={
            <PrivateRoute>
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
              <AIAssistant />
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
