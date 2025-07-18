

import React, { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

import { IGameRecord, ITransaction } from '../../types/entities';

// Вспомогательный компонент для стилизации таблиц
const HistoryTable: React.FC<{ headers: string[]; children: React.ReactNode }> = ({ headers, children }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
            <tr>
                {headers.map(h => <th key={h} style={{ border: '1px solid #444', padding: '8px', textAlign: 'left' }}>{h}</th>)}
            </tr>
        </thead>
        <tbody>
            {children}
        </tbody>
    </table>
);

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#333', borderRadius: '8px' }}>
        <h3>{title}</h3>
        {children}
    </div>
)

const ProfilePage: React.FC = () => {
    const { user, refreshUser  } = useAuth();


    const [gameHistory, setGameHistory] = useState<IGameRecord[]>([]);
    const [transactionHistory, setTransactionHistory] = useState<ITransaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [historyError, setHistoryError] = useState('');


    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Состояния для формы смены пароля
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    // Состояния для формы баланса
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceMessage, setBalanceMessage] = useState({ type: '', text: '' });


    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Запускаем оба запроса параллельно для эффективности
                const [gamesRes, transactionsRes] = await Promise.all([
                    axios.get('http://localhost:5001/api/users/history/games'),
                    axios.get('http://localhost:5001/api/users/history/transactions'),
                ]);
                setGameHistory(gamesRes.data);
                setTransactionHistory(transactionsRes.data);
            } catch (err) {
                setError('Не удалось загрузить историю. Попробуйте обновить страницу.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const fetchHistory = async () => {
        setHistoryError('');
        setLoadingHistory(true);
        try {
            const [gamesRes, transactionsRes] = await Promise.all([
                axios.get('http://localhost:5001/api/users/history/games'),
                axios.get('http://localhost:5001/api/users/history/transactions'),
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
            await axios.put('http://localhost:5001/api/users/profile/password', { currentPassword, newPassword });
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
            // Отправляем запрос на изменение баланса
            await axios.post('http://localhost:5001/api/users/balance', { amount: amountToSend });
        
            
            setBalanceMessage({ type: 'success', text: 'Баланс успешно обновлен!' });
            setBalanceAmount('');
            fetchHistory(); // Обновляем списки транзакций/игр
        } catch (err: any) {
             setBalanceMessage({ type: 'error', text: err.response?.data?.message || 'Ошибка операции' });
        }
    }

    if (!user) {
        return <div>Загрузка данных профиля...</div>;
    }

    // Переводчики для отображения на русском
    const statusTranslations: Record<IGameRecord['status'], string> = { WON: 'Победа', LOST: 'Поражение', DRAW: 'Ничья' };
    const typeTranslations: Record<ITransaction['type'], string> = { DEPOSIT: 'Пополнение', WITHDRAWAL: 'Вывод', WAGER_WIN: 'Выигрыш', WAGER_LOSS: 'Проигрыш' };

    const profileStyles: React.CSSProperties = {
        textAlign: 'left',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: '#2d2d2d',
        borderRadius: '8px',
    };

    const avatarStyles: React.CSSProperties = {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        backgroundColor: '#444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1rem',
    };

    // --- Рендеринг компонента ---
    return (
        <div style={profileStyles}>
            <ProfileSection title="Основная информация">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={avatarStyles}>
                        <span>Аватар</span>
                    </div>
                    <div>
                        <p><strong>Имя пользователя:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Баланс:</strong> <span style={{ color: 'lightgreen', fontWeight: 'bold' }}>${user.balance.toFixed(2)}</span></p>
                    </div>
                </div>
            </ProfileSection>

            <ProfileSection title="Настройки">
                <h4>Смена пароля</h4>
                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Текущий пароль" required />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Новый пароль" required />
                    <button type="submit" style={{ alignSelf: 'flex-start' }}>Сменить пароль</button>
                    {passwordMessage.text && <p style={{ margin: '10px 0 0', color: passwordMessage.type === 'error' ? 'salmon' : 'lightgreen' }}>{passwordMessage.text}</p>}
                </form>
            </ProfileSection>

            <ProfileSection title="Управление балансом (Мок)">
                <form style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '500px' }}>
                    <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Сумма" required />
                    <button type="submit" onClick={(e) => handleBalanceUpdate(e, 'deposit')}>Пополнить</button>
                    <button type="button" onClick={(e) => handleBalanceUpdate(e, 'withdraw')}>Вывести</button>
                </form>
                {balanceMessage.text && <p style={{ margin: '10px 0 0', color: balanceMessage.type === 'error' ? 'salmon' : 'lightgreen' }}>{balanceMessage.text}</p>}
            </ProfileSection>

            <ProfileSection title="История игр">
                {loadingHistory && <p>Загрузка истории игр...</p>}
                {historyError && <p style={{ color: 'red' }}>{historyError}</p>}
                {!loadingHistory && !historyError && gameHistory.length === 0 && <p>Вы еще не сыграли ни одной игры.</p>}
                {!loadingHistory && !historyError && gameHistory.length > 0 && (
                    <HistoryTable headers={['Игра', 'Результат', 'Изменение баланса', 'Дата']}>
                        {gameHistory.map(game => (
                            <tr key={game._id}>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{game.gameName}</td>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{statusTranslations[game.status]}</td>
                                <td style={{ border: '1px solid #444', padding: '8px', color: game.amountChanged >= 0 ? 'lightgreen' : 'salmon' }}>
                                    {game.amountChanged >= 0 ? '+' : ''}${game.amountChanged.toFixed(2)}
                                </td>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{new Date(game.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </HistoryTable>
                )}
            </ProfileSection>

            <ProfileSection title="История транзакций">
                {loadingHistory && <p>Загрузка истории транзакций...</p>}
                {historyError && <p style={{ color: 'red' }}>{historyError}</p>}
                {!loadingHistory && !historyError && transactionHistory.length === 0 && <p>У вас еще нет транзакций.</p>}
                {!loadingHistory && !historyError && transactionHistory.length > 0 && (
                    <HistoryTable headers={['Тип', 'Статус', 'Сумма', 'Дата']}>
                        {transactionHistory.map(tx => (
                            <tr key={tx._id}>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{typeTranslations[tx.type]}</td>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{tx.status}</td>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>${tx.amount.toFixed(2)}</td>
                                <td style={{ border: '1px solid #444', padding: '8px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </HistoryTable>
                )}
            </ProfileSection>
        </div>
    );
};

export default ProfilePage;