import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast'; // 1. Импортируем компоненты


// Pages
import HomePage from './pages/HomePage/HomePage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import LoginPage from './pages/LoginPage/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import LobbyPage from './pages/LobbyPage/LobbyPage'; // Переименовали TicTacToeLobbyPage
import GamePage from './pages/GamePage/GamePage';   // Переименовали TicTacToeGamePage
import TournamentsListPage from './pages/TournamentsListPage/TournamentsListPage';
import TournamentDetailPage from './pages/TournamentDetailPage/TournamentDetailPage';
import NotificationsPage from './pages/NotificationsPage/NotificationsPage'; // Импорт новой страницы

import AdminPage from './pages/AdminPage/AdminPage';

// Страницы-заглушки из твоей верстки
import DashboardPage from './pages/DashboardPage/DashboardPage';

// Components
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import AdminRoute from './components/AdminRoute/AdminRoute';
import { NotificationHandler } from './components/NotificationHandler/NotificationHandler'; // Вынесем в отдельный компонент

// Новые компоненты из твоей верстки
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

function App() {
  const { token, loading, refreshUser } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  useEffect(() => {
    // При самой первой загрузке приложения, если есть токен, обновляем данные
    refreshUser();
  }, [refreshUser]); // Этот useEffect сработает один раз

  if (loading) {
    return <div>Загрузка приложения...</div>
  }

  return (
    <Router>
      <Navbar />
      <Toaster position="bottom-right" />
      <NotificationHandler /> {/* 2. Добавляем наш слушатель уведомлений */}

      <div className="App">
        <main>
          <Routes>
            {/* Публичные роуты */}
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Защищенные роуты */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              {/* Динамические роуты для лобби и игры */}
              <Route path="/lobby/:gameType" element={<LobbyPage />} />
              <Route path="/game/:gameType/:roomId" element={<GamePage />} />
              <Route path="/tournaments" element={<TournamentsListPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/notifications" element={<NotificationsPage />} /> {/* Новый роут */}
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// function App() {
//   const { loading, refreshUser } = useAuth();
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

//   useEffect(() => {
//     refreshUser();
//   }, [refreshUser]);

//   if (loading) {
//     return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Загрузка приложения...</div>;
//   }

//   return (
//     <Router>
//       <div className="min-h-screen bg-slate-900 text-slate-300">
//         <Toaster position="bottom-right" />
//         <NotificationHandler />
        
//         <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
//         <div className="lg:ml-64">
//           <Header onMenuClick={() => setIsSidebarOpen(true)} />

//           <main className="p-4 sm:p-6 lg:p-8">
//             <Routes>
//               <Route element={<ProtectedRoute />}>
//                 <Route path="/" element={<DashboardPage />} />
//                 <Route path="/games" element={<HomePage />} />
//                 <Route path="/tournaments" element={<TournamentsListPage />} />
//                 <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
//                 <Route path="/profile" element={<ProfilePage />} />
//                 <Route path="/lobby/:gameType" element={<LobbyPage />} />
//                 <Route path="/game/:gameType/:roomId" element={<GamePage />} />

//                 <Route element={<AdminRoute />}>
//                     <Route path="/admin" element={<AdminPage />} />
//                 </Route>
//               </Route>
//               {/* Роуты для логина/регистрации будут за пределами этого шаблона */}
//                 <Route path="/register" element={<RegisterPage />} />
//                 <Route path="/login" element={<LoginPage />} />
//                 <Route path="/forgot-password" element={<ForgotPasswordPage />} />
//                 <Route path="/reset-password" element={<ResetPasswordPage />} />
//             </Routes>
//           </main>
//         </div>
//       </div>
//     </Router>
//   );
// }

export default App;