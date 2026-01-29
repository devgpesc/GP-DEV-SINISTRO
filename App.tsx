
import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
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
import AIAssistant from './components/AIAssistant.tsx';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Redirect to="/" />;
  return <>{children}</>;
};

const AuthOnlyAssistant = () => {
  const { user } = useAuth();
  return user ? <AIAssistant /> : null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            
            <Route path="/">
               <PrivateRoute>
                 <Layout>
                    <Switch>
                      <Route exact path="/" component={Dashboard} />
                      <Route path="/eventos" component={Events} />
                      <Route path="/cotacoes" component={Quotations} />
                      <Route path="/compras" component={Purchases} />
                      <Route path="/entregas" component={Deliveries} />
                      <Route path="/fornecedores" component={Suppliers} />
                      <Route path="/associados" component={Associates} />
                      <Route path="/veiculos" component={Vehicles} />
                      <Route path="/catalogo" component={Catalog} />
                      <Route path="/relatorios" component={Reports} />
                      <Route path="/configuracoes" component={Settings} />
                      <Route path="/notificacoes" component={Notifications} />
                      <Route path="/saas-admin">
                          <AdminRoute><SaasAdmin /></AdminRoute>
                      </Route>
                      {/* Catch-all redirect to dashboard */}
                      <Redirect to="/" />
                    </Switch>
                 </Layout>
               </PrivateRoute>
            </Route>
          </Switch>
          <AuthOnlyAssistant />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
