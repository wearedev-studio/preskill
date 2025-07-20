import React from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './Avatar.module.css';
import { API_URL } from '../../api/index';

interface AvatarProps {
    size?: 'small' | 'large'; // Определяем размеры для разных частей интерфейса
}

const Avatar: React.FC<AvatarProps> = ({ size = 'small' }) => {
    const { user } = useAuth();

    if (!user) return null;

    // Проверяем, есть ли у пользователя загруженный аватар
    const hasUploadedAvatar = user.avatar && user.avatar.startsWith('/uploads');

    if (hasUploadedAvatar) {
        return (
            <img 
                src={`${API_URL}/${user.avatar}`} 
                alt={user.username} 
                className={`${styles.avatarImage} ${size === 'large' ? styles.large : styles.small}`} 
            />
        );
    }

    // Если нет, показываем инициалы
    const initials = user.username ? user.username.substring(0, 2).toUpperCase() : '??';

    return (
        <div className={`${styles.avatarInitials} ${size === 'large' ? styles.large : styles.small}`}>
            {initials}
        </div>
    );
};

export default Avatar;