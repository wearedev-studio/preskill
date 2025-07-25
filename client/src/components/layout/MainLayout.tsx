import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUI } from '../../context/UIContext';

// Импорты всех страниц
import DashboardPage from '../../pages/DashboardPage/DashboardPage';
import HomePage from '../../pages/HomePage/HomePage';
import TournamentsListPage from '../../pages/TournamentsListPage/TournamentsListPage';
import TournamentDetailPage from '../../pages/TournamentDetailPage/TournamentDetailPage';
import ProfilePage from '../../pages/ProfilePage/ProfilePage';
import NotificationsPage from '../../pages/NotificationsPage/NotificationsPage';
import LobbyPage from '../../pages/LobbyPage/LobbyPage';
import GamePage from '../../pages/GamePage/GamePage';
import AdminPage from '../../pages/AdminPage/AdminPage';
import AdminRoute from '../AdminRoute/AdminRoute';

const MainLayout: React.FC = () => {
    const { isSidebarOpen } = useUI();
    
    return (
        <div className="min-h-screen text-slate-300" style={{marginLeft: "249px"}}>
            <Sidebar />
            
            <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
                <Header />
                <main className="p-4 sm:p-6 lg:p-8">
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/games" element={<HomePage />} />
                        <Route path="/tournaments" element={<TournamentsListPage />} />
                        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/lobby/:gameType" element={<LobbyPage />} />
                        <Route path="/game/:gameType/:roomId" element={<GamePage />} />

                        <Route element={<AdminRoute />}>
                            <Route path="/admin" element={<AdminPage />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    )
}

export default MainLayout;