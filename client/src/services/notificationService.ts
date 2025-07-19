import axios from 'axios';

// Интерфейс, описывающий одно уведомление
export interface INotification {
    _id: string;
    user: string;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

/**
 * Получить все уведомления для текущего пользователя
 */
export const getMyNotifications = async (): Promise<INotification[]> => {
    const { data } = await axios.get('http://localhost:5001/api/notifications');
    return data;
};

/**
 * Отметить все уведомления как прочитанные
 */
export const markNotificationsAsRead = async (): Promise<{ message: string }> => {
    const { data } = await axios.post('http://localhost:5001/api/notifications/read');
    return data;
};