import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { Room } from '../socket';
import { IGameLogic } from '../games/game.logic.interface';
import Tournament from '../models/Tournament.model';
import { startTournament } from '../services/tournament.service'; // Импортируем нашу функцию


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