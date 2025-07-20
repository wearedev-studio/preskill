// import React, { useState, useEffect, useCallback } from 'react';
// import { useParams, Link } from 'react-router-dom';
// import { getTournamentById, registerForTournament, ITournament } from '../../services/tournamentService';
// import { forceStartTournament } from '../../services/adminService';
// import { useAuth } from '../../context/AuthContext';
// import { useSocket } from '../../context/SocketContext';
// import { Trophy, Users, DollarSign, Calendar, Clock, Crown, Play, Settings } from 'lucide-react';

// const TournamentDetailPage: React.FC = () => {
//     const { id } = useParams<{ id: string }>();
//     const { user, refreshUser } = useAuth();
//     const { socket } = useSocket();
//     const [tournament, setTournament] = useState<ITournament | null>(null);
//     const [activeMatchRoomId, setActiveMatchRoomId] = useState<string | null>(null);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState('');
//     const [isRegistered, setIsRegistered] = useState(false);

//     const fetchTournament = useCallback(async () => {
//         if (!id) return;
//         try {
//             const data = await getTournamentById(id);
//             setTournament(data);
//             if (user) {
//                 setIsRegistered(data.players.includes(user._id));
//             }
//         } catch (error) {
//             console.error("Не удалось загрузить турнир", error);
//             setError('Турнир не найден.');
//         } finally {
//             setLoading(false);
//         }
//     }, [id, user]);

//     useEffect(() => {
//         fetchTournament();
//     }, [fetchTournament]);

//     useEffect(() => {
//         if (!socket || !id) return;

//         const handleTournamentUpdate = ({ tournamentId }: { tournamentId: string }) => {
//             if (tournamentId === id) fetchTournament();
//         };

//         const handleMatchReady = ({ tournamentId, roomId }: { tournamentId: string, roomId: string }) => {
//             if (tournamentId === id) {
//                 setActiveMatchRoomId(roomId);
//             }
//         };

//         socket.on('tournamentUpdated', handleTournamentUpdate);
//         socket.on('matchReady', handleMatchReady);
//         return () => {
//             socket.off('tournamentUpdated', handleTournamentUpdate);
//             socket.off('matchReady', handleMatchReady);
//         };
//     }, [socket, id, fetchTournament]);

//     const handleRegister = async () => {
//         if (!id) return;
//         try {
//             await registerForTournament(id);
//             await refreshUser();
//             fetchTournament();
//         } catch (err: any) {
//             alert(`Ошибка регистрации: ${err.response?.data?.message || 'Попробуйте снова'}`);
//         }
//     };

//     const handleForceStart = async () => {
//         if (!id) return;
//         if (window.confirm('Вы уверены, что хотите запустить турнир сейчас? Пустые слоты будут заполнены ботами.')) {
//             try {
//                 const res = await forceStartTournament(id);
//                 alert(res.message);
//             } catch (err: any) {
//                 alert(`Ошибка: ${err.response?.data?.message || 'Не удалось запустить турнир'}`);
//             }
//         }
//     };

//     if (loading) {
//         return (
//             <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//                 <div className="text-center">
//                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//                     <p className="text-slate-400">Загрузка турнира...</p>
//                 </div>
//             </div>
//         );
//     }

//     if (error) {
//         return (
//             <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//                 <div className="text-center">
//                     <div className="text-red-400 text-xl mb-4">{error}</div>
//                     <Link to="/tournaments" className="text-blue-400 hover:text-blue-300">
//                         Вернуться к турнирам
//                     </Link>
//                 </div>
//             </div>
//         );
//     }

//     if (!tournament) {
//         return (
//             <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//                 <div className="text-center text-slate-400">
//                     Турнир не найден.
//                 </div>
//             </div>
//         );
//     }

//     const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;

//     return (
//         <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
//             <div className="max-w-6xl mx-auto space-y-6">
//                 {/* Заголовок турнира */}
//                 <div className="bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-700">
//                     <div className="flex items-start justify-between mb-4">
//                         <div className="flex items-center space-x-4">
//                             <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
//                                 <Trophy className="w-8 h-8 text-white" />
//                             </div>
//                             <div>
//                                 <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
//                                 <p className="text-slate-400">{tournament.gameType}</p>
//                             </div>
//                         </div>
//                         <div className="text-right">
//                             <p className="text-3xl font-bold text-green-400">
//                                 ${(tournament as any).prizePool?.toLocaleString() || '0'}
//                             </p>
//                             <p className="text-sm text-slate-400">Призовой фонд</p>
//                         </div>
//                     </div>

