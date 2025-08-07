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

        // Создаем начальное состояние игры
        const roomPlayers = players.map(p => ({
            socketId: p.socketId || 'offline',
            user: {
                _id: p._id,
                username: p.username,
                avatar: p.isBot ? 'bot_avatar.png' : 'default_avatar.png',
                balance: p.isBot ? 9999 : 0
            }
        }));

        const initialGameState = gameLogic.createInitialState(roomPlayers);

        // Создаем запись в базе данных
        const tournamentRoom = new TournamentRoom({
            tournamentId,
            matchId,
            gameType,
            players,
            gameState: initialGameState,
            status: 'WAITING'
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

        // Проверяем, что игрок участвует в этом матче
        const player = room.players.find(p => p._id === playerId);
        if (!player) {
            console.log(`[TournamentRoom] Player ${playerId} not in match ${matchId}`);
            socket.emit('error', { message: 'Вы не участвуете в этом матче' });
            return false;
        }

        // Обновляем socketId игрока
        player.socketId = socket.id;
        tournamentPlayerSockets[playerId] = socket.id;

        // Подключаем к комнате
        socket.join(`tournament-${matchId}`);

        // Обновляем статус комнаты
        if (room.status === 'WAITING') {
            room.status = 'ACTIVE';
            if (tournamentRooms[matchId]) {
                tournamentRooms[matchId] = room;
            }
            await TournamentRoom.findOneAndUpdate({ matchId }, { status: 'ACTIVE' });
        }

        // Отправляем состояние игры
        socket.emit('tournamentGameStart', {
            matchId,
            gameType: room.gameType,
            players: room.players,
            gameState: room.gameState,
            myPlayerId: playerId
        });

        // Проверяем, нужно ли боту сделать первый ход
        const currentPlayer = room.players.find(p => p._id === room.gameState.turn);
        if (currentPlayer && currentPlayer.isBot) {
            console.log(`[TournamentRoom] Bot ${currentPlayer.username} should start the game`);
            
            setTimeout(async () => {
                try {
                    // Используем ту же логику, что и в processTournamentMove
                    await processTournamentMove(io, null, room.matchId, currentPlayer._id, { type: 'BOT_MOVE' });
                } catch (error) {
                    console.error(`[TournamentRoom] Error in initial bot move:`, error);
                }
            }, 2000); // Задержка для инициализации
        }

        console.log(`[TournamentRoom] Player ${playerId} joined room ${matchId}`);
        return true;
    } catch (error) {
        console.error(`[TournamentRoom] Error joining room:`, error);
        socket.emit('error', { message: 'Ошибка подключения к матчу' });
        return false;
    }
}

