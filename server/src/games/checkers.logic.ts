import { IGameLogic, GameMove, GameState } from './game.logic.interface';
import { Room } from '../socket';

// ==================================
// Типы и константы
// ==================================
type Piece = {
    playerIndex: 0 | 1; // 0 - верхний игрок (ходит вниз), 1 - нижний (ходит вверх)
    isKing: boolean;
};

type CheckersState = {
    board: (Piece | null)[];
    turn: string; // userId игрока
    mustCaptureWith: number | null; // Индекс шашки для серийного взятия
};

type CheckersMove = {
    from: number;
    to: number;
    isCapture: boolean;

};

// // ==================================
// // Вспомогательные функции (вся логика правил)
// // ==================================

// /** Находит все возможные ходы для одной шашки (с учетом взятий) */
// function getMovesForPiece(board: (Piece | null)[], fromIndex: number): CheckersMove[] {
//     const piece = board[fromIndex];
//     if (!piece) return [];
//     const moves: CheckersMove[] = [];
//     const fromRow = Math.floor(fromIndex / 8);
//     const fromCol = fromIndex % 8;
//     const directions = piece.isKing ? [1, -1] : (piece.playerIndex === 0 ? [1] : [-1]);

//     for (const dRow of directions) {
//         for (const dCol of [-1, 1]) {
//             const toRow = fromRow + dRow;
//             const toCol = fromCol + dCol;
//             const toIndex = toRow * 8 + toCol;

//             if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
//                 if (board[toIndex] === null) {
//                     moves.push({ from: fromIndex, to: toIndex });
//                 } else if (board[toIndex]?.playerIndex !== piece.playerIndex) {
//                     const jumpRow = toRow + dRow;
//                     const jumpCol = toCol + dCol;
//                     const jumpIndex = jumpRow * 8 + jumpCol;
//                     if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && board[jumpIndex] === null) {
//                         moves.push({ from: fromIndex, to: jumpIndex });
//                     }
//                 }
//             }
//         }
//     }
//     return moves;
// }

// /** Находит все легальные ходы для игрока (с учетом правила обязательного взятия) */
// function getAllLegalMoves(board: (Piece | null)[], playerIndex: 0 | 1): CheckersMove[] {
//     let allMoves: CheckersMove[] = [];
//     let mandatoryCaptures: CheckersMove[] = [];
//     for (let i = 0; i < 64; i++) {
//         const piece = board[i];
//         if (piece && piece.playerIndex === playerIndex) {
//             const pieceMoves = getMovesForPiece(board, i);
//             for (const move of pieceMoves) {
//                 if (Math.abs(move.from - move.to) > 9) { // Ход через клетку = взятие
//                     mandatoryCaptures.push(move);
//                 }
//                 allMoves.push(move);
//             }
//         }
//     }
//     return mandatoryCaptures.length > 0 ? mandatoryCaptures : allMoves;
// }

// ==================================
// Вспомогательные функции (Новая, полная логика правил)
// ==================================

/** Находит все возможные ходы для ОДНОЙ шашки */
function getMovesForPiece(board: (Piece | null)[], fromIndex: number): CheckersMove[] {
    const piece = board[fromIndex];
    if (!piece) return [];

    const moves: CheckersMove[] = [];
    const fromRow = Math.floor(fromIndex / 8);
    const fromCol = fromIndex % 8;
    
    // --- Логика для обычных шашек ---
    if (!piece.isKing) {
        // Простые ходы (только вперед)
        // Игрок 0 (белые) ходят вверх (уменьшение row), игрок 1 (черные) ходят вниз (увеличение row)
        const moveDirection = piece.playerIndex === 0 ? -1 : 1;
        for (const dCol of [-1, 1]) {
            const toRow = fromRow + moveDirection;
            const toCol = fromCol + dCol;
            const toIndex = toRow * 8 + toCol;
            if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8 && board[toIndex] === null) {
                moves.push({ from: fromIndex, to: toIndex, isCapture: false });
            }
        }
        // Ходы со взятием (вперед и назад)
        for (const dRow of [-1, 1]) {
            for (const dCol of [-1, 1]) {
                const capturedRow = fromRow + dRow;
                const capturedCol = fromCol + dCol;
                const capturedIndex = capturedRow * 8 + capturedCol;
                const toRow = fromRow + dRow * 2;
                const toCol = fromCol + dCol * 2;
                const toIndex = toRow * 8 + toCol;

                if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8 && board[toIndex] === null) {
                    const capturedPiece = board[capturedIndex];
                    if (capturedPiece && capturedPiece.playerIndex !== piece.playerIndex) {
                        moves.push({ from: fromIndex, to: toIndex, isCapture: true });
                    }
                }
            }
        }
    }
    // --- Логика для "дамок" ---
    else {
        // Дамки ходят в 4 направлениях на любое расстояние
        for (const dRow of [-1, 1]) {
            for (const dCol of [-1, 1]) {
                let capturedPiece: Piece | null = null;
                let capturedIndex: number | null = null;
                
                for (let i = 1; i < 8; i++) {
                    const currentRow = fromRow + dRow * i;
                    const currentCol = fromCol + dCol * i;
                    const currentIndex = currentRow * 8 + currentCol;

                    if (currentRow < 0 || currentRow >= 8 || currentCol < 0 || currentCol >= 8) break;

                    const currentPiece = board[currentIndex];
                    
                    if (currentPiece) {
                        if (currentPiece.playerIndex === piece.playerIndex) {
                            // Своя фигура - путь закрыт
                            break;
                        }
                        if (capturedPiece) {
                            // Вторая фигура противника - путь закрыт
                            break;
                        }
                        // Первая фигура противника
                        capturedPiece = currentPiece;
                        capturedIndex = currentIndex;
                    } else {
                        if (capturedPiece) {
                            // Пустая клетка после фигуры противника - взятие
                            moves.push({ from: fromIndex, to: currentIndex, isCapture: true });
                        } else {
                            // Пустая клетка без взятия - обычный ход
                            moves.push({ from: fromIndex, to: currentIndex, isCapture: false });
                        }
                    }
                }
            }
        }
    }
    return moves;
}


