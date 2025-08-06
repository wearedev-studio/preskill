import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_URL } from '../api/index';
import { useNavigate } from 'react-router-dom';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      const newSocket = io(`${API_URL}`, {
        auth: {
          token: token,
        },
      });

      // Обработчик автоматического перенаправления к турнирным играм
      newSocket.on('tournamentMatchReady', (data: {
        tournamentId: string;
        matchId: string;
        gameType: string;
        opponent: any;
      }) => {
        console.log('[Tournament] Match ready, redirecting to game:', data);
        
        // Автоматически перенаправляем игрока к турнирной игре
        setTimeout(() => {
          window.location.href = `/tournament-game/${data.matchId}`;
        }, 2000); // 2 секунды задержки для показа уведомления
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
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