export async function processTournamentMove(
    io: Server,
    socket: any,
    matchId: string,
    playerId: string,
    move: any
): Promise<void> {
    try {
        const room = tournamentRooms[matchId] || await TournamentRoom.findOne({ matchId });
        if (!room || room.status !== 'ACTIVE') {
            if (socket) socket.emit('error', { message: 'Матч недоступен' });
            return;
        }

        const isBot = room.players.find(p => p._id === playerId)?.isBot;
        if (!isBot && room.gameState.turn && room.gameState.turn.toString() !== playerId.toString()) {
            if (socket) socket.emit('error', { message: 'Сейчас не ваш ход' });
            console.log(`[TournamentRoom] Turn check failed: gameState.turn=${room.gameState.turn}, playerId=${playerId}`);
            return;
        }

        const gameLogic = gameLogics[room.gameType as keyof typeof gameLogics];
        if (!gameLogic) {
            if (socket) socket.emit('error', { message: 'Игровая логика недоступна' });
            return;
        }

        const roomPlayers = room.players.map(p => ({
            socketId: p.socketId || 'offline',
            user: {
                _id: p._id,
                username: p.username,
                avatar: p.isBot ? 'bot_avatar.png' : 'default_avatar.png',
                balance: p.isBot ? 9999 : 0
            }
        }));

        let newState, error;

        if (isBot && move.type === 'BOT_MOVE') {
            const botPlayerIndex = room.players.findIndex(p => p._id === playerId) as 0 | 1;
            const botMove = gameLogic.makeBotMove(room.gameState, botPlayerIndex);
            
            if (!botMove || Object.keys(botMove).length === 0) {
                console.log(`[TournamentRoom] Bot ${playerId} has no valid moves`);
                return;
            }
            
            const result = gameLogic.processMove(room.gameState, botMove, playerId, roomPlayers);
            newState = result.newState;
            error = result.error;
        }
        else if (room.gameType === 'backgammon' && move.type === 'ROLL_DICE') {
            const { rollDiceForBackgammon } = await import('../games/backgammon.logic');
            const result = rollDiceForBackgammon(room.gameState, playerId, roomPlayers);
            newState = result.newState;
            error = result.error;
        } else {
            const result = gameLogic.processMove(
                room.gameState,
                move,
                playerId,
                roomPlayers
            );
            newState = result.newState;
            error = result.error;
        }

        if (error) {
            if (socket) {
                socket.emit('tournamentGameError', {
                    matchId,
                    error: error
                });
            }
            console.log(`[TournamentRoom] Move error in match ${matchId}: ${error}`);
            return;
        }

        room.gameState = newState;
        if (tournamentRooms[matchId]) {
            tournamentRooms[matchId] = room;
        }
        await TournamentRoom.findOneAndUpdate({ matchId }, { gameState: newState });

        io.to(`tournament-${matchId}`).emit('tournamentGameUpdate', {
            matchId,
            gameState: newState
        });

        const gameResult = gameLogic.checkGameEnd(newState, roomPlayers);
        console.log(`[TournamentRoom] Game result check for match ${matchId}:`, gameResult);
        
        if (gameResult.isGameOver) {
            console.log(`[TournamentRoom] Game over detected for match ${matchId}, winner: ${gameResult.winnerId}, isDraw: ${gameResult.isDraw}`);
            await finishTournamentMatch(io, room, gameResult.winnerId, gameResult.isDraw);
            return;
        }

        const nextPlayer = room.players.find(p => p._id === newState.turn);
        if (nextPlayer && nextPlayer.isBot) {
            console.log(`[TournamentRoom] Bot ${nextPlayer.username} should make a move`);
            
            setTimeout(async () => {
                try {
                    const currentRoom = tournamentRooms[matchId] || await TournamentRoom.findOne({ matchId });
                    if (!currentRoom || currentRoom.status !== 'ACTIVE') return;

                    if (currentRoom.gameType === 'backgammon') {
                        const botPlayerId = nextPlayer._id;
                        
                        if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                            const { rollDiceForBackgammon } = await import('../games/backgammon.logic');
                            const { newState: diceState, error: diceError } = rollDiceForBackgammon(
                                currentRoom.gameState,
                                botPlayerId,
                                roomPlayers
                            );
                            
                            if (diceError) {
                                console.log('[TournamentBot] Dice roll error:', diceError);
                                return;
                            }
                            
                            currentRoom.gameState = diceState;
                            if (tournamentRooms[matchId]) {
                                tournamentRooms[matchId] = currentRoom;
                            }
                            await TournamentRoom.findOneAndUpdate({ matchId }, { gameState: diceState });
                            
                            io.to(`tournament-${matchId}`).emit('tournamentGameUpdate', {
                                matchId,
                                gameState: diceState
                            });
                            
                            if ((currentRoom.gameState as any).turnPhase === 'ROLLING') {
                                return;
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    let botCanMove = true;
                    let safetyBreak = 0;

                    while (botCanMove && safetyBreak < 10) {
                        safetyBreak++;
                        
                        const botPlayerIndex = currentRoom.players.findIndex(p => p.isBot) as 0 | 1;
                        const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex);
                        
                        if (!botMove || Object.keys(botMove).length === 0) break;

                        const botProcessResult = gameLogic.processMove(
                            currentRoom.gameState,
                            botMove,
                            nextPlayer._id,
                            roomPlayers
                        );

                        if (botProcessResult.error) break;

                        currentRoom.gameState = botProcessResult.newState;
                        if (tournamentRooms[matchId]) {
                            tournamentRooms[matchId] = currentRoom;
                        }
                        await TournamentRoom.findOneAndUpdate({ matchId }, { gameState: botProcessResult.newState });
                        
                        const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, roomPlayers);
                        if (botGameResult.isGameOver) {
                            await finishTournamentMatch(io, currentRoom, botGameResult.winnerId, botGameResult.isDraw);
                            return;
                        }
                        
                        botCanMove = !botProcessResult.turnShouldSwitch;
                        
                        if (currentRoom.gameType === 'backgammon' && botProcessResult.turnShouldSwitch) {
                            break;
                        }
                    }

                    io.to(`tournament-${matchId}`).emit('tournamentGameUpdate', {
                        matchId,
                        gameState: currentRoom.gameState
                    });

                } catch (error) {
                    console.error(`[TournamentRoom] Error in bot move:`, error);
                }
            }, 1500);
        }

        console.log(`[TournamentRoom] Processed move in match ${matchId}`);
    } catch (error) {
        console.error(`[TournamentRoom] Error processing move:`, error);
        socket.emit('error', { message: 'Ошибка обработки хода' });
    }
}

