// frontend/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ 
    children, 
    allowedRoles = [], 
    redirectTo = '/' 
}) {
    const { user } = useAuth();

    // Check if user is authenticated
    if (!user || !user.token) {
        return <Navigate to={redirectTo} replace />;
    }

    // Check if user has required role
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        if (user.role === 'admin') {
            return <Navigate to="/admin/dashboard" replace />;
        } else if (user.role === 'operator') {
            return <Navigate to="/operator/dashboard" replace />;
        }
        return <Navigate to={redirectTo} replace />;
    }

    return children;
}