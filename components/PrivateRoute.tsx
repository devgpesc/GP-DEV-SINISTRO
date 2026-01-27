import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PrivateRoute: React.FC = () => {
  const { user } = useAuth();

  // Como o AuthProvider já bloqueia a renderização enquanto loading === true,
  // aqui podemos confiar que 'user' é o estado final.
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};