import { Server } from 'socket.io';
import Tournament, { ITournament, ITournamentPlayer, ITournamentMatch } from '../models/Tournament.model';
import User from '../models/User.model';
import Transaction from '../models/Transaction.model';
import { createNotification } from './notification.service';
import { createTournamentRoom } from './tournamentRoom.service';
import { Types } from 'mongoose';

// Хранилище активных турниров в памяти
export const activeTournaments: Record<string, ITournament> = {};

// Хранилище таймеров турниров
const tournamentTimers: Record<string, NodeJS.Timeout> = {};

// Конфигурация ботов
const BOT_NAMES = [
    'AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot', 'EpsilonBot',
    'ZetaBot', 'EtaBot', 'ThetaBot', 'IotaBot', 'KappaBot',
    'LambdaBot', 'MuBot', 'NuBot', 'XiBot', 'OmicronBot',
    'PiBot', 'RhoBot', 'SigmaBot', 'TauBot', 'UpsilonBot'
];

/**
 * Создает новый турнир
 */
export async function createTournament(
    io: Server,
    name: string,
    gameType: string,
    maxPlayers: number,
    entryFee: number,
    prizePool: number,
    platformCommission: number = 10
): Promise<ITournament | null> {
    try {
        console.log(`[Tournament] Creating tournament: ${name}, ${gameType}, ${maxPlayers} players`);

        // Проверяем валидность параметров
        if (![4, 8, 16, 32].includes(maxPlayers)) {
            throw new Error('Количество игроков должно быть 4, 8, 16 или 32');
        }

        if (!['checkers', 'chess', 'backgammon', 'tic-tac-toe'].includes(gameType)) {
            throw new Error('Неподдерживаемый тип игры');
        }

        // Создаем турнир
        const tournament = new Tournament({
            name,
            gameType,
            maxPlayers,
            entryFee,
            prizePool,
            platformCommission,
            status: 'WAITING',
            players: [],
            bracket: [],
            createdAt: new Date(),
            firstRegistrationTime: null
        });

        await tournament.save();

        // Добавляем в память
        activeTournaments[tournament._id.toString()] = tournament;

        // Уведомляем всех о новом турнире
        io.emit('tournamentCreated', tournament);

        console.log(`[Tournament] Created tournament ${tournament._id}`);
        return tournament;
    } catch (error) {
        console.error(`[Tournament] Error creating tournament:`, error);
        return null;
    }
}

/**
 * Регистрирует игрока в турнире
 */
export async function registerPlayerInTournament(
    io: Server,
    tournamentId: string,
    userId: string,
    socketId: string
): Promise<{ success: boolean; message: string }> {
    try {
        console.log(`[Tournament] Registering player ${userId} in tournament ${tournamentId}`);

        const tournament = activeTournaments[tournamentId] || await Tournament.findById(tournamentId);
        if (!tournament) {
            return { success: false, message: 'Турнир не найден' };
        }

        if (tournament.status !== 'WAITING') {
            return { success: false, message: 'Турнир уже начался или завершен' };
        }

        // Проверяем, не зарегистрирован ли игрок уже
        if (tournament.players.some(p => p._id === userId)) {
            return { success: false, message: 'Вы уже зарегистрированы в этом турнире' };
        }

        // Проверяем лимит игроков
        if (tournament.players.length >= tournament.maxPlayers) {
            return { success: false, message: 'Турнир заполнен' };
        }

        // Получаем данные пользователя
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'Пользователь не найден' };
        }

        // Проверяем баланс
        if (user.balance < tournament.entryFee) {
            return { success: false, message: 'Недостаточно средств для участия' };
        }

        // Списываем взнос
        user.balance -= tournament.entryFee;
        await user.save();

        // Создаем транзакцию
        await new Transaction({
            user: userId,
            type: 'TOURNAMENT_FEE',
            amount: -tournament.entryFee
        }).save();

        // Добавляем игрока
        const player: ITournamentPlayer = {
            _id: userId,
            username: user.username,
            socketId,
            isBot: false,
            registeredAt: new Date()
        };

        tournament.players.push(player);

        // Устанавливаем время первой регистрации
        if (!tournament.firstRegistrationTime) {
            tournament.firstRegistrationTime = new Date();
            
            // Запускаем 15-секундный таймер
            const timer = setTimeout(() => {
                startTournamentWithBots(io, tournamentId);
            }, 15000);
            
            tournamentTimers[tournamentId] = timer;
            console.log(`[Tournament] Started 15-second timer for tournament ${tournamentId}`);
        }

        // Сохраняем изменения
        await tournament.save();
        activeTournaments[tournamentId] = tournament;

        // Уведомляем всех об обновлении
        io.emit('tournamentUpdated', tournament);

        // Уведомляем игрока
        await createNotification(io, userId, {
            title: `🎯 Регистрация в турнире "${tournament.name}"`,
            message: `Вы успешно зарегистрированы! Игроков: ${tournament.players.length}/${tournament.maxPlayers}`,
            link: `/tournament/${tournamentId}`
        });

        console.log(`[Tournament] Player ${user.username} registered in tournament ${tournamentId}`);

        // Проверяем, заполнен ли турнир
        if (tournament.players.length === tournament.maxPlayers) {
            // Отменяем таймер и сразу запускаем турнир
            if (tournamentTimers[tournamentId]) {
                clearTimeout(tournamentTimers[tournamentId]);
                delete tournamentTimers[tournamentId];
            }
            await startTournament(io, tournamentId);
        }

        return { success: true, message: 'Успешно зарегистрированы в турнире' };
    } catch (error) {
        console.error(`[Tournament] Error registering player:`, error);
        return { success: false, message: 'Ошибка регистрации в турнире' };
    }
}

