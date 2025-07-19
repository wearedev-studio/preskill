import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { markNotificationsAsRead } from '../../services/notificationService';

const NotificationsPage: React.FC = () => {
    const { notifications, fetchNotifications } = useNotifications();
    const navigate = useNavigate();

    useEffect(() => {
        // Когда пользователь заходит на страницу, отмечаем все как прочитанное
        const markAsRead = async () => {
            try {
                await markNotificationsAsRead();
                // Перезагружаем уведомления, чтобы обновить их статус
                fetchNotifications();
            } catch (error) {
                console.error("Не удалось отметить уведомления как прочитанные", error);
            }
        };
        markAsRead();
    }, [fetchNotifications]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Уведомления</h2>
            </div>

            {notifications.length === 0 ? (
                <p>У вас пока нет уведомлений.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {notifications.map(n => (
                        <div
                            key={n._id}
                            onClick={() => n.link && navigate(n.link)}
                            style={{
                                borderLeft: n.isRead ? '4px solid #555' : '4px solid #64ffda',
                                padding: '1rem',
                                backgroundColor: '#2d2d2d',
                                borderRadius: '4px',
                                cursor: n.link ? 'pointer' : 'default',
                                opacity: n.isRead ? 0.7 : 1,
                            }}
                        >
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{n.title}</p>
                            <p style={{ margin: '0.5rem 0 0' }}>{n.message}</p>
                            <small>{new Date(n.createdAt).toLocaleString()}</small>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;