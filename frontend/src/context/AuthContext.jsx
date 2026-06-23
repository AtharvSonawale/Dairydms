// context/AuthContext.js
import { createContext, useContext, useState } from 'react';

const decodeId = (token) => {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload?.id ?? null;
    } catch {
        return null;
    }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;

            const role = localStorage.getItem('role');
            const name = localStorage.getItem('name');
            const centre_id = localStorage.getItem('centre_id');
            const dairy_id = localStorage.getItem('dairy_id');
            const dairy_name = localStorage.getItem('dairy_name');
            const centre_name = localStorage.getItem('centre_name');

            return {
                token,
                role,
                name,
                centre_id,
                dairy_id,
                dairy_name,
                centre_name,
                id: decodeId(token)
            };
        } catch {
            return null;
        }
    });

    const login = (data) => {
        // Store all user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('name', data.name);
        localStorage.setItem('centre_id', data.centre_id || '');
        localStorage.setItem('dairy_id', data.dairy_id || '');
        localStorage.setItem('dairy_name', data.dairy_name || '');
        localStorage.setItem('centre_name', data.centre_name || '');
        setUser({ ...data, id: decodeId(data?.token) });
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);