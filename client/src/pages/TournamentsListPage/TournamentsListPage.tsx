// import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom';
// import { getTournaments, ITournament } from '../../services/tournamentService';

// const TournamentCard: React.FC<{ tournament: ITournament }> = ({ tournament }) => (
//     <Link to={`/tournaments/${tournament._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
//         <div style={{ border: '1px solid #444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
//             <h3>{tournament.name} - {tournament.gameType}</h3>
//             <p>Статус: {tournament.status}</p>
//             <p>Взнос: ${tournament.entryFee}</p>
//             <p>Участники: {tournament.players.length} / {tournament.maxPlayers}</p>
//             <p>Начало: {new Date(tournament.startTime).toLocaleString()}</p>
//         </div>
//     </Link>
// );

// const TournamentsListPage: React.FC = () => {
    
//     const [tournaments, setTournaments] = useState<ITournament[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [filter, setFilter] = useState<'REGISTERING' | 'ACTIVE' | 'FINISHED'>('REGISTERING');


//     useEffect(() => {
//         const fetchTournaments = async () => {
//             try {
//                 setLoading(true);
//                 const data = await getTournaments();
//                 setTournaments(data);
//             } catch (error) {
//                 console.error("Не удалось загрузить турниры", error);
//             } finally {
//                 setLoading(false);
//             }
//         };
//         fetchTournaments();
//     }, []);

//     const filteredTournaments = useMemo(() => {
//         return tournaments.filter(t => t.status === filter);
//     }, [tournaments, filter]);

//     if (loading) return <div>Загрузка турниров...</div>;



//     return (
//         <div>
//             <h2>Турниры</h2>
//             <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
//                 <button onClick={() => setFilter('REGISTERING')}>Регистрация</button>
//                 <button onClick={() => setFilter('ACTIVE')}>Активные</button>
//                 <button onClick={() => setFilter('FINISHED')}>Завершенные</button>
//             </div>
            
//             {filteredTournaments.length === 0 ? (
//                 <p>В этой категории турниров нет.</p>
//             ) : (
//                 filteredTournaments.map(t => <TournamentCard key={t._id} tournament={t} />)
//             )}
//         </div>
//     );
// };

// export default TournamentsListPage;

// import React, { useState, useEffect, useMemo } from 'react';
// import { Link } from 'react-router-dom';
// import { getTournaments, ITournament } from '../../services/tournamentService';
// import { Trophy, Users, DollarSign, Calendar, Clock, Crown } from 'lucide-react';

// const TournamentCard: React.FC<{ tournament: ITournament }> = ({ tournament }) => {
//     const getStatusColor = (status: string) => {
//         switch (status) {
//             case 'REGISTERING': return 'bg-blue-900 text-blue-100';
//             case 'ACTIVE': return 'bg-green-900 text-green-100';
//             case 'FINISHED': return 'bg-slate-700 text-slate-300';
//             default: return 'bg-slate-700 text-slate-300';
//         }
//     };

//     const getStatusText = (status: string) => {
//         switch (status) {
//             case 'REGISTERING': return 'Регистрация';
//             case 'ACTIVE': return 'Активный';
//             case 'FINISHED': return 'Завершен';
//             default: return status;
//         }
//     };

//     return (
//         <Link to={`/tournaments/${tournament._id}`} className="block">
//             <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:shadow-lg hover:border-slate-600 transition-all duration-200">
//                 <div className="flex items-start justify-between mb-4">
//                     <div className="flex items-center space-x-3">
//                         <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
//                             <Trophy className="w-6 h-6 text-white" />
//                         </div>
//                         <div>
//                             <h3 className="text-xl font-semibold text-white">{tournament.name}</h3>
//                             <p className="text-sm text-slate-400">{tournament.gameType}</p>
//                         </div>
//                     </div>
//                     <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tournament.status)}`}>
//                         {getStatusText(tournament.status)}
//                     </span>
//                 </div>

//                 <div className="grid grid-cols-2 gap-4 mb-4">
//                     <div className="flex items-center space-x-2">
//                         <DollarSign className="w-4 h-4 text-slate-400" />
//                         <span className="text-sm text-slate-300">
//                             Взнос: ${tournament.entryFee}
//                         </span>
//                     </div>
//                     <div className="flex items-center space-x-2">
//                         <Users className="w-4 h-4 text-slate-400" />
//                         <span className="text-sm text-slate-300">
//                             {tournament.players.length}/{tournament.maxPlayers} игроков
//                         </span>
//                     </div>
//                     <div className="flex items-center space-x-2 col-span-2">
//                         <Calendar className="w-4 h-4 text-slate-400" />
//                         <span className="text-sm text-slate-300">
//                             Начало: {new Date(tournament.startTime).toLocaleString()}
//                         </span>
//                     </div>
//                 </div>

//                 <div className="flex items-center justify-between">
//                     <div className="text-right">
//                         <p className="text-lg font-bold text-green-400">
//                             ${(tournament as any).prizePool?.toLocaleString() || '0'}
//                         </p>
//                         <p className="text-xs text-slate-400">Призовой фонд</p>
//                     </div>
//                     <div className="text-blue-400 text-sm font-medium">
//                         Подробнее →
//                     </div>
//                 </div>
//             </div>
//         </Link>
//     );
// };

// const TournamentsListPage: React.FC = () => {
//     const [tournaments, setTournaments] = useState<ITournament[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [filter, setFilter] = useState<'REGISTERING' | 'ACTIVE' | 'FINISHED'>('REGISTERING');

