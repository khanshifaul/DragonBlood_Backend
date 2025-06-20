import { Player } from './player.interface';

export interface GameState {
  players: Player[];
  currentRound: number;
  cards: {
    redCardPosition?: number;
    revealed: boolean[];
  };
  pot: number;
  gameStarted: boolean;
  roundInProgress: boolean;
}
