import React, { useState } from 'react';
import axios from 'axios';

const AdminPage: React.FC = () => {
    const [gameType, setGameType] = useState('tic-tac-toe');
    const [bet, setBet] = useState(50);
    const [message, setMessage] = useState('');

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

    return (
        <div>
            <h2>Панель Администратора</h2>
            <h3>Создать игровую комнату</h3>
            <form onSubmit={handleSubmit}>
                <select value={gameType} onChange={e => setGameType(e.target.value)}>
                    <option value="tic-tac-toe">Крестики-нолики</option>
                    <option value="checkers">Шашки</option>
                </select>
                <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} min="1" />
                <button type="submit">Создать комнату</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default AdminPage;