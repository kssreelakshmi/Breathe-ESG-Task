import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import api from '../api/axios'

export default function Login() {
    const { login } = useAuth()
    const navigate  = useNavigate()

    const [form, setForm]   = useState({ username: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await api.post('/auth/login/', form)
            login(res.data.user, res.data.token)
            navigate('/dashboard')
        } catch (err) {
            setError('Invalid username or password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                {/* Logo / Brand */}
                <div style={styles.brand}>
                    <div style={styles.logo}>🌿</div>
                    <h1 style={styles.title}>Breathe ESG</h1>
                    <p style={styles.subtitle}>Emissions Data Platform</p>
                </div>

                {error && (
                    <div style={styles.errorBox}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.field}>
                        <label style={styles.label}>Username</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            style={styles.input}
                            type="password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        style={loading ? styles.btnDisabled : styles.btn}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    )
}

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f0f4f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        background: '#fff',
        borderRadius: 12,
        padding: '40px 36px',
        width: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    },
    brand: {
        textAlign: 'center',
        marginBottom: 28,
    },
    logo: {
        fontSize: 40,
        marginBottom: 8,
    },
    title: {
        margin: 0,
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a1a',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: 13,
        color: '#888',
    },
    errorBox: {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        marginBottom: 16,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
    },
    input: {
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 14,
        outline: 'none',
    },
    btn: {
        padding: '11px',
        background: '#16a34a',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: 4,
    },
    btnDisabled: {
        padding: '11px',
        background: '#86efac',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'not-allowed',
        marginTop: 4,
    },
}