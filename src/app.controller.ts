import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Query,
  UseGuards,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GameService } from './bot-provider/game/game.service';
import {
  BANKNOTE_DENOMINATION,
  Boosters,
  ENTITY_LVL_PRICING,
  GameEntities,
  GamerRank,
  MONEY_S_SIZE,
  PAPER_PACK_COST,
  PAPER_PACK_SIZE,
  PAPER_S_AMOUNT,
  PaperPacks,
  PRINTING_SPEED,
  TonTransfer,
} from './bot-provider/game/constants';
import { GamerDoesNotExistError } from './bot-provider/game/errors/gamer-does-not-exist.error';
import { MaximumEntityLevelReachedError } from './bot-provider/game/errors/maximum-entity-level-reached.error';
import { FullStorageError } from './bot-provider/game/errors/full-storage.error';
import { NotEnoughBalanceError } from './bot-provider/game/errors/not-enough-balance.error';
import { TaskService } from './bot-provider/game/task.service';
import { LogicError } from './bot-provider/game/errors/logic.error';
import { calculateDailyReward } from './bot-provider/game/helpers';
import { AuthGuard } from '@nestjs/passport';
import { BlockchainService } from './bot-provider/game/blockchain.service';
import { Bot } from 'grammy';
import { LabeledPrice } from '@grammyjs/types';
import * as process from 'process';
import { v4 as uuidv4 } from 'uuid';

@Controller('api')
export class AppController {
  constructor(
    private readonly gameService: GameService,
    private readonly taskService: TaskService,
    private readonly blockchainService: BlockchainService,
    private readonly bot: Bot,
  ) {}

