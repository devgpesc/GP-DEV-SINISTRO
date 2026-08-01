import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { BrowserRouter: Router, Routes, Route, Navigate } = ReactRouterDOM as any;
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { PrivateRoute } from './components/PrivateRoute.tsx';
import { PermissionRoute } from './components/PermissionRoute.tsx';
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
import AuthCallback from './pages/AuthCallback.tsx';
import PendingAccess from './pages/PendingAccess.tsx';
import SaasAdmin from './pages/SaasAdmin.tsx';
import Associates from './pages/Associates.tsx';
import Notifications from './pages/Notifications.tsx';
import VehiclePositioning from './pages/VehiclePositioning.tsx';

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
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/pending-access" element={<PendingAccess />} />
            
            <Route path="/*" element={
               <PrivateRoute>
                 <Layout>
                    <Routes>
                      <Route path="/" element={
                        <PermissionRoute require="canAccessDashboard"><Dashboard /></PermissionRoute>
                      } />
                      <Route path="/eventos" element={
                        <PermissionRoute require="canAccessEvents"><Events /></PermissionRoute>
                      } />
                      <Route path="/cotacoes" element={
                        <PermissionRoute require="canAccessQuotations"><Quotations /></PermissionRoute>
                      } />
                      <Route path="/compras" element={
                        <PermissionRoute require="canAccessPurchases"><Purchases /></PermissionRoute>
                      } />
                      <Route path="/entregas" element={
                        <PermissionRoute require="canAccessDeliveries"><Deliveries /></PermissionRoute>
                      } />
                      <Route path="/posicionamento" element={
                        <PermissionRoute require="canAccessEvents"><VehiclePositioning /></PermissionRoute>
                      } />
                      <Route path="/fornecedores" element={
                        <PermissionRoute require="canAccessSuppliers"><Suppliers /></PermissionRoute>
                      } />
                      <Route path="/associados" element={
                        <PermissionRoute require="canAccessAssociates"><Associates /></PermissionRoute>
                      } />
                      <Route path="/veiculos" element={
                        <PermissionRoute require="canAccessVehicles"><Vehicles /></PermissionRoute>
                      } />
                      <Route path="/catalogo" element={
                        <PermissionRoute require="canAccessCatalog"><Catalog /></PermissionRoute>
                      } />
                      <Route path="/relatorios" element={
                        <PermissionRoute require="canViewReports"><Reports /></PermissionRoute>
                      } />
                      <Route path="/configuracoes" element={
                        <PermissionRoute require="canManageSettings"><Settings /></PermissionRoute>
                      } />
                      <Route path="/notificacoes" element={
                        <PermissionRoute require="canAccessNotifications"><Notifications /></PermissionRoute>
                      } />
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
