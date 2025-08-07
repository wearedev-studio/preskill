import { Server } from 'socket.io';
import TournamentRoom, { ITournamentRoom, ITournamentRoomPlayer } from '../models/TournamentRoom.model';
import Tournament, { ITournament, ITournamentMatch } from '../models/Tournament.model';
import User from '../models/User.model';
import Transaction from '../models/Transaction.model';
import { createNotification } from './notification.service';
import { gameLogics } from '../socket';
import { advanceTournamentWinner } from './tournament.service';

export const tournamentRooms: Record<string, ITournamentRoom> = {};
export const tournamentPlayerSockets: Record<string, string> = {};

// Упрощенная структура игрока для игровой логики
interface GamePlayer {
    socketId: string;
    user: {
        _id: string;
        username: string;
        avatar: string;
        balance: number;
    };
}

/**
 * Преобразует игроков турнира в формат, понятный игровой логике
 */
function convertPlayersForGameLogic(players: ITournamentRoomPlayer[]): GamePlayer[] {
    return players.map(p => ({
        socketId: p.socketId || 'offline',
        user: {
            _id: p._id.toString(),
            username: p.username,
            avatar: p.isBot ? 'bot_avatar.png' : 'default_avatar.png',
            balance: p.isBot ? 9999 : 0
        }
    }));
}

/**
 * Создает турнирную комнату
 */
export async function createTournamentRoom(
    io: Server,
    tournamentId: string,
    matchId: string,
    gameType: string,
    players: ITournamentRoomPlayer[]
): Promise<ITournamentRoom | null> {
    try {
        console.log(`[TournamentRoom] Creating room for match ${matchId} in tournament ${tournamentId}`);
        
        // Проверяем, что игровая логика существует
        const gameLogic = gameLogics[gameType as keyof typeof gameLogics];
        if (!gameLogic) {
            console.error(`[TournamentRoom] No game logic found for ${gameType}`);
            return null;
        }

        // Преобразуем игроков для игровой логики
        const gamePlayersFormat = convertPlayersForGameLogic(players);
        console.log(`[TournamentRoom] Game players format:`, gamePlayersFormat.map(p => ({ 
            id: p.user._id, 
            username: p.user.username 
        })));

        // Создаем начальное состояние игры
        const initialGameState = gameLogic.createInitialState(gamePlayersFormat);
        console.log(`[TournamentRoom] Initial game state:`, {
            turn: initialGameState.turn,
            gameType,
            hasBoard: !!initialGameState.board
        });

        // Создаем запись в базе данных
        const tournamentRoom = new TournamentRoom({
            tournamentId,
            matchId,
            gameType,
            players,
            gameState: initialGameState,
            status: 'WAITING',
            replayCount: 0
        });

        await tournamentRoom.save();

        // Добавляем в память
        tournamentRooms[matchId] = tournamentRoom;

        console.log(`[TournamentRoom] Created room ${matchId} for ${players.length} players`);

        // Уведомляем реальных игроков
        await notifyPlayersAboutMatch(io, tournamentRoom);

        return tournamentRoom;
    } catch (error) {
        console.error(`[TournamentRoom] Error creating room:`, error);
        return null;
    }
}

async function notifyPlayersAboutMatch(io: Server, room: ITournamentRoom) {
    const tournament = await Tournament.findById(room.tournamentId);
    if (!tournament) return;

    let currentRound = 1;
    for (const round of tournament.bracket) {
        const matchInRound = round.matches.find(m => m.matchId.toString() === room.matchId);
        if (matchInRound) {
            currentRound = round.round;
            break;
        }
    }

    for (const player of room.players) {
        if (!player.isBot && player.socketId) {
            const socket = io.sockets.sockets.get(player.socketId);
            if (socket) {
                const opponent = room.players.find(p => p._id !== player._id);
                
                socket.emit('tournamentMatchReady', {
                    tournamentId: room.tournamentId,
                    matchId: room.matchId,
                    gameType: room.gameType,
                    round: currentRound,
                    opponent: opponent
                });

                const roundText = currentRound === 1 ? 'Первый раунд' :
                                currentRound === 2 ? 'Полуфинал' :
                                currentRound === 3 ? 'Финал' : `Раунд ${currentRound}`;
                
                await createNotification(io, player._id, {
                    title: `⚔️ ${roundText} турнира готов!`,
                    message: `${roundText} турнира "${tournament.name}". Противник: ${opponent?.username}`,
                    link: `/tournament-game/${room.matchId}`
                });

                console.log(`[TournamentRoom] Notified player ${player.username} about ${roundText} match ${room.matchId}`);
            }
        }
    }
}

