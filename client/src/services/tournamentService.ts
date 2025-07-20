import { API_URL } from '@/api';
import axios from 'axios';

// Типы данных, которые мы ожидаем от API
// Они должны соответствовать моделям на бэкенде
export interface ITournament {
    _id: string;
    gameType: string;
    name: string;
    status: 'REGISTERING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    entryFee: number;
    maxPlayers: number;
    players: string[]; // Массив ID игроков
    startTime: string;
    bracket: any[]; // Пока оставим any для гибкости
    createdAt: string;
}

/**
 * Получить список всех турниров
 */
export const getTournaments = async (): Promise<ITournament[]> => {
    const { data } = await axios.get(`${API_URL}/api/tournaments`);
    return data;
};

/**
 * Получить детальную информацию о конкретном турнире по ID
 */
export const getTournamentById = async (id: string): Promise<ITournament> => {
    const { data } = await axios.get(`${API_URL}/api/tournaments/${id}`);
    return data;
};

/**
 * Отправляет запрос на регистрацию в турнире
 */
export const registerForTournament = async (id: string) => {
    const { data } = await axios.post(`${API_URL}/api/tournaments/${id}/register`);
    return data;
};