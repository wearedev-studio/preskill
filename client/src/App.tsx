import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage/HomePage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import LoginPage from './pages/LoginPage/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import LobbyPage from './pages/LobbyPage/LobbyPage'; // Переименовали TicTacToeLobbyPage
import GamePage from './pages/GamePage/GamePage';   // Переименовали TicTacToeGamePage

// Components
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';

function App() {
  const { token, loading, refreshUser } = useAuth();

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
            </Route>
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;