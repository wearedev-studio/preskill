import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      await axios.post('http://localhost:5001/api/auth/forgot-password', { email });
      setMessage('Код для сброса пароля был "отправлен". Проверьте консоль сервера или ответ от API. Сейчас вы будете перенаправлены на страницу сброса.');
      
      setTimeout(() => {
        // Передаем email на следующую страницу
        navigate('/reset-password', { state: { email } });
      }, 3000);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Произошла ошибка.');
    }
  };

  return (
    <div>
      <h2>Сброс пароля</h2>
      <p>Введите ваш email, чтобы получить код для сброса.</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        <button type="submit">Получить код</button>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;