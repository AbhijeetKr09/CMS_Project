/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('cms_token');
        const savedUser = localStorage.getItem('cms_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const response = await api.post('/cms/auth/login', { email, password });
        const { token: newToken, user: newUser } = response.data;
        localStorage.setItem('cms_token', newToken);
        localStorage.setItem('cms_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        return newUser; // includes role — used by Login page to redirect
    };

    const logout = () => {
        localStorage.removeItem('cms_token');
        localStorage.removeItem('cms_user');
        setToken(null);
        setUser(null);
    };

    const isAuthenticated = !!token;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ width: 32, height: 32, border: '2px solid #555', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated, role: user?.role ?? null, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