/** Находит все легальные ходы для игрока */
function getAllLegalMoves(board: (Piece | null)[], playerIndex: 0 | 1): CheckersMove[] {
    let allMoves: CheckersMove[] = [];
    for (let i = 0; i < 64; i++) {
        if (board[i] && board[i]?.playerIndex === playerIndex) {
            allMoves.push(...getMovesForPiece(board, i));
        }
    }
    const mandatoryCaptures = allMoves.filter(move => move.isCapture);
    return mandatoryCaptures.length > 0 ? mandatoryCaptures : allMoves;
}



// ==================================
// Экспортируемый объект логики
// ==================================

export const checkersLogic: IGameLogic = {
    createInitialState(players: Room['players']): CheckersState {
        const board: (Piece | null)[] = Array(64).fill(null);
        for (let i = 0; i < 64; i++) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            if ((row + col) % 2 !== 0) {
                // Игрок 0 (белые) - снизу доски (ряды 5-7), ходят первыми
                if (row >= 5) board[i] = { playerIndex: 0, isKing: false };
                // Игрок 1 (черные) - сверху доски (ряды 0-2)
                else if (row <= 2) board[i] = { playerIndex: 1, isKing: false };
            }
        }
        
        // Первый игрок (создатель комнаты) всегда играет белыми и ходит первым
        // @ts-ignore
        return { board, turn: players[0].user._id.toString(), mustCaptureWith: null };
    },

     processMove(gameState: CheckersState, move: CheckersMove, playerId: string, players: Room['players']) {
        if (gameState.turn !== playerId) {
            return { newState: gameState, error: "Сейчас не ваш ход.", turnShouldSwitch: false };
        }
        // @ts-ignore
        const playerIndex = players.findIndex(p => p.user._id.toString() === playerId) as 0 | 1;
        const legalMoves = getAllLegalMoves(gameState.board, playerIndex);

        if (gameState.mustCaptureWith !== null && move.from !== gameState.mustCaptureWith) {
             return { newState: gameState, error: "Вы должны продолжить взятие той же шашкой.", turnShouldSwitch: false };
        }
        
        const isMoveLegal = legalMoves.some(m => m.from === move.from && m.to === move.to);
        if (!isMoveLegal) {
            return { newState: gameState, error: "Недопустимый ход. Возможно, вы должны совершить взятие.", turnShouldSwitch: false };
        }

        const { from, to } = move;
        const newBoard = [...gameState.board];
        const piece = newBoard[from]!;
        newBoard[to] = piece;
        newBoard[from] = null;

        const isCapture = Math.abs(Math.floor(from / 8) - Math.floor(to / 8)) >= 2;
        if (isCapture) {
            // Для "летающей" дамки нужно найти срубленную шашку
            const dRow = Math.sign(to - from);
            const dCol = Math.sign((to % 8) - (from % 8));
            let capturedIndex = -1;
            for (let i = from + dRow*8 + dCol; i !== to; i += dRow*8 + dCol) {
                if (newBoard[i] !== null) {
                    capturedIndex = i;
                    break;
                }
            }
            if (capturedIndex !== -1) {
                newBoard[capturedIndex] = null;
            }
        }
        
        const toRow = Math.floor(to / 8);
        // Превращение в дамки: игрок 0 (белые) достигают ряда 0, игрок 1 (черные) достигают ряда 7
        if (!piece.isKing && ((piece.playerIndex === 0 && toRow === 0) || (piece.playerIndex === 1 && toRow === 7))) {
            newBoard[to]!.isKing = true;
        }

        // let turnShouldSwitch = true;
        // let nextMustCaptureWith: number | null = null;
        // if (isCapture) {
        //     const nextCaptures = getMovesForPiece(newBoard, to).filter(m => m.isCapture);
        //     if (nextCaptures.length > 0) {
        //         turnShouldSwitch = false;
        //         nextMustCaptureWith = to;
        //     }
        // }
        
        // const newState: CheckersState = { ...gameState, board: newBoard, mustCaptureWith: nextMustCaptureWith };
        // return { newState, turnShouldSwitch };
        let turnShouldSwitch = true;
        let nextMustCaptureWith: number | null = null;
        if (isCapture) {
            const nextCaptures = getMovesForPiece(newBoard, to).filter(m => m.isCapture);
            if (nextCaptures.length > 0) {
                turnShouldSwitch = false; // Если есть еще взятия, ход НЕ ПЕРЕХОДИТ
                nextMustCaptureWith = to;
            }
        }
        
        const newState: CheckersState = { ...gameState, board: newBoard, mustCaptureWith: nextMustCaptureWith };

        // ИСПРАВЛЕНИЕ: Модуль сам определяет, чей ход следующий
        if (turnShouldSwitch) {
            // @ts-ignore
            const nextPlayer = players.find(p => p.user._id.toString() !== playerId)!;
            // @ts-ignore
            newState.turn = nextPlayer.user._id.toString();
        } else {
            newState.turn = playerId; // Ход остается у текущего игрока
        }

        return { newState, error: undefined, turnShouldSwitch };
    },

    checkGameEnd(gameState: CheckersState, players: Room['players']) {
        const board = gameState.board;
        const currentPlayerId = gameState.turn;

        let player0Pieces = 0;
        let player1Pieces = 0;
        for (const piece of board) {
            if (piece) {
                if (piece.playerIndex === 0) player0Pieces++;
                else player1Pieces++;
            }
        }

        // Условие 1: У одного из игроков закончились шашки
        if (player0Pieces === 0) {
            // Игрок 1 (индекс 1) победил
            // @ts-ignore
            return { isGameOver: true, winnerId: players[1].user._id.toString(), isDraw: false };
        }
        if (player1Pieces === 0) {
            // Игрок 0 (индекс 0) победил
            // @ts-ignore
            return { isGameOver: true, winnerId: players[0].user._id.toString(), isDraw: false };
        }
        
        // Находим индексы обоих игроков
        // @ts-ignore
        const currentPlayerIndex = players.findIndex(p => p.user._id.toString() === currentPlayerId) as 0 | 1;
        // @ts-ignore
        const nextPlayer = players.find(p => p.user._id.toString() !== currentPlayerId);
        // @ts-ignore
        const nextPlayerIndex = players.findIndex(p => p.user._id.toString() === nextPlayer?.user._id.toString()) as 0 | 1;

        if (!nextPlayer) {
            // Если второго игрока нет, игра не может продолжаться (теоретическая ситуация)
            return { isGameOver: true, winnerId: currentPlayerId, isDraw: false };
        }
        
        // Условие 2: Проверяем доступные ходы для текущего игрока
        // Если у текущего игрока нет ходов, он проиграл (заблокирован)
        const legalMovesForCurrentPlayer = getAllLegalMoves(board, currentPlayerIndex);
        if (legalMovesForCurrentPlayer.length === 0) {
            // Текущий игрок заблокирован и проиграл
            // @ts-ignore
            return { isGameOver: true, winnerId: nextPlayer.user._id.toString(), isDraw: false };
        }
        
        // Условие 3: Проверяем доступные ходы для следующего игрока
        // Если у следующего игрока нет ходов, он проиграл (заблокирован)
        const legalMovesForNextPlayer = getAllLegalMoves(board, nextPlayerIndex);
        if (legalMovesForNextPlayer.length === 0) {
            // Следующий игрок заблокирован и проиграл
            return { isGameOver: true, winnerId: currentPlayerId, isDraw: false };
        }

        // Если ни одно из условий не выполнено, игра продолжается
        return { isGameOver: false, isDraw: false };
    },
    
    makeBotMove(gameState: CheckersState, playerIndex: 0 | 1): GameMove {
        const legalMoves = getAllLegalMoves(gameState.board, playerIndex);
        if (legalMoves.length > 0) {
            return legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
        return {}; 
    }
};


