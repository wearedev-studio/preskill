import mongoose, { Document, Schema, Types } from 'mongoose';

// Интерфейс для одного матча в сетке
interface IMatch {
    matchId: number;
    players: (Types.ObjectId | { isBot: boolean; username: string; _id: string })[];
    winner?: Types.ObjectId | { isBot: boolean; username: string; _id: string };
    roomId?: string; // ID временной игровой комнаты
}

// Интерфейс для раунда
interface IRound {
    roundName: string; // e.g., 'Quarter-finals'
    matches: IMatch[];
}

// Интерфейс для документа турнира
export interface ITournament extends Document {
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon';
    name: string;
    status: 'REGISTERING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    entryFee: number;
    prizePool: number;
    maxPlayers: number;
    players: Types.ObjectId[];
    startTime: Date;
    bracket: IRound[];
}

const matchSchema = new Schema({
    matchId: { type: Number, required: true },
    players: { type: Array, default: [] },
    winner: { type: Object },
    roomId: { type: String },
}, { _id: false });

const roundSchema = new Schema({
    roundName: { type: String, required: true },
    matches: [matchSchema],
}, { _id: false });

const tournamentSchema = new Schema<ITournament>({
    gameType: {
        type: String,
        required: true,
        enum: ['tic-tac-toe', 'checkers', 'chess', 'backgammon'],
    },
    name: { type: String, required: true },
    status: {
        type: String,
        required: true,
        enum: ['REGISTERING', 'ACTIVE', 'FINISHED', 'CANCELLED'],
        default: 'REGISTERING',
    },
    entryFee: { type: Number, required: true, default: 0 },
    prizePool: { type: Number, default: 0 }, // Новое поле
    maxPlayers: {
        type: Number,
        required: true,
        enum: [4, 8, 16, 32], // Только степени двойки для олимпийской системы
        default: 8,
    },
    players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    startTime: { type: Date, required: true },
    bracket: [roundSchema],
}, {
    timestamps: true,
});

const Tournament = mongoose.model<ITournament>('Tournament', tournamentSchema);

export default Tournament;