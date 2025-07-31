import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, ITournament } from '../../services/tournamentService';
import { Trophy, Users, DollarSign, Calendar, Clock, Crown } from 'lucide-react';
import styles from './TournamentsListPage.module.css';

const TournamentCard: React.FC<{ tournament: ITournament }> = ({ tournament }) => {
    const statusStyles = {
        REGISTERING: styles.statusRegistering,
        ACTIVE: styles.statusActive,
        FINISHED: styles.statusFinished,
    };
    const statusText = {
        REGISTERING: 'Registering',
        ACTIVE: 'Active',
        FINISHED: 'Finished',
        CANCELLED: 'Canceled'
    };

    return (
        <Link to={`/tournaments/${tournament._id}`} className={styles.tournamentCard}>
            <div className={styles.cardHeader}>
                <div className={styles.cardTitleSection}>
                    <div className={styles.cardIcon}><Trophy /></div>
                    <div>
                        <h3 className={styles.cardTitle}>{tournament.name}</h3>
                        <p className={styles.cardSubtitle}>{tournament.gameType}</p>
                    </div>
                </div>
                {/* @ts-ignore */}
                <span className={`${styles.cardStatus} ${statusStyles[tournament.status] || ''}`}>
                    {statusText[tournament.status] || tournament.status}
                </span>
            </div>

            <div className={styles.cardInfoGrid}>
                <div className={styles.infoItem}><DollarSign /><p>Contribution: ${tournament.entryFee}</p></div>
                <div className={styles.infoItem}><Users /><p>{tournament.players.length}/{tournament.maxPlayers} players</p></div>
                <div className={`${styles.infoItem} ${styles.fullWidth}`}><Calendar /><p>Start: {new Date(tournament.startTime).toLocaleString()}</p></div>
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.prizePool}>
                    {/* @ts-ignore */}
                    <p className={styles.prizePoolValue}>${tournament.prizePool.toLocaleString()}</p>
                    <p className={styles.prizePoolLabel}>Prize fund</p>
                </div>
                <span className={styles.detailsLink}>Read more →</span>
            </div>
        </Link>
    );
};

const TournamentsListPage: React.FC = () => {
    const [allTournaments, setAllTournaments] = useState<ITournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'REGISTERING' | 'ACTIVE' | 'FINISHED'>('REGISTERING');

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                setLoading(true);
                const data = await getTournaments();
                setAllTournaments(data);
            } catch (error) {
                console.error("Failed to load tournaments", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTournaments();
    }, []);

    const filteredTournaments = useMemo(() => {
        return allTournaments.filter(t => t.status === filter);
    }, [allTournaments, filter]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading tournaments...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <div>
                    <h1>Tournaments</h1>
                    <p>Take part in tournaments and win prizes</p>
                </div>
                <div className={styles.ratingWidget}>
                    <div className={styles.ratingWidgetText}>
                        <p>Total tournaments</p>
                        <p>{allTournaments.length}</p>
                    </div>
                    <div className={styles.ratingWidgetIcon}><Trophy /></div>
                </div>
            </div>

            <div className={styles.filterBar}> 
                <button onClick={() => setFilter('REGISTERING')} className={`${styles.filterButton} ${filter === 'REGISTERING' ? styles.active : ''}`}><Clock /><span>Registration</span></button> 
                <button onClick={() => setFilter('ACTIVE')} className={`${styles.filterButton} ${filter === 'ACTIVE' ? styles.active : ''}`}><Trophy /><span>Active</span></button>
                <button onClick={() => setFilter('FINISHED')} className={`${styles.filterButton} ${filter === 'FINISHED' ? styles.active : ''}`}><Crown /><span>Completed</span></button>
            </div>

            {filteredTournaments.length === 0 ? (
                <div className={styles.emptyState}>
                    <Trophy />
                    <h3>There are no tournaments in this category</h3>
                    <p>Try choosing another category or check back later.</p>
                </div>
            ) : (
                <div className={styles.tournamentsGrid}>
                    {filteredTournaments.map(tournament => (
                        <TournamentCard key={tournament._id} tournament={tournament} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TournamentsListPage;