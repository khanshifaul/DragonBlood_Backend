import { ApiProperty } from '@nestjs/swagger';

export class JoinGamePayload {
  @ApiProperty({ example: 'player123', description: 'Player name' })
  name: string;
}

export class PlaceBetPayload {
  @ApiProperty({ example: 5, description: 'Card index' })
  cardIndex: number;

  @ApiProperty({ example: 10, description: 'Bet amount' })
  betAmount: number;
}
