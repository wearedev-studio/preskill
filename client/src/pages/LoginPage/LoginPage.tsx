import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import styles from './LoginPage.module.css';
import { Crown } from 'lucide-react';
import { API_URL } from '../../api/index';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
            const { token, ...user } = res.data;
            login({ token, user });
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка входа. Проверьте данные.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.authContainer}>
            <div className={styles.authCard}>
                <div className={styles.authHeader}>
                    <div className={styles.logo}>
                        <div className={styles.logoIconContainer}><Crown /></div>
                        <h1 className={styles.logoText}>Skill Games</h1>
                    </div>
                    <h2 className={styles.authTitle}>Вход в систему</h2>
                    <p className={styles.authSubtitle}>Добро пожаловать обратно!</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.authForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.formLabel}>Email адрес</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.formInput}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="password" className={styles.formLabel}>Пароль</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={styles.formInput}
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <div className={styles.alertError}><p>{error}</p></div>}

                    <button type="submit" disabled={isLoading} className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isLoading ? (
                            <><div className={styles.spinner}></div><span>Вход...</span></>
                        ) : ( "Войти" )}
                    </button>
                </form>

                <div className={styles.authFooter}>
                    <p>
                        <Link to="/forgot-password" className={styles.authLink}>Забыли пароль?</Link>
                    </p>
                    <p style={{ marginTop: '0.5rem' }}>
                        Нет аккаунта?{' '}
                        <Link to="/register" className={styles.authLink}>Зарегистрироваться</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;