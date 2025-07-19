import React from 'react';
import { Chessboard } from 'react-chessboard';

// Тип для хода, который мы отправляем на сервер
type ChessMove = {
    from: string;
    to: string;
    promotion?: string;
};

// Пропсы компонента
interface ChessBoardProps {
    gameState: { fen: string };
    onMove: (move: ChessMove) => void;
    isMyTurn: boolean; // Мы по-прежнему получаем этот флаг, чтобы включать/выключать возможность перетаскивания
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ gameState, onMove, isMyTurn, isGameFinished, myPlayerIndex }) => {

    function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
        // --- НОВАЯ, МАКСИМАЛЬНО ПРОСТАЯ ЛОГИКА ---

        // 1. Создаем объект хода
        const move: ChessMove = {
            from: sourceSquare,
            to: targetSquare,
        };

        // 2. Проверяем, является ли ход превращением пешки
        if (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') {
            move.promotion = 'q';
        }
        if (piece === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1') {
            move.promotion = 'q';
        }

        // 3. ОТПРАВЛЯЕМ ХОД НА СЕРВЕР В ЛЮБОМ СЛУЧАЕ.
        // Сервер сам разберется, можно ходить или нет.
        onMove(move);

        // 4. Говорим доске, что ход визуально можно совершить.
        // Если сервер отклонит ход, он пришлет `gameUpdate` со старым состоянием,
        // и доска автоматически вернется в правильное положение.
        return true;
    }

    return (
        <div style={{ width: '560px', margin: '20px auto' }}>
            <Chessboard
            // @ts-ignore
                position={gameState.fen}
                onPieceDrop={onPieceDrop}
                boardOrientation={myPlayerIndex === 0 ? 'white' : 'black'}
                // Флаг isMyTurn теперь используется только для того, чтобы разрешить или запретить перетаскивание фигур
                arePiecesDraggable={!isGameFinished && isMyTurn}
            />
        </div>
    );
};

export default ChessBoard;