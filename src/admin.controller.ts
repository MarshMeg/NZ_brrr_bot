import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GameService } from './bot-provider/game/game.service';
import { TaskService } from './bot-provider/game/task.service';
import Decimal from 'decimal.js';
import { AuthGuard } from '@nestjs/passport';
import { GamerRank } from './bot-provider/game/constants';
import { calculateDailyReward } from './bot-provider/game/helpers';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly gameService: GameService,
    private readonly taskService: TaskService,
  ) {}

  @Post('set-referral-bonus')
  async setReferralBonus(
    @Headers('Auth') authHeader: string,
    @Body('telegramId') telegramId: string,
    @Body('bonus') bonus: number,
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      await this.gameService.updateReferralBonus(
        telegramId?.toString(),
        Number(bonus),
      );
      return {
        status: true,
      };
    } catch (e) {
      console.log(`setReferralBonus Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('add-to-balance')
  async setBalance(
    @Headers('Auth') authHeader: string,
    @Body('telegramId') telegramId: string,
    @Body('balance') balance: string,
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      await this.gameService.updateReferralBalance(
        telegramId?.toString(),
        new Decimal(balance).abs(),
      );
      return {
        status: true,
      };
    } catch (e) {
      console.log(`setBalance Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('decrease-ref-balance')
  async decreaseRefBalance(
    @Headers('Auth') authHeader: string,
    @Body('telegramId') telegramId: string,
    @Body('balance') balance: string,
  ) {
    if (authHeader !== '62e240a0-ba8a-4352-82ef-995eafe1433f') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      await this.gameService.updateReferralBalance(
        telegramId?.toString(),
        new Decimal(balance).abs().mul(-1),
      );
      return {
        status: true,
      };
    } catch (e) {
      console.log(`setBalance Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('add-to-task-balance')
  async setTaskBalance(
    @Headers('Auth') authHeader: string,
    @Body('telegramId') telegramId: string,
    @Body('balance') balance: string,
  ) {
    if (authHeader !== '62e240a0-ba8a-4352-82ef-995eafe1433f') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      await this.gameService.updateTaskBalance(
        telegramId?.toString(),
        new Decimal(balance),
      );
      return {
        status: true,
      };
    } catch (e) {
      console.log(`setTaskBalance Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('create-task')
  async createTask(
    @Headers('Auth') authHeader: string,
    @Body('link') link: string,
    @Body('title') title: string,
    @Body('tgChannelId') channelId: string,
    @Body('completionLimit') completionLimit: number,
    @Body('rewardedMinutes') rewardedMinutes: number,
    @Body('isConfirmationDisabled') isConfirmationDisabled: boolean,
    @Body('exp') exp: number,
    @Body('lang') lang: string[],
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!link || !title || !rewardedMinutes || !channelId) {
      return {
        status: false,
        error: 'Invalid params',
      };
    }
    if (
      !Array.isArray(lang) ||
      !lang.every((element) => typeof element === 'string')
    ) {
      return {
        status: false,
        error: '`lang` should be an array of strings. Example: ["uk", "ru"]',
      };
    }

    try {
      const task = await this.taskService.createTask(
        link,
        title,
        channelId,
        completionLimit,
        Number(rewardedMinutes),
        isConfirmationDisabled,
        lang,
        exp,
      );
      return {
        status: true,
        data: task,
      };
    } catch (e) {
      console.log(`createTask Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('delete-task')
  async deleteTask(
    @Headers('Auth') authHeader: string,
    @Body('id') id: string,
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!id) {
      return {
        status: false,
        error: 'Invalid params',
      };
    }

    try {
      await this.taskService.deleteTask(id);
      return {
        status: true,
      };
    } catch (e) {
      console.log(`deleteTask Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('disable-game')
  async disableGame(@Headers('Auth') authHeader: string) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-3333-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }

    try {
      await this.gameService.setSetting('is-game-enabled', 'disabled');
      return {
        status: true,
      };
    } catch (e) {
      console.log(`disableGame Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('enable-game')
  async enableGame(@Headers('Auth') authHeader: string) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-3333-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }

    try {
      await this.gameService.setSetting('is-game-enabled', 'enabled');
      return {
        status: true,
      };
    } catch (e) {
      console.log(`enableGame Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('update-task')
  async updateTask(
    @Headers('Auth') authHeader: string,
    @Body('id') id: string,
    @Body('completionLimit') completionLimit: string,
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }
    if (!id) {
      return {
        status: false,
        error: 'Invalid params',
      };
    }

    try {
      await this.taskService.updateTask(id, completionLimit);
      return {
        status: true,
      };
    } catch (e) {
      console.log(`updateTask Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('task-list')
  async taskList(
    @Headers('Auth') authHeader: string,
    @Query('only-actual') onlyActual: boolean,
  ) {
    if (authHeader !== '3f5653ba-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }

    try {
      const taskList = await this.taskService.getTaskList();
      return {
        status: true,
        data: onlyActual
          ? taskList.filter(
              (task) => task.completionLimit !== task.completedTimes,
            )
          : taskList,
      };
    } catch (e) {
      console.log(`updateTask Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('user')
  async getUser(
    @Query('telegramId') telegramId: string,
    @Headers('Auth') authHeader: string,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (authHeader !== '4jfid84p-3b2a-4f7f-82e0-9ef79b47e012') {
      return {
        status: false,
        error: 'Invalid request',
      };
    }

    try {
      const gamer = await this.gameService.getAndUpdateUser(
        telegramId?.toString(),
        false,
      );
      const user = await this.gameService.getUser(telegramId?.toString());
      return {
        status: true,
        data: {
          gamer: {
            ...gamer._doc,
            rank: gamer.rank ?? GamerRank.bronzeMedal,
            dailyReward: calculateDailyReward(gamer),
            taskBalance: gamer.taskBalance ?? '0',
          },
          ref: {
            ...user._doc,
          },
        },
      };
    } catch (e) {
      console.log(`admin getUser Error: `, e);
      return {
        status: false,
        error: e?.message,
      };
    }
  }
}
