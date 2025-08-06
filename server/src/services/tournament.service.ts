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
    const realPlayers = match.players.filter((p: any) => !p.isBot);
    
    // Если играют только боты, сразу определяем случайного победителя
    if (realPlayers.length === 0) {
        const winner = match.players[Math.floor(Math.random() * 2)];
        console.log(`[Tournament] Bot vs Bot match: ${match.players[0].username} vs ${match.players[1].username}, winner: ${winner.username}`);
        return advanceTournamentWinner(io, tournament._id!.toString(), match.matchId, winner);
    }

    const roomId = `tourney-${tournament._id}-match-${match.matchId}`;
    const gameLogic = gameLogics[tournament.gameType];
    
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
        } else {
            // Для реального игрока ищем его сокет
            const socketId = userSocketMap[player._id.toString()];
            if (socketId) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    roomPlayers.push({ socketId, user: (socket as any).user });
                }
            }
        }
    }

    // Если не удалось найти всех реальных игроков, откладываем матч
    if (roomPlayers.length !== match.players.length) {
        console.log(`[Tournament] Not all players found for match ${match.matchId}, retrying later`);
        setTimeout(() => createTournamentMatchRoom(io, tournament, match), 5000);
        return;
    }

    const newRoom: Room = {
        id: roomId,
        gameType: tournament.gameType,
        bet: 0, // В турнирах нет ставок
        players: roomPlayers,
        gameState: gameLogic.createInitialState(roomPlayers),
    };
    rooms[roomId] = newRoom;

    // Сохраняем ID комнаты в базе данных
    const round = tournament.bracket.find(r => r.matches.some(m => m.matchId === match.matchId));
    const matchInDB = round?.matches.find(m => m.matchId === match.matchId);
    if (matchInDB) matchInDB.roomId = roomId;

    // Оповещаем только реальных игроков
    for (const player of roomPlayers) {
        if (!player.user._id.toString().startsWith('bot-')) {
            const socket = io.sockets.sockets.get(player.socketId);
            if (socket) {
                socket.join(roomId);
                io.to(socket.id).emit('matchReady', { 
                    tournamentId: tournament._id, 
                    roomId 
                });

                // Отправляем уведомление
                createNotification(io, (socket as any).user._id.toString(), {
                    title: `⚔️ Ваш матч в турнире "${tournament.name}" готов!`,
                    message: 'Нажмите, чтобы присоединиться.',
                    link: `/tournaments/${tournament._id}`
                });
            }
        }
    }

    console.log(`[Tournament] Created match room ${roomId} for tournament ${tournament.name}`);
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
        
        console.log(`[Tournament Service] Starting tournament ${tournament.name} with ${tournament.players.length} players`);

        // Добавляем ботов до нужного количества
        const neededBots = tournament.maxPlayers - tournament.players.length;
        const botPlayers: ITournamentPlayer[] = Array.from({ length: neededBots }, (_, i) => ({
            _id: `bot-${Date.now()}-${i}`,
            isBot: true,
            username: botUsernames[Math.floor(Math.random() * botUsernames.length)] + `_${i + 1}`,
        }));

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
 * Инициализация CRON-задачи
 */
export const initializeTournamentScheduler = (io: Server) => {
    // Запускаем проверку каждую минуту
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const oneMinuteWarningTime = new Date(now.getTime() + 60 * 1000);

            // Находим турниры, которые скоро начнутся
            const warningTournaments = await Tournament.find({
                startTime: { $gt: now, $lte: oneMinuteWarningTime },
                status: 'REGISTERING',
            });
            
            for (const tournament of warningTournaments) {
                for (const playerId of tournament.players) {
                    await createNotification(io, playerId.toString(), {
                        title: '⏰ Турнир скоро начнется!',
                        message: `Турнир "${tournament.name}" начнется через минуту.`,
                        link: `/tournaments/${tournament._id}`
                    });
                }
            }

            // Находим турниры, которые должны начаться
            const dueTournaments = await Tournament.find({
                startTime: { $lte: now },
                status: 'REGISTERING',
            });
            
            for (const tournament of dueTournaments) {
                if (tournament.players.length > 0) {
                    await startTournament(tournament._id!.toString(), io);
                } else {
                    // Если нет игроков, отменяем турнир
                    tournament.status = 'CANCELLED';
                    await tournament.save();
                    console.log(`[Tournament] Cancelled tournament ${tournament.name} - no players`);
                }
            }
        } catch (error) {
            console.error('[Tournament Scheduler] Error:', error);
        }
    });
    
    console.log('[Tournament Scheduler] Initialized');
};