async function finishTournamentMatch(
    io: Server,
    room: ITournamentRoom,
    winnerId?: string,
    isDraw: boolean = false
): Promise<void> {
    try {
        console.log(`[TournamentRoom] Finishing match ${room.matchId}`);

        let winner: ITournamentRoomPlayer | undefined;
        if (winnerId && !isDraw) {
            winner = room.players.find(p => p._id === winnerId);
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
            isDraw
        });

        // Уведомляем игроков о результате матча и статусе в турнире
        await notifyPlayersAboutMatchResult(io, room, winner, isDraw);

        // Продвигаем победителя в турнире
        if (winner) {
            await advanceWinnerInTournament(io, room.tournamentId.toString(), room.matchId, winner);
        } else if (isDraw) {
            // В случае ничьи выбираем случайного победителя
            const randomWinner = room.players[Math.floor(Math.random() * room.players.length)];
            await advanceWinnerInTournament(io, room.tournamentId.toString(), room.matchId, randomWinner);
        }

        // Очищаем комнату из памяти через некоторое время
        setTimeout(() => {
            delete tournamentRooms[room.matchId];
            room.players.forEach(p => {
                if (tournamentPlayerSockets[p._id]) {
                    delete tournamentPlayerSockets[p._id];
                }
            });
        }, 30000); // 30 секунд

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
                    const isWinner = winner && player._id === winner._id;
                    const isLoser = !isDraw && !isWinner;

                    if (isWinner) {
                        // Игрок победил - уведомляем о переходе в следующий раунд
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
                        // Игрок проиграл - уведомляем об исключении
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
                        // Ничья
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

async function advanceWinnerInTournament(
    io: Server,
    tournamentId: string,
    matchId: string,
    winner: ITournamentRoomPlayer
): Promise<void> {
    try {
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament || tournament.status !== 'ACTIVE') {
            console.log(`[TournamentRoom] Tournament ${tournamentId} not found or not active`);
            return;
        }

        // Находим матч в турнирной сетке и записываем победителя
        let matchFound = false;
        for (const round of tournament.bracket) {
            const match = round.matches.find(m => m.matchId.toString() === matchId);
            if (match && !match.winner) {
                match.winner = {
                    _id: winner._id,
                    username: winner.username,
                    isBot: winner.isBot,
                    socketId: winner.socketId,
                    registeredAt: new Date()
                };
                match.status = 'FINISHED';
                matchFound = true;
                break;
            }
        }

        if (!matchFound) {
            console.log(`[TournamentRoom] Match ${matchId} not found in tournament bracket`);
            return;
        }

        await tournament.save();
        io.emit('tournamentUpdated', tournament);

        console.log(`[TournamentRoom] Advanced winner ${winner.username} in tournament ${tournamentId}`);

        // Проверяем, нужно ли создать следующий раунд
        await checkAndCreateNextRound(io, tournament);
    } catch (error) {
        console.error(`[TournamentRoom] Error advancing winner:`, error);
    }
}

async function checkAndCreateNextRound(io: Server, tournament: ITournament): Promise<void> {
    try {
        console.log(`[TournamentRoom] Checking next round for tournament ${tournament._id}`);
        console.log(`[TournamentRoom] Tournament bracket:`, JSON.stringify(tournament.bracket, null, 2));
        
        // Проверяем все раунды по порядку
        for (let i = 0; i < tournament.bracket.length; i++) {
            const round = tournament.bracket[i];
            console.log(`[TournamentRoom] Checking round ${i}:`, round.matches.map(m => ({ status: m.status, winner: m.winner?.username })));
            
            const allMatchesFinished = round.matches.every((m: ITournamentMatch) => m.status === 'FINISHED');
            const hasWaitingMatches = round.matches.some((m: ITournamentMatch) => m.status === 'WAITING');
            
            console.log(`[TournamentRoom] Round ${round.round}: allFinished=${allMatchesFinished}, hasWaiting=${hasWaitingMatches}`);
            
            if (allMatchesFinished && i + 1 < tournament.bracket.length) {
                // Текущий раунд завершен, нужно создать следующий
                const nextRound = tournament.bracket[i + 1];
                const nextRoundHasWaitingMatches = nextRound.matches.some((m: ITournamentMatch) => m.status === 'WAITING');
                
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

async function accelerateBotMatches(io: Server, tournament: ITournament, currentRound: any): Promise<void> {
    try {
        let acceleratedAny = false;
        
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
                        await advanceWinnerInTournament(io, tournament._id.toString(), room.matchId, winner);
                        
                        console.log(`[TournamentRoom] Accelerated bot match ${room.matchId}, winner: ${winner.username}`);
                        acceleratedAny = true;
                        
                        // КРИТИЧЕСКИ ВАЖНО: После каждого ускоренного матча перепроверяем турнир
                        setTimeout(async () => {
                            try {
                                const updatedTournament = await Tournament.findById(tournament._id);
                                if (updatedTournament) {
                                    console.log(`[TournamentRoom] Rechecking tournament ${tournament._id} after bot vs bot match`);
                                    await checkAndCreateNextRound(io, updatedTournament);
                                }
                            } catch (error) {
                                console.error(`[TournamentRoom] Error in recheck after bot vs bot match:`, error);
                            }
                        }, 500); // Быстрая перепроверка для бот-матчей
                    }
                }
            }
        }
        
        // КРИТИЧЕСКИ ВАЖНО: ВСЕГДА перепроверяем турнир после вызова accelerateBotMatches
        console.log(`[TournamentRoom] Rechecking tournament ${tournament._id} after accelerateBotMatches call`);
        setTimeout(async () => {
            try {
                const updatedTournament = await Tournament.findById(tournament._id);
                if (updatedTournament) {
                    await checkAndCreateNextRound(io, updatedTournament);
                }
            } catch (error) {
                console.error(`[TournamentRoom] Error in recheck after accelerateBotMatches:`, error);
            }
        }, 1500); // Достаточная задержка для завершения всех операций
    } catch (error) {
        console.error(`[TournamentRoom] Error accelerating bot matches:`, error);
    }
}

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
        const winners = currentRound.matches.map((m: ITournamentMatch) => m.winner).filter((w: any) => w !== null);

        console.log(`[TournamentRoom] Winners from round ${currentRound.round}:`, winners.map(w => w?.username));
        console.log(`[TournamentRoom] Need ${nextRound.matches.length * 2} winners, have ${winners.length}`);

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

                // Если оба игрока боты, запускаем НЕМЕДЛЕННУЮ автоматическую игру
                if (match.player1.isBot && match.player2.isBot) {
                    console.log(`[TournamentRoom] Starting immediate bot vs bot match ${match.matchId}`);
                    // Немедленно завершаем матч ботов без задержки
                    setTimeout(() => {
                        accelerateSingleBotMatch(io, room, tournament);
                    }, 500); // Минимальная задержка для инициализации
                }
            } else {
                console.error(`[TournamentRoom] Failed to create room for match ${match.matchId}`);
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
        }, 2000); // Даем время ботам завершить свои матчи
        
    } catch (error) {
        console.error(`[TournamentRoom] Error creating next round matches:`, error);
    }
}