  @Post('initialize')
  async initializeUser(@Body('telegramId') telegramId: string) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      const gamer = await this.gameService.initGameUser(telegramId?.toString());
      return {
        status: true,
        data: {
          refId: gamer._id,
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (e) {
      console.log(`initializeUser Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('is-user-initialized')
  @UseGuards(AuthGuard('jwt'))
  async isInitialized(@Query('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const isInitialized = await this.gameService.isUserInitialized(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: {
          isInitialized,
        },
      };
    } catch (e) {
      console.log(`isInitialized Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('referral-profile')
  @UseGuards(AuthGuard('jwt'))
  async getReferralProfile(
    @Query('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const user = await this.gameService.getUser(telegramId?.toString());
      return {
        status: true,
        data: {
          bankBalance: user.balance,
          referralBonus: user.referralBonus,
          referralLink: `https://t.me/brrrrrgamebot?start=${user._id}`,
        },
      };
    } catch (e) {
      console.log(`getReferralProfile Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('configuration')
  async getConfiguration() {
    return {
      status: true,
      data: {
        supportedEntities: GameEntities,
        entityPricing: ENTITY_LVL_PRICING,
        entityParams: {
          [GameEntities.moneyStorage]: MONEY_S_SIZE,
          [GameEntities.paperStorage]: PAPER_S_AMOUNT,
          [GameEntities.printingSpeed]: PRINTING_SPEED,
          [GameEntities.banknoteDenomination]: BANKNOTE_DENOMINATION,
        },
        supportedPaperPacks: PaperPacks,
        paperPackCost: PAPER_PACK_COST,
        paperPackSize: PAPER_PACK_SIZE,
        boosters: Boosters,
        tonTransfer: TonTransfer,
        serverTime: Math.floor(Date.now() / 1000),
      },
    };
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getUser(
    @Query('telegramId') telegramId: string,
    @Query('shouldUpdateBalance') shouldUpdateBalance: boolean = false,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const gamer = await this.gameService.getAndUpdateUser(
        telegramId?.toString(),
        shouldUpdateBalance,
      );
      return {
        status: true,
        data: {
          refId: gamer._id,
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (e) {
      console.log(`getUser Error: `, e);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('level-up')
  @UseGuards(AuthGuard('jwt'))
  async levelUp(
    @Body('telegramId') telegramId: string,
    @Body('entity') entity: GameEntities,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(`LevelUp - User not initialized ${telegramId}`);
      return {
        status: false,
        error: 'User not initialized',
      };
    }
    if (!Object.values(GameEntities).includes(entity)) {
      return {
        status: false,
        error: 'Invalid entity name',
      };
    }

    try {
      const gamer = await this.gameService.levelUp(
        telegramId?.toString(),
        entity,
      );
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`Level up Error: `, error);
      if (
        error instanceof GamerDoesNotExistError ||
        error instanceof NotEnoughBalanceError ||
        error instanceof MaximumEntityLevelReachedError ||
        error instanceof LogicError
      ) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('buy-paper')
  @UseGuards(AuthGuard('jwt'))
  async buyPaper(
    @Body('telegramId') telegramId: string,
    @Body('paperPack') paperPack: PaperPacks,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(`BuyPaper - User not initialized ${telegramId}`);
      return {
        status: false,
        error: 'User not initialized',
      };
    }
    if (!Object.values(PaperPacks).includes(paperPack)) {
      return {
        status: false,
        error: 'Invalid paper pack name',
      };
    }

    try {
      const gamer = await this.gameService.buyPaper(
        telegramId?.toString(),
        paperPack,
      );
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`Buy paper Error:`, error);
      if (
        error instanceof GamerDoesNotExistError ||
        error instanceof FullStorageError ||
        error instanceof NotEnoughBalanceError
      ) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('transfer/bank-to-balance')
  @UseGuards(AuthGuard('jwt'))
  async transferFromBankToBalance(
    @Body('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(
        `TransferFromBankToBalance - User not initialized ${telegramId}`,
      );
      return {
        status: false,
        error: 'User not initialized',
      };
    }

    try {
      const gamer = await this.gameService.transferFromBankToBalance(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`Transfer from bank Error: ${error?.message}`);
      if (
        error instanceof GamerDoesNotExistError ||
        error instanceof FullStorageError ||
        error instanceof NotEnoughBalanceError
      ) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('transfer/task-to-balance')
  @UseGuards(AuthGuard('jwt'))
  async transferFromTaskBalanceToBalance(
    @Body('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(
        `TransferFromTaskBalanceToBalance - User not initialized ${telegramId}`,
      );
      return {
        status: false,
        error: 'User not initialized',
      };
    }

    try {
      const gamer = await this.gameService.transferFromTaskBalanceToGameBalance(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`Transfer from bank Error: ${error?.message}`);
      if (
        error instanceof GamerDoesNotExistError ||
        error instanceof FullStorageError ||
        error instanceof NotEnoughBalanceError
      ) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Get('task/list')
  @UseGuards(AuthGuard('jwt'))
  async getTaskList(
    @Request() req,
    @Query('telegramId') telegramId: string,
    @Query('lang') lang?: string,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(`GetTaskList - User not initialized ${telegramId}`);
      return {
        status: false,
        error: 'User not initialized',
      };
    }

    try {
      const taskList = await this.taskService.getUserTaskList(
        telegramId?.toString(),
        lang,
      );
      return {
        status: true,
        data: taskList.map((task) => ({
          taskId: task._id,
          title: task.title,
          link: task.link,
          bonus: task.bonus,
          rewardedMinutes: task.rewardedMinutes,
          createdAt: task.createdAt,
          isCompleted: task.isCompleted,
          lang: task.lang,
          exp: task.exp,
        })),
      };
    } catch (error) {
      console.log(`getTaskList Error: ${error?.message}`, error);
      if (error instanceof LogicError) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('task/complete')
  @UseGuards(AuthGuard('jwt'))
  async completeTask(
    @Body('telegramId') telegramId: string,
    @Body('taskId') taskId: string,
    @Request() req,
  ) {
    if (!telegramId || !taskId) {
      return {
        status: false,
        error: 'Telegram ID or task id is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    if (!(await this.gameService.isUserInitialized(telegramId))) {
      console.log(`CompleteTask - User not initialized ${telegramId}`);
      return {
        status: false,
        error: 'User not initialized',
      };
    }

    try {
      await this.taskService.markAsCompleted(telegramId.toString(), taskId);
      return {
        status: true,
      };
    } catch (error) {
      console.log(
        `Task completion ${telegramId} - ${taskId} Error: ${error?.message}`,
      );
      if (error instanceof LogicError) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Get('leaderboard')
  async getLeaderboard() {
    try {
      return {
        status: true,
        data: await this.gameService.getLeaderboard(),
      };
    } catch (error) {
      console.log(`getLeaderboard Error: ${error?.message}`, error);
      if (error instanceof LogicError) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('claim-daily-reward')
  @UseGuards(AuthGuard('jwt'))
  async claimDailyReward(
    @Body('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const gamer = await this.gameService.claimDailyReward(telegramId);
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`claimDailyReward Error: ${error?.message}`, error);
      if (error instanceof LogicError) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Post('increase-rank')
  @UseGuards(AuthGuard('jwt'))
  async increaseRank(@Body('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const gamer = await this.gameService.increaseRank(telegramId);
      return {
        status: true,
        data: {
          telegramId: gamer.telegramId,
          snapshotTime: gamer.snapshotTime,
          balance: gamer.balance,
          taskBalance: gamer.taskBalance ?? '0',
          moneyStorageLvl: gamer.moneyStorageLvl,
          paperStorageLvl: gamer.paperStorageLvl,
          printingSpeedLvl: gamer.printingSpeedLvl,
          banknoteLvl: gamer.banknoteLvl,
          paperAmount: gamer.paperAmount,
          rank: gamer.rank ?? GamerRank.bronzeMedal,
          dailyReward: calculateDailyReward(gamer),
          dailyRewardStreak: gamer.dailyRewardStreak,
          dailyRewardLastClaimed: gamer.dailyRewardLastClaimed,
          exp: gamer.exp,
        },
      };
    } catch (error) {
      console.log(`increaseRank Error: ${error?.message}`, error);
      if (error instanceof LogicError) {
        return {
          status: false,
          error: error?.message,
        };
      }
      return {
        status: false,
        error: `Unexpected error: ${error?.message}`,
      };
    }
  }

  @Get('datetime')
  async getMetadata() {
    return new Date();
  }

  @Post('trigger-tx-check')
  // @UseGuards(AuthGuard('jwt'))
  async triggerTxCheck(@Body('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      // throw new UnauthorizedException('You can only update your own data');
    }

    try {
      await this.blockchainService.triggerTxChecks();
      return {
        status: true,
      };
    } catch (e) {
      console.log(`isInitialized Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('user-boost-info')
  @UseGuards(AuthGuard('jwt'))
  async getUserBoostInfo(
    @Query('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const boosters = await this.gameService.getUserBoostInfo(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: boosters.map((booster) => ({
          boostInfo: Boosters[booster.item] || null,
          txInfo: booster,
        })),
      };
    } catch (e) {
      console.log(`getReferralProfile Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('ref-reward-info')
  @UseGuards(AuthGuard('jwt'))
  async getRefRewardInfo(
    @Query('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      return {
        status: true,
        data: {
          reward: await this.blockchainService.getRefRewardInfo(
            telegramId?.toString(),
          ),
        },
      };
    } catch (e) {
      console.log(`getRefRewardInfo Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('is-game-launched')
  async isGameLaunched(@Query('telegramId') telegramId: string) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }

    try {
      const isInitialized = await this.gameService.isUserInitialized(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: {
          isInitialized,
        },
      };
    } catch (e) {
      console.log(`isGameLaunched Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('get-sale-info')
  @UseGuards(AuthGuard('jwt'))
  async getSaleInfo(@Query('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const isInitialized = await this.blockchainService.getSaleInfo(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: {
          isInitialized,
        },
      };
    } catch (e) {
      console.log(`getSaleInfo Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('choose-drop-option')
  @UseGuards(AuthGuard('jwt'))
  async chooseDropOption(
    @Body('telegramId') telegramId: string,
    @Body('option') option: number,
    @Body('wallet') wallet: string,
    @Request() req,
  ) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (![1, 2, 3, 4].includes(option)) {
      return {
        status: false,
        error: 'Invalid option',
      };
    }
    if (!wallet) {
      return {
        status: false,
        error: 'Wallet not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      await this.blockchainService.saveChosenOption(telegramId, option, wallet);
      return {
        status: true,
      };
    } catch (e) {
      console.log(`isInitialized Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('get-drop-option')
  @UseGuards(AuthGuard('jwt'))
  async getDropOption(@Query('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const data = await this.blockchainService.getChosenOption(
        telegramId?.toString(),
      );
      return {
        status: true,
        data: data
          ? {
              option: data.option,
              wallet: data.wallet,
            }
          : null,
      };
    } catch (e) {
      console.log(`getSaleInfo Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Get('get-drop-info')
  @UseGuards(AuthGuard('jwt'))
  async getDropInfo(@Query('telegramId') telegramId: string, @Request() req) {
    if (!telegramId) {
      return {
        status: false,
        error: 'Telegram ID is not provided',
      };
    }
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    try {
      const gamer = await this.gameService.getDropInfo(telegramId);

      return {
        status: true,
        data: gamer
          ? {
              forFriends: gamer.userBalanceFinalNewRes ?? '0', // (Реферальный баланс на этапе 9)
              forTasks: gamer.taskBalanceFinalNewRes ?? '0', // (Баланс за задачи на этапе 9)
              forGame: gamer.balanceFinalNewRes ?? '0', // (Игровой баланс на этапе 9)
              forUpgrades: gamer.spendingFinalNewRes ?? '0', // (Баланс за прокачки на этапе 9)
              forRank: gamer.forRankFinalNewRes ?? '0', // (for rank на этапе 9)
              total: gamer.sumUp4FinalNewRes ?? '0', // (число из пункта 4)
            }
          : {
              forFriends: '0',
              forTasks: '0',
              forGame: '0',
              forUpgrades: '0',
              forRank: '0',
              total: '0',
            },
      };
    } catch (e) {
      console.log(`getSaleInfo Error: ${e?.message}`);
      return {
        status: false,
        error: e?.message,
      };
    }
  }

  @Post('send-invoice')
  @UseGuards(AuthGuard('jwt'))
  async sendBoosterInvoice(
    @Query('telegramId') telegramId: string,
    @Body() body: { boosterId: string },
    @Request() req,
  ) {
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    const { boosterId } = body;

    try {
      const title = 'Buying a booster';
      const description = `You are purchasing a booster that provides ${Boosters[boosterId].boost}% boost for ${Boosters[boosterId].hours} hours. This booster will help you enhance your performance in the game!`;

      const prices: LabeledPrice[] = [
        { label: 'Booster', amount: Boosters[boosterId].stars },
      ];

      const invoiceLink = await this.bot.api.createInvoiceLink(
        title,
        description,
        boosterId,
        '',
        'XTR',
        prices,
      );

      return {
        success: true,
        message: 'Ссылка на инвойс успешно создана',
        link: invoiceLink,
      };
    } catch (error) {
      console.error('Ошибка при отправке инвойса:', error.message);
      throw new HttpException(
        'Ошибка при отправке инвойса',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('reward')
  async processReward(
    @Query('telegramId') telegramId: number,
    @Query('token') token: string,
    @Request() req,
  ) {
    if (token !== process.env.REWARD_ASD) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    try {
      await this.blockchainService.processSuccessfulPayment(
        telegramId,
        'p1',
        0,
        `${uuidv4()}_asd`,
      );

      return {
        success: true,
        message: 'Reward successfully processed and transaction recorded',
      };
    } catch (error) {
      console.error('Ошибка при записи транзакции:', error.message);
      throw new HttpException(
        'Error processing reward',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('check')
  @UseGuards(AuthGuard('jwt'))
  async checkCode(
    @Query('telegramId') telegramId: string,
    @Body('caseId') caseId: string,
    @Body('code') code: string,
    @Request() req,
  ) {
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    const result = await this.gameService.checkCodeAndLogAttempt(
      telegramId,
      caseId,
      code,
    );
    return { result };
  }

  @Get('available')
  @UseGuards(AuthGuard('jwt'))
  async getAvailableCases(
    @Query('telegramId') telegramId: string,
    @Request() req,
  ) {
    if (String(req.user?.userId) !== String(telegramId)) {
      throw new UnauthorizedException('You can only update your own data');
    }

    const availableCases =
      await this.gameService.getAvailableCasesForUser(telegramId);
    return { availableCases };
  }

  @Get('add-extra-attempts')
  async addExtraAttempts(
    @Query('telegramId') telegramId: string,
    @Query('token') token: string,
  ) {
    if (token !== process.env.REWARD_ASD) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    try {
      const updatedCase = await this.gameService.addExtraAttempts(telegramId);
      return updatedCase;
    } catch (error) {
      throw new HttpException(
        { message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('mark-ad-watched')
  async markAdAsWatched(
    @Query('telegramId') telegramId: string,
    @Query('token') token: string,
  ) {
    if (token !== process.env.REWARD_ASD) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    try {
      const updatedCase = await this.gameService.markAdAsWatched(telegramId);
      return updatedCase;
    } catch (error) {
      throw new HttpException(
        { message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
