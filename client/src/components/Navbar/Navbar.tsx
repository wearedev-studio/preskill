import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface User {
  _id: string;
  username: string;
  email: string;
  balance: number;
  avatar: string;
}

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const navStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      background: '#1a1a1a',
      marginBottom: '2rem'
  }

  const linkStyle: React.CSSProperties = {
    color: 'white',
    textDecoration: 'none'
  }

  console.log(user); 

  return (
    <nav style={navStyle}>
      <div>
        <Link to="/" style={linkStyle}>Главная</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isAuthenticated && user ? (
          <>
            <Link to="/profile" style={linkStyle}>Профиль</Link>
            <span style={{ color: 'lightgreen' }}>Баланс: ${user.balance.toFixed(2)}</span>
            <span>({user.username})</span>
            <button onClick={handleLogout}>Выйти</button>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" style={{...linkStyle, marginLeft: '1rem' }}>Админка</Link>
            )}
          </>
        ) : (
          <>
            <Link to="/login" style={linkStyle}>Вход</Link>
            <Link to="/register" style={linkStyle}>Регистрация</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;