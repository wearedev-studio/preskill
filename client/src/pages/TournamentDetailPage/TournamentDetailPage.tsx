import React, {useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTournamentById, registerForTournament, ITournament } from '../../services/tournamentService';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import styles from './TournamentDetailPage.module.css';
import { Trophy, Users, DollarSign, Calendar, Clock, Crown, Play } from 'lucide-react';

const TournamentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, refreshUser } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
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
            console.error("Failed to load tournament", error);
            setError('Tournament not found.');
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
            console.log('Tournament updated:', tournamentId);
            if (tournamentId === id) {
                fetchTournament();
            }
        };

        const handleMatchReady = ({ tournamentId, roomId, playerId }: { tournamentId: string, roomId: string, playerId?: string }) => {
            console.log('Match ready:', { tournamentId, roomId, playerId });
            if (tournamentId === id && tournament) {
                // Проверяем, что событие предназначено для текущего пользователя (если указан playerId)
                if (!playerId || playerId === user?._id) {
                    console.log('Automatically redirecting to tournament game:', roomId);
                    // Автоматически перенаправляем игрока к турнирной игре
                    navigate(`/game/${tournament.gameType}/${roomId}`);
                } else {
                    console.log('Match ready event not for current user');
                }
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


    if (loading) return <div>Loading tournament...</div>;
    if (error) return <div>{error}</div>;
    if (!tournament) return <div>Tournament not found.</div>;

    const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;
    const statusText: { [key: string]: string } = { REGISTERING: 'Набор игроков', ACTIVE: 'Активный', FINISHED: 'Завершен' };
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
                        <p className={styles.prizePoolValue}>${tournament.prizePool?.toLocaleString() || '0'}</p>
                        <p className={styles.prizePoolLabel}>Призовой фонд</p>
                    </div>
                </div>

                <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><Users size={20} /><p>{tournament.players.length}/{tournament.maxPlayers} игроков</p></div>
                    <div className={styles.detailItem}><DollarSign size={20} /><p>${tournament.entryFee} взнос</p></div>
                    <div className={styles.detailItem}><Calendar size={20} /><p>{new Date(tournament.createdAt).toLocaleDateString()}</p></div>
                    <div className={styles.detailItem}><Clock size={20} /><span className={`${styles.statusBadge} ${statusStyle[tournament.status]}`}>{statusText[tournament.status]}</span></div>
                </div>

                {isRegistered && (
                    <div className={styles.registrationStatus}>
                        <Crown size={20} /><span>Вы зарегистрированы в этом турнире!</span>
                    </div>
                )}

                <div className={styles.actions}>
                    {canRegister ? (
                        <button onClick={handleRegister} className={`${styles.actionButton} ${styles.btnBlue}`}><Trophy /><span>Играть за ${tournament.entryFee}$</span></button>
                    ) : tournament.status === 'REGISTERING' && tournament.players.length < tournament.maxPlayers ? (
                        <div className={styles.waitingMessage}>
                            <Clock size={20} />
                            <span>Ожидание игроков... ({tournament.players.length}/{tournament.maxPlayers})</span>
                        </div>
                    ) : tournament.status === 'ACTIVE' && isRegistered ? (
                        <div className={styles.waitingMessage}>
                            <Clock size={20} />
                            <span>Турнир активен. Ожидание вашего матча...</span>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className={styles.card}>
                <h2 style={{fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem'}}>Турнирная сетка</h2>
                {tournament.bracket && tournament.bracket.length > 0 ? (
                    <div className={styles.bracketContainer}>
                        <div className={styles.bracket}>
                            {tournament.bracket.map((round: any, roundIndex: number) => (
                                <div key={roundIndex} className={styles.round}>
                                    <h3 className={styles.roundTitle}>{round.roundName}</h3>
                                    {round.matches.map((match: any) => (
                                        <div key={match.matchId} className={styles.match}>
                                            <div className={`${styles.playerSlot} ${match.winner?._id === match.players[0]?._id ? styles.winner : ''}`}>
                                                <span>{match.players[0]?.username || 'TBD'}</span>
                                                {match.winner?._id === match.players[0]?._id && <Crown size={16} />}
                                            </div>
                                            <div className={styles.vsText}>VS</div>
                                            <div className={`${styles.playerSlot} ${match.winner?._id === match.players[1]?._id ? styles.winner : ''}`}>
                                                <span>{match.players[1]?.username || 'TBD'}</span>
                                                {match.winner?._id === match.players[1]?._id && <Crown size={16} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        {tournament.status === 'REGISTERING' ? (
                            <p>Турнирная сетка будет сгенерирована при запуске турнира.</p>
                        ) : (
                            <p>Сетка недоступна.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TournamentDetailPage;