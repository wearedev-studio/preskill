import { Server } from 'socket.io';
import { IRoom, GamePlayer, IGameResult, GameMove } from '../types/game.types';
import { gameLogics, getIO } from '../socket';
import User from '../models/User.model';
import GameRecord from '../models/GameRecord.model';
import Transaction from '../models/Transaction.model';
import { advanceTournamentWinner } from './tournament.service';

/**
 * Сервис для управления игровой логикой
 */
export class GameService {
    private io: Server;
    private rooms: Record<string, IRoom>;

    constructor(io: Server, rooms: Record<string, IRoom>) {
        this.io = io;
        this.rooms = rooms;
    }

    /**
     * Проверяет, является ли игрок ботом
     */
    private isBot(player: GamePlayer): boolean {
        if (!player || !player.user || !player.user._id) return false;
        return player.user._id.toString().startsWith('bot-');
    }

    /**
     * Форматирует название игры для базы данных
     */
    private formatGameNameForDB(gameType: string): 'Checkers' | 'Chess' | 'Backgammon' | 'Tic-Tac-Toe' {
        switch (gameType) {
            case 'tic-tac-toe': return 'Tic-Tac-Toe';
            case 'checkers': return 'Checkers';
            case 'chess': return 'Chess';
            case 'backgammon': return 'Backgammon';
            default: return 'Tic-Tac-Toe';
        }
    }

    /**
     * Возвращает публичное состояние комнаты
     */
    private getPublicRoomState(room: IRoom) {
        const { botJoinTimer, disconnectTimer, ...publicState } = room;
        return publicState;
    }

    /**
     * Обрабатывает ход игрока
     */
    async processPlayerMove(roomId: string, move: GameMove, playerId: string): Promise<boolean> {
        const room = this.rooms[roomId];
        if (!room || room.players.length < 2 || room.gameState.turn !== playerId) {
            return false;
        }

        const gameLogic = gameLogics[room.gameType];
        const { newState, error, turnShouldSwitch } = gameLogic.processMove(
            room.gameState, 
            move, 
            playerId, 
            room.players
        );
        
        if (error) {
            this.io.to(playerId).emit('error', { message: error });
            return false;
        }

        room.gameState = newState;
        
        // Проверяем конец игры
        const gameResult = gameLogic.checkGameEnd(room.gameState, room.players);
        if (gameResult.isGameOver) {
            await this.endGame(room, gameResult.winnerId, gameResult.isDraw);
            return true;
        }
        
        // Отправляем обновление состояния
        this.io.to(roomId).emit('gameUpdate', this.getPublicRoomState(room));
        
        // Обрабатываем ход бота, если необходимо
        if (turnShouldSwitch) {
            await this.processBotMove(room);
        }
        
        return true;
    }

    /**
     * Обрабатывает ход бота
     */
    private async processBotMove(room: IRoom): Promise<void> {
        const currentPlayer = room.players.find(p => 
            p.user._id.toString() === room.gameState.turn
        );
        
        if (!currentPlayer || !this.isBot(currentPlayer)) {
            return;
        }

        setTimeout(async () => {
            const currentRoom = this.rooms[room.id];
            if (!currentRoom) return;

            let botCanMove = true;
            let safetyBreak = 0;
            const gameLogic = gameLogics[currentRoom.gameType];

            while (botCanMove && safetyBreak < 10) {
                safetyBreak++;
                
                const botPlayerIndex = currentRoom.players.findIndex(p => this.isBot(p)) as 0 | 1;
                const botMove = gameLogic.makeBotMove(currentRoom.gameState, botPlayerIndex);
                
                if (!botMove || Object.keys(botMove).length === 0) break;

                const botProcessResult = gameLogic.processMove(
                    currentRoom.gameState,
                    botMove,
                    currentPlayer.user._id.toString(),
                    currentRoom.players
                );

                if (botProcessResult.error) break;

                currentRoom.gameState = botProcessResult.newState;
                
                // Проверяем конец игры после хода бота
                const botGameResult = gameLogic.checkGameEnd(currentRoom.gameState, currentRoom.players);
                if (botGameResult.isGameOver) {
                    await this.endGame(currentRoom, botGameResult.winnerId, botGameResult.isDraw);
                    return;
                }
                
                botCanMove = !botProcessResult.turnShouldSwitch;
            }

            if (currentRoom) {
                this.io.to(room.id).emit('gameUpdate', this.getPublicRoomState(currentRoom));
            }
        }, 1500);
    }

