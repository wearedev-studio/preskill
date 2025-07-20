import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import TicTacToeBoard from '../../components/game/TicTacToeBoard';
import CheckersBoard from '../../components/game/CheckersBoard';
import ChessBoard from '../../components/game/ChessBoard';
import BackgammonBoard from '../../components/game/BackgammonBoard';
import { Chess } from 'chess.js';
import styles from './GamePage.module.css';

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

const GamePage: React.FC = () => {
    const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user, refreshUser } = useAuth();
    
    const [roomState, setRoomState] = useState<GameRoomState | null>(null);
    const [gameMessage, setGameMessage] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [redirectCountdown, setRedirectCountdown] = useState(5);
    const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!socket || !roomId) return;

        if (roomId.startsWith('tourney-')) {
            socket.emit('joinTournamentGame', roomId);
        } else {
            socket.emit('getGameState', roomId);
        }

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

            try {
                await refreshUser();
            } catch (error) {
                console.error("Не удалось обновить профиль после игры", error);
            }
        };
        const onError = ({ message }: { message: string }) => {
            setGameMessage(`Ошибка: ${message}`);
        };
        
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
    }, [socket, roomId, user?.username, navigate, gameType, refreshUser]);

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

    const handleRollDice = () => {
        if (socket) {
            socket.emit('rollDice', roomId);
        }
    };

    const renderGameBoard = () => {
        if (!roomState) return null;

        const myPlayerIndex = roomState.players.findIndex((p: Player) => p.user._id === user?._id);
        const isMyTurn = roomState.gameState.turn === user?._id;

        switch (gameType) {
            case 'tic-tac-toe':
                return (
                    <TicTacToeBoard 
                        board={roomState.gameState.board} 
                        onMove={(cellIndex) => handleMove({ cellIndex })} 
                        isMyTurn={roomState.gameState.turn === user?._id} 
                        isGameFinished={!!gameMessage} 
                    />
                );
            case 'checkers':
                if (myPlayerIndex === -1) return (
                    <div className="alert alert-error">
                        <p>Ошибка: вы не являетесь игроком в этой комнате.</p>
                    </div>
                );
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
                return (
                    <ChessBoard 
                        // @ts-ignore
                        gameState={roomState.gameState} 
                        onMove={(move) => handleMove(move)} 
                        isMyTurn={isMyTurn} 
                        isGameFinished={!!gameMessage} 
                        myPlayerIndex={myPlayerIndex as 0 | 1} 
                    />
                );
            case 'backgammon':
                return (
                    <BackgammonBoard
                        // @ts-ignore
                        gameState={roomState.gameState}
                        onMove={(move) => handleMove(move)}
                        onRollDice={handleRollDice}
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameMessage}
                        myPlayerIndex={myPlayerIndex as 0 | 1}
                    />
                );
            default:
                return (
                    <div className="alert alert-error">
                        <p>Игра "{gameType}" не найдена.</p>
                    </div>
                );
        }
    };

    if (!roomState) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="spinner"></div>
                    <p className="loading-text">Загрузка игры...</p>
                </div>
            </div>
        );
    }
    
    const isWaitingForOpponent = roomState.players.length < 2 && !gameMessage;
    const opponent = roomState.players.find(p => p.user._id !== user?._id);
    const isMyTurn = roomState.gameState.turn === user?._id;

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <button onClick={() => navigate(`/lobby/${gameType}`)} className={styles.backButton}>
                    ← Назад в лобби
                </button>
                <div className={styles.gameHeader}>
                    <div className={styles.gameIcon}>{getGameIcon(gameType)}</div>
                    <div><h1>{formatGameName(gameType)}</h1></div>
                </div>
            </div>

            <div className={`${styles.card} ${styles.cardPadding}`}>
                <div className={styles.gameInfoGrid}>
                    <div className={styles.gameInfoItem}>
                        <span className={styles.gameInfoIcon}>👥</span>
                        <div className={styles.gameInfoContent}><p>Игроки</p><p>{user?.username} vs {opponent?.user.username || '...'}</p></div>
                    </div>
                    <div className={styles.gameInfoItem}>
                        <span className={styles.gameInfoIcon}>💰</span>
                        <div className={styles.gameInfoContent}><p>Ставка</p><p>${roomState.bet}</p></div>
                    </div>
                    <div className={styles.gameInfoItem}>
                        <span className={styles.gameInfoIcon}>🏆</span>
                        <div className={styles.gameInfoContent}><p>Приз</p><p>${roomState.bet * 2}</p></div>
                    </div>
                </div>
            </div>

            <div className={styles.statusMessageContainer}>
                {isWaitingForOpponent ? (
                    <div className={`${styles.statusMessage} ${styles.statusWaiting}`}>
                        <div className={styles.statusIcon}>⏰</div>
                        <h3 className={styles.statusTitleWaiting}>⏳ Ожидание оппонента...</h3>
                        <p>Автоматическая отмена через: <span style={{fontWeight: 'bold'}}>{countdown} сек</span></p>
                    </div>
                ) : !gameMessage ? (
                    <div className={`${styles.statusMessage} ${isMyTurn ? styles.statusTurn : styles.statusOpponentTurn}`}>
                        <h3 className={`${styles.statusTitle} ${isMyTurn ? styles.statusTitleMyTurn : styles.statusTitleOpponentTurn}`}>
                            {isMyTurn ? '✅ Ваш ход' : '⏳ Ход противника'}
                        </h3>
                    </div>
                ) : (
                    <div className={`${styles.statusMessage} ${styles.statusGameEnd}`}>
                        <div className={styles.statusIcon}>
                            {gameMessage.includes('победили') ? '🏆' : gameMessage.includes('Ничья') ? '🤝' : '😔'}
                        </div>
                        <h3 className={`${styles.statusTitle} ${styles.statusTitleEnd}`}>{gameMessage}</h3>
                        <div className={styles.statusCountdown}>
                            <p>Возвращение в лобби через: <span style={{fontWeight: 'bold'}}>{redirectCountdown} сек</span></p>
                            <button onClick={() => navigate(`/lobby/${gameType}`)} className={`${styles.btn} ${styles.btnPrimary}`}>Вернуться сейчас</button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`${styles.card} ${styles.cardPadding}`}>
                {renderGameBoard()}
            </div>

            {!gameMessage && (
                <div style={{textAlign: 'center'}}>
                    <button onClick={handleLeaveGame} className={`${styles.btn} ${styles.btnDanger}`}>
                        {isWaitingForOpponent ? 'Отменить поиск' : 'Сдаться'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default GamePage;