//     const filters = [
//         { id: 'REGISTERING' as const, label: 'Регистрация', icon: Clock },
//         { id: 'ACTIVE' as const, label: 'Активные', icon: Trophy },
//         { id: 'FINISHED' as const, label: 'Завершенные', icon: Crown },
//     ];

//     useEffect(() => {
//         const fetchTournaments = async () => {
//             try {
//                 setLoading(true);
//                 const data = await getTournaments();
//                 setTournaments(data);
//             } catch (error) {
//                 console.error("Не удалось загрузить турниры", error);
//             } finally {
//                 setLoading(false);
//             }
//         };
//         fetchTournaments();
//     }, []);

//     const filteredTournaments = useMemo(() => {
//         return tournaments.filter(t => t.status === filter);
//     }, [tournaments, filter]);

//     if (loading) {
//         return (
//             <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//                 <div className="text-center">
//                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//                     <p className="text-slate-400">Загрузка турниров...</p>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
//             <div className="max-w-6xl mx-auto space-y-6">
//                 {/* Заголовок */}
//                 <div className="flex items-center justify-between">
//                     <div>
//                         <h1 className="text-3xl font-bold text-white">Турниры</h1>
//                         <p className="text-slate-400">Участвуйте в турнирах и выигрывайте призы</p>
//                     </div>
//                     <div className="flex items-center space-x-3">
//                         <div className="text-right">
//                             <p className="text-sm text-slate-400">Всего турниров</p>
//                             <p className="text-lg font-bold text-blue-400">{tournaments.length}</p>
//                         </div>
//                         <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
//                             <Trophy className="w-6 h-6 text-white" />
//                         </div>
//                     </div>
//                 </div>

//                 {/* Фильтры */}
//                 <div className="bg-slate-800 rounded-lg shadow-sm p-4 border border-slate-700">
//                     <div className="flex space-x-1">
//                         {filters.map((filterOption) => (
//                             <button
//                                 key={filterOption.id}
//                                 onClick={() => setFilter(filterOption.id)}
//                                 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
//                                     filter === filterOption.id
//                                         ? 'bg-blue-600 text-white'
//                                         : 'text-slate-400 hover:text-white hover:bg-slate-700'
//                                 }`}
//                             >
//                                 <filterOption.icon className="w-4 h-4" />
//                                 <span>{filterOption.label}</span>
//                             </button>
//                         ))}
//                     </div>
//                 </div>

//                 {/* Список турниров */}
//                 {filteredTournaments.length === 0 ? (
//                     <div className="bg-slate-800 rounded-lg shadow-sm p-12 border border-slate-700 text-center">
//                         <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
//                         <h3 className="text-xl font-semibold text-slate-400 mb-2">
//                             В этой категории турниров нет
//                         </h3>
//                         <p className="text-slate-500">
//                             Попробуйте выбрать другую категорию или проверьте позже
//                         </p>
//                     </div>
//                 ) : (
//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                         {filteredTournaments.map(tournament => (
//                             <TournamentCard key={tournament._id} tournament={tournament} />
//                         ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default TournamentsListPage;


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
        REGISTERING: 'Регистрация',
        ACTIVE: 'Активный',
        FINISHED: 'Завершен',
        CANCELLED: 'Отменен'
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
                <div className={styles.infoItem}><DollarSign /><p>Взнос: ${tournament.entryFee}</p></div>
                <div className={styles.infoItem}><Users /><p>{tournament.players.length}/{tournament.maxPlayers} игроков</p></div>
                <div className={`${styles.infoItem} ${styles.fullWidth}`}><Calendar /><p>Начало: {new Date(tournament.startTime).toLocaleString()}</p></div>
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.prizePool}>
                    {/* @ts-ignore */}
                    <p className={styles.prizePoolValue}>${tournament.prizePool.toLocaleString()}</p>
                    <p className={styles.prizePoolLabel}>Призовой фонд</p>
                </div>
                <span className={styles.detailsLink}>Подробнее →</span>
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
                console.error("Не удалось загрузить турниры", error);
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
                    <p className="text-slate-400">Загрузка турниров...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <div>
                    <h1>Турниры</h1>
                    <p>Участвуйте в турнирах и выигрывайте призы</p>
                </div>
                <div className={styles.ratingWidget}>
                    <div className={styles.ratingWidgetText}>
                        <p>Всего турниров</p>
                        <p>{allTournaments.length}</p>
                    </div>
                    <div className={styles.ratingWidgetIcon}><Trophy /></div>
                </div>
            </div>

            <div className={styles.filterBar}>
                <button onClick={() => setFilter('REGISTERING')} className={`${styles.filterButton} ${filter === 'REGISTERING' ? styles.active : ''}`}><Clock /><span>Регистрация</span></button>
                <button onClick={() => setFilter('ACTIVE')} className={`${styles.filterButton} ${filter === 'ACTIVE' ? styles.active : ''}`}><Trophy /><span>Активные</span></button>
                <button onClick={() => setFilter('FINISHED')} className={`${styles.filterButton} ${filter === 'FINISHED' ? styles.active : ''}`}><Crown /><span>Завершенные</span></button>
            </div>

            {filteredTournaments.length === 0 ? (
                <div className={styles.emptyState}>
                    <Trophy />
                    <h3>В этой категории турниров нет</h3>
                    <p>Попробуйте выбрать другую категорию или проверьте позже.</p>
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