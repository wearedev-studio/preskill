import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import TicTacToeBoard from '../../components/game/TicTacToeBoard';
import CheckersBoard from '../../components/game/CheckersBoard';
import ChessBoard from '../../components/game/ChessBoard';
import BackgammonBoard from '../../components/game/BackgammonBoard';
import styles from './TournamentGamePage.module.css';

interface TournamentGameState {
    matchId: string;
    gameType: string;
    players: Array<{
        _id: string;
        username: string;
        isBot: boolean;
    }>;
    gameState: any;
    myPlayerId: string;
}

interface TournamentGameResult {
    matchId: string;
    winner?: {
        _id: string;
        username: string;
        isBot: boolean;
    };
    isDraw: boolean;
}

interface TournamentMatchResult {
    type: 'ADVANCED' | 'ELIMINATED' | 'DRAW';
    message: string;
    tournamentId: string;
    status: 'WAITING_NEXT_ROUND' | 'ELIMINATED';
}

interface TournamentCompleted {
    tournamentId: string;
    isWinner: boolean;
    winner: string;
    tournamentName: string;
    prizePool: number;
}

const TournamentGamePage: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const [gameData, setGameData] = useState<TournamentGameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gameResult, setGameResult] = useState<TournamentGameResult | null>(null);
    const [gameError, setGameError] = useState<string | null>(null);
    const [matchResult, setMatchResult] = useState<TournamentMatchResult | null>(null);
    const [tournamentCompleted, setTournamentCompleted] = useState<TournamentCompleted | null>(null);
    
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const gameTypeText = {
        'tic-tac-toe': 'Крестики-нолики',
        'checkers': 'Шашки',
        'chess': 'Шахматы',
        'backgammon': 'Нарды'
    };

    useEffect(() => {
        if (!matchId || !socket || !user) {
            setError('Недостаточно данных для подключения к игре');
            setLoading(false);
            return;
        }

        socket.emit('joinTournamentGame', matchId);

        socket.on('tournamentGameStart', handleGameStart);
        socket.on('tournamentGameUpdate', handleGameUpdate);
        socket.on('tournamentGameEnd', handleGameEnd);
        socket.on('tournamentGameError', handleGameError);
        socket.on('tournamentMatchResult', handleMatchResult);
        socket.on('tournamentMatchReady', handleNextRoundReady);
        socket.on('tournamentCompleted', handleTournamentCompleted);
        socket.on('error', handleError);

        return () => {
            socket.off('tournamentGameStart', handleGameStart);
            socket.off('tournamentGameUpdate', handleGameUpdate);
            socket.off('tournamentGameEnd', handleGameEnd);
            socket.off('tournamentGameError', handleGameError);
            socket.off('tournamentMatchResult', handleMatchResult);
            socket.off('tournamentMatchReady', handleNextRoundReady);
            socket.off('tournamentCompleted', handleTournamentCompleted);
            socket.off('error', handleError);
        };
    }, [matchId, socket, user]);

    const handleGameStart = (data: TournamentGameState) => {
        console.log('[TournamentGame] Game started:', data);
        setGameData(data);
        setLoading(false);
        setError(null);
    };

    const handleGameUpdate = (data: { matchId: string; gameState: any }) => {
        console.log('[TournamentGame] Game updated:', data);
        if (gameData && data.matchId === gameData.matchId) {
            setGameData(prev => prev ? { ...prev, gameState: data.gameState } : null);
        }
    };

    const handleGameEnd = (result: TournamentGameResult) => {
        console.log('[TournamentGame] Game ended:', result);
        setGameResult(result);
        
    };

    const handleMatchResult = (result: TournamentMatchResult) => {
        console.log('[TournamentGame] Match result:', result);
        setMatchResult(result);
        
        if (result.type === 'ELIMINATED') {
            setTimeout(() => {
                navigate('/tournaments');
            }, 5000);
        } else if (result.type === 'ADVANCED') {
        }
    };

    const handleNextRoundReady = (data: any) => {
        console.log('[TournamentGame] Next round ready:', data);
        
        if (data.matchId) {
            navigate(`/tournament-game/${data.matchId}`);
        }
    };

    const handleTournamentCompleted = (data: TournamentCompleted) => {
        console.log('[TournamentGame] Tournament completed:', data);
        setTournamentCompleted(data);
        
        setTimeout(() => {
            navigate('/tournaments');
        }, 10000);
    };

    const handleError = (error: { message: string }) => {
        console.error('[TournamentGame] Error:', error);
        setError(error.message);
        setLoading(false);
    };

    const handleGameError = (data: { matchId: string; error: string }) => {
        console.log('[TournamentGame] Game error:', data);
        if (data.matchId === matchId) {
            setGameError(data.error);
            setTimeout(() => setGameError(null), 3000);
        }
    };

    const handleMove = (move: any) => {
        if (!socket || !matchId) return;
        
        console.log('[TournamentGame] Making move:', move);
        socket.emit('tournamentMove', { matchId, move });
    };

    const handleTicTacToeMove = (cellIndex: number) => {
        if (!socket || !matchId) return;
        
        const move = { cellIndex };
        console.log('[TournamentGame] Making tic-tac-toe move:', move);
        socket.emit('tournamentMove', { matchId, move });
    };

    const handleRollDice = () => {
        if (!socket || !matchId) return;
        
        console.log('[TournamentGame] Rolling dice');
        socket.emit('tournamentMove', {
            matchId,
            move: { type: 'ROLL_DICE' }
        });
    };

    const renderGameBoard = () => {
        if (!gameData) return null;

        const { gameType, gameState, players, myPlayerId } = gameData;
        const isMyTurn = gameState.turn === myPlayerId;
        const myPlayerIndex = players.findIndex(p => p._id === myPlayerId) as 0 | 1;
        
        switch (gameType) {
            case 'tic-tac-toe':
                return (
                    <TicTacToeBoard
                        board={gameState.board}
                        onMove={handleTicTacToeMove}
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameResult}
                    />
                );
            
            case 'checkers':
                return (
                    <CheckersBoard
                        gameState={gameState}
                        onMove={handleMove}
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameResult}
                        myPlayerIndex={myPlayerIndex}
                    />
                );
            
            case 'chess':
                return (
                    <ChessBoard
                        gameState={gameState}
                        onMove={handleMove}
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameResult}
                        myPlayerIndex={myPlayerIndex}
                    />
                );
            
            case 'backgammon':
                return (
                    <BackgammonBoard
                        gameState={gameState}
                        onMove={handleMove}
                        isMyTurn={isMyTurn}
                        isGameFinished={!!gameResult}
                        myPlayerIndex={myPlayerIndex}
                        onRollDice={handleRollDice}
                    />
                );
            
            default:
                return <div>Неподдерживаемый тип игры: {gameType}</div>;
        }
    };

    const renderGameResult = () => {
        if (!gameResult || !gameData) return null;

        const isWinner = gameResult.winner?._id === user?._id;
        const isDraw = gameResult.isDraw;

        return (
            <div className={styles.gameResultOverlay}>
                <div className={styles.gameResultModal}>
                    <h2>Матч завершен!</h2>
                    
                    {isDraw ? (
                        <div className={styles.drawResult}>
                            <span className={styles.resultIcon}>🤝</span>
                            <p>Ничья!</p>
                        </div>
                    ) : isWinner ? (
                        <div className={styles.winResult}>
                            <span className={styles.resultIcon}>🏆</span>
                            <p>Поздравляем! Вы победили!</p>
                        </div>
                    ) : (
                        <div className={styles.loseResult}>
                            <span className={styles.resultIcon}>😔</span>
                            <p>Вы проиграли</p>
                            {gameResult.winner && (
                                <p>Победитель: {gameResult.winner.username}</p>
                            )}
                        </div>
                    )}

                    {matchResult && (
                        <div className={styles.tournamentStatus}>
                            <h3>Статус в турнире:</h3>
                            <p>{matchResult.message}</p>
                            
                            {matchResult.type === 'ADVANCED' && (
                                <p className={styles.waitingMessage}>
                                    Ожидание следующего раунда...
                                </p>
                            )}
                            
                            {matchResult.type === 'ELIMINATED' && (
                                <div className={styles.resultActions}>
                                    <button
                                        onClick={() => navigate('/tournaments')}
                                        className={styles.backToTournamentsButton}
                                    >
                                        Вернуться к турнирам
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {matchResult?.type === 'ELIMINATED' && (
                        <p className={styles.autoRedirect}>
                            Автоматический переход через 5 секунд...
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const renderTournamentCompleted = () => {
        if (!tournamentCompleted) return null;

        return (
            <div className={styles.gameResultOverlay}>
                <div className={styles.gameResultModal}>
                    <h2>🏆 Турнир завершен!</h2>
                    
                    {tournamentCompleted.isWinner ? (
                        <div className={styles.winResult}>
                            <span className={styles.resultIcon}>🥇</span>
                            <h3>Поздравляем с победой!</h3>
                            <p>Вы выиграли турнир "{tournamentCompleted.tournamentName}"!</p>
                            <p className={styles.prizeInfo}>
                                Ваш приз: {Math.floor(tournamentCompleted.prizePool * 0.6)} монет
                            </p>
                        </div>
                    ) : (
                        <div className={styles.tournamentResult}>
                            <span className={styles.resultIcon}>🏁</span>
                            <h3>Турнир завершен</h3>
                            <p>Турнир "{tournamentCompleted.tournamentName}" завершен</p>
                            <p>Победитель: {tournamentCompleted.winner}</p>
                        </div>
                    )}

                    <div className={styles.resultActions}>
                        <button
                            onClick={() => navigate('/tournaments')}
                            className={styles.backToTournamentsButton}
                        >
                            Вернуться к турнирам
                        </button>
                    </div>

                    <p className={styles.autoRedirect}>
                        Автоматический переход через 10 секунд...
                    </p>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <p>Подключение к турнирной игре...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    <h2>Ошибка подключения</h2>
                    <p>{error}</p>
                    <button 
                        onClick={() => navigate('/tournaments')}
                        className={styles.backButton}
                    >
                        Вернуться к турнирам
                    </button>
                </div>
            </div>
        );
    }

    if (!gameData) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    <h2>Игра не найдена</h2>
                    <p>Турнирный матч не найден или недоступен</p>
                    <button 
                        onClick={() => navigate('/tournaments')}
                        className={styles.backButton}
                    >
                        Вернуться к турнирам
                    </button>
                </div>
            </div>
        );
    }

    const opponent = gameData.players.find(p => p._id !== user?._id);
    const isMyTurn = gameData.gameState.turn === user?._id;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button 
                    onClick={() => navigate('/tournaments')}
                    className={styles.backButton}
                >
                    ← Турниры
                </button>
                <h1>Турнирный матч</h1>
                <div className={styles.gameInfo}>
                    {gameTypeText[gameData.gameType as keyof typeof gameTypeText]}
                </div>
            </div>

            <div className={styles.playersInfo}>
                <div className={`${styles.player} ${isMyTurn ? styles.currentTurn : ''}`}>
                    <div className={styles.playerName}>
                        {user?.username} (Вы)
                    </div>
                    {isMyTurn && <div className={styles.turnIndicator}>Ваш ход</div>}
                </div>

                <div className={styles.vs}>VS</div>

                <div className={`${styles.player} ${!isMyTurn ? styles.currentTurn : ''}`}>
                    <div className={styles.playerName}>
                        {opponent?.username}
                        {opponent?.isBot && ' 🤖'}
                    </div>
                    {!isMyTurn && <div className={styles.turnIndicator}>Ход противника</div>}
                </div>
            </div>

            <div className={styles.gameBoard}>
                {renderGameBoard()}
            </div>

            {gameError && (
                <div className={styles.gameErrorMessage}>
                    <div className={styles.errorContent}>
                        <span className={styles.errorIcon}>⚠️</span>
                        <span>{gameError}</span>
                    </div>
                </div>
            )}

            {gameResult && !tournamentCompleted && renderGameResult()}
            {tournamentCompleted && renderTournamentCompleted()}
        </div>
    );
};

export default TournamentGamePage;