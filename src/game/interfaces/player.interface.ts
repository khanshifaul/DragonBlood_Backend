export interface Player {
  id: string;
  name: string;
  socketId: string;
  chips: number;
  currentBet?: {
    amount: number;
    cardIndex: number;
  };
  rewardsEarned: number;
  rewardsLost: number;
}
