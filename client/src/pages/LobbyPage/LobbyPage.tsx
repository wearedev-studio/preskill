import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import styles from './LobbyPage.module.css'; // Импортируем стили

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

const getGameIcon = (gameType: string = ''): string => {
    switch (gameType) {
        case 'tic-tac-toe': return '⭕';
        case 'checkers': return '⚫';
        case 'chess': return '♛';
        case 'backgammon': return '🎲';
        default: return '🎮';
    }
}

const LobbyPage: React.FC = () => {
    const { gameType } = useParams<{ gameType: string }>();
    const { socket } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [bet, setBet] = useState(10);
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!socket || !gameType) return;
        socket.emit('joinLobby', gameType);

        const onRoomsList = (availableRooms: RoomInfo[]) => setRooms(availableRooms);
        const onGameStart = (room: GameRoom) => navigate(`/game/${room.gameType}/${room.id}`);
        const onError = ({ message }: { message: string }) => {
            setError(message);
            setIsCreating(false);
        };
        
        socket.on('roomsList', onRoomsList);
        socket.on('gameStart', onGameStart);
        socket.on('error', onError);

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
            setIsCreating(true);
            socket.emit('createRoom', { gameType, bet });
        }
    };

    const handleJoinRoom = (roomId: string) => {
        if (socket) {
            setError('');
            socket.emit('joinRoom', roomId);
        }
    };

    if (!user || !gameType) {
        return <div>Загрузка...</div>;
    }

    return (
        <div className={styles.pageContainer}>
            <button onClick={() => navigate('/games')} className={styles.backButton}>
                ← Назад к играм
            </button>
            
            <div className={styles.gameHeader}>
                <div className={styles.gameIcon}>{getGameIcon(gameType)}</div>
                <div>
                    <h1>Лобби: {formatGameName(gameType)}</h1>
                    <p>Ваш баланс: <span>${user.balance.toFixed(2)}</span></p>
                </div>
            </div>

            {error && <div style={{color: 'salmon', textAlign: 'center', marginBottom: '1rem'}}>Ошибка: {error}</div>}

            <div className={styles.mainGrid}>
                {/* Секция создания комнаты */}
                <div className={styles.lobbySection}>
                    <div className={styles.lobbySectionHeader}>
                        <span>➕</span>
                        <h2 className={styles.lobbySectionTitle}>Создать игру</h2>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Ставка ($)</label>
                        <input
                            type="number"
                            value={bet}
                            onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
                            min="1"
                            max={user.balance}
                            className={styles.formInput}
                            placeholder="Введите ставку"
                        />
                    </div>
                    <button onClick={handleCreateRoom} disabled={isCreating || bet > user.balance} className={`${styles.btn} ${styles.btnPrimary}`}>
                        {isCreating ? (
                            <>
                                <div className={styles.spinner}></div>
                                Создание...
                            </>
                        ) : (
                            `▶️ Создать игру на $${bet}`
                        )}
                    </button>
                </div>

                {/* Секция доступных комнат */}
                <div className={styles.lobbySection}>
                    <div className={styles.lobbySectionHeader}>
                        <span>👥</span>
                        <h2 className={styles.lobbySectionTitle}>Доступные игры</h2>
                    </div>
                    
                    <div className={styles.roomList}>
                        {rooms.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div>⏰</div>
                                <p>Нет доступных комнат</p>
                                <p>Создайте свою игру!</p>
                            </div>
                        ) : (
                            rooms.map(room => (
                                <div key={room.id} className={styles.roomItem}>
                                    <div className={styles.roomInfo}>
                                        <div className={styles.roomAvatar}>
                                            <span>👤</span>
                                        </div>
                                        <div className={styles.roomDetails}>
                                            <h4>{room.host.user.username}</h4>
                                            <p>Ставка: ${room.bet}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleJoinRoom(room.id)} className={`${styles.btn} ${styles.btnPrimary}`}>
                                        Присоединиться
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;