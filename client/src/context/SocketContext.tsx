import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_URL } from '../api/index';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { token } = useAuth(); // Получаем токен для аутентификации

  useEffect(() => {
    if (token) {
      // Создаем новое соединение при получении токена
      const newSocket = io(`${API_URL}`, {
        auth: {
          token: token,
        },
      });
      setSocket(newSocket);

      // Закрываем соединение при выходе пользователя
      return () => {
        newSocket.close();
      };
    } else {
      // Если токена нет, убеждаемся, что сокет закрыт
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

// Кастомный хук для удобного использования
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};