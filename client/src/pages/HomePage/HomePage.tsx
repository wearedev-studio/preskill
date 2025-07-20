import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';
import { Star } from 'lucide-react';

// 1. Расширяем данные для каждой игры
const gamesData = [
    { name: 'Шахматы', gameType: 'chess', status: 'Доступно', category: 'Стратегия', tag: 'Продвинутый', avatar: 'Ш', rating: 4.9, difficulty: 'Сложно', players: '2 игрока', time: '30-60 мин' },
    { name: 'Шашки', gameType: 'checkers', status: 'Доступно', category: 'Стратегия', tag: 'Средний', avatar: 'Ш', rating: 4.7, difficulty: 'Средне', players: '2 игрока', time: '15-30 мин' },
    { name: 'Нарды', gameType: 'backgammon', status: 'Доступно', category: 'Стратегия', tag: 'Средний', avatar: 'Н', rating: 4.8, difficulty: 'Средне', players: '2 игрока', time: '20-45 мин' },
    { name: 'Крестики-нолики', gameType: 'tic-tac-toe', status: 'Доступно', category: 'Казуальные', tag: 'Легкий', avatar: 'К', rating: 4.5, difficulty: 'Легко', players: '2 игрока', time: '1-5 мин' },
];

const GameCard: React.FC<{ game: typeof gamesData[0] }> = ({ game }) => (
    <div className={styles.gameCard}>
        <div className={styles.cardImage}></div>
        <div className={styles.cardAvatar}>{game.avatar}</div>
        <div className={styles.cardContent}>
            <div className={styles.cardHeader}>
                <div>
                    <h3>{game.name}</h3>
                    <p>{game.category}</p>
                </div>
                <div className={styles.cardRating}>
                    <Star size={16} fill="currentColor" />
                    <span>{game.rating}</span>
                </div>
            </div>
            <div className={styles.cardTag}>{game.tag}</div>
            <div className={styles.cardStats}>
                <div className={styles.statItem}><p>{game.difficulty}</p><p>Сложность</p></div>
                <div className={styles.statItem}><p>{game.players}</p><p>Игроки</p></div>
                <div className={styles.statItem}><p>{game.time}</p><p>Время</p></div>
            </div>
            <Link to={`/lobby/${game.gameType}`} className={styles.cardButton}>
                ▷ Играть сейчас
            </Link>
        </div>
    </div>
);

const HomePage: React.FC = () => {
    // 2. Добавляем состояния для фильтров
    const [categoryFilter, setCategoryFilter] = useState('Все игры');

    // 3. Фильтруем игры на основе выбранной категории
    const filteredGames = useMemo(() => {
        if (categoryFilter === 'Все игры') return gamesData;
        return gamesData.filter(game => game.category === categoryFilter);
    }, [categoryFilter]);

    return (
        <div>
            <div className={styles.pageHeader}>
                <h1>Игры</h1>
                <p>Выберите игру и начните играть!</p>
            </div>
            
            {/* Панель с фильтрами */}
            <div className={styles.filtersContainer}>
                <div className={styles.filterGroup}>
                    <span>Категории:</span>
                    <div className={styles.filterButtons}>
                        <button onClick={() => setCategoryFilter('Все игры')} className={`${styles.filterButton} ${categoryFilter === 'Все игры' ? styles.active : ''}`}>Все игры</button>
                        <button onClick={() => setCategoryFilter('Стратегия')} className={`${styles.filterButton} ${categoryFilter === 'Стратегия' ? styles.active : ''}`}>Стратегия</button>
                        <button onClick={() => setCategoryFilter('Казуальные')} className={`${styles.filterButton} ${categoryFilter === 'Казуальные' ? styles.active : ''}`}>Казуальные</button>
                    </div>
                </div>
                 {/* Здесь могут быть другие группы фильтров, например, по типу игры */}
            </div>

            {/* Сетка с играми */}
            <div className={styles.gameGrid}>
                {filteredGames.map(game => (
                    <GameCard key={game.gameType} game={game} />
                ))}
            </div>
        </div>
    );
};

export default HomePage;