/**
 * Запускает турнир с заполнением ботами
 */
async function startTournamentWithBots(io: Server, tournamentId: string): Promise<void> {
    try {
        console.log(`[Tournament] Starting tournament ${tournamentId} with bots`);

        const tournament = activeTournaments[tournamentId] || await Tournament.findById(tournamentId);
        if (!tournament || tournament.status !== 'WAITING') {
            console.log(`[Tournament] Tournament ${tournamentId} not found or not waiting`);
            return;
        }

        // Очищаем таймер
        if (tournamentTimers[tournamentId]) {
            clearTimeout(tournamentTimers[tournamentId]);
            delete tournamentTimers[tournamentId];
        }

        // Заполняем ботами до нужного количества
        const botsNeeded = tournament.maxPlayers - tournament.players.length;
        if (botsNeeded > 0) {
            const usedBotNames = new Set();
            
            for (let i = 0; i < botsNeeded; i++) {
                let botName;
                do {
                    botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
                } while (usedBotNames.has(botName));
                
                usedBotNames.add(botName);

                const botPlayer: ITournamentPlayer = {
                    _id: new Types.ObjectId().toString(),
                    username: botName,
                    socketId: 'bot',
                    isBot: true,
                    registeredAt: new Date()
                };

                tournament.players.push(botPlayer);
            }

            console.log(`[Tournament] Added ${botsNeeded} bots to tournament ${tournamentId}`);
        }

        await startTournament(io, tournamentId);
    } catch (error) {
        console.error(`[Tournament] Error starting tournament with bots:`, error);
    }
}

/**
 * Запускает турнир
 */
async function startTournament(io: Server, tournamentId: string): Promise<void> {
    try {
        console.log(`[Tournament] Starting tournament ${tournamentId}`);

        const tournament = activeTournaments[tournamentId] || await Tournament.findById(tournamentId);
        if (!tournament || tournament.status !== 'WAITING') {
            console.log(`[Tournament] Tournament ${tournamentId} not found or not waiting`);
            return;
        }

        // Перемешиваем игроков для случайной сетки
        const shuffledPlayers = [...tournament.players].sort(() => Math.random() - 0.5);

        // Создаем турнирную сетку
        const bracket = createTournamentBracket(shuffledPlayers);
        tournament.bracket = bracket;
        tournament.status = 'ACTIVE';
        tournament.startedAt = new Date();

        // Сохраняем изменения
        await tournament.save();
        activeTournaments[tournamentId] = tournament;

        // Уведомляем всех о начале турнира
        io.emit('tournamentStarted', tournament);

        // Уведомляем игроков
        for (const player of tournament.players) {
            if (!player.isBot) {
                await createNotification(io, player._id, {
                    title: `🚀 Турнир "${tournament.name}" начался!`,
                    message: `Игра: ${tournament.gameType}. Удачи в первом раунде!`,
                    link: `/tournament/${tournamentId}`
                });
            }
        }

        console.log(`[Tournament] Tournament ${tournamentId} started with ${tournament.players.length} players`);

        // Создаем матчи первого раунда
        await createFirstRoundMatches(io, tournament);
    } catch (error) {
        console.error(`[Tournament] Error starting tournament:`, error);
    }
}

