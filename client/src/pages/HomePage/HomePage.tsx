import React from 'react';
import { Link } from 'react-router-dom';

// gameType должен совпадать с ключами в gameLogics на бэкенде
const games = [
    { name: 'Крестики-нолики', gameType: 'tic-tac-toe', status: 'Доступно' },
    { name: 'Шашки', gameType: 'checkers', status: 'Доступно' }, // ИЗМЕНЕНО
    { name: 'Шахматы', gameType: 'chess', status: 'Доступно' },
    { name: 'Нарды', gameType: 'backgammon', status: 'Доступно' },
];

const GameCard: React.FC<{ game: typeof games[0] }> = ({ game }) => (
    <div style={{ border: '1px solid #444', padding: '1.5rem', borderRadius: '8px', width: '200px', textAlign: 'center' }}>
        <h3>{game.name}</h3>
        <p>{game.status}</p>
        {game.status === 'Доступно' ? (
            <Link to={`/lobby/${game.gameType}`}><button>Играть</button></Link>
        ) : (
            <button disabled>Играть</button>
        )}
    </div>
);

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Выберите игру</h1>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '2rem' }}>
        {games.map(game => <GameCard key={game.name} game={game} />)}
      </div>
    </div>
  );
};

export default HomePage;