/**
 * Подключение игрока к турнирной комнате
 */
export async function joinTournamentRoom(
    io: Server,
    socket: any,
    matchId: string,
    playerId: string
): Promise<boolean> {
    try {
        console.log(`[TournamentRoom] Player ${playerId} joining room ${matchId}`);

        const room = tournamentRooms[matchId] || await TournamentRoom.findOne({ matchId });
        if (!room) {
            console.log(`[TournamentRoom] Room ${matchId} not found`);
            socket.emit('error', { message: 'Турнирный матч не найден' });
            return false;
        }

        // Проверяем статус комнаты
        if (room.status === 'FINISHED') {
            console.log(`[TournamentRoom] Match ${matchId} is already finished`);
            socket.emit('error', { message: 'Этот матч уже завершен' });
            return false;
        }

        // Проверяем, что игрок участвует в этом матче
        const player = room.players.find(p => p._id.toString() === playerId.toString());
        if (!player) {
            console.log(`[TournamentRoom] Player ${playerId} not in match ${matchId}`);
            socket.emit('error', { message: 'Вы не участвуете в этом матче' });
            return false;
        }

        // Обновляем socketId игрока
        player.socketId = socket.id;
        tournamentPlayerSockets[playerId] = socket.id;

        // Подключаем к комнате
        const roomName = `tournament-${matchId}`;
        socket.join(roomName);
        
        console.log(`[TournamentRoom] Player ${playerId} joined room ${roomName}`);
        console.log(`[TournamentRoom] Socket ${socket.id} joined room ${roomName}`);
        
        // Проверяем, что сокет действительно в комнате
        setTimeout(() => {
            const socketsInRoom = socket.adapter.rooms.get(roomName);
            console.log(`[TournamentRoom] Sockets in room ${roomName} after join:`, socketsInRoom ? Array.from(socketsInRoom) : 'none');
        }, 100);

        // Обновляем статус комнаты
        if (room.status === 'WAITING') {
            room.status = 'ACTIVE';
            if (tournamentRooms[matchId]) {
                tournamentRooms[matchId] = room;
            }
            await TournamentRoom.findOneAndUpdate({ matchId }, { status: 'ACTIVE' });
        }

        // Отправляем состояние игры
        console.log(`[TournamentRoom] Sending game start to player ${playerId}`);
        socket.emit('tournamentGameStart', {
            matchId,
            gameType: room.gameType,
            players: room.players,
            gameState: room.gameState,
            myPlayerId: playerId
        });

        console.log(`[TournamentRoom] Player ${playerId} joined room ${matchId} successfully`);

        // Проверяем, нужно ли боту сделать первый ход
        const currentPlayer = room.players.find(p => p._id.toString() === room.gameState.turn?.toString());
        if (currentPlayer && currentPlayer.isBot) {
            console.log(`[TournamentRoom] Bot ${currentPlayer.username} should make first move`);
            
            setTimeout(async () => {
                try {
                    await processTournamentMove(io, null, room.matchId, currentPlayer._id.toString(), { type: 'BOT_MOVE' });
                } catch (error) {
                    console.error(`[TournamentRoom] Error in initial bot move:`, error);
                }
            }, 1000);
        }

        return true;
    } catch (error) {
        console.error(`[TournamentRoom] Error joining room:`, error);
        socket.emit('error', { message: 'Ошибка подключения к матчу' });
        return false;
    }
}

/**
 * Обработка хода в турнире
 */
