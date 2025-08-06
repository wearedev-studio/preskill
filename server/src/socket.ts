import { Server, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from './models/User.model';
import GameRecord from './models/GameRecord.model';
import Transaction from './models/Transaction.model';
import { IGameLogic, GameState, GameMove } from './games/game.logic.interface';
import { ticTacToeLogic } from './games/tic-tac-toe.logic';
import { checkersLogic } from './games/checkers.logic'; // 1. ИМПОРТИРУЕМ новую логику
import { chessLogic } from './games/chess.logic';
import { backgammonLogic, rollDiceForBackgammon } from './games/backgammon.logic';
import { advanceTournamentWinner } from './services/tournament.service';
import {
    joinTournamentRoom,
    processTournamentMove,
    tournamentPlayerSockets
} from './services/tournamentRoom.service';




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
export const rooms: Record<string, Room> = {};
export const userSocketMap: Record<string, string> = {};

export const gameLogics: Record<Room['gameType'], IGameLogic> = {
    'tic-tac-toe': ticTacToeLogic,
    'checkers': checkersLogic,
    'chess': chessLogic,
    'backgammon': backgammonLogic
};

const BOT_WAIT_TIME = 15000;
export const botUsernames = ["Shadow", "Vortex", "Raptor", "Ghost", "Cipher", "Blaze"];

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
        .map(r => ({ id: r.id, bet: r.bet, host: r.players.length > 0 
                ? r.players[0] 
                : { user: { username: 'Ожидание игрока' } } }));
    
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
    console.log(`[EndGame] Room: ${room.id}, Winner: ${winnerId}, Draw: ${isDraw}`);
    
    // Обработка турнирных игр теперь происходит в tournamentRoom.service.ts
    // Здесь обрабатываем только обычные лобби-игры

    // Обработка обычных игр
    if (!room) return;
    if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
    if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
    
    // @ts-ignore
    const winner = room.players.find(p => p.user._id.toString() === winnerId);
    // @ts-ignore
    const loser = room.players.find(p => p.user._id.toString() !== winnerId);

    const gameNameForDB = formatGameNameForDB(room.gameType);

    if (isDraw) {
        // Обработка ничьи
        for (const player of room.players) {
            if (!isBot(player)) {
                const opponent = room.players.find(p => p.user._id !== player.user._id);
                await GameRecord.create({
                    user: player.user._id,
                    gameName: gameNameForDB,
                    status: 'DRAW',
                    amountChanged: 0,
                    opponent: opponent?.user.username || 'Bot'
                });
            }
        }
        io.to(room.id).emit('gameEnd', { winner: null, isDraw: true });
    } else if (winner && loser) {
        // Обработка победы/поражения
        if (!isBot(winner)) {
            await User.findByIdAndUpdate(winner.user._id, { $inc: { balance: room.bet } });
            await GameRecord.create({
                user: winner.user._id,
                gameName: gameNameForDB,
                status: 'WON',
                amountChanged: room.bet,
                opponent: loser.user.username
            });
            await Transaction.create({
                user: winner.user._id,
                type: 'WAGER_WIN',
                amount: room.bet
            });
        }
        if (!isBot(loser)) {
            await User.findByIdAndUpdate(loser.user._id, { $inc: { balance: -room.bet } });
            await GameRecord.create({
                user: loser.user._id,
                gameName: gameNameForDB,
                status: 'LOST',
                amountChanged: -room.bet,
                opponent: winner.user.username
            });
            await Transaction.create({
                user: loser.user._id,
                type: 'WAGER_LOSS',
                amount: room.bet
            });
        }
        io.to(room.id).emit('gameEnd', { winner, isDraw: false });
    }
    
    const gameType = room.gameType;
    delete rooms[room.id];
    broadcastLobbyState(io, gameType);
}

