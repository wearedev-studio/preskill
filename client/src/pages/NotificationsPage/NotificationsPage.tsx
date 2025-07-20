import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { markNotificationsAsRead } from '../../services/notificationService';
import styles from './NotificationsPage.module.css';

const NotificationsPage: React.FC = () => {
    const { notifications, fetchNotifications } = useNotifications();
    const navigate = useNavigate();

    useEffect(() => {
        const markAsRead = async () => {
            try {
                await markNotificationsAsRead();
                fetchNotifications();
            } catch (error) {
                console.error("Не удалось отметить уведомления как прочитанные", error);
            }
        };
        markAsRead();
    }, [fetchNotifications]);

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <span className={styles.headerIcon}>🔔</span>
                <h1>Уведомления</h1>
            </div>

            {notifications.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>📭</div>
                    <h3>Уведомлений нет</h3>
                    <p>Здесь будут появляться все важные события.</p>
                </div>
            ) : (
                <div className={styles.notificationList}>
                    {notifications.map(n => (
                        <div
                            key={n._id}
                            onClick={() => n.link && navigate(n.link)}
                            className={`${styles.notificationItem} ${n.isRead ? styles.read : styles.unread} ${n.link ? styles.clickable : ''}`}
                        >
                            <p className={styles.title}>{n.title}</p>
                            <p className={styles.message}>{n.message}</p>
                            <p className={styles.date}>{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;