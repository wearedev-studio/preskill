// import { Room } from "../socket";

// export type GameMove = any;
// export type GameState = any;

// export interface IGameLogic {
//   createInitialState(players: Room['players']): GameState;

//   processMove(
//     gameState: GameState, 
//     move: GameMove, 
//     playerId: string,
//     players: Room['players']
//   ): { 
//       newState: GameState; 
//       error?: string; 
//       turnShouldSwitch: boolean; // Добавляем флаг для управления сменой хода
//   };

//   checkGameEnd(
//     gameState: GameState,
//     players: Room['players'],
//     nextPlayerId: string
//   ): { isGameOver: boolean; winnerId?: string; isDraw: boolean };
  
//   makeBotMove(
//       gameState: GameState, 
//       playerIndex: 0 | 1 // Теперь бот будет знать, кем он играет
//   ): GameMove;
// }

import { Room } from "../socket";

export type GameMove = any;
export type GameState = any;

export interface IGameLogic {
  createInitialState(players: Room['players']): GameState;

  processMove(
    gameState: GameState, 
    move: GameMove, 
    playerId: string,
    players: Room['players']
  ): { 
      newState: GameState; 
      error?: string; 
      turnShouldSwitch: boolean;
  };

  checkGameEnd(
    gameState: GameState,
    players: Room['players']
  ): { isGameOver: boolean; winnerId?: string; isDraw: boolean };
  
  makeBotMove(
      gameState: GameState, 
      playerIndex: 0 | 1
  ): GameMove;
}

// import { Room } from "../socket";

// export type GameMove = any;
// export type GameState = any;

// export interface IGameLogic {
//   /**
//    * Создает начальное состояние доски и игры.
//    */
//   createInitialState(players: Room['players']): GameState;

//   /**
//    * Обрабатывает ход игрока, проверяет его валидность и возвращает новое состояние.
//    */
//   processMove(
//     gameState: GameState, 
//     move: GameMove, 
//     playerId: string,
//     players: Room['players']
//   ): { newState: GameState; error?: string };

//   /**
//    * Проверяет, завершена ли игра (победа или ничья).
//    */
//   checkGameEnd(
//     gameState: GameState,
//     players: Room['players']
//   ): { isGameOver: boolean; winnerId?: string; isDraw: boolean };
  
//   /**
//    * Генерирует ход для бота на основе текущего состояния игры.
//    */
//   makeBotMove(gameState: GameState): GameMove;
// }