import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';

// ==================================
// Типы и константы
// ==================================

type Point = [playerIndex: 0 | 1, count: number] | null;

type BackgammonState = {
    // Доска: 26 "пунктов". 
    // 1-24: игровые пункты
    // 0: бар для игрока 1 (белые)
    // 25: бар для игрока 0 (черные)
    points: Point[]; 
    turn: string; // userId игрока
    dice: number[]; // Результат броска костей, например [3, 5]
    turnPhase: 'ROLLING' | 'MOVING'; // Фаза хода
    borneOff: [number, number]; // Сколько шашек вывели игроки 0 и 1
};

type BackgammonMove = {
    from: number; // от 0 до 25
    to: number;   // от 1 до 24, либо 0/25 для вывода с доски
};

// ==================================
// Вспомогательные функции
// ==================================

/** Проверяет, все ли шашки игрока находятся в его "доме" */
function allCheckersInHome(points: Point[], borneOffCount: number, playerIndex: 0 | 1): boolean {
    let checkerCount = 0;
    const homeRange = playerIndex === 0 ? { start: 1, end: 6 } : { start: 19, end: 24 };
    
    for (let i = 1; i <= 24; i++) {
        const point = points[i];
        if (point && point[0] === playerIndex) {
            if (i < homeRange.start || i > homeRange.end) return false;
            checkerCount += point[1];
        }
    }
    // Проверяем, что все 15 шашек (на доске + выведенные) в доме
    return (checkerCount + borneOffCount) === 15;
}

/** Находит все легальные ходы для игрока на основе его костей */
function findAllLegalMoves(gameState: BackgammonState, playerIndex: 0 | 1): BackgammonMove[] {
    const legalMoves: BackgammonMove[] = [];
    const { points, dice } = gameState;
    const moveDirection = playerIndex === 0 ? -1 : 1;
    const barIndex = playerIndex === 0 ? 25 : 0;

    // 1. Если есть шашки на баре, только ходы с бара легальны
    if (points[barIndex] && points[barIndex]![1] > 0) {
        for (const die of dice) {
            const toIndex = playerIndex === 0 ? 25 - die : die;
            const targetPoint = points[toIndex];
            if (!targetPoint || targetPoint[0] === playerIndex || targetPoint[1] <= 1) {
                legalMoves.push({ from: barIndex, to: toIndex });
            }
        }
        return legalMoves;
    }

    // 2. Если на баре шашек нет, ищем ходы с доски
    const canBearOff = allCheckersInHome(points, gameState.borneOff[playerIndex], playerIndex);

    for (let from = 1; from <= 24; from++) {
        const point = points[from];
        if (point && point[0] === playerIndex) {
            for (const die of dice) {
                const to = from + (die * moveDirection);
                // 2a. Проверяем возможность вывода шашек (bear off)
                if (canBearOff && (to < 1 || to > 24)) {
                    legalMoves.push({ from, to: playerIndex === 0 ? 0 : 25 });
                } 
                // 2b. Проверяем обычные ходы
                else if (to >= 1 && to <= 24) {
                    const targetPoint = points[to];
                    if (!targetPoint || targetPoint[0] === playerIndex || targetPoint[1] <= 1) {
                        legalMoves.push({ from, to });
                    }
                }
            }
        }
    }
    
    // TODO: Добавить более сложную логику, например, обязательность использования большей кости
    return legalMoves;
}

