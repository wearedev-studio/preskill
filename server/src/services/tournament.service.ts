import { Server } from 'socket.io';
import cron from 'node-cron';
import Tournament, { ITournament } from '../models/Tournament.model';
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
    
    if (realPlayers.length === 0) {
        const winner = match.players[Math.floor(Math.random() * 2)];
        // Если играют два бота, сразу определяем победителя
        // @ts-ignore
        return advanceTournamentWinner(io, tournament._id, match.matchId, winner);
    }

    const roomId = `tourney-${tournament._id}-match-${match.matchId}`;
    const gameLogic = gameLogics[tournament.gameType];
    
    // Находим реальных игроков и их сокеты
    const roomPlayers = [];
    for (const player of realPlayers) {
        const socketId = userSocketMap[player._id.toString()];
        if (socketId) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                roomPlayers.push({ socketId, user: (socket as any).user });
            }
        }
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

    // Оповещаем игроков, что их матч готов
    roomPlayers.forEach(p => {
        const socket = io.sockets.sockets.get(p.socketId);
        socket?.join(roomId);
        // Старое событие, которое говорит странице турнира показать кнопку
        // @ts-ignore
        io.to(socket.id).emit('matchReady', { tournamentId: tournament._id, roomId });

        // НОВОЕ! Отправляем универсальное уведомление этому же игроку
        // @ts-ignore
        createNotification(io, (socket as any).user._id.toString(), {
            title: `⚔️ Ваш матч в турнире "${tournament.name}" готов!`,
            message: 'Нажмите, чтобы присоединиться.',
            link: `/tournaments/${tournament._id}`
        });
    });
}


/**
 * Обрабатывает результат завершенного матча, продвигает победителя и запускает следующие матчи.
 */
export async function advanceTournamentWinner(io: Server, tournamentId: string, matchId: number, winnerData: any) {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament || tournament.status !== 'ACTIVE') return;

    let currentRoundIndex = -1, currentMatchIndex = -1, nextRoundExists = false;

    // 1. Находим матч и обновляем победителя
    for (let i = 0; i < tournament.bracket.length; i++) {
        const matchIndex = tournament.bracket[i].matches.findIndex(m => m.matchId === matchId);
        if (matchIndex !== -1) {
            currentRoundIndex = i;
            currentMatchIndex = matchIndex;
            // Проверяем, что победитель еще не записан, чтобы избежать двойной обработки
            if (!tournament.bracket[i].matches[matchIndex].winner) {
                tournament.bracket[i].matches[matchIndex].winner = winnerData;
            }
            break;
        }
    }

    // 2. Проверяем, завершен ли текущий раунд
    const currentRound = tournament.bracket[currentRoundIndex];
    if (!currentRound.matches.every(m => m.winner)) {
        await tournament.save();
        io.emit('tournamentUpdated', { tournamentId });
        return; // Раунд еще не закончен, просто сохраняем результат
    }

    // 3. Раунд завершен. Готовим следующий или завершаем турнир.
    const winners = currentRound.matches.map(m => m.winner!);

    if (winners.length === 1) { // Это был финал
        tournament.status = 'FINISHED';
        const tournamentWinner = winners[0];
        // @ts-ignore
        if (!tournamentWinner.isBot) {
            await User.findByIdAndUpdate(tournamentWinner._id, { $inc: { balance: tournament.prizePool } });
            await Transaction.create({ user: tournamentWinner._id, type: 'TOURNAMENT_WINNINGS', amount: tournament.prizePool });
            await createNotification(io, tournamentWinner._id.toString(), {
                title: '🏆 Победа в турнире!',
                message: `Вы выиграли ${tournament.prizePool}$ в турнире "${tournament.name}"!`
            });
        }
        // @ts-ignore
        console.log(`[Tournament] ${tournament.name} finished. Winner: ${tournamentWinner.username}`);
    } else { // Создаем следующий раунд
        const nextRoundMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
            nextRoundMatches.push({
                matchId: Date.now() + i, // Уникальный ID для нового матча
                players: [winners[i], winners[i + 1]],
            });
        }
        tournament.bracket.push({ roundName: `Round ${currentRoundIndex + 2}`, matches: nextRoundMatches });
        
        // Сразу создаем игровые комнаты для нового раунда
        for (const match of nextRoundMatches) {
            await createTournamentMatchRoom(io, tournament, match);
        }
    }

    await tournament.save();
    io.emit('tournamentUpdated', { tournamentId });
}



/**
 * Основная функция, которая запускает турнир
 */
export async function startTournament(tournamentId: string, io: Server) {
    const tournament = await Tournament.findById(tournamentId).populate('players');
    if (!tournament || tournament.status !== 'REGISTERING') return;
    
    console.log(`[Tournament Service] Starting tournament ${tournament.name}`);

    const neededBots = tournament.maxPlayers - tournament.players.length;
    const botPlayers = Array.from({ length: neededBots }, (_, i) => ({
        _id: `bot-${Date.now()}-${i}`, isBot: true,
        username: botUsernames[Math.floor(Math.random() * botUsernames.length)],
    }));

    const allParticipants = [...tournament.players, ...botPlayers];
    shuffleArray(allParticipants);

    const matches = [];
    for (let i = 0; i < allParticipants.length; i += 2) {
        matches.push({ matchId: i / 2 + 1, players: [allParticipants[i], allParticipants[i + 1]] });
    }

    tournament.bracket = [{ roundName: 'Round 1', matches }];
    tournament.status = 'ACTIVE';
    
    for (const match of tournament.bracket[0].matches) {
        await createTournamentMatchRoom(io, tournament, match);
    }
    
    await tournament.save();
    io.emit('tournamentUpdated', { tournamentId: tournament._id });
}

/**
 * Инициализация CRON-задачи
 */
export const initializeTournamentScheduler = (io: Server) => {
    // Запускаем проверку каждую минуту
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const oneMinuteWarningTime = new Date(now.getTime() + 60 * 1000);

        // Находим турниры, которые скоро начнутся, для отправки уведомлений
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

        // Находим турниры, которые уже должны были начаться
        const dueTournaments = await Tournament.find({
            startTime: { $lte: now },
            status: 'REGISTERING',
        });
        for (const tournament of dueTournaments) {
            // @ts-ignore
            await startTournament(tournament._id.toString(), io);
        }
    });
};