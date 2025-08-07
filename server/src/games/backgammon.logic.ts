import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';
import { BackgammonEngine, PlayerColor, BackgammonPiece, Point, DiceRoll } from './backgammon-engine';

type BackgammonState = {
    board: Point[];
    bar: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    home: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    currentPlayer: PlayerColor;
    diceRoll: DiceRoll | null;
    moveHistory: any[];
    turn: string; // userId игрока для совместимости с платформой
    turnPhase: 'ROLLING' | 'MOVING';
    isGameOver: boolean;
    winner?: string;
};

type BackgammonMove = {
    from: number;
    to: number;
    dieValue: number;
};

// Создание движка из состояния игры
function createEngineFromState(gameState: BackgammonState): BackgammonEngine {
    const engine = new BackgammonEngine();
    engine.restoreGameState({
        board: gameState.board,
        bar: gameState.bar,
        home: gameState.home,
        currentPlayer: gameState.currentPlayer,
        diceRoll: gameState.diceRoll,
        moveHistory: gameState.moveHistory
    });
    return engine;
}

export const backgammonLogic: IGameLogic = {
    createInitialState(players: Room['players']): BackgammonState {
        console.log('[Backgammon] Creating initial state for players:', players.length);
        
        const engine = new BackgammonEngine();
        const engineState = engine.getGameState();
        
        return {
            board: engineState.board,
            bar: engineState.bar,
            home: engineState.home,
            currentPlayer: engineState.currentPlayer,
            diceRoll: engineState.diceRoll,
            moveHistory: engineState.moveHistory,
            // @ts-ignore
            turn: players[0]?.user._id.toString(), // Первый игрок (белые) ходит первым
            turnPhase: 'ROLLING',
            isGameOver: false
        };
    },

    processMove(gameState: BackgammonState, move: BackgammonMove, playerId: string, players: Room['players']) {
        console.log('[Backgammon] Processing move:', { move, playerId, turnPhase: gameState.turnPhase });
        
        // Проверяем, что ход делает правильный игрок
        if (gameState.turn !== playerId) {
            console.log('[Backgammon] Wrong player turn');
            return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
        }

        // Проверяем фазу хода
        if (gameState.turnPhase !== 'MOVING') {
            console.log('[Backgammon] Wrong turn phase');
            return { newState: gameState, error: "Сначала бросьте кости.", turnShouldSwitch: false };
        }

        // Определяем индекс игрока
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        if (playerIndex === -1) {
            console.log('[Backgammon] Player not found');
            return { newState: gameState, error: "Игрок не найден.", turnShouldSwitch: false };
        }

        // Определяем ожидаемый цвет (0 = белые, 1 = черные)
        const expectedColor: PlayerColor = playerIndex === 0 ? 'white' : 'black';
        
        // Проверяем, что сейчас ход нужного игрока
        if (gameState.currentPlayer !== expectedColor) {
            console.log('[Backgammon] Wrong color turn. Expected:', expectedColor, 'Actual:', gameState.currentPlayer);
            return { newState: gameState, error: "Сейчас не ваш ход по правилам нард.", turnShouldSwitch: false };
        }

        // Создаем движок из текущего состояния
        const engine = createEngineFromState(gameState);
        
        // Выполняем ход
        const moveSuccess = engine.makeMove(move.from, move.to, move.dieValue);
        
        if (!moveSuccess) {
            console.log('[Backgammon] Move execution failed');
            return { newState: gameState, error: "Недопустимый ход.", turnShouldSwitch: false };
        }

        // Получаем новое состояние
        const newEngineState = engine.getGameState();
        
        // Проверяем состояние игры
        const gameStatus = engine.isGameOver();
        
        // Определяем, нужно ли переключать ход
        let turnShouldSwitch = false;
        let nextTurn = gameState.turn;
        let nextTurnPhase: 'ROLLING' | 'MOVING' = gameState.turnPhase;
        
        // Если нет доступных ходов или все кости использованы
        if (!newEngineState.diceRoll || newEngineState.diceRoll.availableMoves.length === 0 || !engine.hasAvailableMoves()) {
            turnShouldSwitch = true;
            nextTurnPhase = 'ROLLING';
            
            if (!gameStatus.isGameOver) {
                engine.switchPlayer();
                const updatedEngineState = engine.getGameState();
                const nextPlayerIndex = playerIndex === 0 ? 1 : 0;
                const nextPlayer = players[nextPlayerIndex];
                nextTurn = nextPlayer ? (nextPlayer.user as any)._id.toString() : gameState.turn;
                
                // Обновляем состояние движка после переключения
                newEngineState.currentPlayer = updatedEngineState.currentPlayer;
                newEngineState.diceRoll = null; // Очищаем кости для следующего игрока
            }
        }

        const newGameState: BackgammonState = {
            board: newEngineState.board,
            bar: newEngineState.bar,
            home: newEngineState.home,
            currentPlayer: newEngineState.currentPlayer,
            diceRoll: newEngineState.diceRoll,
            moveHistory: newEngineState.moveHistory,
            turn: nextTurn,
            turnPhase: nextTurnPhase,
            isGameOver: gameStatus.isGameOver
        };

        // Определяем победителя
        if (gameStatus.isGameOver && gameStatus.winner) {
            const winnerIndex = gameStatus.winner === 'white' ? 0 : 1;
            const winner = players[winnerIndex];
            if (winner) {
                newGameState.winner = (winner.user as any)._id.toString();
            }
        }

        console.log('[Backgammon] Move processed successfully. Turn should switch:', turnShouldSwitch);
        return { newState: newGameState, error: undefined, turnShouldSwitch };
    },

    checkGameEnd(gameState: BackgammonState, players: Room['players']) {
        console.log('[Backgammon] Checking game end. Game over:', gameState.isGameOver);
        
        if (!gameState.isGameOver) {
            return { isGameOver: false, isDraw: false };
        }

        return { 
            isGameOver: true, 
            winnerId: gameState.winner,
            isDraw: false 
        };
    },
    
    makeBotMove(gameState: BackgammonState, playerIndex: 0 | 1): GameMove {
        console.log('[Backgammon] Bot making move for player:', playerIndex);
        
        const expectedColor: PlayerColor = playerIndex === 0 ? 'white' : 'black';
        
        // Проверяем, что сейчас ход бота
        if (gameState.currentPlayer !== expectedColor) {
            console.log(`[Backgammon] Bot move requested but it's not bot's turn. Expected: ${expectedColor}, Actual: ${gameState.currentPlayer}`);
            return {};
        }

        // Проверяем фазу хода
        if (gameState.turnPhase !== 'MOVING') {
            console.log('[Backgammon] Bot cannot move - wrong phase');
            return {};
        }

        // Создаем движок из текущего состояния
        const engine = createEngineFromState(gameState);
        
        // Получаем все возможные ходы
        const possibleMoves = engine.getPossibleMoves();
        
        console.log('[Backgammon] Available moves for bot:', possibleMoves.length);
        
        if (possibleMoves.length > 0) {
            // Простая стратегия: приоритет выводу фигур, затем продвижению вперед
            let selectedMove = possibleMoves[0];
            
            // Приоритет выводу фигур из дома
            const bearOffMoves = possibleMoves.filter(move => move.to === -2);
            if (bearOffMoves.length > 0) {
                selectedMove = bearOffMoves[0];
                console.log('[Backgammon] Bot chose bear off move');
            } else {
                // Приоритет ходам с бара
                const barMoves = possibleMoves.filter(move => move.from === -1);
                if (barMoves.length > 0) {
                    selectedMove = barMoves[0];
                    console.log('[Backgammon] Bot chose bar move');
                } else {
                    // Приоритет продвижению вперед
                    const forwardMoves = possibleMoves.filter(move => {
                        if (expectedColor === 'white') {
                            return move.to > move.from;
                        } else {
                            return move.to < move.from;
                        }
                    });
                    
                    if (forwardMoves.length > 0) {
                        selectedMove = forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
                        console.log('[Backgammon] Bot chose forward move');
                    } else {
                        selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                        console.log('[Backgammon] Bot chose random move');
                    }
                }
            }
            
            const botMove = {
                from: selectedMove.from,
                to: selectedMove.to,
                dieValue: selectedMove.dieValue
            };
            
            console.log('[Backgammon] Bot move:', botMove);
            return botMove;
        }
        
        console.log('[Backgammon] No moves available for bot');
        return {};
    }
};

