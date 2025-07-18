import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const ResetPasswordPage: React.FC = () => {
  const [secretCode, setSecretCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      setError('Email не найден. Пожалуйста, начните процедуру сброса сначала.');
      setTimeout(() => navigate('/forgot-password'), 3000);
    }
  }, [email, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      await axios.post('http://localhost:5001/api/auth/reset-password', {
        email,
        secretCode,
        newPassword,
      });
      setMessage('Пароль успешно сброшен! Вы будете перенаправлены на страницу входа.');
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Произошла ошибка.');
    }
  };

  if (!email) {
    return <div><p style={{ color: 'red' }}>{error || 'Перенаправление...'}</p></div>;
  }

  return (
    <div>
      <h2>Установка нового пароля</h2>
      <p>Устанавливаем пароль для: <strong>{email}</strong></p>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Секретный код:</label>
          <input
            type="text"
            value={secretCode}
            onChange={(e) => setSecretCode(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Новый пароль:</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        <button type="submit">Сбросить пароль</button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;