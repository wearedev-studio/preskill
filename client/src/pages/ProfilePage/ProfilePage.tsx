import React, { useState, useEffect, FormEvent, ChangeEvent, FC } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/common/Avatar'; // 1. Импортируем новый компонент

import { IGameRecord, ITransaction } from '../../types/entities';
import styles from './ProfilePage.module.css'; // Import the CSS module
import { API_URL } from '../../api/index';
import { submitKycDocument } from '@/services/api';
import KycModal from '../../components/modals/KycModal'; // Импортируем модальное окно

// Helper component for the table to keep the main component clean
// Вспомогательный компонент для таблицы
const HistoryTable: FC<{ headers: string[]; children: React.ReactNode }> = ({ headers, children }) => (
    <table className={styles.historyTable}>
        <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
    </table>
);

interface KYCStatusProps {
    user: NonNullable<ReturnType<typeof useAuth>['user']>; // Гарантируем, что user не null
    onVerifyClick: () => void;
}

const KYCStatus: FC<KYCStatusProps> = ({ user, onVerifyClick }) => {
    const statusMap = {
        NOT_SUBMITTED: { text: "Not confirmed", style: styles.kycStatus_REJECTED },
        PENDING: { text: "Under review", style: styles.kycStatus_PENDING },
        APPROVED: { text: "Confirmed", style: styles.kycStatus_APPROVED },
        REJECTED: { text: "Rejected", style: styles.kycStatus_REJECTED },
    };
    
    // Используем `user` из пропсов, а не из внешнего скоупа
    // @ts-ignore
    const currentStatus = statusMap[user.kycStatus] || statusMap.NOT_SUBMITTED;

    return (
        <div className={`${styles.kycContainer} ${currentStatus.style}`}>
            <h4>Verification status: {currentStatus.text}</h4>
            
            {user.kycStatus === 'REJECTED' && (
                <p><strong>Cause:</strong> {user.kycRejectionReason}</p>
            )}

            {(user.kycStatus === 'NOT_SUBMITTED' || user.kycStatus === 'REJECTED') && (
                <button onClick={onVerifyClick} className={`${styles.btn} ${styles.btnPrimary}`} style={{marginTop: '1rem'}}>
                    Pass verification
                </button>
            )}
        </div>
    );
};

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

    const [kycFile, setKycFile] = useState<File | null>(null);
    const [kycDocType, setKycDocType] = useState('PASSPORT');
    const [kycMessage, setKycMessage] = useState({ type: '', text: '' });

    const [isKycModalOpen, setIsKycModalOpen] = useState(false);

    const handleKycSuccess = async () => {
        // Эта функция вызывается, когда модальное окно сообщает об успехе
        await refreshUser(); // Обновляем данные пользователя
    };


    const handleKycFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setKycFile(file);
    };

    const handleKycSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kycFile) {
            setKycMessage({ type: 'error', text: 'Please select a file to upload.' });
            return;
        }
        
        const formData = new FormData();
        formData.append('document', kycFile);
        formData.append('documentType', kycDocType);

        try {
            const res = await submitKycDocument(formData);
            setKycMessage({ type: 'success', text: res.data.message });
            await refreshUser();
        } catch (error: any) {
            setKycMessage({ type: 'error', text: error.response?.data?.message || 'Loading error' });
        }
    };

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
            setHistoryError(err.response?.data?.message || 'Failed to load history.');
        } finally {
            setLoadingHistory(false);
        }
    }

    useEffect(() => {
        fetchHistory();
    }, []);

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: '', text: '' });
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'The new password must be at least 6 characters long..' });
            return;
        }
        try {
            await axios.put(`${API_URL}/api/users/profile/password`, { currentPassword, newPassword });
            setPasswordMessage({ type: 'success', text: 'Password successfully updated!' });
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: any) {
            setPasswordMessage({ type: 'error', text: err.response?.data?.message || 'Error changing password' });
        }
    };

    const handleBalanceUpdate = async (e: FormEvent, operation: 'deposit' | 'withdraw') => {
        e.preventDefault();
        setBalanceMessage({ type: '', text: '' });
        const amount = Number(balanceAmount);

        if (operation === 'withdraw' && user?.kycStatus !== 'APPROVED') {
            setIsKycModalOpen(true);
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            setBalanceMessage({ type: 'error', text: 'Please enter a valid positive amount..' });
            return;
        }

        const amountToSend = operation === 'deposit' ? Number(balanceAmount) : -Number(balanceAmount);
        
        try {
            await axios.post(`${API_URL}/api/users/balance`, { amount: amountToSend });
            setBalanceMessage({ type: 'success', text: 'Balance updated successfully!' });
            setBalanceAmount('');
            fetchHistory();
        } catch (err: any) {
             setBalanceMessage({ type: 'error', text: err.response?.data?.message || 'Operation error' });
        }
    }

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
            alert('Failed to upload avatar. Make sure it is an image and its size is less than 5MB.');
        }
    };

    if (!user) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="spinner"></div>
                    <p className="loading-text">Loading profile data...</p>
                </div>
            </div>
        );
    }

    // Компонент для отображения KYC
    // const KYCStatus: FC = () => {
    //     const statusInfo = {
    //         NOT_SUBMITTED: { text: "Не подтвержден", style: styles.kycStatus_REJECTED },
    //         PENDING: { text: "На проверке", style: styles.kycStatus_PENDING },
    //         APPROVED: { text: "Подтвержден", style: styles.kycStatus_APPROVED },
    //         REJECTED: { text: "Отклонен", style: styles.kycStatus_REJECTED },
    //     };
    //     // @ts-ignore
    //     const currentStatus = statusInfo[user.kycStatus] || statusInfo.NOT_SUBMITTED;

    //     return (
    //         <div className={`${styles.kycContainer} ${currentStatus.style}`}>
    //             <h4>Статус верификации: {currentStatus.text}</h4>
    //             {user.kycStatus === 'REJECTED' && <p><strong>Причина:</strong> {user.kycRejectionReason}</p>}
    //             {(user.kycStatus === 'NOT_SUBMITTED' || user.kycStatus === 'REJECTED') && (
    //                 <button onClick={() => setIsKycModalOpen(true)} className={`${styles.btn} ${styles.btnPrimary}`} style={{marginTop: '1rem'}}>
    //                     Пройти верификацию
    //                 </button>
    //             )}
    //         </div>
    //     );
    // };

    // Переводчики для отображения на русском
    const statusTranslations: Record<IGameRecord['status'], string> = { WON: 'Won', LOST: 'Loss', DRAW: 'Draw' };
    const typeTranslations: Record<ITransaction['type'], string> = { DEPOSIT: 'Deposit', WITHDRAWAL: 'Withdrawal', WAGER_WIN: 'Wager win', WAGER_LOSS: 'Wager loss' };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.profileContainer}>
                {/* Basic Info */}
                <div className={styles.profileSection}>
                    <h3>Basic information</h3>
                    <div className={styles.profileHeader}>
                            <div className={styles.avatarContainer}>
                            {/* <img 
                                src={avatarPreview || (user?.avatar.startsWith('/') ? `http://localhost:5001${user.avatar}` : '/default-avatar.png')} 
                                alt="Аватар" 
                                className={styles.profileAvatarImg} 
                            /> */}
                             {avatarPreview ? (
                                <img src={avatarPreview} alt="Preview" className={styles.profileAvatarImg} />
                           ) : (
                                <Avatar size="large" />
                           )}
                            <label htmlFor="avatarInput" className={styles.avatarEditButton}>✏️</label>
                            <input id="avatarInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </div>                        <div className={styles.profileInfo}>
                            <h2>{user.username}</h2>
                            {avatarFile && (
                        <div className={styles.avatarActions}>
                            <button onClick={handleAvatarUpload} className={`${styles.btn} ${styles.btnPrimary}`}>Save avatar</button>
                            <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
                        </div>
                    )}
                            <p><strong>Email:</strong> {user.email}</p>
                            <p><strong>Balance:</strong> <span className={styles.balanceHighlight}>${user.balance.toFixed(2)}</span></p>
                        </div>
                        <div className={styles.card}>
                            <h3>Verification(KYC)</h3>
                            <KYCStatus user={user} onVerifyClick={() => setIsKycModalOpen(true)} />
                        </div>
                    </div>
                </div>

                {/* Security Settings */}
                <div className={styles.profileSection}>
                    <h3>Security settings</h3>
                    <h4 style={{ fontWeight: 500, color: '#a1a1aa', marginBottom: '1rem' }}>Change password</h4>
                    <form onSubmit={handlePasswordChange}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Current Password</label>
                                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={styles.formInput} placeholder="Enter your current password" required />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>New Password</label>
                                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.formInput} placeholder="Enter new password" required />
                            </div>
                        </div>
                        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>🔒 Change password</button>
                        {passwordMessage.text && <div className={`${styles.alert} ${passwordMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}><p>{passwordMessage.text}</p></div>}
                    </form>
                </div>

                {/* Balance Management */}
                <div className={styles.profileSection}>
                    <h3>Balance Management (Demo)</h3>
                    <form>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Amount</label>
                                <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} className={styles.formInput} placeholder="Enter the amount" required />
                            </div>
                            <button onClick={(e) => handleBalanceUpdate(e, 'deposit')} className={`${styles.btn} ${styles.btnSuccess}`}>💰  Top up</button>
                            <button type="button" onClick={(e) => handleBalanceUpdate(e, 'withdraw')} className={`${styles.btn} ${styles.btnSecondary}`}>💸 Withdraw</button>
                        </div>
                        {balanceMessage.text && <div className={`${styles.alert} ${balanceMessage.type === 'error' ? styles.alertError : styles.alertSuccess}`}><p>{balanceMessage.text}</p></div>}
                    </form>
                </div>

                {/* Game History */}
                <div className={styles.profileSection}>
                    <h3>History of games</h3>
                    {loadingHistory && <p>Loading...</p>}
                    {historyError && <div className={`${styles.alert} ${styles.alertError}`}>{historyError}</div>}
                    {!loadingHistory && !historyError && (
                        <HistoryTable headers={['Game', 'Result', 'Balance Change', 'Date']}>
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
                    <h3>Transaction history</h3>
                    {loadingHistory && <p>Loading...</p>}
                    {historyError && <div className={`${styles.alert} ${styles.alertError}`}>{historyError}</div>}
                    {!loadingHistory && !historyError && (
                         <HistoryTable headers={['Type', 'Status', 'Amount', 'Date']}>
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
            <KycModal isOpen={isKycModalOpen} 
                onClose={() => setIsKycModalOpen(false)}
                onSuccess={handleKycSuccess} />

        </div>
    );
};

export default ProfilePage;