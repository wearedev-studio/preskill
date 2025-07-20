import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../../components/layout/AuthLayout';
import styles from './ForgotPasswordPage.module.css';
import { Crown } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);
        try {
            await axios.post('http://localhost:5001/api/auth/forgot-password', { email });
            setMessage('Код для сброса "отправлен". Сейчас вы будете перенаправлены.');
            setTimeout(() => {
                navigate('/reset-password', { state: { email } });
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Произошла ошибка.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout>
            <div className={styles.authHeader}>
                <div className={styles.logo}>
                    <div className={styles.logoIconContainer}><Crown /></div>
                    <h1 className={styles.logoText}>GameHub</h1>
                </div>
                <h2 className={styles.authTitle}>Восстановление пароля</h2>
                <p className={styles.authSubtitle}>Введите ваш email для получения кода</p>
            </div>

            {message ? (
                <div className={styles.alertSuccess}>{message}</div>
            ) : (
                <form onSubmit={handleSubmit} className={styles.authForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.formLabel}>Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={styles.formInput} placeholder="you@example.com" />
                    </div>
                    {error && <div className={styles.alertError}><p>{error}</p></div>}
                    <button type="submit" disabled={isLoading} className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isLoading ? 'Отправка...' : 'Получить код'}
                    </button>
                </form>
            )}

            <div className={styles.authFooter}>
                <p><Link to="/login" className={styles.authLink}>Вернуться ко входу</Link></p>
            </div>
        </AuthLayout>
    );
};

export default ForgotPasswordPage;