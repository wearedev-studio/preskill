import { Request, Response } from 'express';
import { Server } from 'socket.io';
import Tournament from '../models/Tournament.model';
import User from '../models/User.model';
import Transaction from '../models/Transaction.model';

// Получение всех турниров
export const getAllTournaments = async (req: Request, res: Response) => {
    try {
        const tournaments = await Tournament.find({}).sort({ startTime: 1 });
        res.json(tournaments);
    } catch (error: any) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Получение одного турнира по ID
export const getTournamentDetails = async (req: Request, res: Response) => {
    try {
        const tournament = await Tournament.findById(req.params.id).populate('players', 'username');
        if (tournament) {
            res.json(tournament);
        } else {
            res.status(404).json({ message: 'Турнир не найден' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Хранилище активных таймеров турниров
const tournamentTimers = new Map<string, NodeJS.Timeout>();

/**
 * Регистрация текущего пользователя в турнире
 */
export const registerInTournament = async (req: Request, res: Response) => {
    const tournamentId = req.params.id;
    const userId = req.user!._id;

    try {
        const tournament = await Tournament.findById(tournamentId);
        const user = await User.findById(userId);

        // --- Проверки ---
        if (!tournament) return res.status(404).json({ message: 'Турнир не найден.' });
        if (!user) return res.status(404).json({ message: 'Пользователь не найден.' });
        if (tournament.status !== 'REGISTERING') return res.status(400).json({ message: 'Регистрация на этот турнир закрыта.' });
        if (tournament.players.length >= tournament.maxPlayers) return res.status(400).json({ message: 'Турнир уже заполнен.' });
        // @ts-ignore
        if (tournament.players.includes(userId)) return res.status(400).json({ message: 'Вы уже зарегистрированы в этом турнире.' });
        if (user.balance < tournament.entryFee) return res.status(400).json({ message: 'Недостаточно средств для вступительного взноса.' });

        // --- Выполнение операций ---
        // 1. Списываем баланс и создаем транзакцию
        user.balance -= tournament.entryFee;
        await user.save();
        await Transaction.create({ user: userId, type: 'TOURNAMENT_FEE', amount: tournament.entryFee });

        // 2. Добавляем игрока в турнир
        // @ts-ignore
        tournament.players.push(userId);
        
        // 3. Устанавливаем время первой регистрации, если это первый игрок
        if (tournament.players.length === 1) {
            tournament.firstRegistrationTime = new Date();
        }
        
        // 4. Рассчитываем призовой фонд с учетом комиссии
        const totalFees = tournament.entryFee * (tournament.players.length);
        const commission = Math.floor(totalFees * (tournament.platformCommission / 100));
        tournament.prizePool = totalFees - commission;
        
        await tournament.save();
        
        // 5. Оповещаем всех через сокеты, что данные турнира обновились
        const io: Server = req.app.get('io');
        io.emit('tournamentUpdated', { tournamentId });

        // 6. Логика запуска турнира
        if (tournament.players.length >= tournament.maxPlayers) {
            // Турнир заполнен - запускаем немедленно
            const { startTournament } = await import('../services/tournament.service');
            
            // Отменяем таймер, если он был установлен
            if (tournamentTimers.has(tournamentId)) {
                clearTimeout(tournamentTimers.get(tournamentId)!);
                tournamentTimers.delete(tournamentId);
            }
            
            setTimeout(() => {
                startTournament(tournamentId, io);
            }, 2000); // Небольшая задержка для обновления UI
        } else if (tournament.players.length === 1) {
            // Первый игрок зарегистрировался - запускаем 15-секундный таймер
            console.log(`[Tournament] Starting 15-second timer for tournament ${tournamentId}`);
            
            const timer = setTimeout(async () => {
                try {
                    // Проверяем, что турнир все еще в статусе регистрации
                    const currentTournament = await Tournament.findById(tournamentId);
                    if (currentTournament && currentTournament.status === 'REGISTERING') {
                        console.log(`[Tournament] 15-second timer expired for tournament ${tournamentId}, starting with ${currentTournament.players.length} players`);
                        const { startTournament } = await import('../services/tournament.service');
                        startTournament(tournamentId, io);
                    }
                } catch (error) {
                    console.error(`[Tournament] Error in timer for tournament ${tournamentId}:`, error);
                } finally {
                    tournamentTimers.delete(tournamentId);
                }
            }, 15000); // 15 секунд
            
            tournamentTimers.set(tournamentId, timer);
        }

        res.json({ message: 'Вы успешно зарегистрировались в турнире!' });

    } catch (error) {
        console.error('Tournament registration error:', error);
        res.status(500).json({ message: 'Ошибка сервера при регистрации.' });
    }
};