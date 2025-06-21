import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GAME_CONSTANTS } from './constants/game.constants';
import { GameService } from './game.service';
import { Player } from './interfaces/player.interface';

/**
 * GameGateway handles all Socket.IO events for the game.
 *
 * ## Events
 * - joinGame: Join the game (payload: string playerName)
 * - placeBet: Place a bet (payload: { amount: number, cardIndex: number })
 * - startRound: Start a new round (no payload)
 *
 * ## Emits
 * - playerJoined: Player object
 * - betPlaced: { amount, cardIndex }
 * - betFailed: { message }
 * - gameState: Game state object
 * - roundStarted: Game state object
 * - roundCompleted: { gameState, winners, redCardPosition, noBetPlayers }
 * - redCardRevealed: { redCardPosition, gameState }
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : [
          'http://localhost:5173',
          'http://localhost:5000',
          'http://localhost:3000',
          'http://192.168.1.211:5173',
        ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly gameService: GameService) {}

  /**
   * Handle new client connection
   * @param client Socket
   */
  handleConnection(client: Socket) {
    console.log(`[SOCKET] Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnect
   * @param client Socket
   */
  handleDisconnect(client: Socket) {
    this.gameService.removePlayer(client.id);
    this.server.emit('gameState', this.gameService.getState());
    console.log(`[SOCKET] Client disconnected: ${client.id}`);
  }

  /**
   * joinGame event
   * @param client Socket
   * @param playerName string - Player name
   * Emits: playerJoined, gameState, betFailed
   */
  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, playerName: string) {
    console.log(`[RECV] joinGame from ${client.id}:`, playerName);
    if (
      this.gameService.getState().players.some((p) => p.name === playerName)
    ) {
      client.emit('betFailed', {
        message: 'Name already taken. Choose another.',
      });
      console.error(
        `[SOCKET ERROR] Join failed for name: ${playerName} (duplicate)`,
      );
      return;
    }
    const newPlayer: Player = {
      id: Math.random().toString(36).substring(2, 9),
      name: playerName,
      socketId: client.id,
      chips: GAME_CONSTANTS.INITIAL_CHIPS,
      bets: [],
      rewardsEarned: 0,
      rewardsLost: 0,
    };
    this.gameService.addPlayer(newPlayer);
    client.emit('playerJoined', newPlayer);
    this.server.emit('gameState', this.gameService.getState());
    console.log(`[SOCKET] Player joined: ${playerName} (${client.id})`);
    // Auto-start a round if none is in progress
    const state = this.gameService.getState();
    if (!state.roundInProgress) {
      this.handleStartRound();
    }
  }

  /**
   * placeBet event
   * @param client Socket
   * @param data { amount: number, cardIndex: number }
   * Emits: betPlaced, gameState, betFailed
   */
  @SubscribeMessage('placeBet')
  handlePlaceBet(client: Socket, data: { amount: number; cardIndex: number }) {
    console.log(`[RECV] placeBet from ${client.id}:`, data);
    // Find the player before placing the bet
    const playerBefore = this.gameService.getState().players.find(
      (p) => p.socketId === client.id,
    );
    const chipsBefore = playerBefore?.chips ?? null;
    const success = this.gameService.placeBet(
      client.id,
      data.amount,
      data.cardIndex,
    );
    // Find the player after placing the bet
    const playerAfter = this.gameService.getState().players.find(
      (p) => p.socketId === client.id,
    );
    const chipsAfter = playerAfter?.chips ?? null;
    if (success) {
      // Emit to the betting client
      client.emit('betPlaced', {
        amount: data.amount,
        cardIndex: data.cardIndex,
        chipsBefore,
        chipsAfter,
      });
      // Emit to all clients (global betPlaced event)
      this.server.emit('betPlaced', {
        playerName: playerAfter?.name,
        playerId: playerAfter?.id,
        amount: data.amount,
        cardIndex: data.cardIndex,
        chipsAfter, // always use chipsAfter for consistency
        chipsBefore,
        pot: this.gameService.getState().pot,
      });
      this.server.emit('gameState', this.gameService.getState());
      console.log(
        `[SOCKET] Bet placed: ${data.amount} on card ${data.cardIndex} by ${client.id} | Chips before: ${chipsBefore} | Chips after: ${chipsAfter}`,
      );
    } else {
      client.emit('betFailed', { message: 'Bet could not be placed' });
      console.error(`[SOCKET ERROR] Bet failed for ${client.id}`);
    }
  }

  /**
   * startRound event
   * No payload
   * Emits: roundStarted, roundCompleted, redCardRevealed
   */
  @SubscribeMessage('startRound')
  handleStartRound(client?: Socket, data?: any) {
    console.log(`[RECV] startRound from ${client?.id ?? 'server/auto'}:`, data);
    const gameState = this.gameService.getState();
    if (!gameState.roundInProgress) {
      this.gameService.startNewRound();
      this.server.emit('roundStarted', this.gameService.getState());
      setTimeout(() => {
        const { winners, redCardPosition, noBetPlayers, betResults } =
          this.gameService.completeRound();
        this.server.emit('roundCompleted', {
          gameState: this.gameService.getState(),
          winners: winners.map((p) => p.id),
          redCardPosition,
          noBetPlayers: noBetPlayers.map((p) => p.id),
          betResults, // send detailed bet results
        });
        // Emit redCardRevealed event for frontend animation
        setTimeout(() => {
          this.server.emit('redCardRevealed', {
            redCardPosition,
            gameState: this.gameService.getState(),
          });
          // Start next round after reveal delay
          setTimeout(() => {
            this.handleStartRound();
          }, GAME_CONSTANTS.REVEAL_DELAY);
        }, 1000); // 1s after roundCompleted, reveal the card
        console.log(
          `[SOCKET] Round completed. Red card: ${redCardPosition}, Winners: ${winners
            .map((p) => p.name)
            .join(', ')}, No bet: ${noBetPlayers
            .map((p) => p.name)
            .join(', ')}`,
        );
      }, GAME_CONSTANTS.ROUND_DELAY);
      console.log('[SOCKET] Round started');
    }
  }
}
