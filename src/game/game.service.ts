import { Injectable } from '@nestjs/common';
import { GameState } from './interfaces/game-state.interface';
import { Player } from './interfaces/player.interface';
import { GAME_CONSTANTS } from './constants/game.constants';

@Injectable()
export class GameService {
  private gameState: GameState = {
    players: [],
    currentRound: 0,
    cards: {
      revealed: Array(GAME_CONSTANTS.NUM_CARDS).fill(false),
    },
    pot: 0,
    gameStarted: false,
    roundInProgress: false,
  };

  getState(): GameState {
    return this.gameState;
  }

  addPlayer(player: Player): void {
    this.gameState.players.push(player);
  }

  removePlayer(socketId: string): void {
    this.gameState.players = this.gameState.players.filter(p => p.socketId !== socketId);
  }

  placeBet(socketId: string, amount: number, cardIndex: number): boolean {
    const player = this.gameState.players.find(p => p.socketId === socketId);
    if (!player) {
      console.warn(`[BET FAIL] No player found for socketId: ${socketId}`);
      return false;
    }
    if (player.chips < amount) {
      console.warn(`[BET FAIL] Player ${player.name} (${socketId}) has insufficient chips: ${player.chips} < ${amount}`);
      return false;
    }
    if (!this.gameState.roundInProgress) {
      console.warn(`[BET FAIL] Round not in progress for player ${player.name} (${socketId})`);
      return false;
    }
    if (amount < GAME_CONSTANTS.MIN_BET || amount > GAME_CONSTANTS.MAX_BET) {
      console.warn(`[BET FAIL] Bet amount ${amount} out of range (${GAME_CONSTANTS.MIN_BET}-${GAME_CONSTANTS.MAX_BET}) for player ${player.name} (${socketId})`);
      return false;
    }
    if (cardIndex < 1 || cardIndex > GAME_CONSTANTS.NUM_CARDS) {
      console.warn(`[BET FAIL] Card index ${cardIndex} out of range (1-${GAME_CONSTANTS.NUM_CARDS}) for player ${player.name} (${socketId})`);
      return false;
    }
    if (player.currentBet) {
      console.warn(`[BET FAIL] Player ${player.name} (${socketId}) already placed a bet this round.`);
      return false;
    }
    player.currentBet = { amount, cardIndex };
    player.chips -= amount;
    this.gameState.pot += amount;
    console.log(`[BET SUCCESS] Player ${player.name} (${socketId}) bet ${amount} on card ${cardIndex}`);
    return true;
  }

  startNewRound(): void {
    this.gameState.currentRound++;
    this.gameState.roundInProgress = true;
    this.gameState.pot = 0;
    this.gameState.cards = {
      revealed: Array(GAME_CONSTANTS.NUM_CARDS).fill(false),
    };
    this.gameState.players.forEach(player => {
      player.currentBet = undefined;
    });
    console.log(`[ROUND STARTED] Round ${this.gameState.currentRound} started. All bets reset.`);
  }

  determineRedCardPosition(): number {
    const bets = this.gameState.players
      .filter(p => p.currentBet)
      .map(p => p.currentBet!.cardIndex);
    const betCounts = Array(GAME_CONSTANTS.NUM_CARDS).fill(0);
    bets.forEach(bet => betCounts[bet - 1]++);
    const minBets = Math.min(...betCounts);
    const possiblePositions = betCounts
      .map((count, index) => count === minBets ? index + 1 : null)
      .filter(pos => pos !== null);
    return possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
  }

  completeRound(): { winners: Player[], redCardPosition: number, noBetPlayers: Player[] } {
    const redCardPosition = this.determineRedCardPosition();
    this.gameState.cards.redCardPosition = redCardPosition;
    const winners = this.gameState.players.filter(
      player => player.currentBet && player.currentBet.cardIndex === redCardPosition
    );
    winners.forEach(winner => {
      const payout = winner.currentBet!.amount * 2;
      winner.chips += payout;
      winner.rewardsEarned += payout;
      this.gameState.pot -= winner.currentBet!.amount;
    });
    this.gameState.players.forEach(player => {
      if (player.currentBet && player.currentBet.cardIndex !== redCardPosition) {
        player.rewardsLost += player.currentBet.amount;
      }
    });
    const noBetPlayers = this.gameState.players.filter(player => !player.currentBet);
    this.gameState.roundInProgress = false;
    return { winners, redCardPosition, noBetPlayers };
  }
} 