    /**
     * Завершает игру
     */
    async endGame(room: IRoom, winnerId?: string, isDraw: boolean = false): Promise<void> {
        console.log(`[GameService] Ending game in room ${room.id}, winner: ${winnerId}, draw: ${isDraw}`);
        
        // Обработка турнирных игр
        if (room.id.startsWith('tourney-')) {
            await this.endTournamentGame(room, winnerId, isDraw);
            return;
        }

        // Обработка обычных игр
        await this.endRegularGame(room, winnerId, isDraw);
    }

    /**
     * Завершает турнирную игру
     */
    private async endTournamentGame(room: IRoom, winnerId?: string, isDraw: boolean = false): Promise<void> {
        const [, tournamentId, , matchIdStr] = room.id.split('-');
        const matchId = parseInt(matchIdStr, 10);
        
        let winnerObject = null;
        if (winnerId && !isDraw) {
            const winnerPlayer = room.players.find(p => 
                p.user._id.toString() === winnerId
            );
            if (winnerPlayer) {
                winnerObject = {
                    _id: winnerPlayer.user._id.toString(),
                    username: winnerPlayer.user.username,
                    isBot: this.isBot(winnerPlayer)
                };
            }
        } else if (isDraw) {
            // В случае ничьи выбираем случайного победителя
            const randomWinner = room.players[Math.floor(Math.random() * room.players.length)];
            winnerObject = {
                _id: randomWinner.user._id.toString(),
                username: randomWinner.user.username,
                isBot: this.isBot(randomWinner)
            };
        }
        
        // Уведомляем игроков о результате
        this.io.to(room.id).emit('gameEnd', { 
            winner: winnerObject ? { user: winnerObject } : null, 
            isDraw 
        });
        
        // Продвигаем победителя в турнире
        if (winnerObject) {
            await advanceTournamentWinner(this.io, tournamentId, matchId.toString(), winnerObject);
        }
        
        delete this.rooms[room.id];
    }

