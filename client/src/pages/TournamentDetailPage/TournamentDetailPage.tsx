// import React, { useState, useEffect, useCallback } from 'react';
// import { useParams } from 'react-router-dom';
// import { getTournamentById, registerForTournament, ITournament } from '../../services/tournamentService';
// import { useAuth } from '../../context/AuthContext';
// import { useSocket } from '../../context/SocketContext';

// const TournamentDetailPage: React.FC = () => {
//     const { id } = useParams<{ id: string }>();
//     const { user, refreshUser } = useAuth();
//     const { socket } = useSocket();
//     const [tournament, setTournament] = useState<ITournament | null>(null);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState('');
//     const [isRegistered, setIsRegistered] = useState(false);

// const fetchTournament = useCallback(async () => {
//     if (!id) return;
//     try {
//         const data = await getTournamentById(id);
//         setTournament(data);
//         if (user) {
//             setIsRegistered(data.players.includes(user._id));
//         }
//     } catch (error) {
//         console.error("Не удалось загрузить турнир", error);
//         setError('Турнир не найден.');
//     } finally {
//         setLoading(false);
//     }
// }, [id, user]);

//     useEffect(() => {
//         fetchTournament();
//     }, [fetchTournament]);

//     useEffect(() => {
//         if (!socket) return;
//         const handleTournamentUpdate = ({ tournamentId }: { tournamentId: string }) => {
//             if (tournamentId === id) {
//                 console.log('Получено обновление для этого турнира, перезагружаем данные...');
//                 fetchTournament(); // Перезагружаем данные при обновлении
//             }
//         };
//         socket.on('tournamentUpdated', handleTournamentUpdate);
//         return () => {
//             socket.off('tournamentUpdated', handleTournamentUpdate);
//         };
//     }, [socket, id, fetchTournament]);

//     const handleRegister = async () => {
//         if (!id) return;
//         try {
//             await registerForTournament(id);
//             await refreshUser(); // Обновляем баланс в AuthContext
//             fetchTournament(); // Обновляем данные турнира
//         } catch (err: any) {
//             alert(`Ошибка регистрации: ${err.response?.data?.message || 'Попробуйте снова'}`);
//         }
//     };

//     if (loading) return <div>Загрузка турнира...</div>;
//     if (error) return <div>{error}</div>;
//     if (!tournament) return <div>Турнир не найден.</div>;

//     const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;

//     return (
//         <div>
//             <h2>{tournament.name}</h2>
//             <p>Статус: {tournament.status}</p>
//             <p>Взнос: ${tournament.entryFee}</p>
//             {/* @ts-ignore */}
//             <p>Призовой фонд: ${tournament.prizePool}</p>
//             <p>Участники: {tournament.players.length} / {tournament.maxPlayers}</p>

//             {isRegistered && <p style={{ color: 'lightgreen' }}>Вы зарегистрированы в этом турнире!</p>}
//             {canRegister && <button onClick={handleRegister}>Зарегистрироваться за ${tournament.entryFee}</button>}

//             <h3>Турнирная сетка</h3>
//             {/* ... (код отрисовки сетки) ... */}
//         </div>
//     );
// };

// export default TournamentDetailPage;


import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTournamentById, registerForTournament, ITournament } from '../../services/tournamentService';
import { forceStartTournament } from '../../services/adminService'; // Импортируем новую функцию