// ==================================
// Экспортируемый объект логики
// ==================================
export const backgammonLogic: IGameLogic = {
    createInitialState(players: Room['players']): BackgammonState {
        const points: BackgammonState['points'] = Array(26).fill(null);
        // Начальная расстановка
        // Игрок 0 (черные), движется от 24 к 1
        points[24] = [0, 2]; points[13] = [0, 5]; points[8] = [0, 3]; points[6] = [0, 5];
        // Игрок 1 (белые), движется от 1 к 24
        points[1] = [1, 2]; points[12] = [1, 5]; points[17] = [1, 3]; points[19] = [1, 5];
        
        return {
            points,
            // @ts-ignore
            turn: players[0].user._id.toString(),
            dice: [],
            turnPhase: 'ROLLING',
            borneOff: [0, 0],
        };
    },

    processMove(gameState: BackgammonState, move: BackgammonMove, playerId: string, players: Room['players']) {
        const { from, to } = move;
        // @ts-ignore
        const playerIndex = players.findIndex(p => p.user._id.toString() === playerId) as 0 | 1;
        
        // --- 1. Базовые проверки ---
        if (gameState.turn !== playerId || gameState.turnPhase !== 'MOVING') {
            return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
        }
        if (gameState.dice.length === 0) {
            return { newState: gameState, error: "У вас закончились ходы.", turnShouldSwitch: false };
        }

        // --- 2. Проверка хода с бара ---
        const barIndex = playerIndex === 0 ? 25 : 0;
        if (gameState.points[barIndex] && gameState.points[barIndex]![1] > 0) {
            if (from !== barIndex) {
                return { newState: gameState, error: "Вы должны сначала вывести все шашки с бара.", turnShouldSwitch: false };
            }
        }
        
        // --- 3. Проверка хода и использования костей ---
        const moveDirection = playerIndex === 0 ? -1 : 1;
        let moveDistance: number;
        if (from === barIndex) { // Вход с бара
            moveDistance = playerIndex === 0 ? 25 - to : to;
        } else {
            moveDistance = (to - from) * moveDirection;
        }

        const dieIndex = gameState.dice.indexOf(moveDistance);
        if (dieIndex === -1) {
            // Проверка на использование кости большего номинала при выводе
            // @ts-ignore
            const canBearOff = allCheckersInHome(gameState.points, playerIndex);
            const isBearingOff = playerIndex === 0 ? to < 1 : to > 24;
            if (canBearOff && isBearingOff) {
                const highestDie = Math.max(...gameState.dice);
                const highestPointWithChecker = playerIndex === 0 
                    ? Math.max(...gameState.points.map((p, i) => (p && p[0] === playerIndex && i >=1 && i <= 6) ? i : 0))
                    : Math.min(...gameState.points.map((p, i) => (p && p[0] === playerIndex && i >= 19 && i <= 24) ? i : 25));
                
                if (moveDistance >= highestDie && (playerIndex === 0 ? from === highestPointWithChecker : from === highestPointWithChecker)) {
                    // Разрешаем ход
                } else {
                    return { newState: gameState, error: "У вас нет такого значения на костях.", turnShouldSwitch: false };
                }
            } else {
                return { newState: gameState, error: "У вас нет такого значения на костях.", turnShouldSwitch: false };
            }
        }
        
        // --- 4. Проверка пункта назначения ---
        const targetPoint = gameState.points[to];
        if (targetPoint && targetPoint[0] !== playerIndex && targetPoint[1] > 1) {
            return { newState: gameState, error: "Этот пункт заблокирован противником.", turnShouldSwitch: false };
        }
        
        // --- 5. Применение хода ---
        const newPoints = [...gameState.points];
        const newDice = [...gameState.dice];
        const newBorneOff = [...gameState.borneOff] as [number, number];

        // Убираем шашку с начальной точки
        if (newPoints[from] && newPoints[from]![1] > 0) {
            newPoints[from]![1]--;
            if (newPoints[from]![1] === 0) newPoints[from] = null;
        }

        // Вывод шашки с доски (bear off)
        if (playerIndex === 0 ? to < 1 : to > 24) {
            newBorneOff[playerIndex]++;
        } else {
            // "Бить" шашку противника
            if (targetPoint && targetPoint[0] !== playerIndex && targetPoint[1] === 1) {
                const opponentBarIndex = playerIndex === 0 ? 0 : 25;
                if (!newPoints[opponentBarIndex]) newPoints[opponentBarIndex] = [playerIndex === 0 ? 1 : 0, 0];
                newPoints[opponentBarIndex]![1]++;
                newPoints[to] = [playerIndex, 1];
            } else { // Обычный ход на пункт
                if (!newPoints[to]) newPoints[to] = [playerIndex, 0];
                newPoints[to]![1]++;
            }
        }

        // Удаляем использованную кость
        newDice.splice(dieIndex, 1);

        const newState: BackgammonState = { ...gameState, points: newPoints, dice: newDice, borneOff: newBorneOff };

        // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ---
        const turnShouldSwitch = newDice.length === 0;
        if (turnShouldSwitch) {
            newState.turnPhase = 'ROLLING';
            // Явно передаем ход следующему игроку
            // @ts-ignore
            const nextPlayer = players.find(p => p.user._id.toString() !== playerId)!;
            // @ts-ignore
            newState.turn = nextPlayer.user._id.toString();
        }
        
        return { newState, turnShouldSwitch };
    },

    checkGameEnd(gameState: BackgammonState, players: Room['players']) {
        if (gameState.borneOff[0] === 15) {
            // @ts-ignore
            return { isGameOver: true, winnerId: players[0].user._id.toString(), isDraw: false };
        }
        if (gameState.borneOff[1] === 15) {
            // @ts-ignore
            return { isGameOver: true, winnerId: players[1].user._id.toString(), isDraw: false };
        }
        return { isGameOver: false, isDraw: false };
    },
    
    makeBotMove(gameState: BackgammonState, playerIndex: 0 | 1): GameMove {
        // 1. Находим все возможные легальные ходы
        const legalMoves = findAllLegalMoves(gameState, playerIndex);

        if (legalMoves.length > 0) {
            // 2. Выбираем случайный из легальных ходов
            // В будущем можно добавить сюда более сложную стратегию
            const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            return randomMove;
        }

        // Если ходов нет, возвращаем пустой объект
        return {};
    }
};