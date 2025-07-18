import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

interface RoomInfo {
    id: string;
    bet: number;
    host: { user: { username: string } };
}

interface GameRoom {
    id: string;
    gameType: string;
}

const formatGameName = (gameType: string = ''): string => {
    return gameType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const LobbyPage: React.FC = () => {
    const { gameType } = useParams<{ gameType: string }>();
    const { socket } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [bet, setBet] = useState(10);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!socket || !gameType) return;

        // 1. Сообщаем серверу, что мы вошли в лобби этого типа игры
        socket.emit('joinLobby', gameType);

        // 2. Слушаем готовый список комнат от сервера
        const onRoomsList = (availableRooms: RoomInfo[]) => {
            setRooms(availableRooms);
        };
        const onGameStart = (room: GameRoom) => navigate(`/game/${room.gameType}/${room.id}`);
        const onError = ({ message }: { message: string }) => setError(message);
        
        socket.on('roomsList', onRoomsList);
        socket.on('gameStart', onGameStart);
        socket.on('error', onError);

        // 3. При выходе со страницы сообщаем серверу, что мы покинули лобби
        return () => {
            socket.emit('leaveLobby', gameType);
            socket.off('roomsList', onRoomsList);
            socket.off('gameStart', onGameStart);
            socket.off('error', onError);
        };
    }, [socket, gameType, navigate]);

    const handleCreateRoom = () => {
        if (socket && gameType) {
            setError('');
            socket.emit('createRoom', { gameType, bet });
        }
    };

    const handleJoinRoom = (roomId: string) => {
        if (socket) {
            setError('');
            socket.emit('joinRoom', roomId);
        }
    };

    if (!user || !gameType) return <div>Загрузка...</div>;

    return (
        <div>
            <h2>Лобби: {formatGameName(gameType)}</h2>
            <p>Ваш баланс: ${user.balance.toFixed(2)}</p>
            {error && <p style={{ color: 'salmon' }}>Ошибка: {error}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2rem', marginTop: '2rem' }}>
                <div style={{ border: '1px solid #444', padding: '1.5rem', borderRadius: '8px' }}>
                    <h3>Создать свою игру</h3>
                    <input 
                        type="number" 
                        value={bet} 
                        onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
                        min="1"
                    />
                    <button onClick={handleCreateRoom}>Создать игру на ${bet}</button>
                </div>
                <div style={{ border: '1px solid #444', padding: '1.5rem', borderRadius: '8px', minWidth: '300px' }}>
                    <h3>Доступные игры</h3>
                    {rooms.length === 0 ? <p>Нет доступных комнат. Создайте свою!</p> : (
                        rooms.map(room => (
                            <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #555', padding: '10px 0' }}>
                                <div>
                                    <p>Игрок: {room.host.user.username}</p>
                                    <p>Ставка: ${room.bet}</p>
                                </div>
                                <button onClick={() => handleJoinRoom(room.id)}>Присоединиться</button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;