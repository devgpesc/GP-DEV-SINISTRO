
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'https://esm.sh/react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
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
import SaasAdmin from './pages/SaasAdmin.tsx';

// Rota protegida específica para Super Admin
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, loading } = useAuth();
  
  // PrivateRoute já cuida do loading global, mas verificamos novamente por segurança
  if (loading) return null;
  
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    console.log('[App] Inicializando Router...');
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rotas Privadas (Protegidas por PrivateRoute) */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
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
             
             {/* Rota Exclusiva Super Admin */}
             <Route path="/saas-admin" element={
               <AdminRoute>
                 <SaasAdmin />
               </AdminRoute>
             } />
          </Route>

          {/* Fallback para rota inexistente */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Assistente IA Global (visível apenas se logado) */}
        <AuthOnlyAssistant />
      </Router>
    </AuthProvider>
  );
};

// Wrapper para isolar o hook useAuth fora do provider no mesmo arquivo
const AuthOnlyAssistant = () => {
  const { user } = useAuth();
  return user ? <AIAssistant /> : null;
};

export default App;
