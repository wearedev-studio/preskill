import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTournaments, ITournament } from '../../services/tournamentService';
import axios from 'axios';
import { Trophy, Target, DollarSign, TrendingUp, Users } from 'lucide-react';

// Тип для истории игр, чтобы компонент знал, какие данные ожидать
interface IGameHistory {
    _id: string;
    gameName: string;
    opponent: string;
    status: 'WON' | 'LOST' | 'DRAW';
    amountChanged: number;
    createdAt: string;
}

const DashboardPage: React.FC = () => {
    const { user } = useAuth(); // Получаем данные текущего пользователя

    // Состояния для хранения данных, загруженных с сервера
    const [stats, setStats] = useState({ totalGames: 0, winRate: 0, netProfit: 0 });
    const [recentGames, setRecentGames] = useState<IGameHistory[]>([]);
    const [upcomingTournaments, setUpcomingTournaments] = useState<ITournament[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Функция для загрузки всех необходимых данных при монтировании компонента
        const fetchData = async () => {
            try {
                // Запускаем запросы параллельно для ускорения загрузки
                const [gamesHistoryRes, tournamentsRes] = await Promise.all([
                    axios.get<IGameHistory[]>('http://localhost:5001/api/users/history/games'),
                    getTournaments()
                ]);

                const gamesHistory = gamesHistoryRes.data;

                // --- 1. Рассчитываем статистику ---
                const totalGames = gamesHistory.length;
                const wins = gamesHistory.filter(g => g.status === 'WON').length;
                const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
                const netProfit = gamesHistory.reduce((acc, game) => acc + game.amountChanged, 0);
                setStats({ totalGames, winRate, netProfit });

                // --- 2. Берем последние 4 игры для списка ---
                setRecentGames(gamesHistory.slice(0, 4));

                // --- 3. Фильтруем турниры, на которые идет регистрация ---
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
        { title: 'Прибыль', value: `$${stats.netProfit.toFixed(2)}`, icon: TrendingUp, color: 'bg-purple-600' },
        { title: 'Баланс', value: `$${user?.balance.toFixed(2)}`, icon: DollarSign, color: 'bg-yellow-600' },
    ];

    if (loading) {
        return <div>Загрузка панели управления...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Панель управления</h1>
                    <p className="text-slate-400">Добро пожаловать, {user?.username}! Готовы к следующей игре?</p>
                </div>
                {/* Ранг можно будет добавить позже, когда у нас будет система рангов */}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {statsCards.map((stat) => (
                    <div key={stat.title} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-400">{stat.title}</p>
                                <p className="text-2xl font-bold text-white">{stat.value}</p>
                            </div>
                            <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity and Tournaments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Games */}
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Последние игры</h2>
                        <Link to="/profile" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                            Показать все
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {recentGames.map((game) => (
                            <div key={game._id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-bold">{game.gameName.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{game.gameName}</p>
                                        <p className="text-sm text-slate-400">против {game.opponent}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        game.status === 'WON' ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'
                                    }`}>
                                        {game.status === 'WON' ? 'Победа' : 'Поражение'}
                                    </span>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(game.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upcoming Tournaments */}
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Предстоящие турниры</h2>
                        <Link to="/tournaments" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                            Показать все
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {upcomingTournaments.map((tournament) => (
                            <Link key={tournament._id} to={`/tournaments/${tournament._id}`} className="block p-4 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-white">{tournament.name}</h3>
                                    {/* @ts-ignore */}
                                    <span className="text-green-400 font-bold">${tournament.prizePool}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span>{new Date(tournament.startTime).toLocaleDateString()}</span>
                                    <div className="flex items-center space-x-1">
                                        <Users className="w-4 h-4" />
                                        <span>{tournament.players.length}/{tournament.maxPlayers} игроков</span>
                                    </div>
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