//                     {/* Информация о турнире */}
//                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
//                         <div className="flex items-center space-x-2">
//                             <Users className="w-5 h-5 text-slate-400" />
//                             <span className="text-slate-300">
//                                 {tournament.players.length}/{tournament.maxPlayers} игроков
//                             </span>
//                         </div>
//                         <div className="flex items-center space-x-2">
//                             <DollarSign className="w-5 h-5 text-slate-400" />
//                             <span className="text-slate-300">
//                                 ${tournament.entryFee} взнос
//                             </span>
//                         </div>
//                         <div className="flex items-center space-x-2">
//                             <Calendar className="w-5 h-5 text-slate-400" />
//                             <span className="text-slate-300">
//                                 {new Date(tournament.startTime).toLocaleDateString()}
//                             </span>
//                         </div>
//                         <div className="flex items-center space-x-2">
//                             <Clock className="w-5 h-5 text-slate-400" />
//                             <span className={`px-3 py-1 rounded-full text-sm font-medium ${
//                                 tournament.status === 'REGISTERING' ? 'bg-blue-900 text-blue-100' :
//                                 tournament.status === 'ACTIVE' ? 'bg-green-900 text-green-100' :
//                                 'bg-slate-700 text-slate-300'
//                             }`}>
//                                 {tournament.status === 'REGISTERING' ? 'Регистрация' :
//                                  tournament.status === 'ACTIVE' ? 'Активный' : 'Завершен'}
//                             </span>
//                         </div>
//                     </div>

//                     {/* Статус регистрации */}
//                     {isRegistered && (
//                         <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 mb-4">
//                             <div className="flex items-center space-x-2">
//                                 <Crown className="w-5 h-5 text-green-400" />
//                                 <span className="text-green-100 font-medium">
//                                     Вы зарегистрированы в этом турнире!
//                                 </span>
//                             </div>
//                         </div>
//                     )}

//                     {/* Кнопки действий */}
//                     <div className="flex flex-wrap gap-3">
//                         {activeMatchRoomId ? (
//                             <Link to={`/game/${tournament.gameType}/${activeMatchRoomId}`}>
//                                 <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-lg font-medium">
//                                     <Play className="w-5 h-5" />
//                                     <span>ВАШ МАТЧ ГОТОВ! ПРИСОЕДИНИТЬСЯ</span>
//                                 </button>
//                             </Link>
//                         ) : canRegister ? (
//                             <button 
//                                 onClick={handleRegister}
//                                 className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
//                             >
//                                 <Trophy className="w-5 h-5" />
//                                 <span>Зарегистрироваться за ${tournament.entryFee}</span>
//                             </button>
//                         ) : null}

//                         {user?.role === 'ADMIN' && tournament.status === 'REGISTERING' && (
//                             <button 
//                                 onClick={handleForceStart}
//                                 className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
//                             >
//                                 <Settings className="w-5 h-5" />
//                                 <span>Начать принудительно</span>
//                             </button>
//                         )}
//                     </div>
//                 </div>

//                 {/* Турнирная сетка */}
//                 <div className="bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-700">
//                     <h2 className="text-2xl font-bold text-white mb-6">Турнирная сетка</h2>
                    
//                     <div className="overflow-x-auto">
//                         <div className="flex gap-8 min-w-max pb-4">
//                             {tournament.bracket.map((round: any, roundIndex: number) => (
//                                 <div key={roundIndex} className="min-w-[250px]">
//                                     <h3 className="text-lg font-semibold text-white mb-4 text-center">
//                                         {round.roundName}
//                                     </h3>
//                                     <div className="space-y-4">
//                                         {round.matches.map((match: any) => (
//                                             <div 
//                                                 key={match.matchId} 
//                                                 className="bg-slate-700 border border-slate-600 rounded-lg p-4 hover:shadow-md transition-shadow"
//                                             >
//                                                 <div className="space-y-2">
//                                                     <div className={`flex items-center justify-between p-2 rounded ${
//                                                         match.winner?._id === match.players[0]?._id ? 'bg-green-900 bg-opacity-50' : 'bg-slate-600'
//                                                     }`}>
//                                                         <span className="text-white font-medium">
//                                                             {match.players[0]?.username || 'Ожидание...'}
//                                                         </span>
//                                                         {match.winner?._id === match.players[0]?._id && (
//                                                             <Crown className="w-4 h-4 text-yellow-400" />
//                                                         )}
//                                                     </div>
                                                    
//                                                     <div className="text-center text-slate-400 text-sm font-medium">
//                                                         VS
//                                                     </div>
                                                    
