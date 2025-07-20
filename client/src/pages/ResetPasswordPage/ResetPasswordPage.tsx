import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../../components/layout/AuthLayout';
import styles from './ResetPasswordPage.module.css';
import { KeyRound } from 'lucide-react';
import { API_URL } from '../../api/index';

const ResetPasswordPage: React.FC = () => {
    const [secretCode, setSecretCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;

    useEffect(() => {
        if (!email) {
            setError('Email не найден. Начните процедуру сброса сначала.');
            setTimeout(() => navigate('/forgot-password'), 3000);
        }
    }, [email, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/reset-password`, { email, secretCode, newPassword });
            setMessage('Пароль успешно сброшен! Перенаправляем на страницу входа...');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Произошла ошибка.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!email) {
        return <AuthLayout><div className={styles.alertError}>{error || 'Перенаправление...'}</div></AuthLayout>;
    }

    return (
        <AuthLayout>
            <div className={styles.authHeader}>
                <div className={styles.authIcon}><KeyRound /></div>
                <h2 className={styles.authTitle}>Установка нового пароля</h2>
                <p className={styles.authSubtitle}>для аккаунта: <strong>{email}</strong></p>
            </div>

            {message ? (
                <div className={styles.alertSuccess}>{message}</div>
            ) : (
                <form onSubmit={handleSubmit} className={styles.authForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="secretCode" className={styles.formLabel}>Секретный код</label>
                        <input id="secretCode" type="text" value={secretCode} onChange={(e) => setSecretCode(e.target.value)} required className={styles.formInput} placeholder="Введите код из email" />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="newPassword" className={styles.formLabel}>Новый пароль</label>
                        <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className={styles.formInput} placeholder="Мин. 6 символов" />
                    </div>

                    {error && <div className={styles.alertError}><p>{error}</p></div>}
                    
                    <button type="submit" disabled={isLoading} className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isLoading ? 'Сохранение...' : 'Сбросить пароль'}
                    </button>
                </form>
            )}

             <div className={styles.authFooter}>
                <p><Link to="/login" className={styles.authLink}>Вернуться ко входу</Link></p>
            </div>
        </AuthLayout>
    );
};

export default ResetPasswordPage;