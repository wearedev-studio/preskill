import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styles from './BackgammonBoard.module.css';

// Типы для нард
type PlayerColor = 'white' | 'black';

interface BackgammonPiece {
    color: PlayerColor;
}

interface Point {
    pieces: BackgammonPiece[];
}

interface DiceRoll {
    dice: [number, number];
    availableMoves: number[];
}

interface BackgammonGameState {
    board: Point[];
    bar: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    home: { white: BackgammonPiece[]; black: BackgammonPiece[] };
    currentPlayer: PlayerColor;
    diceRoll: DiceRoll | null;
    moveHistory: any[];
    turnPhase: 'ROLLING' | 'MOVING';
}

interface BackgammonMove {
    from: number;
    to: number;
    dieValue: number;
}

interface BackgammonBoardProps {
    gameState: BackgammonGameState;
    onMove: (move: BackgammonMove) => void;
    onRollDice: () => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1;
}

const BackgammonBoard: React.FC<BackgammonBoardProps> = ({
    gameState,
    onMove,
    onRollDice,
    isMyTurn,
    isGameFinished,
    myPlayerIndex
}) => {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<number[]>([]);
    const [isRollingDice, setIsRollingDice] = useState(false);
    const [movingPiece, setMovingPiece] = useState<{from: number, to: number} | null>(null);

    console.log('[BackgammonBoard] Render:', {
        isMyTurn,
        isGameFinished,
        myPlayerIndex,
        currentPlayer: gameState.currentPlayer,
        turnPhase: gameState.turnPhase,
        diceRoll: gameState.diceRoll
    });

    // Определяем цвет игрока
    const myColor: PlayerColor = myPlayerIndex === 0 ? 'white' : 'black';

    // Получаем возможные ходы для выбранной точки
    const getPossibleMovesForPoint = useCallback((from: number): number[] => {
        if (!gameState.diceRoll || !isMyTurn || gameState.turnPhase !== 'MOVING') {
            return [];
        }

        const moves: number[] = [];
        const direction = myColor === 'white' ? 1 : -1;

        // Ходы с бара
        if (from === -1) {
            if (gameState.bar[myColor].length === 0) return [];
            
            for (const dieValue of gameState.diceRoll.availableMoves) {
                const to = myColor === 'white' ? dieValue - 1 : 24 - dieValue;
                if (canPlacePieceOnPoint(to)) {
                    moves.push(to);
                }
            }
            return moves;
        }

        // Обычные ходы
        if (from < 0 || from >= 24) return [];
        if (gameState.board[from].pieces.length === 0) return [];
        if (gameState.board[from].pieces[gameState.board[from].pieces.length - 1].color !== myColor) return [];

        // Если есть фигуры на баре, можно ходить только с бара
        if (gameState.bar[myColor].length > 0) return [];

        for (const dieValue of gameState.diceRoll.availableMoves) {
            const to = from + (dieValue * direction);

            // Обычный ход
            if (to >= 0 && to < 24 && canPlacePieceOnPoint(to)) {
                moves.push(to);
            }

            // Вывод из дома
            if (areAllPiecesInHome() && 
                ((myColor === 'white' && to >= 24) || (myColor === 'black' && to < 0))) {
                moves.push(-2); // -2 означает вывод в дом
            }
        }

        return moves;
    }, [gameState, isMyTurn, myColor]);

    // Проверка, можно ли поставить фигуру на точку
    const canPlacePieceOnPoint = useCallback((pointIndex: number): boolean => {
        if (pointIndex < 0 || pointIndex >= 24) return false;
        
        const point = gameState.board[pointIndex];
        if (point.pieces.length === 0) return true;
        if (point.pieces[0].color === myColor) return true;
        if (point.pieces.length === 1) return true; // можно бить одиночную фигуру
        
        return false; // нельзя ходить на точку с 2+ фигурами противника
    }, [gameState.board, myColor]);

    // Проверка, все ли фигуры в доме
    const areAllPiecesInHome = useCallback((): boolean => {
        const homeRange = myColor === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
        
        // Проверяем, что на баре нет фигур
        if (gameState.bar[myColor].length > 0) return false;

        // Проверяем, что все фигуры в доме или уже выведены
        let piecesOnBoard = 0;
        for (let i = 0; i < 24; i++) {
            const piecesOfColor = gameState.board[i].pieces.filter(p => p.color === myColor).length;
            if (piecesOfColor > 0) {
                if (!homeRange.includes(i)) return false;
                piecesOnBoard += piecesOfColor;
            }
        }

        return piecesOnBoard + gameState.home[myColor].length === 15;
    }, [gameState, myColor]);

    // Обработка клика по точке
    const handlePointClick = useCallback((pointIndex: number) => {
        console.log('[BackgammonBoard] Point clicked:', pointIndex);
        
        if (!isMyTurn || isGameFinished || gameState.turnPhase !== 'MOVING') {
            console.log('[BackgammonBoard] Click ignored - not my turn or wrong phase');
            return;
        }

        // Если уже выбрана точка, пытаемся сделать ход
        if (selectedPoint !== null) {
            console.log('[BackgammonBoard] Attempting move from', selectedPoint, 'to', pointIndex);
            
            // Если кликнули на ту же точку, снимаем выделение
            if (selectedPoint === pointIndex) {
                console.log('[BackgammonBoard] Deselecting point');
                setSelectedPoint(null);
                setPossibleMoves([]);
                return;
            }

            // Проверяем, является ли ход возможным
            const isValidMove = possibleMoves.includes(pointIndex);

            if (isValidMove && gameState.diceRoll) {
                // Находим подходящую кость
                const direction = myColor === 'white' ? 1 : -1;
                let dieValue = 0;

                if (selectedPoint === -1) {
                    // Ход с бара
                    dieValue = myColor === 'white' ? pointIndex + 1 : 24 - pointIndex;
                } else if (pointIndex === -2) {
                    // Вывод из дома
                    const distance = myColor === 'white' ? 24 - selectedPoint : selectedPoint + 1;
                    dieValue = gameState.diceRoll.availableMoves.find(die => die >= distance) || 0;
                } else {
                    // Обычный ход
                    dieValue = (pointIndex - selectedPoint) * direction;
                }

                if (gameState.diceRoll.availableMoves.includes(dieValue)) {
                    const move: BackgammonMove = {
                        from: selectedPoint,
                        to: pointIndex,
                        dieValue
                    };

                    console.log('[BackgammonBoard] Sending move:', move);
                    handleMoveWithAnimation(move);
                } else {
                    console.log('[BackgammonBoard] Invalid die value:', dieValue);
                }
            } else {
                // Пытаемся выбрать новую точку
                selectPoint(pointIndex);
            }
            return;
        }

        // Выбираем точку для хода
        selectPoint(pointIndex);
    }, [isMyTurn, isGameFinished, selectedPoint, possibleMoves, gameState, myColor, onMove]);

    const selectPoint = useCallback((pointIndex: number) => {
        // Ход с бара
        if (pointIndex === -1) {
            if (gameState.bar[myColor].length === 0) return;
            console.log('[BackgammonBoard] Selecting bar');
            setSelectedPoint(-1);
            const moves = getPossibleMovesForPoint(-1);
            setPossibleMoves(moves);
            return;
        }

        // Обычная точка
        if (pointIndex < 0 || pointIndex >= 24) return;
        const point = gameState.board[pointIndex];
        if (point.pieces.length === 0) return;
        if (point.pieces[point.pieces.length - 1].color !== myColor) return;

        console.log('[BackgammonBoard] Selecting point', pointIndex);
        setSelectedPoint(pointIndex);
        const moves = getPossibleMovesForPoint(pointIndex);
        setPossibleMoves(moves);
    }, [gameState, myColor, getPossibleMovesForPoint]);

    // Обработка клика по зоне вывода
    const handleBearOffClick = useCallback(() => {
        if (selectedPoint !== null && possibleMoves.includes(-2)) {
            handlePointClick(-2);
        }
    }, [selectedPoint, possibleMoves, handlePointClick]);

    // Обработка броска костей с анимацией
    const handleRollDice = useCallback(() => {
        setIsRollingDice(true);
        onRollDice();
        
        // Анимация длится 1.5 секунды
        setTimeout(() => {
            setIsRollingDice(false);
        }, 1500);
    }, [onRollDice]);

    // Анимация движения фигуры
    const animateMove = useCallback((from: number, to: number) => {
        setMovingPiece({ from, to });
        setTimeout(() => {
            setMovingPiece(null);
        }, 500);
    }, []);

    // Обработка хода с анимацией
    const handleMoveWithAnimation = useCallback((move: BackgammonMove) => {
        animateMove(move.from, move.to);
        setTimeout(() => {
            onMove(move);
            setSelectedPoint(null);
            setPossibleMoves([]);
        }, 250);
    }, [onMove, animateMove]);

    // Рендер фигуры с анимациями
    const renderPiece = useCallback((piece: BackgammonPiece, index: number, pointIndex?: number) => {
        const isMoving = movingPiece && pointIndex !== undefined &&
            (pointIndex === movingPiece.from || pointIndex === movingPiece.to);
        
        const pieceClass = `${styles.piece} ${piece.color === 'white' ? styles.whitePiece : styles.blackPiece} ${
            isMoving ? styles.pieceMoving : ''
        }`;
        
        return (
            <div key={index} className={pieceClass} />
        );
    }, [movingPiece]);

    // Рендер точки
    const renderPoint = useCallback((pointIndex: number, isTop: boolean) => {
        const point = gameState.board[pointIndex];
        const isSelected = selectedPoint === pointIndex;
        const isPossibleMove = possibleMoves.includes(pointIndex);
        const isDark = pointIndex % 2 === 1;

        let pointClass = `${styles.point}`;
        if (isDark) pointClass += ` ${styles.darkPoint}`;
        else pointClass += ` ${styles.lightPoint}`;
        if (isSelected) pointClass += ` ${styles.selectedPoint}`;
        if (isPossibleMove) pointClass += ` ${styles.possibleMove}`;

        const triangleClass = `${styles.pointTriangle} ${isTop ? styles.topTriangle : styles.bottomTriangle}`;
        const piecesClass = `${styles.piecesContainer} ${isTop ? styles.topPiecesContainer : styles.bottomPiecesContainer}`;

        return (
            <div
                key={pointIndex}
                className={pointClass}
                onClick={() => handlePointClick(pointIndex)}
            >
                <div className={triangleClass} />
                <div className={piecesClass}>
                    {point.pieces.slice(0, 5).map((piece, index) => renderPiece(piece, index, pointIndex))}
                    {point.pieces.length > 5 && (
                        <div className={styles.pieceCount}>
                            {point.pieces.length}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [gameState.board, selectedPoint, possibleMoves, handlePointClick, renderPiece]);

    // Рендер костей с анимацией
    const renderDice = useCallback(() => {
        if (!gameState.diceRoll && !isRollingDice) return null;

        return (
            <div className={styles.diceContainer}>
                {isRollingDice ? (
                    // Показываем анимацию броска
                    <>
                        <div className={`${styles.die} ${styles.diceRolling}`}>
                            ?
                        </div>
                        <div className={`${styles.die} ${styles.diceRolling}`}>
                            ?
                        </div>
                    </>
                ) : gameState.diceRoll ? (
                    // Показываем результат броска
                    <>
                        {gameState.diceRoll.dice.map((die, index) => (
                            <div key={index} className={styles.die}>
                                {die}
                            </div>
                        ))}
                        {gameState.diceRoll.availableMoves.map((move, index) => (
                            <div key={`move-${index}`} className={`${styles.die} ${styles.usedDie}`}>
                                {move}
                            </div>
                        ))}
                    </>
                ) : null}
            </div>
        );
    }, [gameState.diceRoll, isRollingDice]);

    return (
        <div className={styles.backgammonBoard}>
            {/* Информация об игре */}
            <div className={styles.gameInfo}>
                <div className={styles.playerInfo}>
                    <div className={styles.playerName}>
                        {myPlayerIndex === 0 ? 'Вы' : 'Противник'}
                    </div>
                    <div className={styles.playerColor}>
                        Белые (ходят первыми)
                    </div>
                </div>

                <div className={styles.diceSection}>
                    {isMyTurn && gameState.turnPhase === 'ROLLING' && !isGameFinished && (
                        <button
                            onClick={handleRollDice}
                            className={styles.rollButton}
                            disabled={isRollingDice}
                        >
                            {isRollingDice ? 'Бросаем...' : 'Бросить кости'}
                        </button>
                    )}
                    {renderDice()}
                </div>

                <div className={styles.playerInfo}>
                    <div className={styles.playerName}>
                        {myPlayerIndex === 1 ? 'Вы' : 'Противник'}
                    </div>
                    <div className={styles.playerColor}>
                        Черные
                    </div>
                </div>
            </div>

            {/* Игровая доска */}
            <div className={styles.boardContainer}>
                {/* Номера точек */}
                <div className={styles.pointNumbers}>
                    {Array.from({ length: 24 }, (_, i) => {
                        const pointNum = i < 12 ? 12 - i : i + 1;
                        return (
                            <div key={i} className={styles.pointNumber}>
                                {pointNum}
                            </div>
                        );
                    })}
                </div>

                <div className={styles.boardGrid}>
                    {/* Верхняя секция */}
                    <div className={styles.topSection}>
                        {/* Левый квадрант (точки 12-7) */}
                        <div className={styles.leftQuadrant}>
                            {Array.from({ length: 6 }, (_, i) => renderPoint(12 - i - 1, true))}
                        </div>
                        
                        {/* Правый квадрант (точки 6-1) */}
                        <div className={styles.rightQuadrant}>
                            {Array.from({ length: 6 }, (_, i) => renderPoint(6 - i - 1, true))}
                        </div>
                    </div>

                    {/* Средняя полоса с баром */}
                    <div className={styles.middleBar}>
                        <span style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 'clamp(10px, 2vw, 14px)' }}>
                            БАР
                        </span>
                    </div>

                    {/* Нижняя секция */}
                    <div className={styles.bottomSection}>
                        {/* Левый квадрант (точки 13-18) */}
                        <div className={styles.leftQuadrant}>
                            {Array.from({ length: 6 }, (_, i) => renderPoint(12 + i, false))}
                        </div>
                        
                        {/* Правый квадрант (точки 19-24) */}
                        <div className={styles.rightQuadrant}>
                            {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, false))}
                        </div>
                    </div>
                </div>

                {/* Бар */}
                <div
                    className={styles.bar}
                    onClick={() => handlePointClick(-1)}
                >
                    <div className={styles.barPieces}>
                        {gameState.bar.white.map((piece, index) => renderPiece(piece, index, -1))}
                    </div>
                    <div className={styles.barPieces}>
                        {gameState.bar.black.map((piece, index) => renderPiece(piece, index, -1))}
                    </div>
                </div>

                {/* Зона вывода фигур */}
                <div
                    className={styles.bearOffZone}
                    onClick={handleBearOffClick}
                >
                    <div className={styles.bearOffLabel}>ВЫВОД</div>
                    <div className={styles.bearOffPieces}>
                        {gameState.home.white.map((piece, index) => renderPiece(piece, index, -2))}
                    </div>
                    <div className={styles.bearOffPieces}>
                        {gameState.home.black.map((piece, index) => renderPiece(piece, index, -2))}
                    </div>
                </div>
            </div>

            {/* Статус игры */}
            <div className={`${styles.gameStatus} ${
                isGameFinished ? styles.gameFinished : 
                isMyTurn ? styles.myTurn : styles.opponentTurn
            }`}>
                {isGameFinished ? (
                    <span>Игра завершена</span>
                ) : isMyTurn ? (
                    gameState.turnPhase === 'ROLLING' ? 
                        <span>🎲 Ваш ход - бросьте кости</span> :
                        <span>🟢 Ваш ход - делайте ходы</span>
                ) : (
                    <span>🟡 Ход противника</span>
                )}
            </div>

            {/* История ходов */}
            {gameState.moveHistory && gameState.moveHistory.length > 0 && (
                <div className={styles.moveHistory}>
                    <strong>История ходов:</strong> {gameState.moveHistory.length} ходов
                </div>
            )}
        </div>
    );
};

export default BackgammonBoard;