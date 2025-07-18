import { Server, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from './models/User.model';
import GameRecord from './models/GameRecord.model';
import Transaction from './models/Transaction.model';
import { IGameLogic, GameState, GameMove } from './games/game.logic.interface';
import { ticTacToeLogic } from './games/tic-tac-toe.logic';

// ==================================
// Типы данных
// ==================================
interface Player {
    socketId: string;
    user: Pick<IUser, '_id' | 'username' | 'avatar' | 'balance'>;
}

export interface Room {
    id: string;
    gameType: 'tic-tac-toe' | 'checkers' | 'chess' | 'backgammon';
    bet: number;
    players: Player[];
    gameState: GameState;
    botJoinTimer?: NodeJS.Timeout;
    disconnectTimer?: NodeJS.Timeout;
}

// ==================================
// Хранилище в памяти и константы
// ==================================
const rooms: Record<string, Room> = {};
const userSocketMap: Record<string, string> = {};

const gameLogics: Record<Room['gameType'], IGameLogic> = {
    'tic-tac-toe': ticTacToeLogic,
    'checkers': {} as IGameLogic,
    'chess': {} as IGameLogic,
    'backgammon': {} as IGameLogic,
};

const BOT_WAIT_TIME = 15000;
const botUsernames = ["Shadow", "Vortex", "Raptor", "Ghost", "Cipher", "Blaze"];

// ==================================
// Вспомогательные функции
// ==================================

/** Проверяет, является ли игрок ботом */
function isBot(player: Player): boolean {
    if (!player || !player.user || !player.user._id) return false;
    return player.user._id.toString().startsWith('bot-');
}

/** Отправляет обновленный список комнат всем в лобби */
function broadcastLobbyState(io: Server, gameType: Room['gameType']) {
    const availableRooms = Object.values(rooms)
        .filter(room => room.gameType === gameType && room.players.length < 2)
        .map(r => ({ id: r.id, bet: r.bet, host: r.players[0] }));
    
    io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);
}

/** Возвращает "чистое" состояние комнаты для отправки клиенту, убирая серверные объекты */
function getPublicRoomState(room: Room) {
    const { botJoinTimer, disconnectTimer, ...publicState } = room;
    return publicState;
}

/** Конвертирует gameType (например, 'tic-tac-toe') в gameName (например, 'Tic-Tac-Toe') */
function formatGameNameForDB(gameType: string): 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe' {
    switch (gameType) {
        case 'tic-tac-toe': return 'Tic-Tac-Toe';
        case 'checkers': return 'Checkers';
        case 'chess': return 'Chess';
        case 'backgammon': return 'Backgammon';
        default: return 'Tic-Tac-Toe'; // Фоллбэк на всякий случай
    }
}

/** Централизованная функция для завершения игры */
async function endGame(io: Server, room: Room, winnerId?: string, isDraw: boolean = false) {
    if (!room) return;
    if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
    if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
    // @ts-ignore
    const winner = room.players.find(p => p.user._id.toString() === winnerId);
    // @ts-ignore
    const loser = room.players.find(p => p.user._id.toString() !== winnerId);

      // ИСПРАВЛЕНИЕ: Используем отформатированное имя игры для записи в БД
    const gameNameForDB = formatGameNameForDB(room.gameType);

     if (isDraw) {
        for (const player of room.players) {
            if (!isBot(player)) {
                await GameRecord.create({ user: player.user._id, gameName: gameNameForDB, status: 'DRAW', amountChanged: 0, opponent: room.players.find(p => p.user._id !== player.user._id)?.user.username || 'Bot' });
            }
        }
        io.to(room.id).emit('gameEnd', { winner: null, isDraw: true });
    } else if (winner && loser) {
        if (!isBot(winner)) {
            await User.findByIdAndUpdate(winner.user._id, { $inc: { balance: room.bet } });
            await GameRecord.create({ user: winner.user._id, gameName: gameNameForDB, status: 'WON', amountChanged: room.bet, opponent: loser.user.username });
            await Transaction.create({ user: winner.user._id, type: 'WAGER_WIN', amount: room.bet });
        }
        if (!isBot(loser)) {
            await User.findByIdAndUpdate(loser.user._id, { $inc: { balance: -room.bet } });
            await GameRecord.create({ user: loser.user._id, gameName: gameNameForDB, status: 'LOST', amountChanged: -room.bet, opponent: winner.user.username });
            await Transaction.create({ user: loser.user._id, type: 'WAGER_LOSS', amount: room.bet });
        }
        // УБИРАЕМ отправку authUpdate. Клиент сам запросит данные.
        io.to(room.id).emit('gameEnd', { winner, isDraw: false });
    }
    
    const gameType = room.gameType;
    delete rooms[room.id];
    broadcastLobbyState(io, gameType);
}

