import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTournaments, ITournament } from '../../services/tournamentService';
import axios from 'axios';
import { Trophy, Target, DollarSign, Clock, Users } from 'lucide-react';
import styles from './DashboardPage.module.css';
import { API_URL } from '../../api/index';

interface IGameHistory {
    _id: string;
    gameName: string;
    opponent: string;
    status: 'WON' | 'LOST' | 'DRAW';
    createdAt: string;
}

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalGames: 0, winRate: 0, hoursPlayed: 0, totalWinnings: 0 });
    const [recentGames, setRecentGames] = useState<IGameHistory[]>([]);
    const [upcomingTournaments, setUpcomingTournaments] = useState<ITournament[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [gamesHistoryRes, tournamentsRes] = await Promise.all([
                    axios.get<any[]>(`${API_URL}/api/users/history/games`),
                    getTournaments()
                ]);

                const gamesHistory = gamesHistoryRes.data;
                const totalGames = gamesHistory.length;
                const wins = gamesHistory.filter(g => g.status === 'WON').length;
                const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
                const totalWinnings = gamesHistory.reduce((acc, game) => acc + (game.amountChanged > 0 ? game.amountChanged : 0), 0);
                
                setStats({ totalGames, winRate, hoursPlayed: 234, totalWinnings }); // "Часы" пока заглушка
                setRecentGames(gamesHistory.slice(0, 4));
                setUpcomingTournaments(tournamentsRes.filter(t => t.status === 'REGISTERING').slice(0, 3));
            } catch (error) {
                console.error("Не удалось загрузить данные для дашборда:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const statsCards = [
        { title: 'Всего игр', value: stats.totalGames, icon: Target, color: 'bg-blue-600' },
        { title: 'Процент побед', value: `${stats.winRate}%`, icon: Trophy, color: 'bg-green-600' },
        { title: 'Часов сыграно', value: `${stats.hoursPlayed}ч`, icon: Clock, color: 'bg-purple-600' },
        { title: 'Заработано', value: `$${stats.totalWinnings.toFixed(2)}`, icon: DollarSign, color: 'bg-yellow-600' },
    ];

    if (loading) return <div>Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className={styles.header}>
                <div>
                    <h1>Панель управления</h1>
                    <p>Добро пожаловать, {user?.username}! Готовы к следующей игре?</p>
                </div>
                <div className={styles.ratingWidget}>
                    <div className={styles.ratingWidgetText}>
                        <p>Текущий ранг</p>
                        <p>Мастер</p>
                    </div>
                    <div className={styles.ratingWidgetIcon}><Trophy /></div>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {statsCards.map((stat, index) => (
                    <div key={index} className={styles.statCard}>
                        <div className={styles.statCardInfo}>
                            <p>{stat.title}</p>
                            <p>{stat.value}</p>
                        </div>
                        <div className={styles.statCardIcon} style={{backgroundColor: stat.color.replace('bg-','').split('-')[0]}}>
                            <stat.icon />
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.layoutGrid}>
                <div className={styles.contentBox}>
                    <div className={styles.boxHeader}>
                        <h2>Последние игры</h2>
                        <Link to="/profile">Показать все</Link>
                    </div>
                    <div className={styles.itemList}>
                        {recentGames.map((game) => (
                            <div key={game._id} className={styles.gameItem}>
                                <div className={styles.gameItemInfo}>
                                    <div className={styles.gameItemAvatar}>{game.gameName.charAt(0)}</div>
                                    <div className={styles.gameItemText}>
                                        <p>{game.gameName}</p>
                                        <p>против {game.opponent}</p>
                                    </div>
                                </div>
                                <div className={styles.gameItemResult}>
                                    <span className={`${styles.badge} ${game.status === 'WON' ? styles.badgeGreen : styles.badgeRed}`}>
                                        {game.status === 'WON' ? 'Победа' : 'Поражение'}
                                    </span>
                                    <p>{new Date(game.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.contentBox}>
                    <div className={styles.boxHeader}>
                        <h2>Предстоящие турниры</h2>
                        <Link to="/tournaments">Показать все</Link>
                    </div>
                    <div className={styles.itemList}>
                        {upcomingTournaments.map((tournament) => (
                            <Link key={tournament._id} to={`/tournaments/${tournament._id}`} className={styles.tournamentItem}>
                                <div className={styles.tournamentItemHeader}>
                                    <h3>{tournament.name}</h3>
                                    {/* @ts-ignore */}
                                    <span>${tournament.prizePool}</span>
                                </div>
                                <div className={styles.tournamentItemFooter}>
                                    <span>{new Date(tournament.startTime).toLocaleDateString()}</span>
                                    <div><Users size={16} /><span>{tournament.players.length}/{tournament.maxPlayers} игроков</span></div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;