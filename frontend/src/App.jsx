import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login     from './pages/Login'
import Upload    from './pages/Upload'
import Dashboard from './pages/Dashboard'

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route path="/upload" element={
                        <ProtectedRoute allowedRoles={['staff']}>
                            <Upload />
                        </ProtectedRoute>
                    } />

                    <Route path="/dashboard" element={
                        <ProtectedRoute allowedRoles={['staff', 'analyst']}>
                            <Dashboard />
                        </ProtectedRoute>
                    } />

                    {/* default redirect */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}