async function accelerateSingleBotMatch(io: Server, room: any, tournament: any): Promise<void> {
    try {
        console.log(`[TournamentRoom] Accelerating single bot match ${room.matchId}`);

        // Случайно выбираем победителя
        const winner = room.players[Math.floor(Math.random() * room.players.length)];

        // Обновляем статус комнаты в памяти
        room.status = 'FINISHED';
        room.winner = winner;

        // Обновляем статус в базе данных
        if (tournamentRooms[room.matchId]) {
            tournamentRooms[room.matchId] = room;
        }
        await TournamentRoom.findOneAndUpdate(
            { matchId: room.matchId },
            { status: 'FINISHED', winner }
        );

        console.log(`[TournamentRoom] Updated accelerated bot match ${room.matchId} status to FINISHED`);

        // Уведомляем о завершении матча
        io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
            matchId: room.matchId,
            winner,
            isDraw: false
        });

        // Продвигаем победителя
        await advanceWinnerInTournament(io, tournament._id.toString(), room.matchId, winner);

        console.log(`[TournamentRoom] Accelerated bot match ${room.matchId} finished, winner: ${winner.username}`);
        
        // КРИТИЧЕСКИ ВАЖНО: После ускорения матча перепроверяем турнир
        setTimeout(async () => {
            try {
                const updatedTournament = await Tournament.findById(tournament._id);
                if (updatedTournament) {
                    console.log(`[TournamentRoom] Rechecking tournament ${tournament._id} after accelerated match`);
                    await checkAndCreateNextRound(io, updatedTournament);
                }
            } catch (error) {
                console.error(`[TournamentRoom] Error in recheck after accelerated match:`, error);
            }
        }, 1000); // Небольшая задержка для завершения всех операций
    } catch (error) {
        console.error(`[TournamentRoom] Error accelerating single bot match:`, error);
    }
}

