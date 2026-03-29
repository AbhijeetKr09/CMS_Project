import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute
 * @param {string[]} allowedRoles - optional list of roles permitted. If omitted, any authenticated user passes.
 */
const ProtectedRoute = ({ allowedRoles }) => {
    const { isAuthenticated, role } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
        // Redirect to their home page if wrong role
        return <Navigate to={role === 'EDITOR' || role === 'ADMIN' ? '/editor-dashboard' : '/dashboard'} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
