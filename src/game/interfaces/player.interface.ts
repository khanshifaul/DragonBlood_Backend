export interface Player {
  id: string;
  name: string;
  socketId: string;
  chips: number;
  bets: {
    amount: number;
    cardIndex: number;
  }[];
  rewardsEarned: number;
  rewardsLost: number;
}