async function finishTournament(io: Server, tournament: ITournament, winner: any): Promise<void> {
    try {
        console.log(`[TournamentRoom] Finishing tournament ${tournament._id}, winner: ${winner.username}`);

        tournament.status = 'FINISHED';
        tournament.winner = winner;
        tournament.finishedAt = new Date();

        // Рассчитываем и выплачиваем призы
        await distributePrizes(io, tournament);

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

async function distributePrizes(io: Server, tournament: ITournament): Promise<void> {
    try {
        console.log(`[TournamentRoom] Distributing prizes for tournament ${tournament._id}`);

        const totalPrizePool = tournament.prizePool;
        const platformCommission = (totalPrizePool * tournament.platformCommission) / 100;
        const netPrizePool = totalPrizePool - platformCommission;

        // Распределение призов (пример: 60% - 1 место, 30% - 2 место, 10% - 3-4 места)
        const prizeDistribution = {
            1: 0.6,  // 60% победителю
            2: 0.3,  // 30% финалисту
            3: 0.1   // 10% полуфиналистам (делится между ними)
        };

        // Находим финалистов и полуфиналистов
        const finalRound = tournament.bracket[tournament.bracket.length - 1];
        const semiFinalRound = tournament.bracket[tournament.bracket.length - 2];

        if (finalRound && finalRound.matches.length > 0) {
            const finalMatch = finalRound.matches[0];
            
            // Приз победителю
            if (tournament.winner && !tournament.winner.isBot) {
                const winnerPrize = Math.floor(netPrizePool * prizeDistribution[1]);
                await awardPrize(tournament.winner._id, winnerPrize, 'Победа в турнире', tournament.name);
            }

            // Приз финалисту (2 место)
            if (tournament.winner) {
                const finalist = finalMatch.player1._id === tournament.winner._id ? finalMatch.player2 : finalMatch.player1;
                if (finalist && !finalist.isBot) {
                    const finalistPrize = Math.floor(netPrizePool * prizeDistribution[2]);
                    await awardPrize(finalist._id, finalistPrize, '2 место в турнире', tournament.name);
                }
            }

            // Призы полуфиналистам (3-4 места)
            if (semiFinalRound && semiFinalRound.matches.length > 0) {
                const semifinalPrize = Math.floor((netPrizePool * prizeDistribution[3]) / semiFinalRound.matches.length);
                
                for (const match of semiFinalRound.matches) {
                    // Находим проигравших в полуфинале
                    if (match.winner) {
                        const loser = match.winner._id === match.player1._id ? match.player2 : match.player1;
                        
                        if (loser && !loser.isBot) {
                            await awardPrize(loser._id, semifinalPrize, '3-4 место в турнире', tournament.name);
                        }
                    }
                }
            }
        }

        console.log(`[TournamentRoom] Prizes distributed for tournament ${tournament._id}`);
    } catch (error) {
        console.error(`[TournamentRoom] Error distributing prizes:`, error);
    }
}

/**
 * Выдает приз игроку
 */
async function awardPrize(userId: string, amount: number, reason: string, tournamentName: string): Promise<void> {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        user.balance += amount;
        await user.save();

        // Создаем транзакцию
        await new Transaction({
            user: userId,
            type: 'TOURNAMENT_WINNINGS',
            amount
        }).save();

        console.log(`[TournamentRoom] Awarded ${amount} to ${user.username} for ${reason}`);
    } catch (error) {
        console.error(`[TournamentRoom] Error awarding prize:`, error);
    }
}

/**
 * Симулирует матч между ботами
 */
async function simulateBotVsBotMatch(io: Server, room: any, tournament: any): Promise<void> {
    try {
        console.log(`[TournamentRoom] Simulating bot vs bot match ${room.matchId}`);

        // Случайно выбираем победителя
        const winner = room.players[Math.floor(Math.random() * room.players.length)];

        // Имитируем время игры (30-120 секунд)
        const gameTime = 30000 + Math.random() * 90000;

        setTimeout(async () => {
            try {
                // Обновляем статус комнаты в памяти
                room.status = 'FINISHED';
                room.winner = winner;

                // КРИТИЧЕСКИ ВАЖНО: Обновляем статус в базе данных
                if (tournamentRooms[room.matchId]) {
                    tournamentRooms[room.matchId] = room;
                }
                await TournamentRoom.findOneAndUpdate(
                    { matchId: room.matchId },
                    { status: 'FINISHED', winner }
                );

                console.log(`[TournamentRoom] Updated bot match ${room.matchId} status to FINISHED in database`);

                // Уведомляем о завершении матча
                io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
                    matchId: room.matchId,
                    winner,
                    isDraw: false
                });

                // Продвигаем победителя
                await advanceTournamentWinner(io, tournament._id.toString(), room.matchId, winner);

                console.log(`[TournamentRoom] Bot match ${room.matchId} finished, winner: ${winner.username}`);
            } catch (innerError) {
                console.error(`[TournamentRoom] Error in bot match completion:`, innerError);
            }
        }, gameTime);
    } catch (error) {
        console.error(`[TournamentRoom] Error simulating bot match:`, error);
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

// Запускаем очистку каждые 30 минут
setInterval(cleanupInactiveTournamentRooms, 30 * 60 * 1000);