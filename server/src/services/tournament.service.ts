import { Server } from 'socket.io';
import cron from 'node-cron';
import Tournament, { ITournament, ITournamentPlayer } from '../models/Tournament.model';
import { botUsernames, Room, gameLogics, rooms, userSocketMap } from '../socket';
import User from '../models/User.model';
import Transaction from '../models/Transaction.model';
import { createNotification } from './notification.service';

// Вспомогательная функция для перемешивания
function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Создает игровую комнату для турнирного матча и оповещает игроков
 */
async function createTournamentMatchRoom(io: Server, tournament: ITournament, match: any) {
    console.log(`[Tournament] Creating match room for tournament ${tournament.name}, match ${match.matchId}`);
    console.log(`[Tournament] Match players:`, match.players.map((p: any) => `${p.username} (bot: ${p.isBot})`));
    
    const realPlayers = match.players.filter((p: any) => !p.isBot);
    
    // Если играют только боты, имитируем игру с задержкой
    if (realPlayers.length === 0) {
        const winner = match.players[Math.floor(Math.random() * 2)];
        console.log(`[Tournament] Bot vs Bot match: ${match.players[0].username} vs ${match.players[1].username}, winner: ${winner.username}`);
        
        // Имитируем время игры (от 30 секунд до 2 минут)
        const gameTime = Math.random() * (120000 - 30000) + 30000;
        setTimeout(() => {
            advanceTournamentWinner(io, tournament._id!.toString(), match.matchId, winner);
        }, gameTime);
        return;
    }

    const roomId = `tourney-${tournament._id}-match-${match.matchId}`;
    console.log(`[Tournament] Creating room with ID: ${roomId}`);
    
    const gameLogic = gameLogics[tournament.gameType];
    if (!gameLogic) {
        console.error(`[Tournament] No game logic found for game type: ${tournament.gameType}`);
        return;
    }
    
    // Создаем игроков для комнаты (включая ботов)
    const roomPlayers = [];
    for (const player of match.players) {
        if (player.isBot) {
            // Для бота создаем фиктивного игрока
            roomPlayers.push({
                socketId: 'bot_socket_id',
                user: {
                    _id: player._id,
                    username: player.username,
                    avatar: 'bot_avatar.png',
                    balance: 9999
                }
            });
            console.log(`[Tournament] Added bot player: ${player.username}`);
        } else {
            // Для реального игрока ищем его сокет
            const socketId = userSocketMap[player._id.toString()];
            console.log(`[Tournament] Looking for socket for player ${player.username} (${player._id}): ${socketId}`);
            console.log(`[Tournament] Current userSocketMap:`, Object.keys(userSocketMap));
            
            if (socketId) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    roomPlayers.push({ socketId, user: (socket as any).user });
                    console.log(`[Tournament] Added real player: ${player.username} with socket ${socketId}`);
                } else {
                    console.log(`[Tournament] Socket ${socketId} not found for player ${player.username}`);
                    // Попробуем добавить игрока без активного сокета
                    roomPlayers.push({
                        socketId: 'offline_player',
                        user: {
                            _id: player._id,
                            username: player.username,
                            avatar: 'default_avatar.png',
                            balance: 0
                        }
                    });
                    console.log(`[Tournament] Added offline player: ${player.username}`);
                }
            } else {
                console.log(`[Tournament] No socket mapping found for player ${player.username}`);
                // Попробуем добавить игрока без активного сокета
                roomPlayers.push({
                    socketId: 'offline_player',
                    user: {
                        _id: player._id,
                        username: player.username,
                        avatar: 'default_avatar.png',
                        balance: 0
                    }
                });
                console.log(`[Tournament] Added offline player: ${player.username}`);
            }
        }
    }

    // Проверяем, что у нас есть хотя бы игроки для матча
    if (roomPlayers.length === 0) {
        console.log(`[Tournament] No players found for match ${match.matchId}, retrying later`);
        setTimeout(() => createTournamentMatchRoom(io, tournament, match), 5000);
        return;
    }
    
    console.log(`[Tournament] Created room with ${roomPlayers.length} players for match ${match.matchId}`);

    console.log(`[Tournament] Creating initial game state for ${tournament.gameType}`);
    const initialGameState = gameLogic.createInitialState(roomPlayers);
    
    const newRoom: Room = {
        id: roomId,
        gameType: tournament.gameType,
        bet: 0, // В турнирах нет ставок
        players: roomPlayers,
        gameState: initialGameState,
    };
    rooms[roomId] = newRoom;
    console.log(`[Tournament] Room ${roomId} created and added to rooms`);

    // Сохраняем ID комнаты в базе данных
    const round = tournament.bracket.find(r => r.matches.some(m => m.matchId === match.matchId));
    const matchInDB = round?.matches.find(m => m.matchId === match.matchId);
    if (matchInDB) {
        matchInDB.roomId = roomId;
        // Сохраняем изменения в базе данных
        await Tournament.findByIdAndUpdate(tournament._id, tournament);
        console.log(`[Tournament] Saved roomId ${roomId} to database for match ${match.matchId}`);
    }

    // Оповещаем всех реальных игроков из исходного матча
    for (const player of match.players) {
        if (!player.isBot) {
            console.log(`[Tournament] Processing real player: ${player.username} (${player._id})`);
            
            // Ищем активный сокет игрока
            const socketId = userSocketMap[player._id.toString()];
            if (socketId) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.join(roomId);
                    console.log(`[Tournament] Player ${player.username} joined room ${roomId}`);
                    
                    io.to(socket.id).emit('matchReady', {
                        tournamentId: tournament._id,
                        roomId
                    });
                    console.log(`[Tournament] Sent matchReady event to ${player.username}`);

                    // Отправляем уведомление
                    createNotification(io, player._id.toString(), {
                        title: `⚔️ Ваш матч в турнире "${tournament.name}" готов!`,
                        message: 'Переходим к игре...',
                        link: `/tournaments/${tournament._id}`
                    });
                } else {
                    console.log(`[Tournament] Socket ${socketId} not found for player ${player.username}`);
                }
            } else {
                console.log(`[Tournament] No socket mapping found for player ${player.username}`);
            }
        }
    }

    console.log(`[Tournament] Successfully created match room ${roomId} for tournament ${tournament.name}`);
}

