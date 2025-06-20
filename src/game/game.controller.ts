import { Controller, Get } from '@nestjs/common';
import { GAME_CONSTANTS } from './constants/game.constants';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Game')
@Controller('game')
export class GameController {
  @Get('constants')
  @ApiOperation({ summary: 'Get game constants', description: 'Returns the constants used in the game.' })
  getGameConstants() {
    return GAME_CONSTANTS;
  }
}
