import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IGameRecord extends Document {
    user: Types.ObjectId;
    gameName: 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe';
    status: 'WON' | 'LOST' | 'DRAW';
    amountChanged: number;
    opponent: string;
}

const gameRecordSchema = new Schema<IGameRecord>({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User', // Ссылка на модель пользователя
        index: true, // Индекс для ускорения поиска истории по пользователю
    },
    gameName: {
        type: String,
        required: true,
        enum: ['Checkers', 'Chess', 'Backgammon', 'Tic-Tac-Toe'],
    },
    status: {
        type: String,
        required: true,
        enum: ['WON', 'LOST', 'DRAW'],
    },
    amountChanged: {
        type: Number,
        required: true,
    },
    opponent: {
        type: String,
        required: true,
        default: 'Bot', // По умолчанию противник - бот
    },
}, {
    timestamps: true, // Добавляет поля createdAt и updatedAt
});

const GameRecord = mongoose.model<IGameRecord>('GameRecord', gameRecordSchema);

export default GameRecord;