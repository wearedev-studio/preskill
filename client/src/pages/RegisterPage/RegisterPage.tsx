import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import styles from './RegisterPage.module.css';
import { Crown, UserPlus } from 'lucide-react';

const RegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await axios.post('http://localhost:5001/api/auth/register', { username, email, password });
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка регистрации.');
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
                        <h1 className={styles.logoText}>GameHub</h1>
                    </div>
                    <h2 className={styles.authTitle}>Создание аккаунта</h2>
                    <p className={styles.authSubtitle}>Присоединяйтесь к нашему сообществу</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.authForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="username" className={styles.formLabel}>Имя пользователя</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className={styles.formInput}
                            placeholder="Введите ваше имя"
                        />
                    </div>
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
                            placeholder="Минимум 6 символов"
                        />
                    </div>

                    {error && <div className={styles.alertError}><p>{error}</p></div>}

                    <button type="submit" disabled={isLoading} className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isLoading ? (
                            <><div className={styles.spinner}></div><span>Создание...</span></>
                        ) : (
                            "Зарегистрироваться"
                        )}
                    </button>
                </form>

                <div className={styles.authFooter}>
                    <p>
                        Уже есть аккаунт?{' '}
                        <Link to="/login" className={styles.authLink}>
                            Войти
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;