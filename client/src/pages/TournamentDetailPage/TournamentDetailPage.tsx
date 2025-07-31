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
            alert(`Registration error: ${err.response?.data?.message || 'Try again'}`);
        }
    };

    const handleForceStart = async () => {
        if (!id) return;
        if (window.confirm('Are you sure you want to start the tournament now? Empty slots will be filled with bots.')) {
            try {
                const res = await forceStartTournament(id);
                alert(res.message);
            } catch (err: any) {
                alert(`Error: ${err.response?.data?.message || 'Failed to start tournament'}`);
            }
        }
    };

    if (loading) return <div>Loading tournament...</div>;
    if (error) return <div>{error}</div>;
    if (!tournament) return <div>Tournament not found.</div>;

    const canRegister = tournament.status === 'REGISTERING' && !isRegistered && tournament.players.length < tournament.maxPlayers;
    const statusText: { [key: string]: string } = { REGISTERING: 'Registration', ACTIVE: 'Active', FINISHED: 'Completed' };
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
                        <p className={styles.prizePoolLabel}>Prize fund</p>
                    </div>
                </div>

                <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><Users size={20} /><p>{tournament.players.length}/{tournament.maxPlayers} players</p></div>
                    <div className={styles.detailItem}><DollarSign size={20} /><p>${tournament.entryFee} contribution</p></div>
                    <div className={styles.detailItem}><Calendar size={20} /><p>{new Date(tournament.startTime).toLocaleDateString()}</p></div>
                    <div className={styles.detailItem}><Clock size={20} /><span className={`${styles.statusBadge} ${statusStyle[tournament.status]}`}>{statusText[tournament.status]}</span></div>
                </div>

                {isRegistered && (
                    <div className={styles.registrationStatus}>
                        <Crown size={20} /><span>You are registered in this tournament!</span>
                    </div>
                )}

                <div className={styles.actions}>
                    {activeMatchRoomId ? (
                        <Link to={`/game/${tournament.gameType}/${activeMatchRoomId}`}>
                            <button className={`${styles.actionButton} ${styles.btnGreen}`}><Play /><span>YOUR MATCH IS READY! JOIN NOW</span></button>
                        </Link>
                    ) : canRegister ? (
                        <button onClick={handleRegister} className={`${styles.actionButton} ${styles.btnBlue}`}><Trophy /><span>Register for ${tournament.entryFee}</span></button>
                    ) : null}
                    {user?.role === 'ADMIN' && tournament.status === 'REGISTERING' && (
                        <button onClick={handleForceStart} className={`${styles.actionButton} ${styles.btnOrange}`}><Settings /><span>Force start</span></button>
                    )}
                </div>
            </div>

            <div className={styles.card}>
                <h2 style={{fontSize: '1.5rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem'}}>Tournament grid</h2>
                <div className={styles.bracketContainer}>
                    <div className={styles.bracket}>
                        {tournament.bracket.map((round: any, roundIndex: number) => (
                            <div key={roundIndex} className={styles.round}>
                                <h3 className={styles.roundTitle}>{round.roundName}</h3>
                                {round.matches.map((match: any) => (
                                    <div key={match.matchId} className={styles.match}>
                                        <div className={`${styles.playerSlot} ${match.winner?._id === match.players[0]?._id ? styles.winner : ''}`}>
                                            <span>{match.players[0]?.username || 'Loading...'}</span>
                                            {match.winner?._id === match.players[0]?._id && <Crown size={16} />}
                                        </div>
                                        <div className={styles.vsText}>VS</div>
                                        <div className={`${styles.playerSlot} ${match.winner?._id === match.players[1]?._id ? styles.winner : ''}`}>
                                            <span>{match.players[1]?.username || 'Loading...'}</span>
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