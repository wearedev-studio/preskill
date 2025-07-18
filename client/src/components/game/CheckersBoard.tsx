import React, { useState } from 'react';

// Типы, описывающие состояние игры в шашки, приходящее с сервера
type Piece = {
    playerIndex: 0 | 1;
    isKing: boolean;
};
type CheckersGameState = {
    board: (Piece | null)[];
};
type CheckersMove = {
    from: number;
    to: number;
};

// Пропсы компонента
interface CheckersBoardProps {
    gameState: CheckersGameState;
    onMove: (move: CheckersMove) => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1; // Индекс текущего игрока (0 или 1)
}

const CheckersBoard: React.FC<CheckersBoardProps> = ({ gameState, onMove, isMyTurn, isGameFinished, myPlayerIndex }) => {
    const [selectedPiece, setSelectedPiece] = useState<number | null>(null);

    const handleSquareClick = (index: number) => {
        // Запрещаем любые действия, если не наш ход или игра окончена
        if (!isMyTurn || isGameFinished) return;

        const piece = gameState.board[index];

        if (selectedPiece !== null) {
            // Второй клик - попытка сделать ход
            // TODO: В будущем здесь можно добавить клиентскую валидацию хода для подсветки
            onMove({ from: selectedPiece, to: index });
            setSelectedPiece(null); // Сбрасываем выбор после любого хода
        } else if (piece && piece.playerIndex === myPlayerIndex) {
            // Первый клик - выбор своей шашки
            setSelectedPiece(index);
        }
    };

    // Стили для доски и фигур
    const boardStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 60px)',
        gridTemplateRows: 'repeat(8, 60px)',
        width: '480px',
        height: '480px',
        border: '2px solid #5a3a22',
        margin: '20px auto',
    };

    const getSquareStyle = (index: number): React.CSSProperties => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const isDark = (row + col) % 2 !== 0;
        return {
            backgroundColor: isDark ? '#8B4513' : '#F0D9B5',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            border: index === selectedPiece ? '3px solid #64ffda' : 'none', // Подсветка выбранной шашки
        };
    };

    const pieceStyle: React.CSSProperties = {
        width: '80%',
        height: '80%',
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 'bold',
    };

    return (
        <div style={boardStyle}>
            {gameState.board.map((piece, index) => (
                <div key={index} style={getSquareStyle(index)} onClick={() => handleSquareClick(index)}>
                    {piece && (
                        <div style={{
                            ...pieceStyle,
                            backgroundColor: piece.playerIndex === 0 ? '#1e1e1e' : '#e0e0e0', // Черные и белые
                            color: piece.playerIndex === 0 ? 'white' : 'black',
                        }}>
                            {piece.isKing && '👑'}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CheckersBoard;