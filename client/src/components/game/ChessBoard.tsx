import React, { useState, useCallback, useEffect } from 'react';
import styles from './ChessBoard.module.css';

// Типы для шахмат
type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
type PieceColor = 'white' | 'black';

interface ChessPiece {
    type: PieceType;
    color: PieceColor;
    hasMoved?: boolean;
}

interface Position {
    row: number;
    col: number;
}

type ChessBoard = (ChessPiece | null)[][];

// Тип для хода
type ChessMove = {
    from: Position;
    to: Position;
    promotion?: string;
};

// Простая логика получения возможных ходов (базовая версия)
function getBasicPossibleMoves(board: ChessBoard, from: Position, piece: ChessPiece): Position[] {
    const moves: Position[] = [];
    const { row, col } = from;

    // Проверка границ доски
    const isValidPos = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
    
    // Проверка, можно ли ходить на клетку
    const canMoveTo = (r: number, c: number) => {
        if (!isValidPos(r, c)) return false;
        const targetPiece = board[r][c];
        return !targetPiece || targetPiece.color !== piece.color;
    };

    switch (piece.type) {
        case 'pawn': {
            const direction = piece.color === 'white' ? -1 : 1;
            const startRow = piece.color === 'white' ? 6 : 1;

            // Ход вперед
            if (isValidPos(row + direction, col) && !board[row + direction][col]) {
                moves.push({ row: row + direction, col });
                
                // Двойной ход с начальной позиции
                if (row === startRow && !board[row + 2 * direction][col]) {
                    moves.push({ row: row + 2 * direction, col });
                }
            }

            // Взятие по диагонали
            if (canMoveTo(row + direction, col - 1) && board[row + direction][col - 1]) {
                moves.push({ row: row + direction, col: col - 1 });
            }
            if (canMoveTo(row + direction, col + 1) && board[row + direction][col + 1]) {
                moves.push({ row: row + direction, col: col + 1 });
            }
            break;
        }

        case 'rook': {
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dr, dc] of directions) {
                for (let i = 1; i < 8; i++) {
                    const newRow = row + dr * i;
                    const newCol = col + dc * i;
                    
                    if (!isValidPos(newRow, newCol)) break;
                    
                    const targetPiece = board[newRow][newCol];
                    if (!targetPiece) {
                        moves.push({ row: newRow, col: newCol });
                    } else {
                        if (targetPiece.color !== piece.color) {
                            moves.push({ row: newRow, col: newCol });
                        }
                        break;
                    }
                }
            }
            break;
        }

        case 'bishop': {
            const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            for (const [dr, dc] of directions) {
                for (let i = 1; i < 8; i++) {
                    const newRow = row + dr * i;
                    const newCol = col + dc * i;
                    
                    if (!isValidPos(newRow, newCol)) break;
                    
                    const targetPiece = board[newRow][newCol];
                    if (!targetPiece) {
                        moves.push({ row: newRow, col: newCol });
                    } else {
                        if (targetPiece.color !== piece.color) {
                            moves.push({ row: newRow, col: newCol });
                        }
                        break;
                    }
                }
            }
            break;
        }

        case 'queen': {
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            for (const [dr, dc] of directions) {
                for (let i = 1; i < 8; i++) {
                    const newRow = row + dr * i;
                    const newCol = col + dc * i;
                    
                    if (!isValidPos(newRow, newCol)) break;
                    
                    const targetPiece = board[newRow][newCol];
                    if (!targetPiece) {
                        moves.push({ row: newRow, col: newCol });
                    } else {
                        if (targetPiece.color !== piece.color) {
                            moves.push({ row: newRow, col: newCol });
                        }
                        break;
                    }
                }
            }
            break;
        }

        case 'knight': {
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of knightMoves) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (canMoveTo(newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
            break;
        }

        case 'king': {
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (canMoveTo(newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
            break;
        }
    }

    return moves;
}

// Пропсы компонента
interface ChessBoardProps {
    gameState: {
        board: ChessBoard;
        currentPlayer: PieceColor;
        moveHistory?: any[];
        moveCount?: number;
        lastMove?: {
            from: Position;
            to: Position;
        };
    };
    onMove: (move: ChessMove) => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1;
}

// Проверка шаха
function isKingInCheck(board: ChessBoard, color: PieceColor): boolean {
    // Находим короля
    let kingPos: Position | null = null;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.type === 'king' && piece.color === color) {
                kingPos = { row, col };
                break;
            }
        }
        if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    // Проверяем, может ли любая фигура противника атаковать короля
    const opponentColor = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === opponentColor) {
                const moves = getBasicPossibleMoves(board, { row, col }, piece);
                if (moves.some(move => move.row === kingPos!.row && move.col === kingPos!.col)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Символы шахматных фигур
const PIECE_SYMBOLS: Record<PieceColor, Record<PieceType, string>> = {
    white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
    },
    black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
    }
};