export async function processTournamentMove(
    io: Server,
    socket: any,
    matchId: string,
    playerId: string,
    move: any
): Promise<void> {
    try {
        console.log(`[TournamentRoom] Processing move for player ${playerId} in match ${matchId}`);
        console.log(`[TournamentRoom] Move:`, move);

        const room = tournamentRooms[matchId] || await TournamentRoom.findOne({ matchId });
        if (!room || room.status !== 'ACTIVE') {
            console.log(`[TournamentRoom] Room not found or not active: ${room?.status}`);
            if (socket) socket.emit('tournamentGameError', { matchId, error: 'Матч недоступен' });
            return;
        }

        const player = room.players.find(p => p._id.toString() === playerId.toString());
        if (!player) {
            console.log(`[TournamentRoom] Player not found in room`);
            if (socket) socket.emit('tournamentGameError', { matchId, error: 'Игрок не найден в матче' });
            return;
        }

        const isBot = player.isBot;
        console.log(`[TournamentRoom] Player ${player.username} is bot: ${isBot}, current turn: ${room.gameState.turn}`);
        
        // Проверяем очередность хода (только для людей)
        if (!isBot && room.gameState.turn) {
            const currentTurn = room.gameState.turn.toString();
            const playerIdStr = playerId.toString();
            
            if (currentTurn !== playerIdStr) {
                console.log(`[TournamentRoom] Turn check failed: expected ${currentTurn}, got ${playerIdStr}`);
                if (socket) socket.emit('tournamentGameError', { matchId, error: 'Сейчас не ваш ход' });
                return;
            }
        }

        const gameLogic = gameLogics[room.gameType as keyof typeof gameLogics];
        if (!gameLogic) {
            console.log(`[TournamentRoom] No game logic found for ${room.gameType}`);
            if (socket) socket.emit('tournamentGameError', { matchId, error: 'Игровая логика недоступна' });
            return;
        }

        // Преобразуем игроков для игровой логики
        const gamePlayersFormat = convertPlayersForGameLogic(room.players);

        let result;

        if (isBot && move.type === 'BOT_MOVE') {
            console.log(`[TournamentRoom] Processing bot move`);
            const botPlayerIndex = room.players.findIndex(p => p._id.toString() === playerId.toString()) as 0 | 1;
            const botMove = gameLogic.makeBotMove(room.gameState, botPlayerIndex);
            
            if (!botMove || Object.keys(botMove).length === 0) {
                console.log(`[TournamentRoom] Bot ${playerId} has no valid moves`);
                return;
            }
            
            console.log(`[TournamentRoom] Bot move:`, botMove);
            result = gameLogic.processMove(room.gameState, botMove, playerId, gamePlayersFormat);
        }
        else if (room.gameType === 'backgammon' && move.type === 'ROLL_DICE') {
            console.log(`[TournamentRoom] Processing dice roll`);
            const { rollDiceForBackgammon } = await import('../games/backgammon.logic');
            result = rollDiceForBackgammon(room.gameState, playerId, gamePlayersFormat);
        } else {
            console.log(`[TournamentRoom] Processing regular move`);
            result = gameLogic.processMove(room.gameState, move, playerId, gamePlayersFormat);
        }

        console.log(`[TournamentRoom] Game logic result:`, {
            hasError: !!result.error,
            error: result.error,
            hasNewState: !!result.newState
        });

        if (result.error) {
            console.log(`[TournamentRoom] Move error: ${result.error}`);
            if (socket) {
                socket.emit('tournamentGameError', {
                    matchId,
                    error: result.error
                });
            }
            return;
        }

        // Обновляем состояние игры
        room.gameState = result.newState;
        if (tournamentRooms[matchId]) {
            tournamentRooms[matchId] = room;
        }
        
        // Сохраняем в базу данных
        try {
            await TournamentRoom.findOneAndUpdate({ matchId }, { gameState: result.newState });
        } catch (dbError) {
            console.error(`[TournamentRoom] Database update error:`, dbError);
        }

        // Отправляем обновление всем игрокам в комнате
        const roomName = `tournament-${matchId}`;
        console.log(`[TournamentRoom] Sending game update to room: ${roomName}`);
        
        // Получаем список сокетов в комнате для отладки
        const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
        console.log(`[TournamentRoom] Sockets in room ${roomName}:`, socketsInRoom ? Array.from(socketsInRoom) : 'none');
        
        io.to(roomName).emit('tournamentGameUpdate', {
            matchId,
            gameState: result.newState
        });

        // Дополнительно отправляем обновления напрямую игрокам по их socketId
        for (const player of room.players) {
            if (!player.isBot && player.socketId) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    console.log(`[TournamentRoom] Sending direct update to player ${player.username} (${player.socketId})`);
                    socket.emit('tournamentGameUpdate', {
                        matchId,
                        gameState: result.newState
                    });
                } else {
                    console.log(`[TournamentRoom] Socket not found for player ${player.username} (${player.socketId})`);
                }
            }
        }

        console.log(`[TournamentRoom] Game state updated and sent to clients`);

        // Проверяем окончание игры
        const gameResult = gameLogic.checkGameEnd(result.newState, gamePlayersFormat);
        
        if (gameResult.isGameOver) {
            console.log(`[TournamentRoom] Game over detected for match ${matchId}`);
            await finishTournamentMatch(io, room, gameResult.winnerId, gameResult.isDraw);
            return;
        }

        // Обрабатываем ход бота если нужно
        const nextPlayer = room.players.find(p => p._id.toString() === result.newState.turn?.toString());
        if (nextPlayer && nextPlayer.isBot) {
            console.log(`[TournamentRoom] Scheduling bot move for ${nextPlayer.username}`);
            
            setTimeout(async () => {
                await processTournamentMove(io, null, matchId, nextPlayer._id.toString(), { type: 'BOT_MOVE' });
            }, 800);
        }

        console.log(`[TournamentRoom] Successfully processed move in match ${matchId}`);
    } catch (error) {
        console.error(`[TournamentRoom] Error processing move:`, error);
        if (socket) socket.emit('tournamentGameError', { matchId, error: 'Ошибка обработки хода' });
    }
}

