import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage/LoginPage';
import AdminLayout from './components/layout/AdminLayout';

import DashboardPage from './pages/DashboardPage/DashboardPage'; // Импортируем нашу новую страницу
import UsersPage from './pages/UsersPage/UsersPage'; // Импортируем нашу новую страницу
import TransactionsPage from './pages/TransactionsPage/TransactionsPage'; // Импортируем нашу новую страницу
import GamesPage from './pages/GamesPage/GamesPage'; // Импортируем нашу новую страницу
import RoomsPage from './pages/RoomsPage/RoomsPage'; // Импортируем нашу новую страницу
import CreateRoomPage from './pages/CreateRoomPage/CreateRoomPage'; // Импортируем нашу новую страницу
import TournamentsPage from './pages/TournamentsPage/TournamentsPage'; // Импортируем нашу новую страницу
import KYCPage from './pages/KYCPage/KYCPage'; // <-- Импорт

function App() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        // Простой экран загрузки, пока мы проверяем токен
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Загрузка...</div>;
    }

    return (
        <Router>
            <Routes>
                {isAuthenticated ? (
                    // Если пользователь АВТОРИЗОВАН, показываем основной шаблон
                    <Route path="/" element={<AdminLayout />}>
                        {/* Вложенные роуты для страниц внутри админки */}
                        <Route index element={<DashboardPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="games" element={<GamesPage />} />
                        <Route path="transactions" element={<TransactionsPage />} />
                        <Route path="rooms" element={<RoomsPage />} />
                        <Route path="tournaments" element={<TournamentsPage />} />
                        <Route path="kyc" element={<KYCPage />} /> {/* <-- Новый роут */}
                        <Route path="create-room" element={<CreateRoomPage />} />
                        {/* Любой другой путь внутри админки перенаправляем на дашборд */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                ) : (
                    // Если пользователь НЕ АВТОРИЗОВАН, показываем только страницу входа
                    <>
                        <Route path="/login" element={<LoginPage />} />
                        {/* Любой другой путь перенаправляем на страницу входа */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </>
                )}
            </Routes>
        </Router>
    );
}

export default App;