/**
 * Обрабатывает результат завершенного матча, продвигает победителя и запускает следующие матчи.
 */
export async function advanceTournamentWinner(io: Server, tournamentId: string, matchId: number, winnerData: any) {
    try {
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament || tournament.status !== 'ACTIVE') {
            console.log(`[Tournament] Tournament ${tournamentId} not found or not active`);
            return;
        }

        let currentRoundIndex = -1;
        let currentMatchIndex = -1;

        // 1. Находим матч и обновляем победителя
        for (let i = 0; i < tournament.bracket.length; i++) {
            const matchIndex = tournament.bracket[i].matches.findIndex(m => m.matchId === matchId);
            if (matchIndex !== -1) {
                currentRoundIndex = i;
                currentMatchIndex = matchIndex;
                
                // Проверяем, что победитель еще не записан
                if (!tournament.bracket[i].matches[matchIndex].winner) {
                    tournament.bracket[i].matches[matchIndex].winner = winnerData;
                    console.log(`[Tournament] Match ${matchId} winner: ${winnerData.username || winnerData._id}`);
                } else {
                    console.log(`[Tournament] Match ${matchId} already has a winner, skipping`);
                    return;
                }
                break;
            }
        }

        if (currentRoundIndex === -1) {
            console.log(`[Tournament] Match ${matchId} not found in tournament ${tournamentId}`);
            return;
        }

        // 2. Проверяем, завершен ли текущий раунд
        const currentRound = tournament.bracket[currentRoundIndex];
        const allMatchesFinished = currentRound.matches.every(m => m.winner);
        
        if (!allMatchesFinished) {
            await tournament.save();
            io.emit('tournamentUpdated', { tournamentId });
            console.log(`[Tournament] Round ${currentRoundIndex + 1} not finished yet`);
            return;
        }

        // 3. Раунд завершен. Готовим следующий или завершаем турнир.
        const winners = currentRound.matches.map(m => m.winner!);
        console.log(`[Tournament] Round ${currentRoundIndex + 1} finished. Winners:`, winners.map(w => w.username));

        if (winners.length === 1) {
            // Это был финал
            tournament.status = 'FINISHED';
            const tournamentWinner = winners[0];
            
            // Награждаем победителя (только если это не бот)
            if (!tournamentWinner.isBot && tournamentWinner._id) {
                await User.findByIdAndUpdate(tournamentWinner._id, {
                    $inc: { balance: tournament.prizePool }
                });
                await Transaction.create({
                    user: tournamentWinner._id,
                    type: 'TOURNAMENT_WINNINGS',
                    amount: tournament.prizePool
                });
                await createNotification(io, tournamentWinner._id.toString(), {
                    title: '🏆 Победа в турнире!',
                    message: `Вы выиграли ${tournament.prizePool}$ в турнире "${tournament.name}"!`
                });
            }
            
            console.log(`[Tournament] ${tournament.name} finished. Winner: ${tournamentWinner.username}, Prize: ${tournament.prizePool}$`);
            
            console.log(`[Tournament] ${tournament.name} finished. Winner: ${tournamentWinner.username}`);
        } else {
            // Создаем следующий раунд
            const nextRoundMatches = [];
            for (let i = 0; i < winners.length; i += 2) {
                const matchId = Date.now() + Math.random(); // Уникальный ID
                nextRoundMatches.push({
                    matchId: Math.floor(matchId),
                    players: [winners[i], winners[i + 1]],
                    winner: undefined,
                    roomId: undefined
                });
            }
            
            const roundNames = ['Round 1', 'Quarter-finals', 'Semi-finals', 'Final'];
            const roundName = roundNames[currentRoundIndex + 1] || `Round ${currentRoundIndex + 2}`;
            
            tournament.bracket.push({
                roundName,
                matches: nextRoundMatches
            });
            
            console.log(`[Tournament] Created ${roundName} with ${nextRoundMatches.length} matches`);
            
            // Сразу создаем игровые комнаты для нового раунда
            for (const match of nextRoundMatches) {
                await createTournamentMatchRoom(io, tournament, match);
            }
        }

        await tournament.save();
        io.emit('tournamentUpdated', { tournamentId });
        
    } catch (error) {
        console.error(`[Tournament] Error in advanceTournamentWinner:`, error);
    }
}

