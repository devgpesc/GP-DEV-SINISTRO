
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// Componente para proteger rota de Admin
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, loading } = useAuth();
  
  if (loading) return null; // Deixa o PrivateRoute lidar com o loading visual
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    console.log('[AutoClaims] App Inicializado. Usando BrowserRouter para suporte nativo OAuth.');
  }, []);

  return (
    <AuthProvider>
      {/* 
        USANDO BROWSER ROUTER
        O Google OAuth retorna tokens na URL. O HashRouter (#) quebra esse fluxo 
        porque interpreta o token como uma rota inexistente antes do Supabase ler.
        O BrowserRouter permite que o Supabase Client leia a URL corretamente.
      */}
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rotas Privadas (Protegidas) */}
          {/* PrivateRoute agora gerencia o estado de loading globalmente */}
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
             
             {/* Rota Super Admin */}
             <Route path="/saas-admin" element={
               <AdminRoute>
                 <SaasAdmin />
               </AdminRoute>
             } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Assistente Flutuante (renderizado apenas se autenticado, controlado internamente ou via rota) */}
        <AuthOnlyAssistant />
      </Router>
    </AuthProvider>
  );
};

// Pequeno wrapper para mostrar o Assistant apenas quando logado
const AuthOnlyAssistant = () => {
  const { user } = useAuth();
  return user ? <AIAssistant /> : null;
};

export default App;
