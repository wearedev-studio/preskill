import axios from 'axios';
import { Tournament } from './tournamentService';

import { API_URL } from '../api/index';

interface TournamentCreationData {
    name: string;
    gameType: string;
    entryFee: number;
    maxPlayers: number;
}

/**
 * Отправляет запрос на создание нового турнира
 * @param tournamentData - Данные для создания турнира
 */
export const createTournament = async (tournamentData: TournamentCreationData): Promise<Tournament> => {
    const { data } = await axios.post(`${API_URL}/api/admin/tournaments`, tournamentData);
    return data;
};

/**
 * Отправляет запрос на создание пустой комнаты в лобби
 * @param roomData - Данные для создания комнаты
 */
export const createLobbyRoom = async (roomData: { gameType: string, bet: number }) => {
    const { data } = await axios.post(`${API_URL}/api/admin/create-room`, roomData);
    return data;
}
