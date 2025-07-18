import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Импортируем хук

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth(); // Используем функцию login из контекста

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await axios.post('http://localhost:5001/api/auth/login', {
                email,
                password,
            });
            // В res.data у нас есть token и все данные пользователя
            const { token, ...user } = res.data;
            login({ token, user }); // Обновляем глобальное состояние
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка входа. Проверьте данные.');
        }
    };

    return (
        <div>
            <h2>Вход</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Пароль:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button type="submit">Войти</button>
            </form>
            <p style={{ marginTop: '1rem' }}>
                <Link to="/forgot-password">Забыли пароль?</Link>
            </p>
        </div>
    );
};

export default LoginPage;