// Функция для обработки броска костей
export function rollDiceForBackgammon(gameState: BackgammonState, playerId: string, players: Room['players']): { newState: BackgammonState; error?: string } {
    console.log('[Backgammon] Rolling dice for player:', playerId);
    
    // Проверяем, что ход делает правильный игрок
    if (gameState.turn !== playerId) {
        console.log('[Backgammon] Wrong player turn for dice roll');
        return { newState: gameState, error: "Сейчас не ваш ход." };
    }

    // Проверяем фазу хода
    if (gameState.turnPhase !== 'ROLLING') {
        console.log('[Backgammon] Wrong turn phase for dice roll');
        return { newState: gameState, error: "Сейчас не время бросать кости." };
    }

    // Создаем движок из текущего состояния
    const engine = createEngineFromState(gameState);
    
    // Бросаем кости
    const diceRoll = engine.rollDice();
    
    // Получаем новое состояние
    const newEngineState = engine.getGameState();
    
    const newGameState: BackgammonState = {
        ...gameState,
        diceRoll: newEngineState.diceRoll,
        turnPhase: 'MOVING'
    };

    console.log('[Backgammon] Dice rolled:', diceRoll.dice, 'Available moves:', diceRoll.availableMoves);
    
    // Проверяем, есть ли доступные ходы
    if (!engine.hasAvailableMoves()) {
        console.log('[Backgammon] No available moves, skipping turn');
        newGameState.turnPhase = 'ROLLING';
        
        // Переключаем игрока в движке
        engine.switchPlayer();
        const updatedEngineState = engine.getGameState();
        
        // Переключаем игрока в состоянии игры
        const playerIndex = players.findIndex(p => (p.user as any)._id.toString() === playerId);
        const nextPlayerIndex = playerIndex === 0 ? 1 : 0;
        const nextPlayer = players[nextPlayerIndex];
        if (nextPlayer) {
            newGameState.turn = (nextPlayer.user as any)._id.toString();
            newGameState.currentPlayer = updatedEngineState.currentPlayer;
        }
        
        // Очищаем кости для следующего игрока
        newGameState.diceRoll = null;
    }
    
    return { newState: newGameState };
}