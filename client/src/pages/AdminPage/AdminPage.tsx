// import React, { useState } from 'react';
// import axios from 'axios';

// const AdminPage: React.FC = () => {
//     const [gameType, setGameType] = useState('tic-tac-toe');
//     const [bet, setBet] = useState(50);
//     const [message, setMessage] = useState('');

//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault();
//         setMessage('');
//         try {
//             const { data } = await axios.post('http://localhost:5001/api/admin/create-room', { gameType, bet });
//             setMessage(`Успешно! Комната создана: ${data.room.id}`);
//         } catch (error: any) {
//             setMessage(`Ошибка: ${error.response?.data?.message || 'Что-то пошло не так'}`);
//         }
//     };

//     return (
//         <div>
//             <h2>Панель Администратора</h2>
//             <h3>Создать игровую комнату</h3>
//             <form onSubmit={handleSubmit}>
//                 <select value={gameType} onChange={e => setGameType(e.target.value)}>
//                     <option value="tic-tac-toe">Крестики-нолики</option>
//                     <option value="checkers">Шашки</option>
//                 </select>
//                 <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} min="1" />
//                 <button type="submit">Создать комнату</button>
//             </form>
//             {message && <p>{message}</p>}
//         </div>
//     );
// };

// export default AdminPage;

import React, { useState } from 'react';
import axios from 'axios';
import { createTournament } from '../../services/adminService';

const AdminPage: React.FC = () => {
    // Состояние для формы создания комнаты
    const [gameType, setGameType] = useState('tic-tac-toe');
    const [bet, setBet] = useState(50);
    const [message, setMessage] = useState('');

    // Состояние для формы создания турнира
    const [tourneyName, setTourneyName] = useState('Ежедневный турнир');
    const [tourneyGameType, setTourneyGameType] = useState('chess');
    const [tourneyEntryFee, setTourneyEntryFee] = useState(10);
    const [tourneyMaxPlayers, setTourneyMaxPlayers] = useState(8);
    const [tourneyStartTime, setTourneyStartTime] = useState('');
    const [tourneyMessage, setTourneyMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        try {
            const { data } = await axios.post('http://localhost:5001/api/admin/create-room', { gameType, bet });
            setMessage(`Успешно! Комната создана: ${data.room.id}`);
        } catch (error: any) {
            setMessage(`Ошибка: ${error.response?.data?.message || 'Что-то пошло не так'}`);
        }
    };
    
    const handleTournamentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTourneyMessage('');
        try {
            const tournamentData = {
                name: tourneyName,
                gameType: tourneyGameType,
                entryFee: tourneyEntryFee,
                maxPlayers: tourneyMaxPlayers,
                startTime: tourneyStartTime,
            };
            const data = await createTournament(tournamentData);
            setTourneyMessage(`Успешно! Турнир "${data.name}" создан.`);
        } catch (error: any) {
            setTourneyMessage(`Ошибка: ${error.response?.data?.message || 'Что-то пошло не так'}`);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '2rem' }}>
             <div>
            <h2>Панель Администратора</h2>
            <h3>Создать игровую комнату</h3>
            <form onSubmit={handleSubmit}>
                <select value={gameType} onChange={e => setGameType(e.target.value)}>
                    <option value="tic-tac-toe">Крестики-нолики</option>
                        <option value="checkers">Шашки</option>
                        <option value="chess">Шахматы</option>
                        <option value="backgammon">Нарды</option>
                </select>
                <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} min="1" />
                <button type="submit">Создать комнату</button>
            </form>
            {message && <p>{message}</p>}
        </div>

            <div style={{ flex: 1, border: '1px solid #444', padding: '1.5rem', borderRadius: '8px' }}>
                <h3>Создать Турнир</h3>
                <form onSubmit={handleTournamentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="text" value={tourneyName} onChange={e => setTourneyName(e.target.value)} placeholder="Название турнира" required />
                    <select value={tourneyGameType} onChange={e => setTourneyGameType(e.target.value)}>
                        <option value="chess">Шахматы</option>
                        <option value="checkers">Шашки</option>
                        <option value="tic-tac-toe">Крестики-нолики</option>
                        <option value="backgammon">Нарды</option>
                    </select>
                     <input type="number" value={tourneyEntryFee} onChange={e => setTourneyEntryFee(Number(e.target.value))} min="0" placeholder="Вступительный взнос" />
                    <select value={tourneyMaxPlayers} onChange={e => setTourneyMaxPlayers(Number(e.target.value))}>
                        <option value={4}>4 игрока</option>
                        <option value={8}>8 игроков</option>
                        <option value={16}>16 игроков</option>
                        <option value={32}>32 игрока</option>
                    </select>
                    <input type="datetime-local" value={tourneyStartTime} onChange={e => setTourneyStartTime(e.target.value)} required />
                    <button type="submit">Создать турнир</button>
                    {tourneyMessage && <p>{tourneyMessage}</p>}
                </form>
            </div>
        </div>
    );
};

export default AdminPage;