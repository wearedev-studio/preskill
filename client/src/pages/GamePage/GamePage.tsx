import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import TicTacToeBoard from '../../components/game/TicTacToeBoard';
import CheckersBoard from '../../components/game/CheckersBoard'; // 1. Импортируем доску для шашек
import ChessBoard from '../../components/game/ChessBoard';
import BackgammonBoard from '../../components/game/BackgammonBoard';
import { Chess } from 'chess.js';


interface Player {
    user: { _id: string; username: string; }
}
interface GameRoomState {
    id: string;
    gameType: string;
    players: Player[];
    gameState: { board: ('X' | 'O' | null)[]; turn: string; };
    bet: number;
}

const GamePage: React.FC = () => {
    const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user, refreshUser   } = useAuth();
    
    const [roomState, setRoomState] = useState<GameRoomState | null>(null);
    const [gameMessage, setGameMessage] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [redirectCountdown, setRedirectCountdown] = useState(5);
    const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!socket || !roomId) return;

        const onGameStart = (state: GameRoomState) => {
            setGameMessage('');
            setRoomState(state);
            if (state.players.length === 1) setCountdown(15);
        };
        const onGameUpdate = (state: GameRoomState) => setRoomState(state);
        const onGameEnd = async ({ winner, isDraw }: { winner: Player | null, isDraw: boolean }) => {
            if (isDraw) setGameMessage('Ничья!');
            else if (winner?.user.username === user?.username) setGameMessage('🎉 Вы победили!');
            else setGameMessage(`Вы проиграли. Победитель: ${winner?.user.username}`);

            // Просто запрашиваем свежие данные и устанавливаем их
            try {
                // const { data: freshUser } = await axios.get('http://localhost:5001/api/users/profile');
                await refreshUser();
            } catch (error) {
                console.error("Не удалось обновить профиль после игры", error);
            }
        };
        const onError = ({ message }: { message: string }) => alert(`Ошибка: ${message}`);
        
        socket.on('gameStart', onGameStart);
        socket.on('gameUpdate', onGameUpdate);
        socket.on('gameEnd', onGameEnd);
        socket.on('error', onError);

        socket.emit('getGameState', roomId);

        return () => {
            socket.off('gameStart', onGameStart);
            socket.off('gameUpdate', onGameUpdate);
            socket.off('gameEnd', onGameEnd);
            socket.off('error', onError);
        };
    }, [socket, roomId, user?.username, navigate, gameType, refreshUser ]);

    useEffect(() => {
        if (roomState?.players.length !== 1 || countdown <= 0 || gameMessage) return;
        const timer = setInterval(() => setCountdown(prev => prev > 0 ? prev - 1 : 0), 1000);
        return () => clearInterval(timer);
    }, [roomState, countdown, gameMessage]);

    useEffect(() => {
        if (gameMessage) {
            setRedirectCountdown(5);
            redirectTimerRef.current = setInterval(() => {
                setRedirectCountdown(prev => {
                    if (prev <= 1) {
                        if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
                        navigate(`/lobby/${gameType}`);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
        };
    }, [gameMessage, navigate, gameType]);

    const handleLeaveGame = () => {
        if (socket && roomId) socket.emit('leaveGame', roomId);
        navigate(`/lobby/${gameType}`);
    };

    const handleMove = (moveData: any) => {
        if (socket) socket.emit('playerMove', { roomId, move: moveData });
    };

     // 2. Новая функция для броска костей
    const handleRollDice = () => {
        if (socket) {
            socket.emit('rollDice', roomId);
        }
    };

    const renderGameBoard = () => {
        if (!roomState) return null;

        const myPlayerIndex = roomState.players.findIndex((p: Player) => p.user._id === user?._id);
        // if (myPlayerIndex === -1) return <div>Ошибка: вы не являетесь игроком.</div>;

        // ИСПРАВЛЕНИЕ: Определяем, чей ход, по-разному для разных игр
        const isMyTurn = roomState.gameState.turn === user?._id;


        switch (gameType) {
            case 'tic-tac-toe':
                return <TicTacToeBoard board={roomState.gameState.board} onMove={(cellIndex) => handleMove({ cellIndex })} isMyTurn={roomState.gameState.turn === user?._id} isGameFinished={!!gameMessage} />;
            case 'checkers':
                // 3. Добавляем рендеринг доски для шашек
                if (myPlayerIndex === -1) return <div>Ошибка: вы не являетесь игроком в этой комнате.</div>;
                return (
                    <CheckersBoard
                        // @ts-ignore
                        gameState={roomState.gameState}
                        // @ts-ignore
                        onMove={(move) => handleMove(move)}
                        isMyTurn={roomState.gameState.turn === user?._id}
                        isGameFinished={!!gameMessage}
                        myPlayerIndex={myPlayerIndex as 0 | 1}
                    />
                );
            case 'chess':
                // 2. Добавляем рендеринг доски для шахмат
                // @ts-ignore
                return <ChessBoard gameState={roomState.gameState} onMove={(move) => handleMove(move)} isMyTurn={isMyTurn} isGameFinished={!!gameMessage} myPlayerIndex={myPlayerIndex as 0 | 1} />;
            case 'backgammon':
                // 3. Добавляем рендеринг доски для нард
                return (
                    <BackgammonBoard
                    // @ts-ignore
                        gameState={roomState.gameState}
                        onMove={(move) => handleMove(move)}
                        onRollDice={handleRollDice} // Передаем новую функцию
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameMessage}
                        myPlayerIndex={myPlayerIndex as 0 | 1}
                    />
                );
            default:
                return <div>Игра "{gameType}" не найдена.</div>;
        }
    };

    if (!roomState) return <div>Загрузка игры...</div>;
    
    const isWaitingForOpponent = roomState.players.length < 2 && !gameMessage;
    const opponent = roomState.players.find(p => p.user._id !== user?._id);
    const isMyTurn = roomState.gameState.turn === user?._id;

    return (
        <div style={{ textAlign: 'center' }}>
            <h2>{gameType?.replace(/-/g, ' ')}</h2>
            <p>Вы (<strong>{user?.username}</strong>) против <strong>{opponent?.user.username || '...'}</strong> | Ставка: <strong>${roomState.bet}</strong></p>
            
            {isWaitingForOpponent ? (
                <h3>⏳ Ожидание оппонента... ({countdown} сек)</h3>
            ) : !gameMessage ? (
                <h3>{isMyTurn ? '✅ Ваш ход' : '⏳ Ход противника'}</h3>
            ) : (
                <div style={{ margin: '20px 0' }}>
                    <h3 style={{ color: 'lightgreen', fontSize: '1.5rem' }}>{gameMessage}</h3>
                    <p>Возвращение в лобби через: {redirectCountdown}...</p>
                    <button onClick={() => navigate(`/lobby/${gameType}`)}>Вернуться сейчас</button>
                </div>
            )}
            
            {renderGameBoard()}
            
            {!gameMessage && (
                <button onClick={handleLeaveGame} style={{ marginTop: '20px', backgroundColor: '#FF6347', color: 'white' }}>
                    {isWaitingForOpponent ? 'Отменить поиск' : 'Сдаться'}
                </button>
            )}
        </div>
    );
};

export default GamePage;