/**
 * Создает турнирную сетку
 */
function createTournamentBracket(players: ITournamentPlayer[]): any[] {
    const bracket = [];
    const totalPlayers = players.length;
    let currentRoundPlayers = [...players];
    let roundNumber = 1;

    while (currentRoundPlayers.length > 1) {
        const matches = [];
        const nextRoundPlayers: ITournamentPlayer[] = [];

        // Создаем пары для текущего раунда
        for (let i = 0; i < currentRoundPlayers.length; i += 2) {
            const player1 = currentRoundPlayers[i];
            const player2 = currentRoundPlayers[i + 1];

            const match: ITournamentMatch = {
                matchId: new Types.ObjectId(),
                player1,
                player2,
                winner: undefined,
                status: roundNumber === 1 ? 'PENDING' : 'WAITING'
            };

            matches.push(match);
            // Добавляем временного игрока для следующего раунда (будет заменен на победителя)
            nextRoundPlayers.push({
                _id: 'temp',
                username: 'TBD',
                socketId: 'temp',
                isBot: false,
                registeredAt: new Date()
            });
        }

        bracket.push({
            round: roundNumber,
            matches
        });

        currentRoundPlayers = nextRoundPlayers;
        roundNumber++;
    }

    return bracket;
}

/**
 * Создает матчи первого раунда
 */
