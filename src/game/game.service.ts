import { Injectable } from '@nestjs/common';
import { GAME_CONSTANTS } from './constants/game.constants';
import { GameState } from './interfaces/game-state.interface';
import { Player } from './interfaces/player.interface';

@Injectable()
export class GameService {
  private gameState: GameState = {
    players: [],
    currentRound: 0,
    cards: {
      revealed: Array(GAME_CONSTANTS.NUM_CARDS).fill(false) as boolean[],
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
    console.log(`[DEBUG] Player added: ${player.name} (${player.id}) | Total players: ${this.gameState.players.length}`);
  }

  removePlayer(socketId: string): void {
    const player = this.gameState.players.find((p) => p.socketId === socketId);
    this.gameState.players = this.gameState.players.filter(
      (p) => p.socketId !== socketId,
    );
    console.log(`[DEBUG] Player removed: ${player?.name ?? 'unknown'} (${socketId}) | Total players: ${this.gameState.players.length}`);
  }

  placeBet(socketId: string, amount: number, cardIndex: number): boolean {
    const player = this.gameState.players.find((p) => p.socketId === socketId);
    if (!player) {
      console.warn(`[BET FAIL] No player found for socketId: ${socketId}`);
      return false;
    }
    if (player.chips < amount) {
      console.warn(
        `[BET FAIL] Player ${player.name} (${socketId}) has insufficient chips: ${player.chips} < ${amount}`,
      );
      return false;
    }
    if (!this.gameState.roundInProgress) {
      console.warn(
        `[BET FAIL] Round not in progress for player ${player.name} (${socketId})`,
      );
      return false;
    }
    if (amount < GAME_CONSTANTS.MIN_BET) {
      console.warn(
        `[BET FAIL] Bet amount ${amount} below min (${GAME_CONSTANTS.MIN_BET}) for player ${player.name} (${socketId})`,
      );
      return false;
    }
    if (cardIndex < 1 || cardIndex > GAME_CONSTANTS.NUM_CARDS) {
      console.warn(
        `[BET FAIL] Card index ${cardIndex} out of range (1-${GAME_CONSTANTS.NUM_CARDS}) for player ${player.name} (${socketId})`,
      );
      return false;
    }
    if (!Array.isArray(player.bets)) {
      player.bets = [];
    }
    player.bets.push({ amount, cardIndex });
    player.chips -= amount;
    this.gameState.pot += amount;
    console.log(
      `[BET SUCCESS] Player ${player.name} (${socketId}) bet ${amount} on card ${cardIndex} | Chips left: ${player.chips} | Pot: ${this.gameState.pot}`,
    );
    return true;
  }

  startNewRound(): void {
    this.gameState.currentRound++;
    this.gameState.roundInProgress = true;
    this.gameState.pot = 0;
    this.gameState.cards = {
      revealed: Array(GAME_CONSTANTS.NUM_CARDS).fill(false) as boolean[],
    };
    this.gameState.players.forEach((player) => {
      player.bets = [];
    });
    console.log(
      `[ROUND STARTED] Round ${this.gameState.currentRound} started. All bets reset. Players: ${this.gameState.players.map(p => p.name).join(', ')}`,
    );
  }

  determineRedCardPosition(): number {
    // Gather all bets for this round
    const allBets = this.gameState.players
      .filter((p) => Array.isArray(p.bets) && p.bets.length > 0)
      .flatMap((p: Player) => p.bets.map((bet) => ({ amount: bet.amount, cardIndex: bet.cardIndex })));
    const totalPot = this.gameState.pot;
    const numCards = GAME_CONSTANTS.NUM_CARDS;
    // For each possible red card position, calculate total payout and profit
    let maxProfit = -Infinity;
    let bestPositions: number[] = [];
    for (let pos = 1; pos <= numCards; pos++) {
      // Payout is 2x for each bet on this card
      const payout = allBets
        .filter((bet) => bet.cardIndex === pos)
        .reduce((sum, bet) => sum + bet.amount * 2, 0);
      const profit = totalPot - payout;
      if (profit > maxProfit) {
        maxProfit = profit;
        bestPositions = [pos];
      } else if (profit === maxProfit) {
        bestPositions.push(pos);
      }
    }
    const chosen = bestPositions[Math.floor(Math.random() * bestPositions.length)];
    console.log(`[DEBUG] Red card determined: ${chosen} | Max profit: ${maxProfit} | Candidates: ${bestPositions.join(', ')} | All bets: ${JSON.stringify(allBets)}`);
    // Randomly select among the most profitable positions
    return chosen;
  }

  completeRound(): {
    winners: Player[];
    redCardPosition: number;
    noBetPlayers: Player[];
    betResults: {
      playerId: string;
      bets: {
        cardIndex: number;
        amount: number;
        won: boolean;
        payout: number;
      }[];
    }[];
  } {
    const redCardPosition = this.determineRedCardPosition();
    this.gameState.cards.redCardPosition = redCardPosition;
    const betResults = this.gameState.players.map((player) => {
      let totalPayout = 0;
      const bets = (player.bets || []).map((bet) => {
        const won = bet.cardIndex === redCardPosition;
        const payout = won ? bet.amount * 2 : 0;
        if (won) totalPayout += payout;
        return { ...bet, won, payout };
      });
      // Update chips for all bets (win or lose)
      if (totalPayout > 0) {
        player.chips += totalPayout;
        player.rewardsEarned += totalPayout;
        this.gameState.pot -= totalPayout;
      }
      bets.forEach((bet) => {
        if (!bet.won) {
          player.rewardsLost += bet.amount;
        }
      });
      console.log(`[ROUND RESULT] Player ${player.name} | Bets: ${JSON.stringify(bets)} | Chips: ${player.chips}`);
      return { playerId: player.id, bets };
    });
    const winners = this.gameState.players.filter(
      (player) =>
        Array.isArray(player.bets) &&
        player.bets.some((bet) => bet.cardIndex === redCardPosition),
    );
    const noBetPlayers = this.gameState.players.filter(
      (player) => !Array.isArray(player.bets) || player.bets.length === 0,
    );
    this.gameState.roundInProgress = false;
    console.log(`[ROUND END] Red card: ${redCardPosition} | Winners: ${winners.map(p => p.name).join(', ') || 'None'} | Pot: ${this.gameState.pot}`);
    return { winners, redCardPosition, noBetPlayers, betResults };
  }

  resetGameState(): void {
    this.gameState = {
      players: [],
      currentRound: 0,
      cards: {
        revealed: Array(GAME_CONSTANTS.NUM_CARDS).fill(false) as boolean[],
      },
      pot: 0,
      gameStarted: false,
      roundInProgress: false,
    };
    console.log('[DEBUG] Game state reset.');
  }
}
