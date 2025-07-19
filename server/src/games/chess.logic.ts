import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { Chess } from 'chess.js';

type ChessState = {
    fen: string;
    turn: string; // userId игрока
};

type ChessMove = {
    from: string;
    to: string;
    promotion?: string;
};

export const chessLogic: IGameLogic = {
    createInitialState(players: Room['players']): ChessState {
        const game = new Chess();
        return {
            fen: game.fen(),
            // @ts-ignore
            turn: players[0].user._id.toString(),
        };
    },

    processMove(gameState: ChessState, move: ChessMove, playerId: string, players: Room['players']) {
        const game = new Chess(gameState.fen);
        
        if (gameState.turn !== playerId) {
            return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
        }

        try {
            const result = game.move({ from: move.from, to: move.to, promotion: move.promotion });
            if (result === null) {
                return { newState: gameState, error: "Недопустимый ход.", turnShouldSwitch: false };
            }
        } catch (e) {
            return { newState: gameState, error: "Недопустимый ход.", turnShouldSwitch: false };
        }
        // @ts-ignore
        const nextPlayer = players.find(p => p.user._id.toString() !== playerId)!;
        const newGameState: ChessState = {
            fen: game.fen(),
            // @ts-ignore
            turn: nextPlayer.user._id.toString(),
        };

        return { newState: newGameState, turnShouldSwitch: true };
    },

    checkGameEnd(gameState: ChessState, players: Room['players']) {
        const game = new Chess(gameState.fen);
        if (!game.isGameOver()) {
            return { isGameOver: false, isDraw: false };
        }

        let winnerId: string | undefined = undefined;
        if (game.isCheckmate()) {
            const loserColor = game.turn();
            const winnerIndex = loserColor === 'w' ? 1 : 0;
            // @ts-ignore
            winnerId = players[winnerIndex]?.user._id.toString();
        }
        
        return { isGameOver: true, winnerId, isDraw: game.isDraw() };
    },
    
    makeBotMove(gameState: ChessState, playerIndex: 0 | 1): GameMove {
        const game = new Chess(gameState.fen);
        const moves = game.moves({ verbose: true });
        
        if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            return { from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion };
        }
        return {};
    }
};