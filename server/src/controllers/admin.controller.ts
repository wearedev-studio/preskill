import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { Room } from '../socket';
import User from '../models/User.model';
import { IGameLogic } from '../games/game.logic.interface';
import Tournament from '../models/Tournament.model';
import { startTournament } from '../services/tournament.service'; // Импортируем нашу функцию

import Transaction from '../models/Transaction.model';
import GameRecord from '../models/GameRecord.model';


// Временное хранилище комнат (в идеале должно быть синхронизировано с socket.ts)
// Мы решим это элегантно в app.ts
let roomsRef: Record<string, Room> = {}; 
let gameLogicsRef: Record<string, IGameLogic> = {};

export const setSocketData = (rooms: Record<string, Room>, gameLogics: Record<string, IGameLogic>) => {
    roomsRef = rooms;
    gameLogicsRef = gameLogics;
};

export const createAdminRoom = (req: Request, res: Response) => {
    const { gameType, bet } = req.body as { gameType: Room['gameType'], bet: number };

    if (!gameType || !bet || !gameLogicsRef[gameType]) {
        return res.status(400).json({ message: 'Неверный тип игры или ставка.' });
    }

    const gameLogic = gameLogicsRef[gameType];
    const roomId = `admin-${gameType}-${Date.now()}`;

    const newRoom: Room = {
        id: roomId,
        gameType,
        bet,
        players: [], // Комната создается ПУСТОЙ
        gameState: null, // Начальное состояние не создается, пока не войдет первый игрок
    };

    roomsRef[roomId] = newRoom;

    // Оповещаем всех в лобби о новой комнате
    const io: Server = req.app.get('io');
    const availableRooms = Object.values(roomsRef)
        .filter(room => room.gameType === gameType && room.players.length < 2)
        .map(r => ({ id: r.id, bet: r.bet, host: r.players.length > 0 ? r.players[0] : { user: { username: 'Ожидание игрока' } } }));
    
    io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);

    console.log(`[Admin] Room ${roomId} created.`);
    res.status(201).json({ message: 'Комната успешно создана', room: newRoom });
};

/** [ADMIN] Получить список активных комнат */
export const getActiveRooms = (req: Request, res: Response) => {
    // roomsRef инжектируется при старте сервера
    const publicRooms = Object.values(roomsRef).map(room => {
        return {
            id: room.id,
            gameType: room.gameType,
            bet: room.bet,
            players: room.players.map(p => p.user.username)
        }
    });
    res.json(publicRooms);
};

/** [ADMIN] Принудительно удалить комнату */
export const deleteRoom = (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = roomsRef[roomId];
    const io: Server = req.app.get('io');
    
    if (room) {
        // Оповещаем игроков в комнате, что админ ее закрыл
        io.to(roomId).emit('error', { message: 'Комната была закрыта администратором.' });
        
        // Удаляем комнату
        delete roomsRef[roomId];
        
        // Обновляем лобби для всех
        const availableRooms = Object.values(roomsRef) /* ... */;
        io.to(`lobby-${room.gameType}`).emit('roomsList', availableRooms);
        
        res.json({ message: `Комната ${roomId} успешно удалена.` });
    } else {
        res.status(404).json({ message: 'Комната не найдена.' });
    }
};

export const createTournament = async (req: Request, res: Response) => {
    const { name, gameType, entryFee, maxPlayers, startTime } = req.body;

    if (!name || !gameType || !maxPlayers || !startTime) {
        return res.status(400).json({ message: 'Пожалуйста, заполните все обязательные поля.' });
    }

    try {
        const tournament = new Tournament({
            name,
            gameType,
            entryFee: Number(entryFee) || 0,
            maxPlayers: Number(maxPlayers),
            startTime: new Date(startTime),
        });

        await tournament.save();
        res.status(201).json(tournament);
    } catch (error: any) {
        res.status(500).json({ message: 'Ошибка сервера при создании турнира', error: error.message });
    }
};

/** [ADMIN] Обновление турнира */
export const updateTournament = async (req: Request, res: Response) => {
    try {
        const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tournament) return res.status(404).json({ message: 'Турнир не найден' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/** [ADMIN] Удаление турнира */
export const deleteTournament = async (req: Request, res: Response) => {
    try {
        const tournament = await Tournament.findByIdAndDelete(req.params.id);
        if (!tournament) return res.status(404).json({ message: 'Турнир не найден' });
        res.json({ message: 'Турнир удален' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/**
 * Принудительный запуск турнира по ID
 */
export const startTournamentManually = async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const io: Server = req.app.get('io');

    try {
        await startTournament(id, io);
        res.json({ message: 'Турнир успешно запущен.' });
    } catch (error: any) {
        res.status(500).json({ message: 'Ошибка при запуске турнира', error: error.message });
    }
};

/**
 * [ADMIN] Получить список всех пользователей
 */
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/**
 * [ADMIN] Получить одного пользователя по ID
 */
export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/**
 * [ADMIN] Обновить пользователя
 */
export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Обновляем только разрешенные поля
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        user.role = req.body.role || user.role;
        user.balance = req.body.balance !== undefined ? req.body.balance : user.balance;

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            balance: updatedUser.balance
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/**
 * [ADMIN] Удалить пользователя
 */
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        await user.deleteOne(); // Используем новый метод Mongoose
        res.json({ message: 'Пользователь успешно удален' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/** [ADMIN] Получить все транзакции */
export const getAllTransactions = async (req: Request, res: Response) => {
    try {
        const transactions = await Transaction.find({}).populate('user', 'username').sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

/** [ADMIN] Получить всю историю игр */
export const getAllGameRecords = async (req: Request, res: Response) => {
    try {
        const games = await GameRecord.find({}).populate('user', 'username').sort({ createdAt: -1 });
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};