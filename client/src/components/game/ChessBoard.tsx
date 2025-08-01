import React from 'react';
import { Chessboard } from 'react-chessboard';

// Тип для хода
type ChessMove = {
    from: string;
    to: string;
    promotion?: string;
};

// Пропсы компонента
interface ChessBoardProps {
    gameState: { fen: string };
    onMove: (move: ChessMove) => void;
    isMyTurn: boolean;
    isGameFinished: boolean;
    myPlayerIndex: 0 | 1;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ gameState, onMove, isMyTurn, isGameFinished, myPlayerIndex }) => {

    function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
        const move: ChessMove = {
            from: sourceSquare,
            to: targetSquare,
        };

        if (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') {
            move.promotion = 'q';
        }
        if (piece === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1') {
            move.promotion = 'q';
        }

        onMove(move);
        return true;
    }

    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Убираем фиксированную ширину и делаем контейнер гибким.
    // width: '100%' заставит его занимать всю доступную ширину родителя.
    // maxWidth: '560px' не даст ему стать слишком большим на десктопе.
    const boardWrapperStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '560px',
        margin: '20px auto',
    };

    return (
        <div style={boardWrapperStyle}>
            <Chessboard
                // @ts-ignore
                position={gameState.fen}
                onPieceDrop={onPieceDrop}
                boardOrientation={myPlayerIndex === 0 ? 'white' : 'black'}
                arePiecesDraggable={!isGameFinished && isMyTurn}
            />
        </div>
    );
};

export default ChessBoard;