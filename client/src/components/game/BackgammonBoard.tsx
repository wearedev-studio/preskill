
import React, { useState, useMemo } from 'react';

// === Типы (остаются без изменений) ===
type Point = [playerIndex: 0 | 1, count: number] | null;
type BackgammonGameState = {
    points: Point[];
    dice: number[];
    turnPhase: 'ROLLING' | 'MOVING';
    borneOff: [number, number];
};
type BackgammonMove = { from: number; to: number };

// === Пропсы компонента (остаются без изменений) ===
interface BackgammonBoardProps {
    gameState: BackgammonGameState;
    onMove: (move: BackgammonMove) => void;
    onRollDice: () => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1;
}

// === Логика для подсветки ходов ===
function getPossibleMovesForPoint(from: number, gameState: BackgammonGameState, playerIndex: 0 | 1): number[] {
    const { points, dice } = gameState;
    const moveDirection = playerIndex === 0 ? -1 : 1;
    const barIndex = playerIndex === 0 ? 25 : 0;
    const possibleTos: number[] = [];

    if ((points[barIndex]?.[1] ?? 0) > 0) {
        if (from !== barIndex) return [];
        for (const die of dice) {
            const to = playerIndex === 0 ? 25 - die : die;
            const targetPoint = points[to];
            if (!targetPoint || targetPoint[0] === playerIndex || targetPoint[1] <= 1) {
                possibleTos.push(to);
            }
        }
        return possibleTos;
    }

    for (const die of dice) {
        const to = from + (die * moveDirection);
        if (to < 1 || to > 24) {
             possibleTos.push(playerIndex === 0 ? 0 : 25);
        } else {
            const targetPoint = points[to];
            if (!targetPoint || targetPoint[0] === playerIndex || targetPoint[1] <= 1) {
                possibleTos.push(to);
            }
        }
    }
    return possibleTos;
}


const BackgammonBoard: React.FC<BackgammonBoardProps> = ({ gameState, onMove, onRollDice, isMyTurn, isGameFinished, myPlayerIndex }) => {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

    // Вычисляем возможные ходы для подсветки
    const possibleMoves = useMemo(() => {
        if (selectedPoint === null || !isMyTurn) return new Set<number>();
        const moves = getPossibleMovesForPoint(selectedPoint, gameState, myPlayerIndex);
        return new Set(moves);
    }, [selectedPoint, gameState, isMyTurn, myPlayerIndex]);

    const handlePointClick = (index: number) => {
        if (!isMyTurn || isGameFinished || gameState.turnPhase !== 'MOVING') return;

        if (selectedPoint !== null) {
            if (possibleMoves.has(index) || (index === 0 && possibleMoves.has(0)) || (index === 25 && possibleMoves.has(25))) {
                onMove({ from: selectedPoint, to: index });
            }
            setSelectedPoint(null);
        } else {
            const barIndex = myPlayerIndex === 0 ? 25 : 0;
            const point = gameState.points[index];
            
            // ИСПРАВЛЕНИЕ: Добавлены скобки вокруг (point?.[1] ?? 0)
            if (index === barIndex && (point?.[1] ?? 0) > 0) {
                setSelectedPoint(index);
            } else if (point && point[0] === myPlayerIndex) {
                setSelectedPoint(index);
            }
        }
    };

    const renderPoints = (indices: number[], reverseColumn: boolean = false) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {indices.map(i => (
                <div key={i} onClick={() => handlePointClick(i)} style={{ 
                    height: '50%', display: 'flex',
                    flexDirection: reverseColumn ? 'column-reverse' : 'column',
                    alignItems: 'center',
                    backgroundColor: possibleMoves.has(i) ? '#00bfa5' : 'transparent', // Подсветка
                    cursor: 'pointer',
                }}>
                    {/* Визуализация треугольников */}
                    <div style={{
                        width: 0, height: 0,
                        borderLeft: '25px solid transparent',
                        borderRight: '25px solid transparent',
                        ...(reverseColumn 
                            ? { borderTop: `180px solid ${i % 2 === 0 ? '#c5a17e' : '#a17a57'}` }
                            : { borderBottom: `180px solid ${i % 2 === 0 ? '#c5a17e' : '#a17a57'}` })
                    }}/>
                     {/* Шашки на треугольнике */}
                     <div style={{ position: 'absolute', display: 'flex', flexDirection: reverseColumn ? 'column-reverse' : 'column', height: '180px' }}>
                        {gameState.points[i] && Array.from({ length: gameState.points[i]![1] }).map((_, j) => (
                           <div key={j} style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: gameState.points[i]![0] === 0 ? '#6f4e37' : '#f0d9b5', margin: '1px', border: '2px solid #3a2e21' }}/>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif' }}>
            {/* Панель управления */}
            <div style={{ margin: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                {isMyTurn && gameState.turnPhase === 'ROLLING' && !isGameFinished && (
                    <button onClick={onRollDice} style={{ padding: '10px 20px', fontSize: '1rem' }}>Бросить кости</button>
                )}
                {gameState.dice.length > 0 && (
                    <div>
                        <strong>Ваши кости:</strong>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            {gameState.dice.map((die, i) => (
                                <div key={i} style={{ width: '40px', height: '40px', border: '1px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem' }}>{die}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Игровая доска */}
            <div style={{ display: 'flex', backgroundColor: '#8B4513', padding: '15px', border: '5px solid #3a2e21' }}>
                {renderPoints([12, 11, 10, 9, 8, 7], false)}
                <div style={{ width: '15px' }} />
                {renderPoints([6, 5, 4, 3, 2, 1], false)}
                
                {/* Бар */}
                <div style={{ width: '60px', backgroundColor: '#5a3a22', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
                     {/* Шашки игрока 1 (белые) на баре */}
                     {gameState.points[0] && Array.from({ length: gameState.points[0]![1] }).map((_, j) => (
                        <div key={j} style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#f0d9b5', border: '2px solid #3a2e21' }}/>
                    ))}
                     {/* Шашки игрока 0 (черные) на баре */}
                     {gameState.points[25] && Array.from({ length: gameState.points[25]![1] }).map((_, j) => (
                        <div key={j} style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#6f4e37', border: '2px solid #3a2e21' }}/>
                    ))}
                </div>
                
                {renderPoints([13, 14, 15, 16, 17, 18], true)}
                <div style={{ width: '15px' }} />
                {renderPoints([19, 20, 21, 22, 23, 24], true)}
            </div>
        </div>
    );
};

export default BackgammonBoard;