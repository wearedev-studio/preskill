import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();

    // Пока идет проверка аутентификации, показываем заглушку
    if (loading) {
        return <div>Загрузка...</div>;
    }

    // Если проверка завершена и пользователь не авторизован, перенаправляем на логин
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Если все в порядке, показываем дочерний компонент (страницу)
    return <Outlet />;
};

export default ProtectedRoute;