import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const TournamentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, refreshUser } = useAuth();
    const { socket } = useSocket();
    const [tournament, setTournament] = useState<ITournament | null>(null);
    const [activeMatchRoomId, setActiveMatchRoomId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);


    const fetchTournament = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getTournamentById(id);
            setTournament(data);
            if (user) {
                setIsRegistered(data.players.includes(user._id));
            }
        } catch (error) {
            console.error("Не удалось загрузить турнир", error);
            setError('Турнир не найден.');
        } finally {
            setLoading(false);
        }
    }, [id, user]);
    useEffect(() => {
        fetchTournament();
    }, [fetchTournament]);

    useEffect(() => {
        if (!socket || !id) return;

        const handleTournamentUpdate = ({ tournamentId }: { tournamentId: string }) => {
            if (tournamentId === id) fetchTournament();
        };

        const handleMatchReady = ({ tournamentId, roomId }: { tournamentId: string, roomId: string }) => {
            if (tournamentId === id) {
                setActiveMatchRoomId(roomId);
            }
        };

        socket.on('tournamentUpdated', handleTournamentUpdate);
        socket.on('matchReady', handleMatchReady);
        return () => {
            socket.off('tournamentUpdated', handleTournamentUpdate);
            socket.off('matchReady', handleMatchReady);
        };
    }, [socket, id, fetchTournament]);

    const handleRegister = async () => {
        if (!id) return;
        try {
            await registerForTournament(id);
            await refreshUser(); // Обновляем баланс в AuthContext
            fetchTournament(); // Обновляем данные турнира
        } catch (err: any) {
            alert(`Ошибка регистрации: ${err.response?.data?.message || 'Попробуйте снова'}`);
        }
    };

    const handleForceStart = async () => {
        if (!id) return;
        if (window.confirm('Вы уверены, что хотите запустить турнир сейчас? Пустые слоты будут заполнены ботами.')) {
            try {
                const res = await forceStartTournament(id);
                alert(res.message);
                // Данные обновятся автоматически через сокет-событие 'tournamentUpdated'
            } catch (err: any) {
                alert(`Ошибка: ${err.response?.data?.message || 'Не удалось запустить турнир'}`);
            }
        }
    };

    if (loading) return <div>Загрузка...</div>;
    if (error) return <div>{error}</div>;

    if (!tournament) return <div>Турнир не найден.</div>;

    const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;


    return (
        <div>
            <h2>{tournament.name}</h2>
            <h2>{tournament.name}</h2>
            <p>Статус: {tournament.status}</p>
            <p>Взнос: ${tournament.entryFee}</p>
            {/* @ts-ignore */}
            <p>Призовой фонд: ${tournament.prizePool}</p>
            <p>Участники: {tournament.players.length} / {tournament.maxPlayers}</p>

            {isRegistered && <p style={{ color: 'lightgreen' }}>Вы зарегистрированы в этом турнире!</p>}
            {/* {canRegister && <button onClick={handleRegister}>Зарегистрироваться за ${tournament.entryFee}</button>} */}

            <h3>Турнирная сетка</h3>

            {activeMatchRoomId ? (
                <Link to={`/game/${tournament.gameType}/${activeMatchRoomId}`}>
                    <button style={{ backgroundColor: 'lightgreen', color: 'black', padding: '15px', fontSize: '1.2rem', margin: '20px 0' }}>
                        ВАШ МАТЧ ГОТОВ! ПРИСОЕДИНИТЬСЯ
                    </button>
                </Link>
            ) : tournament.status === 'REGISTERING' && !isRegistered ? (
                <button onClick={handleRegister}>Зарегистрироваться</button>
            ) : null}

            {user?.role === 'ADMIN' && tournament.status === 'REGISTERING' && (
                <button onClick={handleForceStart} style={{ backgroundColor: 'orange', color: 'black', marginLeft: '1rem' }}>
                    Начать принудительно
                </button>
            )}

            <h3>Турнирная сетка</h3>
            <div style={{ display: 'flex', gap: '50px', overflowX: 'auto', padding: '20px' }}>
                {tournament.bracket.map((round: any, roundIndex: number) => (
                    <div key={roundIndex}>
                        <h4>{round.roundName}</h4>
                        {round.matches.map((match: any) => (
                            <div key={match.matchId} style={{ border: '1px solid #555', padding: '10px', marginBottom: '10px', backgroundColor: '#2d2d2d' }}>
                                <p style={{ color: match.winner?._id === match.players[0]?._id ? 'lightgreen' : 'white' }}>
                                    {match.players[0]?.username || 'Ожидание...'}
                                </p>
                                <p>vs</p>
                                <p style={{ color: match.winner?._id === match.players[1]?._id ? 'lightgreen' : 'white' }}>
                                    {match.players[1]?.username || 'Ожидание...'}
                                </p>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TournamentDetailPage;