import React from 'react';

interface TicTacToeBoardProps {
    board: ('X' | 'O' | null)[];
    onMove: (index: number) => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
}

const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({ board, onMove, isMyTurn, isGameFinished }) => {
    const handleCellClick = (index: number) => {
        // Запрещаем ход, если не наш ход, игра окончена или клетка занята
        if (!isMyTurn || isGameFinished || board[index]) {
            return;
        }
        onMove(index);
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 100px)',
            gap: '5px',
            justifyContent: 'center',
            margin: '20px auto'
        }}>
            {board.map((cell, index) => (
                <button 
                    key={index} 
                    onClick={() => handleCellClick(index)} 
                    style={{
                        width: '100px',
                        height: '100px',
                        fontSize: '3rem',
                        fontWeight: 'bold',
                        cursor: isMyTurn && !cell && !isGameFinished ? 'pointer' : 'not-allowed',
                        color: cell === 'X' ? '#6495ED' : '#FF6347' // Синий для X, красный для O
                    }}
                    disabled={!isMyTurn || isGameFinished || !!cell}
                >
                    {cell}
                </button>
            ))}
        </div>
    );
};

export default TicTacToeBoard;