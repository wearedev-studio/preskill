// Полностью собственная реализация шахмат с нуля
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

export interface ChessPiece {
    type: PieceType;
    color: PieceColor;
    hasMoved?: boolean; // Для рокировки и первого хода пешки
}

export type ChessBoard = (ChessPiece | null)[][];

export interface Position {
    row: number;
    col: number;
}

export interface ChessMove {
    from: Position;
    to: Position;
    piece: ChessPiece;
    capturedPiece?: ChessPiece;
    isEnPassant?: boolean;
    isCastling?: boolean;
    promotion?: PieceType;
}

export class ChessEngine {
    private board: ChessBoard;
    private currentPlayer: PieceColor;
    private moveHistory: ChessMove[];
    private enPassantTarget: Position | null;
    private whiteKingMoved: boolean;
    private blackKingMoved: boolean;
    private whiteRookKingsideMoved: boolean;
    private whiteRookQueensideMoved: boolean;
    private blackRookKingsideMoved: boolean;
    private blackRookQueensideMoved: boolean;

    constructor() {
        this.board = this.createInitialBoard();
        this.currentPlayer = 'white';
        this.moveHistory = [];
        this.enPassantTarget = null;
        this.whiteKingMoved = false;
        this.blackKingMoved = false;
        this.whiteRookKingsideMoved = false;
        this.whiteRookQueensideMoved = false;
        this.blackRookKingsideMoved = false;
        this.blackRookQueensideMoved = false;
    }

    private createInitialBoard(): ChessBoard {
        const board: ChessBoard = Array(8).fill(null).map(() => Array(8).fill(null));

        // Белые фигуры (снизу)
        board[7] = [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ];
        
        for (let col = 0; col < 8; col++) {
            board[6][col] = { type: 'pawn', color: 'white' };
        }

        // Черные фигуры (сверху)
        board[0] = [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ];
        
        for (let col = 0; col < 8; col++) {
            board[1][col] = { type: 'pawn', color: 'black' };
        }

        return board;
    }

    public getBoard(): ChessBoard {
        return this.board.map(row => [...row]);
    }

    public getCurrentPlayer(): PieceColor {
        return this.currentPlayer;
    }

    public getMoveHistory(): ChessMove[] {
        return [...this.moveHistory];
    }

    // Проверка, находится ли позиция в пределах доски
    private isValidPosition(pos: Position): boolean {
        return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
    }

    // Получить фигуру на позиции
    private getPiece(pos: Position): ChessPiece | null {
        if (!this.isValidPosition(pos)) return null;
        return this.board[pos.row][pos.col];
    }

    // Установить фигуру на позицию
    private setPiece(pos: Position, piece: ChessPiece | null): void {
        if (this.isValidPosition(pos)) {
            this.board[pos.row][pos.col] = piece;
        }
    }

    // Проверка возможных ходов для пешки
    private getPawnMoves(from: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Ход вперед на одну клетку
        const oneStep = { row: from.row + direction, col: from.col };
        if (this.isValidPosition(oneStep) && !this.getPiece(oneStep)) {
            moves.push(oneStep);

            // Ход вперед на две клетки с начальной позиции
            if (from.row === startRow) {
                const twoStep = { row: from.row + 2 * direction, col: from.col };
                if (this.isValidPosition(twoStep) && !this.getPiece(twoStep)) {
                    moves.push(twoStep);
                }
            }
        }

        // Взятие по диагонали
        const captureLeft = { row: from.row + direction, col: from.col - 1 };
        const captureRight = { row: from.row + direction, col: from.col + 1 };

        if (this.isValidPosition(captureLeft)) {
            const leftPiece = this.getPiece(captureLeft);
            if (leftPiece && leftPiece.color !== piece.color) {
                moves.push(captureLeft);
            }
        }

        if (this.isValidPosition(captureRight)) {
            const rightPiece = this.getPiece(captureRight);
            if (rightPiece && rightPiece.color !== piece.color) {
                moves.push(captureRight);
            }
        }

        // En passant
        if (this.enPassantTarget) {
            if ((captureLeft.row === this.enPassantTarget.row && captureLeft.col === this.enPassantTarget.col) ||
                (captureRight.row === this.enPassantTarget.row && captureRight.col === this.enPassantTarget.col)) {
                moves.push(this.enPassantTarget);
            }
        }

        return moves;
    }

