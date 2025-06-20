import { Controller, Get } from '@nestjs/common';
import { GAME_CONSTANTS } from './constants/game.constants';

@Controller('game')
export class GameController {
  @Get('constants')
  getGameConstants() {
    return GAME_CONSTANTS;
  }
}