// import { IGameLogic, GameMove, GameState } from './game.logic.interface';
// import { Room } from '../socket';

// // Тип для фигуры на доске
// type Piece = {
//     playerIndex: 0 | 1; // 0 - первый игрок (сверху), 1 - второй (снизу)
//     isKing: boolean;
// };

// // Тип для состояния игры в шашки
// type CheckersState = {
//     board: (Piece | null)[]; // Массив из 64 клеток
//     turn: string; // userId игрока, чей сейчас ход
//     // Для обработки серии взятий. Хранит позицию шашки, которая должна продолжить ход.
//     mustCaptureWith: number | null; 
// };

// // Тип для хода в шашках
// type CheckersMove = {
//     from: number;
//     to: number;
// };

// export const checkersLogic: IGameLogic = {
//     /**
//      * Создает начальное состояние для игры в шашки.
//      */
//     createInitialState(players: Room['players']): CheckersState {
//         const board: (Piece | null)[] = Array(64).fill(null);
        
//         // Расстановка шашек
//         for (let i = 0; i < 64; i++) {
//             const row = Math.floor(i / 8);
//             const col = i % 8;
//             // Расставляем только на черные клетки
//             if ((row + col) % 2 !== 0) {
//                 if (row >= 0 && row <= 2) {
//                     board[i] = { playerIndex: 0, isKing: false }; // Игрок 1 (сверху)
//                 } else if (row >= 5 && row <= 7) {
//                     board[i] = { playerIndex: 1, isKing: false }; // Игрок 2 (снизу)
//                 }
//             }
//         }