async function finishTournamentMatch(
    io: Server,
    room: ITournamentRoom,
    winnerId?: string,
    isDraw: boolean = false
): Promise<void> {
    try {
        console.log(`[TournamentRoom] Finishing match ${room.matchId}, isDraw: ${isDraw}, replayCount: ${room.replayCount}`);

        let winner: ITournamentRoomPlayer | undefined;
        if (winnerId && !isDraw) {
            winner = room.players.find(p => p._id.toString() === winnerId.toString());
        }

        // Если ничья и это не превышает лимит переигровок
        if (isDraw && room.replayCount < 3) {
            console.log(`[TournamentRoom] Draw detected, starting replay ${room.replayCount + 1} for match ${room.matchId}`);
            await startTournamentReplay(io, room);
            return;
        }

        // Если ничья и достигнут лимит переигровок, выбираем случайного победителя
        if (isDraw && room.replayCount >= 3) {
            console.log(`[TournamentRoom] Maximum replays reached, selecting random winner for match ${room.matchId}`);
            winner = room.players[Math.floor(Math.random() * room.players.length)];
            isDraw = false; // Больше не ничья, есть победитель
        }

        // Обновляем статус комнаты
        room.status = 'FINISHED';
        room.winner = winner;

        if (tournamentRooms[room.matchId]) {
            tournamentRooms[room.matchId] = room;
        }
        await TournamentRoom.findOneAndUpdate(
            { matchId: room.matchId },
            { status: 'FINISHED', winner }
        );

        // Уведомляем игроков о результате
        io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
            matchId: room.matchId,
            winner,
            isDraw: false // Всегда false, так как либо есть победитель, либо выбран случайный
        });

        // Уведомляем игроков о результате матча и статусе в турнире
        await notifyPlayersAboutMatchResult(io, room, winner, false);

        // Продвигаем победителя в турнире
        if (winner) {
            await advanceTournamentWinner(io, room.tournamentId.toString(), room.matchId, winner);
        }

        // КРИТИЧЕСКИ ВАЖНО: Проверяем, нужно ли создать следующий раунд
        setTimeout(async () => {
            try {
                const updatedTournament = await Tournament.findById(room.tournamentId);
                if (updatedTournament) {
                    console.log(`[TournamentRoom] Checking next round after match ${room.matchId} finished`);
                    await checkAndCreateNextRound(io, updatedTournament);
                }
            } catch (error) {
                console.error(`[TournamentRoom] Error checking next round after match finish:`, error);
            }
        }, 1000);

        console.log(`[TournamentRoom] Match ${room.matchId} finished`);
    } catch (error) {
        console.error(`[TournamentRoom] Error finishing match:`, error);
    }
}