/**
 * Основная функция, которая запускает турнир
 */
export async function startTournament(tournamentId: string, io: Server) {
    try {
        const tournament = await Tournament.findById(tournamentId).populate('players');
        if (!tournament || tournament.status !== 'REGISTERING') {
            console.log(`[Tournament] Cannot start tournament ${tournamentId} - not found or not in REGISTERING status`);
            return;
        }
        
        console.log(`[Tournament Service] Starting tournament ${tournament.name} with ${tournament.players.length} real players`);

        // Добавляем ботов до нужного количества
        const neededBots = tournament.maxPlayers - tournament.players.length;
        const botPlayers: ITournamentPlayer[] = Array.from({ length: neededBots }, (_, i) => ({
            _id: `bot-${Date.now()}-${i}`,
            isBot: true,
            username: botUsernames[Math.floor(Math.random() * botUsernames.length)] + `_Bot${i + 1}`,
        }));
        
        console.log(`[Tournament Service] Adding ${neededBots} bots to fill tournament`);

        // Преобразуем реальных игроков в ITournamentPlayer
        const realPlayers: ITournamentPlayer[] = await Promise.all(
            tournament.players.map(async (playerId) => {
                const user = await User.findById(playerId).select('username');
                return {
                    _id: playerId.toString(),
                    username: user?.username || 'Unknown',
                    isBot: false
                };
            })
        );

        const allParticipants = [...realPlayers, ...botPlayers];
        shuffleArray(allParticipants);

        // Создаем первый раунд
        const matches = [];
        for (let i = 0; i < allParticipants.length; i += 2) {
            matches.push({
                matchId: Math.floor(Date.now() + Math.random() + i),
                players: [allParticipants[i], allParticipants[i + 1]],
                winner: undefined,
                roomId: undefined
            });
        }

        tournament.bracket = [{ roundName: 'Round 1', matches }];
        tournament.status = 'ACTIVE';
        
        // Создаем игровые комнаты для первого раунда
        for (const match of tournament.bracket[0].matches) {
            await createTournamentMatchRoom(io, tournament, match);
        }
        
        await tournament.save();
        io.emit('tournamentUpdated', { tournamentId: tournament._id });
        
        console.log(`[Tournament] Successfully started tournament ${tournament.name}`);
        
    } catch (error) {
        console.error(`[Tournament] Error starting tournament ${tournamentId}:`, error);
    }
}

/**
 * Инициализация системы турниров
 */
export const initializeTournamentScheduler = (io: Server) => {
    // Очищаем старые турниры в статусе REGISTERING без игроков
    cron.schedule('0 */6 * * *', async () => { // Каждые 6 часов
        try {
            const oldTournaments = await Tournament.find({
                status: 'REGISTERING',
                players: { $size: 0 },
                createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Старше 24 часов
            });
            
            for (const tournament of oldTournaments) {
                await Tournament.findByIdAndDelete(tournament._id);
                console.log(`[Tournament] Cleaned up old empty tournament: ${tournament.name}`);
            }
        } catch (error) {
            console.error('[Tournament Cleanup] Error:', error);
        }
    });
    
    console.log('[Tournament System] Initialized with instant matchmaking');
};