async function createFirstRoundMatches(io: Server, tournament: ITournament): Promise<void> {
    try {
        console.log(`[Tournament] Creating first round matches for tournament ${tournament._id}`);

        const firstRound = tournament.bracket[0];
        if (!firstRound) {
            console.error(`[Tournament] No first round found for tournament ${tournament._id}`);
            return;
        }

        // Создаем турнирные комнаты для каждого матча
        for (const match of firstRound.matches) {
            const players = [
                {
                    _id: match.player1._id,
                    username: match.player1.username,
                    socketId: match.player1.socketId,
                    isBot: match.player1.isBot
                },
                {
                    _id: match.player2._id,
                    username: match.player2.username,
                    socketId: match.player2.socketId,
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
                match.status = 'ACTIVE';
                console.log(`[Tournament] Created room for match ${match.matchId}`);

                // Если оба игрока боты, запускаем автоматическую игру
                if (match.player1.isBot && match.player2.isBot) {
                    setTimeout(() => {
                        simulateBotVsBotMatch(io, room, tournament);
                    }, 2000 + Math.random() * 3000); // 2-5 секунд задержки
                }
            }
        }

        // Сохраняем изменения
        await tournament.save();
        activeTournaments[tournament._id.toString()] = tournament;

        // Уведомляем об обновлении
        io.emit('tournamentUpdated', tournament);

        console.log(`[Tournament] Created ${firstRound.matches.length} matches for first round`);
    } catch (error) {
        console.error(`[Tournament] Error creating first round matches:`, error);
    }
}

/**
 * Симулирует матч между ботами
 */
async function simulateBotVsBotMatch(io: Server, room: any, tournament: ITournament): Promise<void> {
    try {
        console.log(`[Tournament] Simulating bot vs bot match ${room.matchId}`);

        // Случайно выбираем победителя
        const winner = room.players[Math.floor(Math.random() * room.players.length)];

        // Имитируем время игры (30-120 секунд)
        const gameTime = 30000 + Math.random() * 90000;

        setTimeout(async () => {
            // Обновляем статус комнаты
            room.status = 'FINISHED';
            room.winner = winner;

            // Уведомляем о завершении матча
            io.to(`tournament-${room.matchId}`).emit('tournamentGameEnd', {
                matchId: room.matchId,
                winner,
                isDraw: false
            });

            // Продвигаем победителя
            await advanceTournamentWinner(io, tournament._id.toString(), room.matchId, winner);

            console.log(`[Tournament] Bot match ${room.matchId} finished, winner: ${winner.username}`);
        }, gameTime);
    } catch (error) {
        console.error(`[Tournament] Error simulating bot match:`, error);
    }
}

/**
 * Продвигает победителя в следующий раунд
 */
export async function advanceTournamentWinner(
    io: Server,
    tournamentId: string,
    matchId: string,
    winner: any
): Promise<void> {
    try {
        console.log(`[Tournament] Advancing winner ${winner.username} in tournament ${tournamentId}`);

        const tournament = activeTournaments[tournamentId] || await Tournament.findById(tournamentId);
        if (!tournament || tournament.status !== 'ACTIVE') {
            console.log(`[Tournament] Tournament ${tournamentId} not found or not active`);
            return;
        }

        // Находим матч и записываем победителя
        let currentRoundIndex = -1;
        let matchIndex = -1;

        for (let i = 0; i < tournament.bracket.length; i++) {
            const round = tournament.bracket[i];
            const foundMatchIndex = round.matches.findIndex(m => m.matchId.toString() === matchId);
            if (foundMatchIndex !== -1) {
                currentRoundIndex = i;
                matchIndex = foundMatchIndex;
                break;
            }
        }

        if (currentRoundIndex === -1 || matchIndex === -1) {
            console.log(`[Tournament] Match ${matchId} not found in tournament bracket`);
            return;
        }

        const match = tournament.bracket[currentRoundIndex].matches[matchIndex];
        match.winner = winner;
        match.status = 'FINISHED';

        // Проверяем, завершен ли текущий раунд
        const currentRound = tournament.bracket[currentRoundIndex];
        const allMatchesFinished = currentRound.matches.every(m => m.status === 'FINISHED');

        if (allMatchesFinished) {
            console.log(`[Tournament] Round ${currentRound.round} finished`);
            
            // Логика создания следующего раунда и завершения турнира
            // теперь обрабатывается в tournamentRoom.service.ts
            console.log(`[Tournament] Round processing will be handled by tournament room service`);
        }

        // Сохраняем изменения
        await tournament.save();
        activeTournaments[tournamentId] = tournament;

        // Уведомляем об обновлении
        io.emit('tournamentUpdated', tournament);

        console.log(`[Tournament] Winner ${winner.username} advanced in tournament ${tournamentId}`);
    } catch (error) {
        console.error(`[Tournament] Error advancing winner:`, error);
    }
}

// Функции createNextRoundMatches, finishTournament, distributePrizes и awardPrize
// перенесены в tournamentRoom.service.ts для избежания дублирования

/**
 * Получает список активных турниров
 */
export async function getActiveTournaments(): Promise<ITournament[]> {
    try {
        const tournaments = await Tournament.find({
            status: { $in: ['WAITING', 'ACTIVE'] }
        }).sort({ createdAt: -1 });

        return tournaments;
    } catch (error) {
        console.error(`[Tournament] Error getting active tournaments:`, error);
        return [];
    }
}

/**
 * Получает турнир по ID
 */
export async function getTournamentById(tournamentId: string): Promise<ITournament | null> {
    try {
        const tournament = activeTournaments[tournamentId] || await Tournament.findById(tournamentId);
        return tournament;
    } catch (error) {
        console.error(`[Tournament] Error getting tournament:`, error);
        return null;
    }
}

/**
 * Очищает завершенные турниры из памяти
 */
export function cleanupFinishedTournaments(): void {
    Object.keys(activeTournaments).forEach(tournamentId => {
        const tournament = activeTournaments[tournamentId];
        if (tournament.status === 'FINISHED') {
            delete activeTournaments[tournamentId];
            console.log(`[Tournament] Cleaned up finished tournament ${tournamentId}`);
        }
    });
}

// Запускаем очистку каждые 30 минут
setInterval(cleanupFinishedTournaments, 30 * 60 * 1000);