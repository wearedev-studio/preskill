import React, { useState } from 'react';
import { createTournament, createLobbyRoom } from '../../services/adminService';
import styles from './AdminPage.module.css';
import { PlusCircle, Trophy } from 'lucide-react';

const AdminPage: React.FC = () => {
    // Состояние для переключения вкладок
    const [activeTab, setActiveTab] = useState('createTournament');
    
    // Состояние для формы создания комнаты
    const [lobbyGameType, setLobbyGameType] = useState('tic-tac-toe');
    const [lobbyBet, setLobbyBet] = useState(50);
    const [lobbyMessage, setLobbyMessage] = useState('');

    // Состояние для формы создания турнира
    const [tourneyName, setTourneyName] = useState('Ежедневный турнир');
    const [tourneyGameType, setTourneyGameType] = useState('chess');
    const [tourneyEntryFee, setTourneyEntryFee] = useState(10);
    const [tourneyMaxPlayers, setTourneyMaxPlayers] = useState(8);
    const [tourneyStartTime, setTourneyStartTime] = useState('');
    const [tourneyMessage, setTourneyMessage] = useState('');

    const handleLobbySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLobbyMessage('');
        try {
            const data = await createLobbyRoom({ gameType: lobbyGameType, bet: lobbyBet });
            setLobbyMessage(`Успешно! Комната создана: ${data.room.id}`);
        } catch (error: any) {
            setLobbyMessage(`Ошибка: ${error.response?.data?.message || 'Что-то пошло не так'}`);
        }
    };
    
    const handleTournamentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTourneyMessage('');
        try {
            const tournamentData = { name: tourneyName, gameType: tourneyGameType, entryFee: tourneyEntryFee, maxPlayers: tourneyMaxPlayers, startTime: tourneyStartTime };
            const data = await createTournament(tournamentData);
            setTourneyMessage(`Успешно! Турнир "${data.name}" создан.`);
        } catch (error: any) {
            setTourneyMessage(`Ошибка: ${error.response?.data?.message || 'Что-то пошло не так'}`);
        }
    };

    return (
        <div className={styles.pageContainer}>
            <aside className={styles.sidebar}>
                <button 
                    onClick={() => setActiveTab('createTournament')} 
                    className={`${styles.navButton} ${activeTab === 'createTournament' ? styles.active : ''}`}
                >
                    <Trophy /> Создать Турнир
                </button>
                <button 
                    onClick={() => setActiveTab('createRoom')} 
                    className={`${styles.navButton} ${activeTab === 'createRoom' ? styles.active : ''}`}
                >
                    <PlusCircle /> Создать Комнату
                </button>
            </aside>

            <main className={styles.content}>
                {activeTab === 'createTournament' && (
                    <section>
                        <h1>Создание Турнира</h1>
                        <div className={styles.card}>
                            <h3>Новый турнир</h3>
                            <form onSubmit={handleTournamentSubmit} className={styles.form}>
                                <input type="text" value={tourneyName} onChange={e => setTourneyName(e.target.value)} placeholder="Название турнира" required className={styles.formInput} />
                                <select value={tourneyGameType} onChange={e => setTourneyGameType(e.target.value)} className={styles.formSelect}>
                                    <option value="chess">Шахматы</option>
                                    <option value="checkers">Шашки</option>
                                    <option value="tic-tac-toe">Крестики-нолики</option>
                                    <option value="backgammon">Нарды</option>
                                </select>
                                <input type="number" value={tourneyEntryFee} onChange={e => setTourneyEntryFee(Number(e.target.value))} min="0" placeholder="Вступительный взнос" className={styles.formInput} />
                                <select value={tourneyMaxPlayers} onChange={e => setTourneyMaxPlayers(Number(e.target.value))} className={styles.formSelect}>
                                    <option value={4}>4 игрока</option>
                                    <option value={8}>8 игроков</option>
                                    <option value={16}>16 игроков</option>
                                    <option value={32}>32 игрока</option>
                                </select>
                                <input type="datetime-local" value={tourneyStartTime} onChange={e => setTourneyStartTime(e.target.value)} required className={styles.formInput} />
                                <button type="submit" className={styles.formButton}>Создать турнир</button>
                                {tourneyMessage && <p className={`${styles.message} ${tourneyMessage.startsWith('Ошибка') ? styles.error : styles.success}`}>{tourneyMessage}</p>}
                            </form>
                        </div>
                    </section>
                )}

                {activeTab === 'createRoom' && (
                    <section>
                        <h1>Создание Комнаты в Лобби</h1>
                        <div className={styles.card}>
                            <h3>Новая комната</h3>
                            <form onSubmit={handleLobbySubmit} className={styles.form}>
                                <select value={lobbyGameType} onChange={e => setLobbyGameType(e.target.value)} className={styles.formSelect}>
                                    <option value="tic-tac-toe">Крестики-нолики</option>
                                    <option value="checkers">Шашки</option>
                                    <option value="chess">Шахматы</option>
                                    <option value="backgammon">Нарды</option>
                                </select>
                                <input type="number" value={lobbyBet} onChange={e => setLobbyBet(Number(e.target.value))} min="1" placeholder="Ставка" className={styles.formInput} />
                                <button type="submit" className={styles.formButton}>Создать комнату</button>
                                {lobbyMessage && <p className={`${styles.message} ${lobbyMessage.startsWith('Ошибка') ? styles.error : styles.success}`}>{lobbyMessage}</p>}
                            </form>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default AdminPage;