    /**
     * Завершает обычную игру
     */
    private async endRegularGame(room: IRoom, winnerId?: string, isDraw: boolean = false): Promise<void> {
        // Очищаем таймеры
        if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
        if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
        
        const winner = room.players.find(p => p.user._id.toString() === winnerId);
        const loser = room.players.find(p => p.user._id.toString() !== winnerId);
        const gameNameForDB = this.formatGameNameForDB(room.gameType);

        if (isDraw) {
            // Обработка ничьи
            for (const player of room.players) {
                if (!this.isBot(player)) {
                    const opponent = room.players.find(p => p.user._id !== player.user._id);
                    await GameRecord.create({ 
                        user: player.user._id, 
                        gameName: gameNameForDB, 
                        status: 'DRAW', 
                        amountChanged: 0, 
                        opponent: opponent?.user.username || 'Bot' 
                    });
                }
            }
            this.io.to(room.id).emit('gameEnd', { winner: null, isDraw: true });
        } else if (winner && loser) {
            // Обработка победы/поражения
            const globalIO = getIO();
            
            if (!this.isBot(winner)) {
                const updatedWinner = await User.findByIdAndUpdate(winner.user._id, { $inc: { balance: room.bet } }, { new: true });
                await GameRecord.create({
                    user: winner.user._id,
                    gameName: gameNameForDB,
                    status: 'WON',
                    amountChanged: room.bet,
                    opponent: loser.user.username
                });
                const winnerTransaction = await Transaction.create({
                    user: winner.user._id,
                    type: 'WAGER_WIN',
                    amount: room.bet
                });

                // Отправляем обновление баланса через Socket.IO для победителя
                if (updatedWinner && globalIO) {
                    globalIO.emit('balanceUpdated', {
                        userId: winner.user._id.toString(),
                        newBalance: updatedWinner.balance,
                        transaction: {
                            type: winnerTransaction.type,
                            amount: winnerTransaction.amount,
                            status: winnerTransaction.status,
                            createdAt: new Date()
                        }
                    });
                }
            }
            if (!this.isBot(loser)) {
                const updatedLoser = await User.findByIdAndUpdate(loser.user._id, { $inc: { balance: -room.bet } }, { new: true });
                await GameRecord.create({
                    user: loser.user._id,
                    gameName: gameNameForDB,
                    status: 'LOST',
                    amountChanged: -room.bet,
                    opponent: winner.user.username
                });
                const loserTransaction = await Transaction.create({
                    user: loser.user._id,
                    type: 'WAGER_LOSS',
                    amount: room.bet
                });

                // Отправляем обновление баланса через Socket.IO для проигравшего
                if (updatedLoser && globalIO) {
                    globalIO.emit('balanceUpdated', {
                        userId: loser.user._id.toString(),
                        newBalance: updatedLoser.balance,
                        transaction: {
                            type: loserTransaction.type,
                            amount: loserTransaction.amount,
                            status: loserTransaction.status,
                            createdAt: new Date()
                        }
                    });
                }
            }
            this.io.to(room.id).emit('gameEnd', { winner, isDraw: false });
        }
        
        const gameType = room.gameType;
        delete this.rooms[room.id];
        
        // Обновляем список комнат в лобби
        this.broadcastLobbyState(gameType);
    }

    /**
     * Отправляет обновленный список комнат в лобби
     */
    private broadcastLobbyState(gameType: string): void {
        const availableRooms = Object.values(this.rooms)
            .filter(room => room.gameType === gameType && room.players.length < 2)
            .map(r => ({ 
                id: r.id, 
                bet: r.bet, 
                host: r.players.length > 0 
                    ? r.players[0] 
                    : { user: { username: 'Ожидание игрока' } } 
            }));
        
        this.io.to(`lobby-${gameType}`).emit('roomsList', availableRooms);
    }

    /**
     * Обрабатывает выход игрока из игры
     */
    async handlePlayerLeave(roomId: string, socketId: string): Promise<void> {
        const room = this.rooms[roomId];
        if (!room) return;
        
        const winningPlayer = room.players.find(p => p.socketId !== socketId);
        if (winningPlayer) {
            await this.endGame(room, winningPlayer.user._id.toString());
        } else {
            if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
            delete this.rooms[roomId];
            this.broadcastLobbyState(room.gameType);
        }
    }

    /**
     * Обрабатывает отключение игрока
     */
    handlePlayerDisconnect(socketId: string, userId: string): void {
        const roomId = Object.keys(this.rooms).find(id => 
            this.rooms[id].players.some(p => p.socketId === socketId)
        );
        
        if (!roomId) return;

        const room = this.rooms[roomId];
        if (room.botJoinTimer) clearTimeout(room.botJoinTimer);
        
        const remainingPlayer = room.players.find(p => p.socketId !== socketId);

        if (room.players.length < 2 || !remainingPlayer) {
            delete this.rooms[roomId];
            this.broadcastLobbyState(room.gameType);
        } else {
            this.io.to(remainingPlayer.socketId).emit('opponentDisconnected', { 
                message: `Противник отключился. Ожидание переподключения (60 сек)...` 
            });
            
            room.disconnectTimer = setTimeout(async () => {
                await this.endGame(room, remainingPlayer.user._id.toString());
            }, 60000);
        }
    }
}