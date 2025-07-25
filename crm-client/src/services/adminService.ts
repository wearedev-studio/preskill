import axios from 'axios';
import { API_URL } from '../api';

// Тип для данных пользователя, которые можно обновлять
export interface IUpdateUserData {
    username?: string;
    email?: string;
    role?: 'USER' | 'ADMIN';
    balance?: number;
}

// Интерфейс для транзакции, получаемой с сервера
export interface ITransaction {
    _id: string;
    user: {
        _id: string;
        username: string;
    };
    type: string;
    status: string;
    amount: number;
    createdAt: string;
}

export interface IGameRecord {
    _id: string;
    user: {
        _id: string;
        username: string;
    };
    gameName: string;
    opponent: string;
    status: 'WON' | 'LOST' | 'DRAW';
    amountChanged: number;
    createdAt: string;
}

export interface IActiveRoom {
    id: string;
    gameType: string;
    bet: number;
    players: string[];
}

export interface ITournament {
    _id: string;
    name: string;
    gameType: string;
    status: string;
    players: any[];
    maxPlayers: number;
    entryFee: number;
    startTime: string;
}

export interface IUpdateTournamentData {
    name?: string;
    gameType?: string;
    entryFee?: number;
    maxPlayers?: number;
    startTime?: string;
}

export interface ICreateTournamentData {
    name: string;
    gameType: string;
    entryFee: number;
    maxPlayers: number;
    startTime: string;
}

// Простой сервис для получения данных
export const getAdminUsers = async () => {
    const { data } = await axios.get(`${API_URL}/api/admin/users`);
    return data;
};

export const getAdminGameRecords = async (): Promise<IGameRecord[]> => {
    const { data } = await axios.get(`${API_URL}/api/admin/games`);
    return data;
};

/**
 * [ADMIN] Обновляет данные пользователя по ID
 */
export const updateUser = async (userId: string, userData: IUpdateUserData) => {
    const { data } = await axios.put(`${API_URL}/api/admin/users/${userId}`, userData);
    return data;
};

/**
 * [ADMIN] Удаляет пользователя по ID
 */
export const deleteUser = async (userId: string) => {
    const { data } = await axios.delete(`${API_URL}/api/admin/users/${userId}`);
    return data;
};

/**
 * [ADMIN] Получает все транзакции
 */
export const getAdminTransactions = async (): Promise<ITransaction[]> => {
    const { data } = await axios.get(`${API_URL}/api/admin/transactions`);
    return data;
};

/**
 * [ADMIN] Получает список всех активных комнат
 */
export const getAdminActiveRooms = async (): Promise<IActiveRoom[]> => {
    const { data } = await axios.get(`${API_URL}/api/admin/rooms`);
    return data;
};

/**
 * [ADMIN] Создает пустую комнату в лобби
 */
export const createAdminRoom = async (roomData: { gameType: string, bet: number }): Promise<any> => {
    const { data } = await axios.post(`${API_URL}/api/admin/create-room`, roomData);
    return data;
};

/**
 * [ADMIN] Удаляет активную комнату по ID
 */
export const deleteAdminRoom = async (roomId: string): Promise<{ message: string }> => {
    const { data } = await axios.delete(`${API_URL}/api/admin/rooms/${roomId}`);
    return data;
};

/**
 * [ADMIN] Получает список всех турниров
 */
export const getAdminTournaments = async (): Promise<ITournament[]> => {
    const { data } = await axios.get(`${API_URL}/api/tournaments`); // Используем тот же публичный эндпоинт
    return data;
};

/**
 * [ADMIN] Создает новый турнир
 */
export const createAdminTournament = async (tournamentData: ICreateTournamentData): Promise<ITournament> => {
    const { data } = await axios.post(`${API_URL}/api/admin/tournaments`, tournamentData);
    return data;
};

/**
 * [ADMIN] Обновляет данные турнира по ID
 */
export const updateAdminTournament = async (tournamentId: string, tournamentData: IUpdateTournamentData): Promise<ITournament> => {
    const { data } = await axios.put(`${API_URL}/api/admin/tournaments/${tournamentId}`, tournamentData);
    return data;
};

/**
 * [ADMIN] Удаляет турнир по ID
 */
export const deleteAdminTournament = async (tournamentId: string): Promise<{ message: string }> => {
    const { data } = await axios.delete(`${API_URL}/api/admin/tournaments/${tournamentId}`);
    return data;
};
