import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate  = useNavigate()
    const location  = useLocation()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }
    

    const isActive = (path) => location.pathname === path

    return (
        <nav style={styles.nav}>
            {/* left — brand */}
            <div style={styles.brand}>
                <span style={styles.logo}>🌿</span>
                <span style={styles.brandName}>Breathe ESG</span>
            </div>

            {/* center — nav links */}
            <div style={styles.links}>
                <button
                    style={isActive('/dashboard') ? styles.linkActive : styles.link}
                    onClick={() => navigate('/dashboard')}
                >
                    Dashboard
                </button>
                {user?.role === 'staff' && (
                <button
                    style={isActive('/upload') ? styles.linkActive : styles.link}
                    onClick={() => navigate('/upload')}
                >
                    Upload Data
                </button>
            )}
            </div>

            {/* right — user info */}
            <div style={styles.userArea}>
                <span style={styles.userName}>{user?.username}</span>
                <span style={styles.role}>{user?.role}</span>
                <button style={styles.logoutBtn} onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </nav>
    )
}

const styles = {
    nav: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 56,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    logo: { fontSize: 22 },
    brandName: {
        fontWeight: 700,
        fontSize: 16,
        color: '#16a34a',
    },
    links: {
        display: 'flex',
        gap: 4,
    },
    link: {
        padding: '6px 14px',
        border: 'none',
        background: 'transparent',
        borderRadius: 6,
        fontSize: 14,
        color: '#6b7280',
        cursor: 'pointer',
        fontWeight: 500,
    },
    linkActive: {
        padding: '6px 14px',
        border: 'none',
        background: '#f0fdf4',
        borderRadius: 6,
        fontSize: 14,
        color: '#16a34a',
        cursor: 'pointer',
        fontWeight: 600,
    },
    userArea: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    userName: {
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
    },
    role: {
        fontSize: 11,
        background: '#f0fdf4',
        color: '#16a34a',
        padding: '2px 8px',
        borderRadius: 99,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    logoutBtn: {
        padding: '5px 12px',
        border: '1px solid #e5e7eb',
        background: '#fff',
        borderRadius: 6,
        fontSize: 13,
        color: '#6b7280',
        cursor: 'pointer',
    },
}