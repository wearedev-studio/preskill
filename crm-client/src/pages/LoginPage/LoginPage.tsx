import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../../api';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
            await login(res.data.token, res.data);
        } catch (err: any) {
            setError(err.message || err.response?.data?.message || 'Ошибка входа');
        }
    };

    // Стили можно будет вынести в CSS модуль позже
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
            <div style={{ width: '100%', maxWidth: '400px', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Вход в CRM</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" required style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                    <button type="submit" style={{ padding: '0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer' }}>Войти</button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;