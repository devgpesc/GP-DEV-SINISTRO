
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { PrivateRoute } from './components/PrivateRoute.tsx';
import Layout from './components/Layout.tsx';

// Pages
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
import SaasAdmin from './pages/SaasAdmin.tsx';
import Associates from './pages/Associates.tsx';
import Notifications from './pages/Notifications.tsx';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
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
                      <Route path="/associados" element={<Associates />} />
                      <Route path="/veiculos" element={<Vehicles />} />
                      <Route path="/catalogo" element={<Catalog />} />
                      <Route path="/relatorios" element={<Reports />} />
                      <Route path="/configuracoes" element={<Settings />} />
                      <Route path="/notificacoes" element={<Notifications />} />
                      <Route path="/saas-admin" element={
                          <AdminRoute><SaasAdmin /></AdminRoute>
                      } />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                 </Layout>
               </PrivateRoute>
            } />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
