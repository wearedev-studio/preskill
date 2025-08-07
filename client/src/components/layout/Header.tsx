import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useUI } from '../../context/UIContext';
import { useSocket } from '../../context/SocketContext';
import styles from './Header.module.css';
import { Menu } from 'lucide-react';

const Header: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { unreadCount } = useNotifications();
    const { toggleSidebar } = useUI();
    const { socket } = useSocket();

    // Обработчик Socket.IO событий для обновления баланса в реальном времени
    useEffect(() => {
        if (!socket || !user) return;

        const handleBalanceUpdate = (data: {
            userId: string;
            newBalance: number;
            transaction: {
                type: string;
                amount: number;
                status: string;
                createdAt: string;
            };
        }) => {
            // Проверяем, что обновление для текущего пользователя
            if (data.userId === user._id) {
                console.log('[Header] Balance updated via Socket.IO:', data);
                
                // Обновляем контекст пользователя для мгновенного отображения в хедере
                refreshUser();
            }
        };

        socket.on('balanceUpdated', handleBalanceUpdate);

        return () => {
            socket.off('balanceUpdated', handleBalanceUpdate);
        };
    }, [socket, user, refreshUser]);

    return (
        <header className={styles.header}>
            {/* ИСПРАВЛЕНИЕ: Убран класс `lg:hidden`, теперь кнопка видна всегда */}
            <button onClick={toggleSidebar} className={styles.menuButton}>
                <Menu />
            </button>
            
            <div className={styles.rightSection}>
                <div className={styles.onlineIndicator}>
                    <div className={styles.onlineDot}></div>
                    <span className="text-sm font-medium">Online</span>
                </div>
                <div className={styles.balance}>
                    Balance: ${user?.balance.toFixed(2) || '0.00'}
                </div>
                <Link to="/notifications" className={styles.notificationBell}>
                    🔔
                    {unreadCount > 0 && (
                        <span className={styles.notificationCount}>{unreadCount}</span>
                    )}
                </Link>
            </div>
        </header>
    );
};

export default Header;