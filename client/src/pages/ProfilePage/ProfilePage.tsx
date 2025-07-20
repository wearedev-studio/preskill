import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/common/Avatar'; // 1. Импортируем новый компонент

import { IGameRecord, ITransaction } from '../../types/entities';
import styles from './ProfilePage.module.css'; // Import the CSS module
import { API_URL } from '../../api/index';

// Helper component for the table to keep the main component clean
const HistoryTable: React.FC<{ headers: string[]; children: React.ReactNode }> = ({ headers, children }) => (
    <table className={styles.historyTable}>
        <thead>
            <tr>
                {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
        </thead>
        <tbody>
            {children}
        </tbody>
    </table>
);



const ProfilePage: React.FC = () => {
    const { user, refreshUser } = useAuth();

    const [gameHistory, setGameHistory] = useState<IGameRecord[]>([]);
    const [transactionHistory, setTransactionHistory] = useState<ITransaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [historyError, setHistoryError] = useState('');

    // Состояния для формы смены пароля
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    // Состояния для формы баланса
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceMessage, setBalanceMessage] = useState({ type: '', text: '' });

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const fetchHistory = async () => {
        setHistoryError('');
        setLoadingHistory(true);
        try {
            const [gamesRes, transactionsRes] = await Promise.all([
                axios.get(`${API_URL}/api/users/history/games`),
                axios.get(`${API_URL}/api/users/history/transactions`),
            ]);
            setGameHistory(gamesRes.data);
            setTransactionHistory(transactionsRes.data);
        } catch (err: any) {
            console.error('Failed to fetch history:', err);
            setHistoryError(err.response?.data?.message || 'Не удалось загрузить историю.');
        } finally {
            setLoadingHistory(false);
        }
    }

    useEffect(() => {
        fetchHistory();
    }, []);

    // Обработчик смены пароля
    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: '', text: '' });
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Новый пароль должен быть не менее 6 символов.' });
            return;
        }
        try {
            await axios.put(`${API_URL}/api/users/profile/password`, { currentPassword, newPassword });
            setPasswordMessage({ type: 'success', text: 'Пароль успешно обновлен!' });
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: any) {
            setPasswordMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка смены пароля' });
        }
    };

    // Обработчик обновления баланса
    const handleBalanceUpdate = async (e: FormEvent, operation: 'deposit' | 'withdraw') => {
        e.preventDefault();
        setBalanceMessage({ type: '', text: '' });
        const amount = Number(balanceAmount);

        if (isNaN(amount) || amount <= 0) {
            setBalanceMessage({ type: 'error', text: 'Пожалуйста, введите корректную положительную сумму.' });
            return;
        }

        const amountToSend = operation === 'deposit' ? Number(balanceAmount) : -Number(balanceAmount);
        
        try {
            await axios.post(`${API_URL}/api/users/balance`, { amount: amountToSend });
            setBalanceMessage({ type: 'success', text: 'Баланс успешно обновлен!' });
            setBalanceAmount('');
            fetchHistory();
        } catch (err: any) {
             setBalanceMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка операции' });
        }
    }

    // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ АВАТАРА ---
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleAvatarUpload = async () => {
        if (!avatarFile) return;

        const formData = new FormData();
        formData.append('avatar', avatarFile);

        try {
            await axios.put(`${API_URL}/api/users/profile/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await refreshUser(); // Обновляем данные пользователя везде
            setAvatarFile(null);
            setAvatarPreview(null);
        } catch (error) {
            alert('Не удалось загрузить аватар. Убедитесь, что это изображение и его размер не превышает 5МБ.');
        }
    };

    if (!user) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="spinner"></div>
                    <p className="loading-text">Загрузка данных профиля...</p>
                </div>
            </div>
        );
    }

    // Переводчики для отображения на русском
    const statusTranslations: Record<IGameRecord['status'], string> = { WON: 'Победа', LOST: 'Поражение', DRAW: 'Ничья' };
    const typeTranslations: Record<ITransaction['type'], string> = { DEPOSIT: 'Пополнение', WITHDRAWAL: 'Вывод', WAGER_WIN: 'Выигрыш', WAGER_LOSS: 'Проигрыш' };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.profileContainer}>
                {/* Basic Info */}
                <div className={styles.profileSection}>
                    <h3>Основная информация</h3>
                    <div className={styles.profileHeader}>
                            <div className={styles.avatarContainer}>
                            {/* <img 
                                src={avatarPreview || (user?.avatar.startsWith('/') ? `http://localhost:5001${user.avatar}` : '/default-avatar.png')} 
                                alt="Аватар" 
                                className={styles.profileAvatarImg} 
                            /> */}
                             {avatarPreview ? (
                                <img src={avatarPreview} alt="Предпросмотр" className={styles.profileAvatarImg} />
                           ) : (
                                <Avatar size="large" />
                           )}
                            <label htmlFor="avatarInput" className={styles.avatarEditButton}>✏️</label>
                            <input id="avatarInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </div>                        <div className={styles.profileInfo}>
                            <h2>{user.username}</h2>
                            {avatarFile && (
                        <div className={styles.avatarActions}>
                            <button onClick={handleAvatarUpload} className={`${styles.btn} ${styles.btnPrimary}`}>Сохранить аватар</button>
                            <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className={`${styles.btn} ${styles.btnSecondary}`}>Отмена</button>
                        </div>
                    )}
                            <p><strong>Email:</strong> {user.email}</p>
                            <p><strong>Баланс:</strong> <span className={styles.balanceHighlight}>${user.balance.toFixed(2)}</span></p>
                        </div>
                    </div>
                </div>

                {/* Security Settings */}
                <div className={styles.profileSection}>
                    <h3>Настройки безопасности</h3>
                    <h4 style={{ fontWeight: 500, color: '#a1a1aa', marginBottom: '1rem' }}>Смена пароля</h4>
                    <form onSubmit={handlePasswordChange}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Текущий пароль</label>
                                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={styles.formInput} placeholder="Введите текущий пароль" required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Новый пароль</label>
                                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.formInput} placeholder="Введите новый пароль" required />
                            </div>
                        </div>
                        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>🔒 Сменить пароль</button>
                        {passwordMessage.text && <div className={`${styles.alert} ${passwordMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}><p>{passwordMessage.text}</p></div>}
                    </form>
                </div>

                {/* Balance Management */}
                <div className={styles.profileSection}>
                    <h3>Управление балансом (Демо)</h3>
                    <form>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Сумма</label>
                                <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} className={styles.formInput} placeholder="Введите сумму" required />
                            </div>
                            <button onClick={(e) => handleBalanceUpdate(e, 'deposit')} className={`${styles.btn} ${styles.btnSuccess}`}>💰 Пополнить</button>
                            <button type="button" onClick={(e) => handleBalanceUpdate(e, 'withdraw')} className={`${styles.btn} ${styles.btnSecondary}`}>💸 Вывести</button>
                        </div>
                        {balanceMessage.text && <div className={`${styles.alert} ${balanceMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}><p>{balanceMessage.text}</p></div>}
                    </form>
                </div>

                {/* Game History */}
                <div className={styles.profileSection}>
                    <h3>История игр</h3>
                    {loadingHistory && <p>Загрузка...</p>}
                    {historyError && <div className={`${styles.alert} ${styles.alertError}`}>{historyError}</div>}
                    {!loadingHistory && !historyError && (
                        <HistoryTable headers={['Игра', 'Результат', 'Изменение баланса', 'Дата']}>
                            {gameHistory.map(game => (
                                <tr key={game._id}>
                                    <td>{game.gameName}</td>
                                    <td>
                                        <span className={`${styles.badge} ${game.status === 'WON' ? styles.badgeGreen : game.status === 'LOST' ? styles.badgeRed : styles.badgeYellow}`}>
                                            {statusTranslations[game.status]}
                                        </span>
                                    </td>
                                    <td className={game.amountChanged >= 0 ? styles.amountPositive : styles.amountNegative}>
                                        {game.amountChanged >= 0 ? '+' : ''}${game.amountChanged.toFixed(2)}
                                    </td>
                                    <td>{new Date(game.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </HistoryTable>
                    )}
                </div>

                {/* Transaction History */}
                <div className={styles.profileSection}>
                    <h3>История транзакций</h3>
                    {loadingHistory && <p>Загрузка...</p>}
                    {historyError && <div className={`${styles.alert} ${styles.alertError}`}>{historyError}</div>}
                    {!loadingHistory && !historyError && (
                         <HistoryTable headers={['Тип', 'Статус', 'Сумма', 'Дата']}>
                           {transactionHistory.map(tx => (
                                <tr key={tx._id}>
                                    <td>{typeTranslations[tx.type]}</td>
                                    <td>{tx.status}</td>
                                    <td>${tx.amount.toFixed(2)}</td>
                                    <td>{new Date(tx.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </HistoryTable>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;