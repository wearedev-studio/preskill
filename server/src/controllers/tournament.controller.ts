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

        // 2. Добавляем игрока в турнир и увеличиваем призовой фонд
        // @ts-ignore
        tournament.players.push(userId);
        tournament.prizePool += tournament.entryFee;
        await tournament.save();
        
        // 3. Оповещаем всех через сокеты, что данные турнира обновились
        const io: Server = req.app.get('io');
        io.emit('tournamentUpdated', { tournamentId });

        res.json({ message: 'Вы успешно зарегистрировались в турнире!' });

    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера при регистрации.' });
    }
};