import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user } = useAuth()

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // if roles are specified, check them
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}