// ==================================
// Основная функция инициализации
// ==================================
export const initializeSocket = (io: Server) => {

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

        // Новая логика подключения к турнирным играм
        socket.on('joinTournamentGame', async (matchId: string) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            const success = await joinTournamentRoom(io, socket, matchId, userId);
            
            if (success) {
                // Сохраняем связь игрока с сокетом для турниров
                tournamentPlayerSockets[userId] = socket.id;
            }
        });

        // Обработка ходов в турнирных играх
        socket.on('tournamentMove', async ({ matchId, move }: { matchId: string, move: any }) => {
            // @ts-ignore
            const userId = initialUser._id.toString();
            await processTournamentMove(io, socket, matchId, userId, move);
        });

        // --- ОБРАБОТЧИК ДЛЯ БРОСКА КОСТЕЙ В НАРДАХ ---
        socket.on('rollDice', (roomId: string) => {
            const room = rooms[roomId];
            const currentPlayerId = (socket as any).user._id.toString();

            if (!room || room.gameType !== 'backgammon') {
                return; // Игнорируем запросы не для нард
            }

            // Используем новую логику броска костей
            const { newState, error } = rollDiceForBackgammon(room.gameState, currentPlayerId, room.players);
            
            if (error) {
                return socket.emit('error', { message: error });
            }

            room.gameState = newState;
            
            // Отправляем обновленное состояние с результатом броска
            io.to(roomId).emit('gameUpdate', getPublicRoomState(room));
            
            // Проверяем, нужно ли боту автоматически бросить кости
            // @ts-ignore
            const nextPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn);
            if (nextPlayer && isBot(nextPlayer) && (room.gameState as any).turnPhase === 'ROLLING') {
                setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (!currentRoom) return;
                    
                    // @ts-ignore
                    const botPlayerId = nextPlayer.user._id.toString();
                    const { newState: botDiceState, error: botDiceError } = rollDiceForBackgammon(
                        currentRoom.gameState,
                        botPlayerId,
                        currentRoom.players
                    );
                    
                    if (!botDiceError) {
                        currentRoom.gameState = botDiceState;
                        io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                    }
                }, 1000);
            }
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
            const room = rooms[roomId];
            const currentUser = await User.findById(initialUser._id);

            // --- 1. Проверки на возможность входа ---
            if (!currentUser || !room) {
                return socket.emit('error', { message: 'Комната не найдена или пользователь не существует.' });
            }
            if (room.players.length >= 2) {
                return socket.emit('error', { message: 'Комната уже заполнена.' });
            }
            if (currentUser.balance < room.bet) {
                return socket.emit('error', { message: 'Недостаточно средств для присоединения.' });
            }

            // --- 2. Добавление игрока в комнату ---
            const gameLogic = gameLogics[room.gameType];
            room.players.push({ socketId: socket.id, user: currentUser });
            socket.join(roomId);

            // --- 3. Логика в зависимости от количества игроков ---
            if (room.players.length === 1) {
                // Сценарий А: Игрок присоединился к пустой комнате, созданной админом.
                // Он становится первым игроком и запускает таймер ожидания бота.
                room.gameState = gameLogic.createInitialState(room.players);
                socket.emit('gameStart', getPublicRoomState(room)); // Отправляем его на страницу игры в режим ожидания

                room.botJoinTimer = setTimeout(() => {
                    const currentRoom = rooms[roomId];
                    if (currentRoom && currentRoom.players.length === 1) {
                        const botUser: Player['user'] = { _id: `bot-${Date.now()}` as any, username: botUsernames[Math.floor(Math.random() * botUsernames.length)], avatar: 'bot_avatar.png', balance: 9999 };
                        currentRoom.players.push({ socketId: 'bot_socket_id', user: botUser });
                        currentRoom.gameState = gameLogic.createInitialState(currentRoom.players);
                        io.to(roomId).emit('gameStart', getPublicRoomState(currentRoom));
                    }
                }, BOT_WAIT_TIME);

            } else {
                // Сценарий Б: Игрок присоединился вторым.
                // Отменяем таймер бота и начинаем игру для обоих.
                if (room.botJoinTimer) {
                    clearTimeout(room.botJoinTimer);
                }
                
                room.gameState = gameLogic.createInitialState(room.players);
                io.to(roomId).emit('gameStart', getPublicRoomState(room)); // Начинаем игру для обоих игроков
            }
            
            // --- 4. Обновляем список комнат в лобби для всех ---
            broadcastLobbyState(io, room.gameType);
        });
        
        // socket.on('joinRoom', async (roomId: string) => {
        //     const currentUser = await User.findById(initialUser._id);
        //     const room = rooms[roomId];
        //     if (!currentUser || !room || room.players.length >= 2) return socket.emit('error', { message: 'Невозможно присоединиться.' });
        //     if (currentUser.balance < room.bet) return socket.emit('error', { message: 'Недостаточно средств.' });
        //     if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
            
        //     room.players.push({ socketId: socket.id, user: currentUser });
        //     socket.join(roomId);
            
        //     const gameLogic = gameLogics[room.gameType];
        //     room.gameState = gameLogic.createInitialState(room.players);

        //     io.to(roomId).emit('gameStart', getPublicRoomState(room));
        //     broadcastLobbyState(io, room.gameType);
        // });

        // socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
        //     const room = rooms[roomId];
        //     // @ts-ignore
        //     const currentPlayerId = initialUser._id.toString();

        //     // --- 1. Базовые проверки ---
        //     if (!room) return;
        //     if (room.players.length < 2) return socket.emit('error', { message: "Дождитесь второго игрока." });
        //     if (room.gameState.turn !== currentPlayerId) return socket.emit('error', { message: "Сейчас не ваш ход." });

        //     const gameLogic = gameLogics[room.gameType];
            
        //     // --- 2. Обработка хода с помощью модуля игры ---
        //     const { newState, error, turnShouldSwitch } = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            
        //     if (error) return socket.emit('error', { message: error });

        //     // --- 3. Обновление состояния и определение следующего игрока ---
        //     room.gameState = newState;
        //     let nextPlayerId: string;
            
        //     if (turnShouldSwitch) {
        //         // @ts-ignore
        //         const nextPlayerObject = room.players.find(p => p.user._id.toString() !== currentPlayerId)!;
        //         // @ts-ignore
        //         nextPlayerId = nextPlayerObject.user._id.toString();
        //         room.gameState.turn = nextPlayerId;
        //     } else {
        //         nextPlayerId = currentPlayerId; // Ход остается у текущего игрока
        //     }
            
        //     // --- 4. Проверка на конец игры ---
        //     const gameResult = gameLogic.checkGameEnd(room.gameState, room.players, nextPlayerId);
        //     if (gameResult.isGameOver) {
        //         return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
        //     }
            
        //     // --- 5. Отправка обновления всем игрокам ---
        //     io.to(roomId).emit('gameUpdate', getPublicRoomState(room));

        //     // --- 6. Логика для хода бота (если применимо) ---
        //     // @ts-ignore
        //     const nextPlayerObject = room.players.find(p => p.user._id.toString() === nextPlayerId)!;
        //     if (isBot(nextPlayerObject) && turnShouldSwitch) {
        //         setTimeout(() => {
        //             // Используем `async` IIFE (Immediately Invoked Function Expression) для работы с асинхронностью
        //             (async () => {
        //                 let currentRoom = rooms[roomId];
        //                 if (!currentRoom) return;

        //                 let botTurnShouldSwitch = false;
        //                 let safetyBreak = 0; // Защита от бесконечного цикла

        //                 // Начинаем цикл ходов бота
        //                 while (!botTurnShouldSwitch && safetyBreak < 10) {
        //                     safetyBreak++;
                            
        //                     const botPlayerIndex = currentRoom.players.findIndex(p => isBot(p)) as 0 | 1;
        //                     const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex);
                            
        //                     if (!botMove || Object.keys(botMove).length === 0) break; // Если боту некуда ходить

        //                     const botProcessResult = gameLogic.processMove(
        //                         currentRoom.gameState,
        //                         botMove,
        //                         // @ts-ignore
        //                         nextPlayerObject.user._id.toString(),
        //                         currentRoom.players
        //                     );

        //                     if (botProcessResult.error) break;

        //                     currentRoom.gameState = botProcessResult.newState;
        //                     botTurnShouldSwitch = botProcessResult.turnShouldSwitch;

        //                     // Проверяем конец игры после каждого мини-хода бота
        //                     const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players, currentRoom.gameState.turn);
        //                     if (botGameResult.isGameOver) {
        //                         return endGame(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
        //                     }
        //                 }

        //                 // Когда цикл ходов бота завершен, передаем ход человеку
        //                 const humanPlayer = currentRoom.players.find(p => !isBot(p))!;
        //                 // @ts-ignore
        //                 currentRoom.gameState.turn = humanPlayer.user._id.toString();

        //                 // Отправляем финальное состояние доски после всей серии ходов бота
        //                 io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));

        //             })();
        //         }, 1500);
        //     }
        // });

        // #################################### Worked
        // socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
        //     // const room = rooms[roomId];
        //     // // @ts-ignore
        //     // const currentPlayerId = initialUser._id.toString();

        //     // if (!room || room.players.length < 2 || room.gameState.turn !== currentPlayerId) return;

        //     // const gameLogic = gameLogics[room.gameType];
            
        //     // const { newState, error, turnShouldSwitch } = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            
        //     // if (error) return socket.emit('error', { message: error });

        //     // room.gameState = newState;
            
        //     // // Проверяем конец игры СРАЗУ после хода текущего игрока
        //     // let gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
        //     // if (gameResult.isGameOver) {
        //     //     return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
        //     // }
            
        //     // // Определяем следующего игрока
        //     // // @ts-ignore
        //     // const nextPlayer = room.players.find(p => p.user._id.toString() !== currentPlayerId)!;
            
        //     // if (turnShouldSwitch) {
        //     //     // @ts-ignore
        //     //     room.gameState.turn = nextPlayer.user._id.toString();
        //     // } else {
        //     //     // Ход остается у текущего игрока (для серийных взятий в шашках)
        //     //     room.gameState.turn = currentPlayerId;
        //     // }
            
        //     // io.to(roomId).emit('gameUpdate', getPublicRoomState(room));

        //     const room = rooms[roomId];
        //     // @ts-ignore
        //     const currentPlayerId = initialUser._id.toString();

        //     if (!room || room.players.length < 2 || room.gameState.turn !== currentPlayerId) return;

        //     const gameLogic = gameLogics[room.gameType];
            
        //     // 1. Просто получаем новое состояние от модуля игры
        //     const { newState, error, turnShouldSwitch } = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            
        //     if (error) return socket.emit('error', { message: error });

        //     // 2. Просто применяем это новое состояние
        //     room.gameState = newState;
            
        //     // 3. Проверяем на конец игры
        //     let gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
        //     if (gameResult.isGameOver) {
        //         return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
        //     }
            
        //     // 4. Отправляем обновление
        //     io.to(roomId).emit('gameUpdate', getPublicRoomState(room));

        //     // 5. Логика бота
        //     // @ts-ignore
        //     const nextPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn)!;
        
        socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
            const room = rooms[roomId];
            // @ts-ignore
            const currentPlayerId = initialUser._id.toString();

            if (!room || room.players.length < 2 || room.gameState.turn !== currentPlayerId) return;

            const gameLogic = gameLogics[room.gameType];
            
            const { newState, error, turnShouldSwitch } = gameLogic.processMove(room.gameState, move, currentPlayerId, room.players);
            
            if (error) return socket.emit('error', { message: error });

            room.gameState = newState;
            
            const gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
            if (gameResult.isGameOver) {
                return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
            }
            
            io.to(roomId).emit('gameUpdate', getPublicRoomState(room));
            // @ts-ignore
            const nextPlayer = room.players.find(p => p.user._id.toString() === room.gameState.turn)!;
            if (isBot(nextPlayer) && turnShouldSwitch) {
                setTimeout(() => {
                    (async () => {
                        let currentRoom = rooms[roomId];
                        if (!currentRoom) return;

                        // Специальная логика для нард - бот должен бросить кости
                        if (currentRoom.gameType === 'backgammon') {
                            // @ts-ignore
                            const botPlayerId = nextPlayer.user._id.toString();
                            
                            // Проверяем, нужно ли боту бросить кости
                            if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                                const { newState: diceState, error: diceError } = rollDiceForBackgammon(
                                    currentRoom.gameState,
                                    botPlayerId,
                                    currentRoom.players
                                );
                                
                                if (diceError) {
                                    console.log('[Bot] Dice roll error:', diceError);
                                    return;
                                }
                                
                                currentRoom.gameState = diceState;
                                io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                                
                                // Если после броска костей нет доступных ходов, ход уже переключился
                                if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                                    return;
                                }
                                
                                // Небольшая задержка перед ходами
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }

                        let botCanMove = true;
                        let safetyBreak = 0;

                        while (botCanMove && safetyBreak < 10) {
                            safetyBreak++;
                            
                            const botPlayerIndex = currentRoom.players.findIndex(p => isBot(p)) as 0 | 1;
                            const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex);
                            
                            if (!botMove || Object.keys(botMove).length === 0) break;

                            const botProcessResult = gameLogic.processMove(
                                currentRoom.gameState,
                                botMove,
                                // @ts-ignore
                                nextPlayer.user._id.toString(),
                                currentRoom.players
                            );

                            if (botProcessResult.error) break;

                            currentRoom.gameState = botProcessResult.newState;
                            
                            const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players);
                            if (botGameResult.isGameOver) {
                                return endGame(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
                            }
                            
                            botCanMove = !botProcessResult.turnShouldSwitch;
                            
                            // Для нард: если ход переключился, выходим из цикла
                            if (currentRoom.gameType === 'backgammon' && botProcessResult.turnShouldSwitch) {
                                break;
                            }
                        }

                        if (currentRoom) {
                             io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
                        }
                       
                    })();
                }, 1500);
            }
        });

        //     // Логика бота
        //     if (isBot(nextPlayer) && turnShouldSwitch) {
        //         setTimeout(() => {
        //             (async () => {
        //                 let currentRoom = rooms[roomId];
        //                 if (!currentRoom) return;

        //                 let botCanMove = true;
        //                 let safetyBreak = 0;

        //                 while (botCanMove && safetyBreak < 10) {
        //                     safetyBreak++;
                            
        //                     const botPlayerIndex = currentRoom.players.findIndex(p => isBot(p)) as 0 | 1;
        //                     const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex);
                            
        //                     if (!botMove || Object.keys(botMove).length === 0) break;

        //                     const botProcessResult = gameLogic.processMove(
        //                         currentRoom.gameState,
        //                         botMove,
        //                         // @ts-ignore
        //                         nextPlayer.user._id.toString(),
        //                         currentRoom.players
        //                     );

        //                     if (botProcessResult.error) break;

        //                     currentRoom.gameState = botProcessResult.newState;
                            
        //                     gameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players);
        //                     if (gameResult.isGameOver) {
        //                         return endGame(io, currentRoom, gameResult.winnerId, gameResult.isDraw);
        //                     }
                            
        //                     // Если ход не должен переключаться (серийное взятие у бота), цикл продолжится
        //                     botCanMove = !botProcessResult.turnShouldSwitch;
        //                 }

        //                 // Когда серия ходов бота закончена, передаем ход человеку
        //                 const humanPlayer = currentRoom.players.find(p => !isBot(p))!;
        //                 // @ts-ignore
        //                 currentRoom.gameState.turn = humanPlayer.user._id.toString();

        //                 io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
        //             })();
        //         }, 1500);
        //     }
        // });



        // socket.on('playerMove', ({ roomId, move }: { roomId: string, move: GameMove }) => {
        //     const room = rooms[roomId];
        //     if (!room || room.players.length < 2) return;
            
        //     // ИСПРАВЛЕНИЕ: Получаем флаг о необходимости смены хода
        //     // @ts-ignore
        //     const { newState, error, turnShouldSwitch } = gameLogics.processMove(room.gameState, move, currentPlayerId, room.players);
        //     if (error) return socket.emit('error', { message: error });

        //     // @ts-ignore
        //     let nextPlayer = room.players.find(p => p.user._id.toString() !== currentPlayerId)!;
            
        //     // ИСПРАВЛЕНИЕ: Меняем ход только если игра это разрешает
        //     if (turnShouldSwitch) {
        //         // @ts-ignore
        //         newState.turn = nextPlayer.user._id.toString();
        //     } else {
        //         // @ts-ignore
        //         newState.turn = currentPlayerId; // Ход остается у текущего игрока
        //         // @ts-ignore
        //         nextPlayer = room.players.find(p => p.user._id.toString() === currentPlayerId)!; // "Следующий" игрок - он сам
        //     }
        //     room.gameState = newState;
        //     // @ts-ignore
        //     const gameResult = gameLogics.checkGameEnd(room.gameState, room.players, newState.turn);
        //     if (gameResult.isGameOver) return endGame(io, room, gameResult.winnerId, gameResult.isDraw);
            
        //     io.to(roomId).emit('gameUpdate', getPublicRoomState(room));

        //     if (isBot(nextPlayer)) {
        //         setTimeout(() => {
        //             const currentRoom = rooms[roomId];
        //             if (!currentRoom) return;
        //             // @ts-ignore
        //             const botMove = gameLogics.makeBotMove(currentRoom.gameState);
        //             // @ts-ignore
        //             const { newState: botState, error: botError } = gameLogic.processMove(currentRoom.gameState, botMove, nextPlayer.user._id.toString(), currentRoom.players);
        //             if (botError) return;

        //             const humanPlayer = currentRoom.players.find(p => !isBot(p))!;
        //             // @ts-ignore
        //             botState.turn = humanPlayer.user._id.toString();
        //             currentRoom.gameState = botState;
        //             // @ts-ignore
        //             const botGameResult = gameLogics.checkGameEnd(currentRoom.gameState, currentRoom.players);
        //             if (botGameResult.isGameOver) {
        //                 endGame(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
        //             } else {
        //                 io.to(roomId).emit('gameUpdate', getPublicRoomState(currentRoom));
        //             }
        //         }, 1500);
        //     }
        // });

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