//                                                     <div className={`flex items-center justify-between p-2 rounded ${
//                                                         match.winner?._id === match.players[1]?._id ? 'bg-green-900 bg-opacity-50' : 'bg-slate-600'
//                                                     }`}>
//                                                         <span className="text-white font-medium">
//                                                             {match.players[1]?.username || 'Ожидание...'}
//                                                         </span>
//                                                         {match.winner?._id === match.players[1]?._id && (
//                                                             <Crown className="w-4 h-4 text-yellow-400" />
//                                                         )}
//                                                     </div>
//                                                 </div>
//                                             </div>
//                                         ))}
//                                     </div>
//                                 </div>
//                             ))}
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default TournamentDetailPage;


import React, {useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTournamentById, registerForTournament, ITournament } from '../../services/tournamentService';
import { forceStartTournament } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import styles from './TournamentDetailPage.module.css';
import { Trophy, Users, DollarSign, Calendar, Clock, Crown, Play, Settings } from 'lucide-react';

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
            await refreshUser();
            fetchTournament();
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
            } catch (err: any) {
                alert(`Ошибка: ${err.response?.data?.message || 'Не удалось запустить турнир'}`);
            }
        }
    };

    if (loading) return <div>Загрузка турнира...</div>;
    if (error) return <div>{error}</div>;
    if (!tournament) return <div>Турнир не найден.</div>;

    const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;
    const statusText: { [key: string]: string } = { REGISTERING: 'Регистрация', ACTIVE: 'Активный', FINISHED: 'Завершен' };
    const statusStyle: { [key: string]: string } = { REGISTERING: styles.statusRegistering, ACTIVE: styles.statusActive, FINISHED: styles.statusFinished };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        <div className={styles.headerIcon}><Trophy /></div>
                        <div className={styles.headerText}>
                            <h1>{tournament.name}</h1>
                            <p>{tournament.gameType.replace('-', ' ')}</p>
                        </div>
                    </div>
                    <div className={styles.prizePool}>
                        {/* @ts-ignore */}
                        <p className={styles.prizePoolValue}>${tournament.prizePool.toLocaleString()}</p>
                        <p className={styles.prizePoolLabel}>Призовой фонд</p>
                    </div>
                </div>

                <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><Users size={20} /><p>{tournament.players.length}/{tournament.maxPlayers} игроков</p></div>
                    <div className={styles.detailItem}><DollarSign size={20} /><p>${tournament.entryFee} взнос</p></div>
                    <div className={styles.detailItem}><Calendar size={20} /><p>{new Date(tournament.startTime).toLocaleDateString()}</p></div>
                    <div className={styles.detailItem}><Clock size={20} /><span className={`${styles.statusBadge} ${statusStyle[tournament.status]}`}>{statusText[tournament.status]}</span></div>
                </div>

                {isRegistered && (
                    <div className={styles.registrationStatus}>
                        <Crown size={20} /><span>Вы зарегистрированы в этом турнире!</span>
                    </div>
                )}

                <div className={styles.actions}>
                    {activeMatchRoomId ? (
                        <Link to={`/game/${tournament.gameType}/${activeMatchRoomId}`}>
                            <button className={`${styles.actionButton} ${styles.btnGreen}`}><Play /><span>ВАШ МАТЧ ГОТОВ! ПРИСОЕДИНИТЬСЯ</span></button>
                        </Link>
                    ) : canRegister ? (
                        <button onClick={handleRegister} className={`${styles.actionButton} ${styles.btnBlue}`}><Trophy /><span>Зарегистрироваться за ${tournament.entryFee}</span></button>
                    ) : null}
                    {user?.role === 'ADMIN' && tournament.status === 'REGISTERING' && (
                        <button onClick={handleForceStart} className={`${styles.actionButton} ${styles.btnOrange}`}><Settings /><span>Начать принудительно</span></button>
                    )}
                </div>
            </div>

            <div className={styles.card}>
                <h2 style={{fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem'}}>Турнирная сетка</h2>
                <div className={styles.bracketContainer}>
                    <div className={styles.bracket}>
                        {tournament.bracket.map((round: any, roundIndex: number) => (
                            <div key={roundIndex} className={styles.round}>
                                <h3 className={styles.roundTitle}>{round.roundName}</h3>
                                {round.matches.map((match: any) => (
                                    <div key={match.matchId} className={styles.match}>
                                        <div className={`${styles.playerSlot} ${match.winner?._id === match.players[0]?._id ? styles.winner : ''}`}>
                                            <span>{match.players[0]?.username || 'Ожидание...'}</span>
                                            {match.winner?._id === match.players[0]?._id && <Crown size={16} />}
                                        </div>
                                        <div className={styles.vsText}>VS</div>
                                        <div className={`${styles.playerSlot} ${match.winner?._id === match.players[1]?._id ? styles.winner : ''}`}>
                                            <span>{match.players[1]?.username || 'Ожидание...'}</span>
                                            {match.winner?._id === match.players[1]?._id && <Crown size={16} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TournamentDetailPage;