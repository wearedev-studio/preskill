import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, ITournament } from '../../services/tournamentService';

const TournamentCard: React.FC<{ tournament: ITournament }> = ({ tournament }) => (
    <Link to={`/tournaments/${tournament._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ border: '1px solid #444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3>{tournament.name} - {tournament.gameType}</h3>
            <p>Статус: {tournament.status}</p>
            <p>Взнос: ${tournament.entryFee}</p>
            <p>Участники: {tournament.players.length} / {tournament.maxPlayers}</p>
            <p>Начало: {new Date(tournament.startTime).toLocaleString()}</p>
        </div>
    </Link>
);

const TournamentsListPage: React.FC = () => {
    
    const [tournaments, setTournaments] = useState<ITournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'REGISTERING' | 'ACTIVE' | 'FINISHED'>('REGISTERING');


    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                setLoading(true);
                const data = await getTournaments();
                setTournaments(data);
            } catch (error) {
                console.error("Не удалось загрузить турниры", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTournaments();
    }, []);

    const filteredTournaments = useMemo(() => {
        return tournaments.filter(t => t.status === filter);
    }, [tournaments, filter]);

    if (loading) return <div>Загрузка турниров...</div>;



    return (
        <div>
            <h2>Турниры</h2>
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                <button onClick={() => setFilter('REGISTERING')}>Регистрация</button>
                <button onClick={() => setFilter('ACTIVE')}>Активные</button>
                <button onClick={() => setFilter('FINISHED')}>Завершенные</button>
            </div>
            
            {filteredTournaments.length === 0 ? (
                <p>В этой категории турниров нет.</p>
            ) : (
                filteredTournaments.map(t => <TournamentCard key={t._id} tournament={t} />)
            )}
        </div>
    );
};

export default TournamentsListPage;