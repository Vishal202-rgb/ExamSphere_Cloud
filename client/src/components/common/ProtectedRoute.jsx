import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, user, token } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated || !user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    const isAllowed =
      allowedRoles.includes(role) ||
      ((allowedRoles.includes('ADMIN') || allowedRoles.includes('SUPER_ADMIN')) &&
        (role === 'ADMIN' || role === 'SUPER_ADMIN'));

    if (!isAllowed) {
      // Redirect to their authorized portal based strictly on verified role
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
      if (role === 'FACULTY') return <Navigate to="/faculty" replace />;
      if (role === 'STUDENT') return <Navigate to="/student" replace />;
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