//         return {
//             board,
//             // @ts-ignore
//             turn: players[0].user._id.toString(),
//             mustCaptureWith: null,
//         };
//     },

//     /**
//      * Обрабатывает ход игрока в шашках.
//      */
//     processMove(gameState: CheckersState, move: CheckersMove, playerId: string, players: Room['players']) {
//         // --- Валидация хода ---
//         if (gameState.turn !== playerId) {
//             return { newState: gameState, error: "Сейчас не ваш ход." };
//         }
        
//         // TODO: Здесь будет сложная логика валидации ходов в шашках.
//         // Для примера, пока сделаем простую логику перемещения без взятий и правил.
//         const { from, to } = move;
//         const piece = gameState.board[from];

//         if (!piece) {
//             return { newState: gameState, error: "В этой клетке нет вашей фигуры." };
//         }
//         if (gameState.board[to]) {
//             return { newState: gameState, error: "Эта клетка уже занята." };
//         }
        
//         // --- Применение хода ---
//         const newBoard = [...gameState.board];
//         newBoard[to] = piece;
//         newBoard[from] = null;
        
//         // --- Проверка на превращение в дамку ---
//         const toRow = Math.floor(to / 8);
//         if (piece.playerIndex === 0 && toRow === 7) newBoard[to]!.isKing = true;
//         if (piece.playerIndex === 1 && toRow === 0) newBoard[to]!.isKing = true;

//         // Простое обновление состояния. Полная логика потребует больше проверок.
//         const newState: CheckersState = {
//             ...gameState,
//             board: newBoard,
//             mustCaptureWith: null, // Сбрасываем после хода
//         };

//         return { newState };
//     },

//     /**
//      * Проверяет, завершена ли игра в шашки.
//      */
//     checkGameEnd(gameState: CheckersState, players: Room['players']) {
//         const piecesPlayer0 = gameState.board.filter(p => p?.playerIndex === 0).length;
//         const piecesPlayer1 = gameState.board.filter(p => p?.playerIndex === 1).length;

//         if (piecesPlayer0 === 0) {
//             // @ts-ignore
//             return { isGameOver: true, winnerId: players[1].user._id.toString(), isDraw: false };
//         }
//         if (piecesPlayer1 === 0) {
//             // @ts-ignore
//             return { isGameOver: true, winnerId: players[0].user._id.toString(), isDraw: false };
//         }

//         // TODO: Добавить проверку на отсутствие возможных ходов
        
//         return { isGameOver: false, isDraw: false };
//     },
    
//     /**
//      * Генерирует ход для бота в шашках.
//      */
//     makeBotMove(gameState: CheckersState): GameMove {
//         // TODO: Реализовать логику ИИ для бота
//         // Пока бот не будет делать ходов
//         return {};
//     }
// };