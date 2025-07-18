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
        if (gameState.turn !== playerId) {
            return { newState: gameState, error: "Сейчас не ваш ход." };
        }
        if (move.cellIndex < 0 || move.cellIndex > 8 || gameState.board[move.cellIndex] !== null) {
            return { newState: gameState, error: "Недопустимый ход." };
        }
        // @ts-ignore
        const playerIndex = players.findIndex(p => p.user._id.toString() === playerId);
        const playerSymbol = playerIndex === 0 ? 'X' : 'O';

        const newBoard = [...gameState.board];
        newBoard[move.cellIndex] = playerSymbol;

        const newGameState = { ...gameState, board: newBoard };

        return { newState: newGameState };
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
    
    makeBotMove(gameState: { board: (string | null)[] }): GameMove {
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