    // Проверка возможных ходов для ладьи
    private getRookMoves(from: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const directions = [
            { row: 0, col: 1 },   // вправо
            { row: 0, col: -1 },  // влево
            { row: 1, col: 0 },   // вниз
            { row: -1, col: 0 }   // вверх
        ];

        for (const dir of directions) {
            for (let i = 1; i < 8; i++) {
                const newPos = { row: from.row + dir.row * i, col: from.col + dir.col * i };
                
                if (!this.isValidPosition(newPos)) break;
                
                const targetPiece = this.getPiece(newPos);
                if (!targetPiece) {
                    moves.push(newPos);
                } else {
                    if (targetPiece.color !== piece.color) {
                        moves.push(newPos);
                    }
                    break;
                }
            }
        }

        return moves;
    }

    // Проверка возможных ходов для коня
    private getKnightMoves(from: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const knightMoves = [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 },
            { row: 2, col: -1 }, { row: 2, col: 1 }
        ];

        for (const move of knightMoves) {
            const newPos = { row: from.row + move.row, col: from.col + move.col };
            
            if (this.isValidPosition(newPos)) {
                const targetPiece = this.getPiece(newPos);
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push(newPos);
                }
            }
        }

        return moves;
    }

    // Проверка возможных ходов для слона
    private getBishopMoves(from: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const directions = [
            { row: 1, col: 1 },   // вниз-вправо
            { row: 1, col: -1 },  // вниз-влево
            { row: -1, col: 1 },  // вверх-вправо
            { row: -1, col: -1 }  // вверх-влево
        ];

        for (const dir of directions) {
            for (let i = 1; i < 8; i++) {
                const newPos = { row: from.row + dir.row * i, col: from.col + dir.col * i };
                
                if (!this.isValidPosition(newPos)) break;
                
                const targetPiece = this.getPiece(newPos);
                if (!targetPiece) {
                    moves.push(newPos);
                } else {
                    if (targetPiece.color !== piece.color) {
                        moves.push(newPos);
                    }
                    break;
                }
            }
        }

        return moves;
    }

    // Проверка возможных ходов для ферзя
    private getQueenMoves(from: Position, piece: ChessPiece): Position[] {
        return [
            ...this.getRookMoves(from, piece),
            ...this.getBishopMoves(from, piece)
        ];
    }

    // Проверка возможных ходов для короля
    private getKingMoves(from: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const directions = [
            { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
            { row: 0, col: -1 },                       { row: 0, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
        ];

        for (const dir of directions) {
            const newPos = { row: from.row + dir.row, col: from.col + dir.col };
            
            if (this.isValidPosition(newPos)) {
                const targetPiece = this.getPiece(newPos);
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push(newPos);
                }
            }
        }

        // Рокировка
        if (!this.isInCheck(piece.color)) {
            if (piece.color === 'white' && !this.whiteKingMoved) {
                // Короткая рокировка
                if (!this.whiteRookKingsideMoved && 
                    !this.getPiece({ row: 7, col: 5 }) && 
                    !this.getPiece({ row: 7, col: 6 })) {
                    moves.push({ row: 7, col: 6 });
                }
                // Длинная рокировка
                if (!this.whiteRookQueensideMoved && 
                    !this.getPiece({ row: 7, col: 1 }) && 
                    !this.getPiece({ row: 7, col: 2 }) && 
                    !this.getPiece({ row: 7, col: 3 })) {
                    moves.push({ row: 7, col: 2 });
                }
            } else if (piece.color === 'black' && !this.blackKingMoved) {
                // Короткая рокировка
                if (!this.blackRookKingsideMoved && 
                    !this.getPiece({ row: 0, col: 5 }) && 
                    !this.getPiece({ row: 0, col: 6 })) {
                    moves.push({ row: 0, col: 6 });
                }
                // Длинная рокировка
                if (!this.blackRookQueensideMoved && 
                    !this.getPiece({ row: 0, col: 1 }) && 
                    !this.getPiece({ row: 0, col: 2 }) && 
                    !this.getPiece({ row: 0, col: 3 })) {
                    moves.push({ row: 0, col: 2 });
                }
            }
        }

        return moves;
    }

    // Получить все возможные ходы для фигуры
    public getPossibleMoves(from: Position): Position[] {
        const piece = this.getPiece(from);
        if (!piece || piece.color !== this.currentPlayer) {
            return [];
        }

        let moves: Position[] = [];

        switch (piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(from, piece);
                break;
            case 'rook':
                moves = this.getRookMoves(from, piece);
                break;
            case 'knight':
                moves = this.getKnightMoves(from, piece);
                break;
            case 'bishop':
                moves = this.getBishopMoves(from, piece);
                break;
            case 'queen':
                moves = this.getQueenMoves(from, piece);
                break;
            case 'king':
                moves = this.getKingMoves(from, piece);
                break;
        }

        // Фильтруем ходы, которые ставят короля под шах
        return moves.filter(to => !this.wouldBeInCheckAfterMove(from, to));
    }

    // Найти короля определенного цвета
    private findKing(color: PieceColor): Position | null {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    // Проверка, находится ли король под шахом
    public isInCheck(color: PieceColor): boolean {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;

        const opponentColor = color === 'white' ? 'black' : 'white';

        // Проверяем, может ли любая фигура противника атаковать короля
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === opponentColor) {
                    const moves = this.getRawMoves({ row, col }, piece);
                    if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Получить "сырые" ходы без проверки шаха (для проверки атак)
    private getRawMoves(from: Position, piece: ChessPiece): Position[] {
        switch (piece.type) {
            case 'pawn':
                return this.getPawnMoves(from, piece);
            case 'rook':
                return this.getRookMoves(from, piece);
            case 'knight':
                return this.getKnightMoves(from, piece);
            case 'bishop':
                return this.getBishopMoves(from, piece);
            case 'queen':
                return this.getQueenMoves(from, piece);
            case 'king':
                // Для короля возвращаем только обычные ходы, без рокировки
                const moves: Position[] = [];
                const directions = [
                    { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
                    { row: 0, col: -1 },                       { row: 0, col: 1 },
                    { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
                ];

                for (const dir of directions) {
                    const newPos = { row: from.row + dir.row, col: from.col + dir.col };
                    if (this.isValidPosition(newPos)) {
                        const targetPiece = this.getPiece(newPos);
                        if (!targetPiece || targetPiece.color !== piece.color) {
                            moves.push(newPos);
                        }
                    }
                }
                return moves;
            default:
                return [];
        }
    }

    // Проверка, будет ли король под шахом после хода
    private wouldBeInCheckAfterMove(from: Position, to: Position): boolean {
        const piece = this.getPiece(from);
        if (!piece) return true;

        // Сохраняем текущее состояние
        const originalToPiece = this.getPiece(to);
        
        // Делаем временный ход
        this.setPiece(to, piece);
        this.setPiece(from, null);

        // Проверяем шах
        const inCheck = this.isInCheck(piece.color);

        // Восстанавливаем состояние
        this.setPiece(from, piece);
        this.setPiece(to, originalToPiece);

        return inCheck;
    }

    // Проверка мата
    public isCheckmate(color: PieceColor): boolean {
        if (!this.isInCheck(color)) return false;

        // Проверяем, есть ли хотя бы один легальный ход
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getPossibleMoves({ row, col });
                    if (moves.length > 0) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    // Проверка пата
    public isStalemate(color: PieceColor): boolean {
        if (this.isInCheck(color)) return false;

        // Проверяем, есть ли хотя бы один легальный ход
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getPossibleMoves({ row, col });
                    if (moves.length > 0) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    // Выполнить ход
    public makeMove(from: Position, to: Position, promotion?: PieceType): boolean {
        const piece = this.getPiece(from);
        if (!piece || piece.color !== this.currentPlayer) {
            return false;
        }

        const possibleMoves = this.getPossibleMoves(from);
        const isValidMove = possibleMoves.some(move => move.row === to.row && move.col === to.col);
        
        if (!isValidMove) {
            return false;
        }

        const capturedPiece = this.getPiece(to);
        const move: ChessMove = {
            from,
            to,
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : undefined
        };

        // Обработка специальных ходов
        
        // En passant
        if (piece.type === 'pawn' && this.enPassantTarget && 
            to.row === this.enPassantTarget.row && to.col === this.enPassantTarget.col) {
            move.isEnPassant = true;
            const capturedPawnRow = piece.color === 'white' ? to.row + 1 : to.row - 1;
            this.setPiece({ row: capturedPawnRow, col: to.col }, null);
        }

        // Рокировка
        if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
            move.isCastling = true;
            const isKingside = to.col > from.col;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? 5 : 3;
            const rookRow = from.row;
            
            const rook = this.getPiece({ row: rookRow, col: rookFromCol });
            if (rook) {
                this.setPiece({ row: rookRow, col: rookToCol }, rook);
                this.setPiece({ row: rookRow, col: rookFromCol }, null);
            }
        }

        // Превращение пешки
        if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
            move.promotion = promotion || 'queen';
            piece.type = move.promotion;
        }

        // Выполняем ход
        this.setPiece(to, piece);
        this.setPiece(from, null);

        // Обновляем флаги для рокировки
        if (piece.type === 'king') {
            if (piece.color === 'white') {
                this.whiteKingMoved = true;
            } else {
                this.blackKingMoved = true;
            }
        }

        if (piece.type === 'rook') {
            if (piece.color === 'white') {
                if (from.col === 0) this.whiteRookQueensideMoved = true;
                if (from.col === 7) this.whiteRookKingsideMoved = true;
            } else {
                if (from.col === 0) this.blackRookQueensideMoved = true;
                if (from.col === 7) this.blackRookKingsideMoved = true;
            }
        }

        // Обновляем en passant target
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
            this.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
        }

        // Добавляем ход в историю
        this.moveHistory.push(move);

        // Переключаем игрока
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

        return true;
    }

    // Проверка окончания игры
    public getGameStatus(): { isGameOver: boolean; winner?: PieceColor; isDraw: boolean } {
        const currentPlayerInCheck = this.isInCheck(this.currentPlayer);
        const currentPlayerInCheckmate = this.isCheckmate(this.currentPlayer);
        const currentPlayerInStalemate = this.isStalemate(this.currentPlayer);

        if (currentPlayerInCheckmate) {
            return {
                isGameOver: true,
                winner: this.currentPlayer === 'white' ? 'black' : 'white',
                isDraw: false
            };
        }

        if (currentPlayerInStalemate) {
            return {
                isGameOver: true,
                isDraw: true
            };
        }

        // Проверка на недостаток материала
        if (this.isInsufficientMaterial()) {
            return {
                isGameOver: true,
                isDraw: true
            };
        }

        return { isGameOver: false, isDraw: false };
    }

    // Проверка недостатка материала для мата
    private isInsufficientMaterial(): boolean {
        const pieces: ChessPiece[] = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    pieces.push(piece);
                }
            }
        }

        // Только короли
        if (pieces.length === 2) {
            return true;
        }

        // Король + слон или конь против короля
        if (pieces.length === 3) {
            const nonKingPieces = pieces.filter(p => p.type !== 'king');
            if (nonKingPieces.length === 1) {
                const piece = nonKingPieces[0];
                return piece.type === 'bishop' || piece.type === 'knight';
            }
        }

        return false;
    }

    // Получить нотацию хода
    public getMoveNotation(move: ChessMove): string {
        let notation = '';

        if (move.isCastling) {
            return move.to.col === 6 ? 'O-O' : 'O-O-O';
        }

        // Тип фигуры
        if (move.piece.type !== 'pawn') {
            notation += move.piece.type.charAt(0).toUpperCase();
        }

        // Взятие
        if (move.capturedPiece || move.isEnPassant) {
            if (move.piece.type === 'pawn') {
                notation += String.fromCharCode(97 + move.from.col);
            }
            notation += 'x';
        }

        // Целевая клетка
        notation += String.fromCharCode(97 + move.to.col) + (8 - move.to.row);

        // Превращение
        if (move.promotion) {
            notation += '=' + move.promotion.charAt(0).toUpperCase();
        }

        // En passant
        if (move.isEnPassant) {
            notation += ' e.p.';
        }

        return notation;
    }
}