async function notifyPlayersAboutMatchResult(
    io: Server,
    room: ITournamentRoom,
    winner?: ITournamentRoomPlayer,
    isDraw: boolean = false
): Promise<void> {
    try {
        const tournament = await Tournament.findById(room.tournamentId);
        if (!tournament) return;

        for (const player of room.players) {
            if (!player.isBot && player.socketId) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    const isWinner = winner && player._id.toString() === winner._id.toString();
                    const isLoser = !isDraw && !isWinner;

                    if (isWinner) {
                        socket.emit('tournamentMatchResult', {
                            type: 'ADVANCED',
                            message: 'Поздравляем! Вы прошли в следующий раунд!',
                            tournamentId: tournament._id,
                            status: 'WAITING_NEXT_ROUND'
                        });

                        await createNotification(io, player._id, {
                            title: `🏆 Победа в матче!`,
                            message: `Вы прошли в следующий раунд турнира "${tournament.name}"`,
                            link: `/tournament/${tournament._id}`
                        });
                    } else if (isLoser) {
                        socket.emit('tournamentMatchResult', {
                            type: 'ELIMINATED',
                            message: 'Вы выбыли из турнира',
                            tournamentId: tournament._id,
                            status: 'ELIMINATED'
                        });

                        await createNotification(io, player._id, {
                            title: `😔 Поражение в турнире`,
                            message: `Вы выбыли из турнира "${tournament.name}"`,
                            link: `/tournament/${tournament._id}`
                        });
                    } else {
                        socket.emit('tournamentMatchResult', {
                            type: 'DRAW',
                            message: 'Ничья! Определяется случайный победитель...',
                            tournamentId: tournament._id,
                            status: 'WAITING_NEXT_ROUND'
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[TournamentRoom] Error notifying players about match result:`, error);
    }
}

/**
 * Очищает неактивные турнирные комнаты
 */
export function cleanupInactiveTournamentRooms(): void {
    const now = Date.now();
    const CLEANUP_TIMEOUT = 60 * 60 * 1000; // 1 час

    Object.keys(tournamentRooms).forEach(matchId => {
        const room = tournamentRooms[matchId];
        if (room.status === 'FINISHED' && 
            (now - new Date(room.updatedAt).getTime()) > CLEANUP_TIMEOUT) {
            delete tournamentRooms[matchId];
            console.log(`[TournamentRoom] Cleaned up inactive room ${matchId}`);
        }
    });
}

/**
 * Проверяет и создает следующий раунд турнира
 */
export async function checkAndCreateNextRound(io: Server, tournament: ITournament): Promise<void> {
    try {
        console.log(`[TournamentRoom] Checking next round for tournament ${tournament._id}`);
        
        // Проверяем все раунды по порядку
        for (let i = 0; i < tournament.bracket.length; i++) {
            const round = tournament.bracket[i];
            console.log(`[TournamentRoom] Checking round ${i}:`, round.matches.map(m => ({ status: m.status, winner: m.winner?.username })));
            
            const allMatchesFinished = round.matches.every((m: any) => m.status === 'FINISHED');
            const hasWaitingMatches = round.matches.some((m: any) => m.status === 'WAITING');
            
            console.log(`[TournamentRoom] Round ${round.round}: allFinished=${allMatchesFinished}, hasWaiting=${hasWaitingMatches}`);
            
            if (allMatchesFinished && i + 1 < tournament.bracket.length) {
                // Текущий раунд завершен, нужно создать следующий
                const nextRound = tournament.bracket[i + 1];
                const nextRoundHasWaitingMatches = nextRound.matches.some((m: any) => m.status === 'WAITING');
                
                if (nextRoundHasWaitingMatches) {
                    console.log(`[TournamentRoom] Round ${round.round} finished, creating next round ${nextRound.round}`);
                    await createNextRoundMatches(io, tournament, i);
                    return; // Выходим после создания следующего раунда
                }
            } else if (allMatchesFinished && i + 1 >= tournament.bracket.length) {
                // Это последний раунд и он завершен - турнир окончен
                console.log(`[TournamentRoom] Tournament finished, determining winner`);
                const finalMatch = round.matches[0];
                if (finalMatch && finalMatch.winner) {
                    console.log(`[TournamentRoom] Tournament winner: ${finalMatch.winner.username}`);
                    await finishTournament(io, tournament, finalMatch.winner);
                } else {
                    console.error(`[TournamentRoom] No winner found in final match`);
                }
                return;
            } else if (!allMatchesFinished) {
                // Текущий раунд не завершен, ускоряем матчи ботов
                console.log(`[TournamentRoom] Round ${round.round} not finished, accelerating bot matches`);
                await accelerateBotMatches(io, tournament, round);
                return; // Выходим и ждем завершения текущего раунда
            }
        }
        
        console.log(`[TournamentRoom] No action needed for tournament ${tournament._id}`);
    } catch (error) {
        console.error(`[TournamentRoom] Error checking next round:`, error);
    }
}

/**
 * Ускоряет матчи между ботами
 */
async function accelerateBotMatches(io: Server, tournament: ITournament, currentRound: any): Promise<void> {
    try {
        for (const match of currentRound.matches) {
            if (match.status === 'ACTIVE' && match.player1 && match.player2) {
                // Проверяем, есть ли матчи только между ботами
                if (match.player1.isBot && match.player2.isBot) {
                    console.log(`[TournamentRoom] Accelerating bot vs bot match ${match.matchId}`);
                    
                    // Находим комнату для этого матча
                    const room = tournamentRooms[match.matchId.toString()];
                    if (room && room.status === 'ACTIVE') {
                        // Немедленно завершаем матч ботов
                        const winner = room.players[Math.floor(Math.random() * room.players.length)];
                        
                        // Обновляем статус комнаты
                        room.status = 'FINISHED';
                        room.winner = winner;
                        
                        if (tournamentRooms[room.matchId]) {
                            tournamentRooms[room.matchId] = room;
                        }
                        await TournamentRoom.findOneAndUpdate(
                            { matchId: room.matchId },
                            { status: 'FINISHED', winner }
                        );
                        
                        // Уведомляем о завершении матча
                        io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
                            matchId: room.matchId,
                            winner,
                            isDraw: false
                        });
                        
                        // Продвигаем победителя
                        await advanceTournamentWinner(io, tournament._id.toString(), room.matchId, winner);
                        
                        console.log(`[TournamentRoom] Accelerated bot match ${room.matchId}, winner: ${winner.username}`);
                    }
                }
            }
        }
        
        // Перепроверяем турнир после ускорения матчей
        setTimeout(async () => {
            try {
                const updatedTournament = await Tournament.findById(tournament._id);
                if (updatedTournament) {
                    await checkAndCreateNextRound(io, updatedTournament);
                }
            } catch (error) {
                console.error(`[TournamentRoom] Error in recheck after accelerateBotMatches:`, error);
            }
        }, 1000);
    } catch (error) {
        console.error(`[TournamentRoom] Error accelerating bot matches:`, error);
    }
}

/**
 * Создает матчи следующего раунда
 */
async function createNextRoundMatches(io: Server, tournament: ITournament, currentRoundIndex: number): Promise<void> {
    try {
        console.log(`[TournamentRoom] Creating next round matches for tournament ${tournament._id}`);

        const nextRoundIndex = currentRoundIndex + 1;
        const nextRound = tournament.bracket[nextRoundIndex];

        if (!nextRound) {
            console.error(`[TournamentRoom] No next round found for tournament ${tournament._id}`);
            return;
        }

        // Получаем победителей текущего раунда
        const currentRound = tournament.bracket[currentRoundIndex];
        const winners = currentRound.matches.map((m: any) => m.winner).filter((w: any) => w !== null);

        console.log(`[TournamentRoom] Winners from round ${currentRound.round}:`, winners.map(w => w?.username));

        if (winners.length < nextRound.matches.length * 2) {
            console.error(`[TournamentRoom] Not enough winners for next round`);
            return;
        }

        // Создаем матчи следующего раунда
        for (let i = 0; i < nextRound.matches.length; i++) {
            const match = nextRound.matches[i];
            const player1 = winners[i * 2];
            const player2 = winners[i * 2 + 1];
            
            if (!player1 || !player2) {
                console.error(`[TournamentRoom] Missing players for next round match ${i}`);
                continue;
            }
            
            console.log(`[TournamentRoom] Creating match ${i}: ${player1.username} vs ${player2.username}`);
            
            match.player1 = player1;
            match.player2 = player2;
            match.status = 'ACTIVE';

            const players = [
                {
                    _id: match.player1._id,
                    username: match.player1.username,
                    socketId: match.player1.socketId || 'offline',
                    isBot: match.player1.isBot
                },
                {
                    _id: match.player2._id,
                    username: match.player2.username,
                    socketId: match.player2.socketId || 'offline',
                    isBot: match.player2.isBot
                }
            ];

            const room = await createTournamentRoom(
                io,
                tournament._id.toString(),
                match.matchId.toString(),
                tournament.gameType,
                players
            );

            if (room) {
                console.log(`[TournamentRoom] Created room for next round match ${match.matchId}`);

                // Если оба игрока боты, ускоряем матч
                if (match.player1.isBot && match.player2.isBot) {
                    console.log(`[TournamentRoom] Starting immediate bot vs bot match ${match.matchId}`);
                    setTimeout(() => {
                        accelerateSingleBotMatch(io, room, tournament);
                    }, 500);
                }
            }
        }

        await tournament.save();
        io.emit('tournamentUpdated', tournament);

        console.log(`[TournamentRoom] Created ${nextRound.matches.length} matches for round ${nextRound.round}`);
        
        // После создания всех матчей, проверяем, нужно ли сразу создать следующий раунд
        setTimeout(async () => {
            const updatedTournament = await Tournament.findById(tournament._id);
            if (updatedTournament) {
                await checkAndCreateNextRound(io, updatedTournament);
            }
        }, 2000);
        
    } catch (error) {
        console.error(`[TournamentRoom] Error creating next round matches:`, error);
    }
}

/**
 * Ускоряет отдельный матч ботов
 */
async function accelerateSingleBotMatch(io: Server, room: any, tournament: any): Promise<void> {
    try {
        console.log(`[TournamentRoom] Accelerating single bot match ${room.matchId}`);

        // Случайно выбираем победителя
        const winner = room.players[Math.floor(Math.random() * room.players.length)];

        // Обновляем статус комнаты
        room.status = 'FINISHED';
        room.winner = winner;

        if (tournamentRooms[room.matchId]) {
            tournamentRooms[room.matchId] = room;
        }
        await TournamentRoom.findOneAndUpdate(
            { matchId: room.matchId },
            { status: 'FINISHED', winner }
        );

        // Уведомляем о завершении матча
        io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
            matchId: room.matchId,
            winner,
            isDraw: false
        });

        // Продвигаем победителя
        await advanceTournamentWinner(io, tournament._id.toString(), room.matchId, winner);

        console.log(`[TournamentRoom] Accelerated bot match ${room.matchId} finished, winner: ${winner.username}`);
        
        // Перепроверяем турнир после ускорения матча
        setTimeout(async () => {
            try {
                const updatedTournament = await Tournament.findById(tournament._id);
                if (updatedTournament) {
                    await checkAndCreateNextRound(io, updatedTournament);
                }
            } catch (error) {
                console.error(`[TournamentRoom] Error in recheck after accelerated match:`, error);
            }
        }, 1000);
    } catch (error) {
        console.error(`[TournamentRoom] Error accelerating single bot match:`, error);
    }
}

/**
 * Завершает турнир
 */
async function finishTournament(io: Server, tournament: ITournament, winner: any): Promise<void> {
    try {
        console.log(`[TournamentRoom] Finishing tournament ${tournament._id}, winner: ${winner.username}`);

        tournament.status = 'FINISHED';
        tournament.winner = winner;
        tournament.finishedAt = new Date();

        await tournament.save();

        // Уведомляем всех о завершении турнира
        io.emit('tournamentFinished', tournament);

        // Уведомляем участников
        for (const player of tournament.players) {
            if (!player.isBot) {
                const isWinner = player._id.toString() === winner._id.toString();
                
                // Отправляем событие о завершении турнира
                const playerSocket = Object.keys(tournamentPlayerSockets).find(playerId =>
                    playerId === player._id.toString()
                );
                
                if (playerSocket) {
                    const socket = io.sockets.sockets.get(tournamentPlayerSockets[playerSocket]);
                    if (socket) {
                        socket.emit('tournamentCompleted', {
                            tournamentId: tournament._id,
                            isWinner,
                            winner: winner.username,
                            tournamentName: tournament.name,
                            prizePool: tournament.prizePool
                        });
                    }
                }
                
                await createNotification(io, player._id, {
                    title: isWinner ? `🏆 Поздравляем с победой!` : `🎯 Турнир завершен`,
                    message: isWinner
                        ? `Вы выиграли турнир "${tournament.name}"! Приз: ${Math.floor(tournament.prizePool * 0.6)} монет`
                        : `Турнир "${tournament.name}" завершен. Победитель: ${winner.username}`,
                    link: `/tournament/${tournament._id}`
                });
            }
        }

        console.log(`[TournamentRoom] Tournament ${tournament._id} finished successfully`);
    } catch (error) {
        console.error(`[TournamentRoom] Error finishing tournament:`, error);
    }
}

/**
 * Запускает переигровку турнирного матча при ничьей
 */
async function startTournamentReplay(io: Server, room: ITournamentRoom): Promise<void> {
    try {
        console.log(`[TournamentRoom] Starting replay ${room.replayCount + 1} for match ${room.matchId}`);

        // Увеличиваем счетчик переигровок
        room.replayCount += 1;

        // Проверяем, что игровая логика существует
        const gameLogic = gameLogics[room.gameType as keyof typeof gameLogics];
        if (!gameLogic) {
            console.error(`[TournamentRoom] No game logic found for ${room.gameType}`);
            return;
        }

        // Преобразуем игроков для игровой логики
        const gamePlayersFormat = convertPlayersForGameLogic(room.players);

        // Создаем новое начальное состояние игры
        const newGameState = gameLogic.createInitialState(gamePlayersFormat);
        room.gameState = newGameState;
        room.status = 'ACTIVE';

        // Обновляем в памяти и базе данных
        if (tournamentRooms[room.matchId]) {
            tournamentRooms[room.matchId] = room;
        }
        await TournamentRoom.findOneAndUpdate(
            { matchId: room.matchId },
            {
                gameState: newGameState,
                status: 'ACTIVE',
                replayCount: room.replayCount,
                $unset: { winner: 1 } // Убираем победителя
            }
        );

        // Уведомляем игроков о переигровке
        const roomName = `tournament-${room.matchId}`;
        io.to(roomName).emit('tournamentReplay', {
            matchId: room.matchId,
            replayNumber: room.replayCount,
            gameState: newGameState,
            message: `Ничья! Начинается переигровка ${room.replayCount}/3`
        });

        // Отправляем новое состояние игры всем игрокам
        for (const player of room.players) {
            if (!player.isBot && player.socketId) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('tournamentGameStart', {
                        matchId: room.matchId,
                        gameType: room.gameType,
                        players: room.players,
                        gameState: newGameState,
                        myPlayerId: player._id,
                        isReplay: true,
                        replayNumber: room.replayCount
                    });

                    // Создаем уведомление о переигровке
                    await createNotification(io, player._id, {
                        title: `🔄 Переигровка ${room.replayCount}/3`,
                        message: `Ничья в турнирном матче! Начинается переигровка`,
                        link: `/tournament-game/${room.matchId}`
                    });
                }
            }
        }

        console.log(`[TournamentRoom] Replay ${room.replayCount} started for match ${room.matchId}`);

        // Если первый ход должен сделать бот, запускаем его
        const currentPlayer = room.players.find(p => p._id.toString() === newGameState.turn?.toString());
        if (currentPlayer && currentPlayer.isBot) {
            console.log(`[TournamentRoom] Bot ${currentPlayer.username} should make first move in replay`);
            
            setTimeout(async () => {
                try {
                    await processTournamentMove(io, null, room.matchId, currentPlayer._id.toString(), { type: 'BOT_MOVE' });
                } catch (error) {
                    console.error(`[TournamentRoom] Error in bot move during replay:`, error);
                }
            }, 1000);
        }

    } catch (error) {
        console.error(`[TournamentRoom] Error starting tournament replay:`, error);
    }
}

// Запускаем очистку каждые 30 минут
setInterval(cleanupInactiveTournamentRooms, 30 * 60 * 1000);