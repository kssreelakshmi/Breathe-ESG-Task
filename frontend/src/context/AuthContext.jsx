import { createContext, useState } from 'react'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user')
        return saved ? JSON.parse(saved) : null
    })

    const login = (userData, token) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
    }

    const logout = async () => {
        try {
            const token = localStorage.getItem('token')
            if (token) {
                await fetch('http://localhost:8000/api/auth/logout/', {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}` },
                })
            }
        } catch (err) {
            console.error('Logout error', err)
        } finally {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
        }
    }

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}