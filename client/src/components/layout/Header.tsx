import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useUI } from '../../context/UIContext';
import styles from './Header.module.css';
import { Menu } from 'lucide-react';

const Header: React.FC = () => {
    const { user } = useAuth();
    const { unreadCount } = useNotifications();
    const { toggleSidebar } = useUI();

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