const ChessBoard: React.FC<ChessBoardProps> = ({ 
    gameState, 
    onMove, 
    isMyTurn, 
    isGameFinished, 
    myPlayerIndex 
}) => {
    const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<Position[]>([]);
    const [promotionMove, setPromotionMove] = useState<ChessMove | null>(null);
    const [draggedPiece, setDraggedPiece] = useState<{
        piece: ChessPiece;
        from: Position;
        mousePos: { x: number; y: number };
    } | null>(null);

    // Проверяем шах
    const myColor: PieceColor = myPlayerIndex === 0 ? 'white' : 'black';
    const isInCheck = isKingInCheck(gameState.board, myColor);
    const opponentColor: PieceColor = myColor === 'white' ? 'black' : 'white';
    const isOpponentInCheck = isKingInCheck(gameState.board, opponentColor);

    console.log('[ChessBoard] Render:', { 
        isMyTurn, 
        isGameFinished, 
        myPlayerIndex, 
        currentPlayer: gameState.currentPlayer,
        boardSize: gameState.board?.length
    });

    // Определяем ориентацию доски
    const isFlipped = myPlayerIndex === 1;

    // Получаем возможные ходы для выбранной фигуры
    const getPossibleMovesForPiece = useCallback((from: Position): Position[] => {
        const piece = gameState.board[from.row][from.col];
        if (!piece) return [];
        
        return getBasicPossibleMoves(gameState.board, from, piece);
    }, [gameState.board]);

    const onSquareClick = useCallback((row: number, col: number) => {
        const position = { row, col };
        console.log('[ChessBoard] Square clicked:', position, { isMyTurn, isGameFinished });
        
        if (!isMyTurn || isGameFinished) {
            console.log('[ChessBoard] Click ignored - not my turn or game finished');
            return;
        }

        // Если уже выбрана фигура, пытаемся сделать ход
        if (selectedSquare) {
            console.log('[ChessBoard] Attempting move from', selectedSquare, 'to', position);
            
            // Если кликнули на ту же клетку, снимаем выделение
            if (selectedSquare.row === row && selectedSquare.col === col) {
                console.log('[ChessBoard] Deselecting piece');
                setSelectedSquare(null);
                setPossibleMoves([]);
                return;
            }

            // Проверяем, является ли ход возможным
            const isValidMove = possibleMoves.some(move => 
                move.row === row && move.col === col
            );

            if (isValidMove) {
                const move: ChessMove = {
                    from: selectedSquare,
                    to: position,
                };

                // Проверяем превращение пешки
                const piece = gameState.board[selectedSquare.row][selectedSquare.col];
                if (piece && piece.type === 'pawn' && 
                    ((piece.color === 'white' && row === 0) || 
                     (piece.color === 'black' && row === 7))) {
                    setPromotionMove(move);
                    return;
                }

                console.log('[ChessBoard] Sending move:', move);
                onMove(move);
                setSelectedSquare(null);
                setPossibleMoves([]);
            } else {
                // Пытаемся выбрать новую фигуру
                selectPiece(row, col);
            }
            return;
        }

        // Выбираем фигуру для хода
        selectPiece(row, col);
    }, [isMyTurn, isGameFinished, selectedSquare, possibleMoves, gameState.board, onMove]);

    const selectPiece = useCallback((row: number, col: number) => {
        const piece = gameState.board[row][col];
        if (!piece) return;

        // Проверяем, что это наша фигура
        const myColor: PieceColor = myPlayerIndex === 0 ? 'white' : 'black';
        if (piece.color !== myColor) return;

        console.log('[ChessBoard] Selecting piece at', { row, col });
        setSelectedSquare({ row, col });
        
        // Получаем возможные ходы
        const moves = getPossibleMovesForPiece({ row, col });
        setPossibleMoves(moves);
    }, [gameState.board, myPlayerIndex, getPossibleMovesForPiece]);

    // Обработка drag and drop
    const onMouseDown = useCallback((e: React.MouseEvent, row: number, col: number) => {
        if (!isMyTurn || isGameFinished) return;

        const piece = gameState.board[row][col];
        if (!piece) return;

        const myColor: PieceColor = myPlayerIndex === 0 ? 'white' : 'black';
        if (piece.color !== myColor) return;

        e.preventDefault();
        setDraggedPiece({
            piece,
            from: { row, col },
            mousePos: { x: e.clientX, y: e.clientY }
        });

        const moves = getPossibleMovesForPiece({ row, col });
        setPossibleMoves(moves);
    }, [isMyTurn, isGameFinished, gameState.board, myPlayerIndex, getPossibleMovesForPiece]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (draggedPiece) {
            setDraggedPiece(prev => prev ? {
                ...prev,
                mousePos: { x: e.clientX, y: e.clientY }
            } : null);
        }
    }, [draggedPiece]);

    const onMouseUp = useCallback((e: MouseEvent) => {
        if (!draggedPiece) return;

        // Находим клетку под курсором
        const boardElement = document.querySelector(`.${styles.boardGrid}`);
        if (boardElement) {
            const rect = boardElement.getBoundingClientRect();
            
            // Учитываем возможные трансформации и скроллинг
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Проверяем, что координаты находятся в пределах доски
            if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
                setDraggedPiece(null);
                setPossibleMoves([]);
                return;
            }
            
            const squareSize = rect.width / 8;
            let col = Math.floor(x / squareSize);
            let row = Math.floor(y / squareSize);

            // Учитываем ориентацию доски
            if (isFlipped) {
                row = 7 - row;
                col = 7 - col;
            }

            if (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const isValidMove = possibleMoves.some(move =>
                    move.row === row && move.col === col
                );

                if (isValidMove) {
                    const move: ChessMove = {
                        from: draggedPiece.from,
                        to: { row, col },
                    };

                    // Проверяем превращение пешки
                    if (draggedPiece.piece.type === 'pawn' &&
                        ((draggedPiece.piece.color === 'white' && row === 0) ||
                         (draggedPiece.piece.color === 'black' && row === 7))) {
                        setPromotionMove(move);
                    } else {
                        onMove(move);
                    }
                }
            }
        }

        setDraggedPiece(null);
        setPossibleMoves([]);
    }, [draggedPiece, possibleMoves, isFlipped, onMove]);

    // Подписываемся на события мыши
    useEffect(() => {
        if (draggedPiece) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            return () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
        }
    }, [draggedPiece, onMouseMove, onMouseUp]);

    // Обработка превращения пешки
    const handlePromotion = useCallback((pieceType: PieceType) => {
        if (promotionMove) {
            onMove({
                ...promotionMove,
                promotion: pieceType
            });
            setPromotionMove(null);
        }
    }, [promotionMove, onMove]);

    // Проверяем, является ли клетка выделенной
    const isSquareSelected = useCallback((row: number, col: number) => {
        return selectedSquare?.row === row && selectedSquare?.col === col;
    }, [selectedSquare]);

    // Проверяем, является ли клетка возможным ходом
    const isSquarePossibleMove = useCallback((row: number, col: number) => {
        return possibleMoves.some(move => move.row === row && move.col === col);
    }, [possibleMoves]);

    // Проверяем, является ли клетка последним ходом
    const isSquareLastMove = useCallback((row: number, col: number) => {
        if (!gameState.lastMove) return false;
        return (gameState.lastMove.from.row === row && gameState.lastMove.from.col === col) ||
               (gameState.lastMove.to.row === row && gameState.lastMove.to.col === col);
    }, [gameState.lastMove]);

    // Получаем CSS класс для клетки
    const getSquareClass = useCallback((row: number, col: number) => {
        const isLight = (row + col) % 2 === 0;
        let className = isLight ? styles.lightSquare : styles.darkSquare;
        
        if (isSquareSelected(row, col)) {
            className += ` ${styles.selectedSquare}`;
        } else if (isSquarePossibleMove(row, col)) {
            className += ` ${styles.possibleMoveSquare}`;
        } else if (isSquareLastMove(row, col)) {
            className += ` ${styles.lastMoveSquare}`;
        }
        
        return className;
    }, [isSquareSelected, isSquarePossibleMove, isSquareLastMove]);

    // Рендерим фигуру
    const renderPiece = useCallback((piece: ChessPiece | null, row: number, col: number) => {
        if (!piece) return null;

        // Не рендерим перетаскиваемую фигуру
        if (draggedPiece && 
            draggedPiece.from.row === row && 
            draggedPiece.from.col === col) {
            return null;
        }

        const pieceClass = `${styles.piece} ${piece.color === 'black' ? styles.blackPiece : styles.whitePiece}`;

        return (
            <div
                className={pieceClass}
                onMouseDown={(e) => onMouseDown(e, row, col)}
            >
                {PIECE_SYMBOLS[piece.color][piece.type]}
            </div>
        );
    }, [draggedPiece, onMouseDown]);

    // Рендерим доску
    const renderBoard = () => {
        const squares = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const displayRow = isFlipped ? 7 - row : row;
                const displayCol = isFlipped ? 7 - col : col;
                const piece = gameState.board[displayRow][displayCol];
                
                squares.push(
                    <div
                        key={`${row}-${col}`}
                        className={`${styles.square} ${getSquareClass(displayRow, displayCol)}`}
                        onClick={() => onSquareClick(displayRow, displayCol)}
                    >
                        {renderPiece(piece, displayRow, displayCol)}
                        
                        {/* Координаты */}
                        {col === 0 && (
                            <div className={`${styles.coordinates} ${styles.rankCoordinate}`}>
                                {isFlipped ? row + 1 : 8 - row}
                            </div>
                        )}
                        {row === 7 && (
                            <div className={`${styles.coordinates} ${styles.fileCoordinate}`}>
                                {String.fromCharCode(97 + (isFlipped ? 7 - col : col))}
                            </div>
                        )}
                    </div>
                );
            }
        }
        
        return squares;
    };

    return (
        <div className={styles.chessBoard}>
            {/* Информация о игроках */}
            <div className={styles.playerInfo}>
                <div className={styles.playerInfoItem}>
                    <span className={`${styles.colorIndicator} ${styles.whiteIndicator}`}></span>
                    Белые (ходят первыми) - {myPlayerIndex === 0 ? 'Вы' : 'Противник'}
                </div>
                <div className={styles.playerInfoItem}>
                    <span className={`${styles.colorIndicator} ${styles.blackIndicator}`}></span>
                    Черные - {myPlayerIndex === 1 ? 'Вы' : 'Противник'}
                </div>
                {gameState.moveCount !== undefined && (
                    <div className={styles.moveCounter}>
                        Ход: {Math.floor(gameState.moveCount / 2) + 1}
                    </div>
                )}
            </div>

            {/* Шахматная доска */}
            <div className={styles.boardContainer}>
                <div className={styles.boardGrid}>
                    {renderBoard()}
                </div>
            </div>
            
            {/* Показываем историю ходов */}
            {gameState.moveHistory && gameState.moveHistory.length > 0 && (
                <div className={styles.gameHistory}>
                    <strong>История ходов:</strong> {gameState.moveHistory.map((move, index) => {
                        if (typeof move === 'string') {
                            return move;
                        } else if (move && typeof move === 'object' && move.from && move.to) {
                            // Конвертируем объект хода в читаемую нотацию
                            const fromSquare = String.fromCharCode(97 + move.from.col) + (8 - move.from.row);
                            const toSquare = String.fromCharCode(97 + move.to.col) + (8 - move.to.row);
                            return `${fromSquare}-${toSquare}`;
                        }
                        return `Ход ${index + 1}`;
                    }).join(', ')}
                </div>
            )}

            {/* Статус игры */}
            <div className={`${styles.gameStatus} ${
                isGameFinished ? styles.gameFinished : 
                isMyTurn ? styles.myTurn : styles.opponentTurn
            }`}>
                {isGameFinished ? (
                    <span>Игра завершена</span>
                ) : isInCheck && isMyTurn ? (
                    <span style={{ color: '#ef4444' }}>⚠️ ШАХ! Ваш ход</span>
                ) : isOpponentInCheck && !isMyTurn ? (
                    <span style={{ color: '#ef4444' }}>⚠️ ШАХ противнику! Ход противника</span>
                ) : isMyTurn ? (
                    <span>🟢 Ваш ход</span>
                ) : (
                    <span>🟡 Ход противника</span>
                )}
            </div>

            {/* Модальное окно превращения пешки */}
            {promotionMove && (
                <div className={styles.promotionModal}>
                    <div className={styles.promotionContent}>
                        <div className={styles.promotionTitle}>
                            Выберите фигуру для превращения:
                        </div>
                        <div className={styles.promotionOptions}>
                            <div
                                className={styles.promotionOption}
                                onClick={() => handlePromotion('queen')}
                                title="Ферзь"
                            >
                                <div className={styles.promotionPiece}>
                                    {myColor === 'white' ? '♕' : '♛'}
                                </div>
                                <div className={styles.promotionLabel}>Ферзь</div>
                            </div>
                            <div
                                className={styles.promotionOption}
                                onClick={() => handlePromotion('rook')}
                                title="Ладья"
                            >
                                <div className={styles.promotionPiece}>
                                    {myColor === 'white' ? '♖' : '♜'}
                                </div>
                                <div className={styles.promotionLabel}>Ладья</div>
                            </div>
                            <div
                                className={styles.promotionOption}
                                onClick={() => handlePromotion('bishop')}
                                title="Слон"
                            >
                                <div className={styles.promotionPiece}>
                                    {myColor === 'white' ? '♗' : '♝'}
                                </div>
                                <div className={styles.promotionLabel}>Слон</div>
                            </div>
                            <div
                                className={styles.promotionOption}
                                onClick={() => handlePromotion('knight')}
                                title="Конь"
                            >
                                <div className={styles.promotionPiece}>
                                    {myColor === 'white' ? '♘' : '♞'}
                                </div>
                                <div className={styles.promotionLabel}>Конь</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Перетаскиваемая фигура */}
            {draggedPiece && (
                <div
                    className={`${styles.dragPreview} ${draggedPiece.piece.color === 'black' ? styles.blackPiece : styles.whitePiece}`}
                    style={{
                        left: draggedPiece.mousePos.x,
                        top: draggedPiece.mousePos.y
                    }}
                >
                    {PIECE_SYMBOLS[draggedPiece.piece.color][draggedPiece.piece.type]}
                </div>
            )}
        </div>
    );
};

export default ChessBoard;