// ==================================
// Основная функция инициализации
// ==================================
export default function initializeSocket(io: Server) {

    io.use(async (socket: Socket, next: (err?: Error) => void) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication error'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            const user = await User.findById(decoded.id).select('username avatar balance').lean();
            if (!user) return next(new Error('User not found'));
            (socket as any).user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const initialUser = (socket as any).user as IUser;
        // @ts-ignore
        userSocketMap[initialUser._id.toString()] = socket.id;

        // --- Полная логика переподключения ---
        // Ищем комнату, где игрок числится, и которая ожидает переподключения
        const previousRoom = Object.values(rooms).find(r => 
            // @ts-ignore
            r.disconnectTimer && r.players.some(p => p.user._id.toString() === initialUser._id.toString())
        );

        if (previousRoom) {
            console.log(`[+] Player ${initialUser.username} reconnected to room ${previousRoom.id}`);
            
            // Отменяем таймер, который привел бы к поражению
            clearTimeout(previousRoom.disconnectTimer);
            previousRoom.disconnectTimer = undefined;

            // Находим игрока в комнате и обновляем его ID сокета на новый
            // @ts-ignore
            const playerInRoom = previousRoom.players.find(p => p.user._id.toString() === initialUser._id.toString())!;
            playerInRoom.socketId = socket.id;
            
            // Подключаем новый сокет к каналу комнаты
            socket.join(previousRoom.id);

            // Оповещаем всех в комнате, что игрок вернулся
            io.to(previousRoom.id).emit('playerReconnected', { message: `Игрок ${initialUser.username} вернулся в игру!` });
            
            // Отправляем актуальное состояние игры, чтобы синхронизировать интерфейс
            io.to(previousRoom.id).emit('gameUpdate', getPublicRoomState(previousRoom));
        }

        // --- Обработчики событий от клиента ---

        socket.on('joinLobby', (gameType: Room['gameType']) => {
            socket.join(`lobby-${gameType}`);
            broadcastLobbyState(io, gameType);
        });

        socket.on('leaveLobby', (gameType: Room['gameType']) => {
            socket.leave(`lobby-${gameType}`);
        });

        socket.on('createRoom', async ({ gameType, bet }: { gameType: Room['gameType'], bet: number }) => {
            const gameLogic = gameLogics[gameType];
            if (!gameLogic || !gameLogic.createInitialState) return socket.emit('error', { message: "Игра недоступна." });
            
            const currentUser = await User.findById(initialUser._id);
            if (!currentUser) return socket.emit('error', { message: "Пользователь не найден." });
            if (currentUser.balance < bet) return socket.emit('error', { message: 'Недостаточно средств.' });

            const roomId = `room-${socket.id}`;
            const players: Player[] = [{ socketId: socket.id, user: currentUser }];
            const newRoom: Room = { id: roomId, gameType, bet, players, gameState: gameLogic.createInitialState(players) };
            rooms[roomId] = newRoom;
            socket.join(roomId);

            socket.emit('gameStart', getPublicRoomState(newRoom));
            broadcastLobbyState(io, gameType);

            newRoom.botJoinTimer = setTimeout(() => {
                const room = rooms[roomId];
                if (room && room.players.length === 1) {
                    const botUser: Player['user'] = { _id: `bot-${Date.now()}` as any, username: botUsernames[Math.floor(Math.random() * botUsernames.length)], avatar: 'bot_avatar.png', balance: 9999 };
                    room.players.push({ socketId: 'bot_socket_id', user: botUser });
                    room.gameState = gameLogic.createInitialState(room.players);
                    io.to(roomId).emit('gameStart', getPublicRoomState(room));
                }
            }, BOT_WAIT_TIME);
        });
        
        socket.on('joinRoom', async (roomId: string) => {
            const currentUser = await User.findById(initialUser._id);
            const room = rooms[roomId];
            if (!currentUser || !room || room.players.length >= 2) return socket.emit('error', { message: 'Невозможно присоединиться.' });
            if (currentUser.balance < room.bet) return socket.emit('error', { message: 'Недостаточно средств.' });
            if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
            
            room.players.push({ socketId: socket.id, user: currentUser });
            socket.join(roomId);
            
            const gameLogic = gameLogics[room.gameType];
            room.gameState = gameLogic.createInitialState(room.players);

            io.to(roomId).emit('gameStart', getPublicRoomState(room));
            broadcastLobbyState(io, room.gameType);
        });

        socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
            const room = rooms[roomId];
            if (!room || room.players.length < 2) return;
            
            const gameLogic = gameLogics[room.gameType];
            // @ts-ignore
            const currentPlayerId = initialUser._id.toString();
            if (room.gameState.turn !== currentPlayerId) return;
            
            const { newState, error } = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            if (error) return socket.emit('error', { message: error });
            // @ts-ignore
            const nextPlayer = room.players.find(p => p.user._id.toString() !== currentPlayerId)!;
            // @ts-ignore
            newState.turn = nextPlayer.user._id.toString();
            room.gameState = newState;

            const gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
            if (gameResult.isGameOver) return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
            
            io.to(roomId).emit('gameUpdate', getPublicRoomState(room));

            if (isBot(nextPlayer)) {
                setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (!currentRoom) return;
                    const botMove = gameLogic.makeBotMove(currentRoom.gameState);
                    // @ts-ignore
                    const { newState: botState, error: botError } = gameLogic.processMove(currentRoom.gameState, botMove, nextPlayer.user._id.toString(), currentRoom.players);
                    if (botError) return;

                    const humanPlayer = currentRoom.players.find(p => !isBot(p))!;
                    // @ts-ignore
                    botState.turn = humanPlayer.user._id.toString();
                    currentRoom.gameState = botState;

                    const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players);
                    if (botGameResult.isGameOver) {
                        endGame(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
                    } else {
                        io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                    }
                }, 1500);
            }
        });

        socket.on('leaveGame', (roomId: string) => {
            const room = rooms[roomId];
            if (!room) return;
            
            const winningPlayer = room.players.find(p => p.socketId !== socket.id);
            if (winningPlayer) {
                // @ts-ignore
                endGame(io, room, winningPlayer.user._id.toString());
            } else {
                if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
                delete rooms[roomId];
                broadcastLobbyState(io, room.gameType);
            }
        });

        socket.on('getGameState', (roomId: string) => {
            const room = rooms[roomId];
            if (room && room.players.some(p => p.socketId === socket.id)) {
                socket.emit('gameUpdate', getPublicRoomState(room));
            }
        });
        
        socket.on('disconnect', () => {
            console.log(`[-] User disconnected: ${initialUser.username}`);
            // @ts-ignore
            delete userSocketMap[initialUser._id.toString()];

            const roomId = Object.keys(rooms).find(id => rooms[id].players.some(p => p.socketId === socket.id));
            if (!roomId) return;

            const room = rooms[roomId];
            if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
            
            const remainingPlayer = room.players.find(p => p.socketId !== socket.id);

            if (room.players.length < 2 || !remainingPlayer) {
                delete rooms[roomId];
                broadcastLobbyState(io, room.gameType);
            } else {
                io.to(remainingPlayer.socketId).emit('opponentDisconnected', { message: `Противник отключился. Ожидание переподключения (60 сек)...` });
                room.disconnectTimer = setTimeout(() => {
                    // @ts-ignore
                    endGame(io, room, remainingPlayer.user._id.toString());
                }, 60000);
            }
        });
    });
}