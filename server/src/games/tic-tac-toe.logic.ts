import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';

type TicTacToeState = {
    board: ('X' | 'O' | null)[];
    turn: string; // userId
};

export const ticTacToeLogic: IGameLogic = {
    createInitialState(players: Room['players']): TicTacToeState {
        return {
            board: Array(9).fill(null),
            // @ts-ignore
            turn: players[0].user._id.toString(),
        };
    },

    processMove(gameState: TicTacToeState, move: { cellIndex: number }, playerId: string, players: Room['players']) {
        console.log(`[TicTacToe] Processing move for player ${playerId}`);
        console.log(`[TicTacToe] Current turn: ${gameState.turn}`);
        console.log(`[TicTacToe] Move:`, move);
        console.log(`[TicTacToe] Players:`, players.map(p => ({ id: (p.user as any)._id, username: (p.user as any).username })));

        // Проверяем очередность хода
        if (gameState.turn && gameState.turn.toString() !== playerId.toString()) {
            console.log(`[TicTacToe] Turn check failed: expected ${gameState.turn}, got ${playerId}`);
            return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
        }

        // Проверяем валидность хода
        if (!move || typeof move.cellIndex !== 'number') {
            console.log(`[TicTacToe] Invalid move format:`, move);
            return { newState: gameState, error: "Неверный формат хода.", turnShouldSwitch: false };
        }

        if (move.cellIndex < 0 || move.cellIndex > 8) {
            console.log(`[TicTacToe] Cell index out of bounds: ${move.cellIndex}`);
            return { newState: gameState, error: "Недопустимый индекс клетки.", turnShouldSwitch: false };
        }

        if (gameState.board[move.cellIndex] !== null) {
            console.log(`[TicTacToe] Cell already occupied: ${move.cellIndex}, value: ${gameState.board[move.cellIndex]}`);
            return { newState: gameState, error: "Клетка уже занята.", turnShouldSwitch: false };
        }

        // Определяем символ игрока
        // @ts-ignore
        const playerIndex = players.findIndex(p => p.user._id.toString() === playerId.toString());
        if (playerIndex === -1) {
            console.log(`[TicTacToe] Player not found in players list`);
            return { newState: gameState, error: "Игрок не найден.", turnShouldSwitch: false };
        }

        const playerSymbol = playerIndex === 0 ? 'X' : 'O';
        console.log(`[TicTacToe] Player ${playerId} (index ${playerIndex}) plays ${playerSymbol}`);

        // Делаем ход
        const newBoard = [...gameState.board];
        newBoard[move.cellIndex] = playerSymbol;

        // Определяем следующего игрока
        // @ts-ignore
        const nextPlayer = players.find(p => p.user._id.toString() !== playerId.toString());
        if (!nextPlayer) {
            console.log(`[TicTacToe] Next player not found`);
            return { newState: gameState, error: "Следующий игрок не найден.", turnShouldSwitch: false };
        }

        // @ts-ignore
        const newGameState = { ...gameState, board: newBoard, turn: nextPlayer.user._id.toString() };

        console.log(`[TicTacToe] Move successful, next turn: ${newGameState.turn}`);
        console.log(`[TicTacToe] New board:`, newBoard);

        // В крестиках-ноликах ход ВСЕГДА переключается
        return { newState: newGameState, error: undefined, turnShouldSwitch: true };
    },

    checkGameEnd(gameState: TicTacToeState, players: Room['players']) {
        const board = gameState.board;
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const combination of winningCombinations) {
            const [a, b, c] = combination;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                const winnerSymbol = board[a] as 'X' | 'O';
                const winner = players[winnerSymbol === 'X' ? 0 : 1];
                // @ts-ignore
                return { isGameOver: true, winnerId: winner.user._id.toString(), isDraw: false };
            }
        }

        if (board.every(cell => cell !== null)) {
            return { isGameOver: true, winnerId: undefined, isDraw: true };
        }

        return { isGameOver: false, isDraw: false };
    },
    
    makeBotMove(gameState: { board: (string | null)[] }, playerIndex: 0 | 1): GameMove {
        const availableCells: number[] = [];
        gameState.board.forEach((cell, index) => {
            if (cell === null) {
                availableCells.push(index);
            }
        });

        const randomIndex = Math.floor(Math.random() * availableCells.length);
        const randomCell = availableCells[randomIndex];

        return { cellIndex: randomCell };
    }
};

// import { IGameLogic, GameMove, GameState } from './game.logic.interface';
// import { Room } from '../socket';

// type TicTacToeState = {
//     board: ('X' | 'O' | null)[];
//     turn: string; // userId
// };

// export const ticTacToeLogic: IGameLogic = {
//     createInitialState(players: Room['players']): TicTacToeState {
//         return {
//             board: Array(9).fill(null),
//             // @ts-ignore
//             turn: players[0].user._id.toString(),
//         };
//     },

//     processMove(gameState: TicTacToeState, move: { cellIndex: number }, playerId: string, players: Room['players']) {
//         if (gameState.turn !== playerId) {
//             return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
//         }
//         if (move.cellIndex < 0 || move.cellIndex > 8 || gameState.board[move.cellIndex] !== null) {
//             return { newState: gameState, error: "Недопустимый ход.", turnShouldSwitch: false };
//         }
//         // @ts-ignore
//         const playerIndex = players.findIndex(p => p.user._id.toString() === playerId);
//         const playerSymbol = playerIndex === 0 ? 'X' : 'O';

//         const newBoard = [...gameState.board];
//         newBoard[move.cellIndex] = playerSymbol;

//         const newGameState = { ...gameState, board: newBoard };

//         // ИСПРАВЛЕНИЕ: Всегда передаем ход после валидного действия
//         return { newState: newGameState, turnShouldSwitch: true };
//     },

//     checkGameEnd(gameState: TicTacToeState, players: Room['players']) {
//         const board = gameState.board;
//         const winningCombinations = [
//             [0, 1, 2], [3, 4, 5], [6, 7, 8],
//             [0, 3, 6], [1, 4, 7], [2, 5, 8],
//             [0, 4, 8], [2, 4, 6]
//         ];

//         for (const combination of winningCombinations) {
//             const [a, b, c] = combination;
//             if (board[a] && board[a] === board[b] && board[a] === board[c]) {
//                 const winnerSymbol = board[a] as 'X' | 'O';
//                 const winner = players[winnerSymbol === 'X' ? 0 : 1];
//                 // @ts-ignore
//                 return { isGameOver: true, winnerId: winner.user._id.toString(), isDraw: false };
//             }
//         }

//         if (board.every(cell => cell !== null)) {
//             return { isGameOver: true, winnerId: undefined, isDraw: true };
//         }

//         return { isGameOver: false, isDraw: false };
//     },
    
//     makeBotMove(gameState: { board: (string | null)[] }, playerIndex: 0 | 1): GameMove {
//         const availableCells: number[] = [];
//         gameState.board.forEach((cell, index) => {
//             if (cell === null) {
//                 availableCells.push(index);
//             }
//         });

//         const randomIndex = Math.floor(Math.random() * availableCells.length);
//         const randomCell = availableCells[randomIndex];

//         return { cellIndex: randomCell };
//     }
// };