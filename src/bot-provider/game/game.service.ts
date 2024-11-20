import { Injectable } from '@nestjs/common';
import mongoose, { Model, ClientSession } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Boosters,
  ENTITY_LVL_PRICING,
  ENTITY_MAX_LEVEL,
  GameEntities,
  GamerRank,
  MAX_STREAK,
  MONEY_S_SIZE,
  PAPER_PACK_COST,
  PAPER_PACK_SIZE,
  PAPER_S_AMOUNT,
  PaperPacks,
} from './constants';
import { User, UserDocument } from '../entities/user.schema';
import {
  calculateDailyReward,
  calculateReward,
  getGamerLvlFieldByEntity,
} from './helpers';
import { Gamer, GamerDocument } from '../entities/gamer.schema';
import {
  PersonalCase,
  PersonalCaseDocument,
} from '../entities/personal-case.schema';
import { GlobalCase, GlobalCaseDocument } from '../entities/global-case.schema';
import {
  UserAttempt,
  UserAttemptDocument,
} from '../entities/user-attempt.schema';
import { MaximumEntityLevelReachedError } from './errors/maximum-entity-level-reached.error';
import { GamerDoesNotExistError } from './errors/gamer-does-not-exist.error';
import { NotEnoughBalanceError } from './errors/not-enough-balance.error';
import { FullStorageError } from './errors/full-storage.error';
import Decimal from 'decimal.js';
import { LogicError } from './errors/logic.error';
import { CacheService } from '../cache/cache.service';
import { Api } from 'grammy';
import * as process from 'process';
import {
  Transaction,
  TransactionDocument,
} from '../entities/transaction.schema';
import { Settings, SettingsDocument } from '../entities/settings.schema';
import { DropInfo, DropInfoDocument } from '../entities/drop-info.schema';
import { PersonalCaseDTO } from './dto/personal-case.dto';
import * as crypto from 'crypto';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Gamer.name) private gameModel: Model<GamerDocument>,
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    @InjectModel(DropInfo.name) private dropInfoModel: Model<DropInfoDocument>,
    @InjectModel(GlobalCase.name) private globalCaseModel: Model<GlobalCase>,
    @InjectModel(UserAttempt.name) private userAttemptModel: Model<UserAttempt>,
    @InjectModel(PersonalCase.name)
    private personalCaseModel: Model<PersonalCase>,
    private readonly cacheService: CacheService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async isUserInitialized(telegramId: string) {
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    const gamer: any = await this.gameModel.findOne({
      telegramId: telegramId,
    });

    return !!user && !!gamer;
  }

  async getUser(telegramId: string) {
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    if (!user) {
      throw new GamerDoesNotExistError('User does not exist');
    }
    return user;
  }

  async initGameUser(telegramId: string) {
    const user = await this.getUser(telegramId);
    if (!user) {
      throw new GamerDoesNotExistError('User does not exist');
    }
    return this.getOrCreateGameUser(telegramId);
  }

  async getAndUpdateUser(telegramId: string, shouldUpdateBalance: boolean) {
    const gamer: any = await this.gameModel.findOne({
      telegramId: telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled' || !shouldUpdateBalance) {
      return gamer;
    }

    return this.upsertGamerData(gamer);
  }

  async levelUp(telegramId: string, entity: GameEntities) {
    let gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      return gamer;
    }

    const gamerLvlField = getGamerLvlFieldByEntity(entity);
    if (new Decimal(gamer[gamerLvlField]).gte(ENTITY_MAX_LEVEL[entity])) {
      throw new LogicError(`Maximum ${entity} level reached`);
    }

    const lvlUpPrice =
      ENTITY_LVL_PRICING[entity][Number(gamer[gamerLvlField]) + 1];

    if (new Decimal(lvlUpPrice).isNaN()) {
      console.log('Something wrong with calculations', {
        entity,
        level: Number(gamer[gamerLvlField]) + 1,
        lvlUpPrice,
      });
      throw new LogicError('Something wrong with calculations');
    }

    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    // we MUST update users balance (make snapshot) BEFORE updating level
    gamer = await this.upsertGamerData(gamer);

    if (new Decimal(lvlUpPrice).gt(gamer.balance)) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      console.log(
        `Gamer ${telegramId} has not enough balance to lvl up ${gamer.balance}/${lvlUpPrice}`,
      );
      throw new NotEnoughBalanceError(
        `Not enough balance to lvl up ${gamer.balance}/${lvlUpPrice}`,
      );
    }

    if (
      Decimal.add(gamer.balance, gamer.paperAmount)
        .sub(lvlUpPrice)
        .lt(PAPER_PACK_COST[PaperPacks.base])
    ) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      console.log(`Gamer ${telegramId} should by a paper first`);
      throw new NotEnoughBalanceError(`You should buy paper first`);
    }

    if (new Decimal(gamer[gamerLvlField]).lt(ENTITY_MAX_LEVEL[entity])) {
      gamer[gamerLvlField] = Number(gamer[gamerLvlField]) + 1;
      gamer.balance = Decimal.sub(gamer.balance, lvlUpPrice).toDecimalPlaces(2);
      if (entity === GameEntities.banknoteDenomination) {
        gamer.printingSpeedLvl = 1;
      }
      gamer = await gamer.save();
    } else {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      console.log(
        `Maximum ${entity} level reached for ${gamer.telegramId}, cannot level up`,
      );
      throw new MaximumEntityLevelReachedError(
        `Maximum ${entity} level reached, cannot level up`,
      );
    }

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async buyPaper(telegramId: string, paperPack: PaperPacks) {
    let gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      return gamer;
    }

    const buyPrice = PAPER_PACK_COST[paperPack];
    if (new Decimal(buyPrice).isNaN()) {
      console.log('Something wrong with calculations', {
        paperPack,
        buyPrice,
      });
      throw new LogicError('Something wrong with calculations');
    }

    if (new Decimal(buyPrice).gt(gamer.balance)) {
      console.log(
        `Gamer ${telegramId} has not enough balance to lvl up ${gamer.balance}/${buyPrice}`,
      );
      throw new NotEnoughBalanceError(
        `Not enough balance to lvl up ${gamer.balance}/${buyPrice}`,
      );
    }
    const newPaperBalance = Decimal.add(
      PAPER_PACK_SIZE[paperPack],
      Number(gamer.paperAmount),
    );
    if (newPaperBalance.gt(PAPER_S_AMOUNT[gamer.paperStorageLvl])) {
      throw new FullStorageError(`Not enough space in paper storage`);
    }

    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    // we MUST update users balance (make snapshot) BEFORE updating paper balance
    // otherwise bought paper will be counted in reward
    gamer = await this.upsertGamerData(gamer);

    gamer.balance = Decimal.sub(gamer.balance, buyPrice).toDecimalPlaces(2);
    gamer.paperAmount = newPaperBalance.toDecimalPlaces(2);
    gamer = await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async transferFromBankToBalance(telegramId: string) {
    let gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    if (!user) {
      throw new GamerDoesNotExistError('User does not exist');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      return gamer;
    }

    const bankTransferLimit = new Decimal(10000);
    if (new Decimal(gamer.usedBankBalance ?? 0).gte(bankTransferLimit)) {
      throw new LogicError('Bank transfers limit reached (10000)');
    }

    const storageSize = MONEY_S_SIZE[Number(gamer.moneyStorageLvl)];
    if (new Decimal(storageSize).isNaN()) {
      console.log('Something wrong with calculations', {
        moneyStorageLvl: gamer.moneyStorageLvl,
        storageSize,
      });
      throw new LogicError('Something wrong with calculations');
    }

    if (new Decimal(gamer.balance).gte(storageSize)) {
      throw new FullStorageError(`Storage is already full`);
    }
    if (new Decimal(user.balance).eq(0)) {
      throw new NotEnoughBalanceError(`Nothing to transfer (empty bank)`);
    }

    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    const storageFreeSpace = Decimal.sub(storageSize, gamer.balance).abs();
    let change = storageFreeSpace.lt(user.balance)
      ? storageFreeSpace
      : new Decimal(user.balance);

    const allowedToTransfer = bankTransferLimit.sub(gamer.usedBankBalance ?? 0);
    change = allowedToTransfer.lte(change) ? allowedToTransfer : change;

    user.balance = new Decimal(user.balance).sub(change).toDecimalPlaces(2);
    await user.save();

    gamer.balance = new Decimal(gamer.balance).add(change).toDecimalPlaces(2);
    gamer.usedBankBalance = new Decimal(gamer.usedBankBalance ?? 0)
      .add(change)
      .toDecimalPlaces(2);
    gamer = await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async transferFromTaskBalanceToGameBalance(telegramId: string) {
    let gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      return gamer;
    }

    const storageSize = MONEY_S_SIZE[Number(gamer.moneyStorageLvl)];
    if (new Decimal(storageSize).isNaN()) {
      console.log('Something wrong with calculations', {
        moneyStorageLvl: gamer.moneyStorageLvl,
        storageSize,
      });
      throw new LogicError('Something wrong with calculations');
    }

    if (new Decimal(gamer.balance).gte(storageSize)) {
      throw new FullStorageError(`Storage is already full`);
    }
    if (new Decimal(gamer.taskBalance).eq(0)) {
      throw new NotEnoughBalanceError(
        `Nothing to transfer (empty task balance)`,
      );
    }

    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    const storageFreeSpace = Decimal.sub(storageSize, gamer.balance).abs();
    const change = storageFreeSpace.lt(gamer.taskBalance)
      ? storageFreeSpace
      : new Decimal(gamer.taskBalance);

    gamer.taskBalance = new Decimal(gamer.taskBalance)
      .sub(change)
      .toDecimalPlaces(2);
    gamer.balance = new Decimal(gamer.balance).add(change).toDecimalPlaces(2);
    gamer = await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async getOrCreateGameUser(telegramId: string) {
    let gamerData: any = await this.gameModel.findOne({
      telegramId: telegramId,
    });
    if (!gamerData) {
      gamerData = await this.gameModel.create({
        telegramId: telegramId,
        createdAt: new Date(),
        snapshotTime: new Date(),
        balance: 0,
        moneyStorageLvl: 1,
        paperStorageLvl: 1,
        printingSpeedLvl: 1,
        banknoteLvl: 1,
        paperAmount: 100,
        usedBankBalance: '0',
        rank: GamerRank.bronzeMedal,
        dailyRewardStreak: 0,
        exp: 0,
      });
    }
    return gamerData;
  }

  async upsertGamerData(gamer): Promise<Gamer> {
    const boosters = await this.getUserBoostInfo(gamer.telegramId);
    const boost = boosters.reduce((sum, tx) => {
      const boostValue = Boosters[tx.item]?.boost ?? 0;
      return sum + boostValue;
    }, 0);

    const newSnapshotTime = new Date();
    const newBalance = calculateReward(gamer, newSnapshotTime.getTime(), boost);

    if (!newBalance.newBalance.eq(gamer.balance)) {
      const user: any = await this.userModel.findOne({
        telegramId: gamer.telegramId,
      });
      if (user.dadReferrerId) {
        await this.updateParentBalance(
          user.dadReferrerId,
          newBalance.newBalance.sub(gamer.balance),
        );
      }
      if (user.grandDadReferrerId) {
        await this.updateParentBalance(
          user.grandDadReferrerId,
          newBalance.newBalance.sub(gamer.balance),
        );
      }
      gamer.balance = newBalance.newBalance.toDecimalPlaces(2);
      gamer.paperAmount = newBalance.newPaperAmount.toDecimalPlaces(2);
    }

    gamer.snapshotTime = newSnapshotTime;
    gamer = await gamer.save();

    return gamer;
  }

  async updateParentBalance(
    parentId: string,
    bonusBase: Decimal,
  ): Promise<Gamer> {
    const user: any = await this.userModel.findById(parentId);
    if (!user) {
      return;
    }
    user.balance = Decimal.add(
      user.balance ?? 0,
      bonusBase.mul(user.referralBonus).div(100).ceil(),
    );
    await user.save();
  }

  async updateReferralBonus(telegramId: string, bonus: number) {
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    if (!user) {
      throw new GamerDoesNotExistError('User does not exist');
    }

    user.referralBonus = Number(bonus);
    await user.save();
  }

  async updateReferralBalance(telegramId: string, balance: Decimal) {
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    if (!user) {
      throw new GamerDoesNotExistError('User does not exist');
    }
    if (new Decimal(user.balance).add(balance).lt(0)) {
      throw new LogicError('Balance cannot be lower than 0');
    }

    user.balance = new Decimal(user.balance).add(balance).toDecimalPlaces(2);
    await user.save();
  }

  async updateTaskBalance(telegramId: string, balance: Decimal) {
    const gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new GamerDoesNotExistError('Gamer does not exist');
    }

    gamer.taskBalance = new Decimal(gamer.taskBalance)
      .add(balance)
      .toDecimalPlaces(2);
    await gamer.save();
  }

  async getLeaderboard() {
    const data = await this.cacheService.getLeaderboard();
    if (!data) {
      const result = await this.connection
        .collection('gamers')
        .aggregate([
          // Project fields and rename to prepare for union
          {
            $project: {
              _id: 0,
              telegramId: '$telegramId',
              username: '$username',
              firstName: '$firstName',
              lastName: '$lastName',
              rank: '$rank',
              balance: { $toDouble: '$balance' },
              taskBalance: { $ifNull: [{ $toDouble: '$taskBalance' }, 0] },
            },
          },
          {
            $unionWith: {
              coll: 'users',
              pipeline: [
                // Project fields and rename to prepare for union
                {
                  $project: {
                    _id: 0,
                    telegramId: '$telegramId',
                    username: '$username',
                    firstName: '$firstName',
                    lastName: '$lastName',
                    rank: '$rank',
                    balance: { $toDouble: '$balance' }, // Convert balance to double
                    taskBalance: {
                      $ifNull: [{ $toDouble: '$taskBalance' }, 0],
                    },
                  },
                },
              ],
            },
          },
          // Group by telegramId and calculate the total sum of balances
          {
            $group: {
              _id: '$telegramId',
              username: { $first: '$username' },
              firstName: { $first: '$firstName' },
              lastName: { $first: '$lastName' },
              rank: { $first: '$rank' },
              totalBalance: { $sum: { $add: ['$balance', '$taskBalance'] } },
            },
          },
          // Sort by totalBalance in descending order
          { $sort: { totalBalance: -1 } },
          // Limit to the top 300
          { $limit: 300 },
        ])
        .toArray();

      for (const record of result) {
        delete record._id;
        delete record.lastName;
        record.rank = record.rank ?? GamerRank.bronzeMedal;
        if (!record.firstName) {
          const metadata = await this.upsertUserMetadata(record._id);
          await this.gameModel.updateOne(
            {
              telegramId: record._id,
            },
            {
              firstName: metadata.firstName,
              lastName: metadata.lastName,
              username: metadata.username,
            },
          );
          record.firstName = metadata.firstName;
          record.lastName = metadata.lastName;
          record.username = metadata.username;
        }
      }

      await this.cacheService.setLeaderboard(result);

      return result;
    }

    return JSON.parse(data as string);
  }

  async upsertUserMetadata(userId: string) {
    try {
      // Fetch the user's profile photos
      const api = new Api(process.env.BOT_TOKEN);
      const chat: any = await api.getChat(userId);

      return {
        firstName: chat.first_name,
        lastName: chat.last_name,
        username: chat.username,
      };
    } catch (error) {
      console.error('Error upsertUserMetadata. skipping:', error);
      return {
        firstName: undefined,
        lastName: undefined,
        username: undefined,
      };
    }
  }

  async claimDailyReward(telegramId: string) {
    const gamer = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new LogicError('Gamer not found');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      console.log(`GAME DISABLED`, setting);
      return gamer;
    }
    console.log(`GAME ENABLED`, setting);
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    const now = new Date();
    const nowUTC = new Date(now.toUTCString());
    const lastClaimed = gamer.dailyRewardLastClaimed
      ? new Date(gamer.dailyRewardLastClaimed.toUTCString())
      : null;

    const todayStart = new Date(
      Date.UTC(
        nowUTC.getUTCFullYear(),
        nowUTC.getUTCMonth(),
        nowUTC.getUTCDate(),
      ),
    );
    const todayEnd = new Date(
      Date.UTC(
        nowUTC.getUTCFullYear(),
        nowUTC.getUTCMonth(),
        nowUTC.getUTCDate(),
        23,
        59,
        59,
      ),
    );

    if (lastClaimed && lastClaimed >= todayStart && lastClaimed <= todayEnd) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      console.log(
        `You have already claimed your reward today - ${telegramId} - ${lastClaimed}`,
      );
      throw new LogicError('You have already claimed your reward today');
    }

    const yesterdayStartUTC = new Date(
      todayStart.getTime() - 24 * 60 * 60 * 1000,
    );
    const yesterdayEndUTC = new Date(todayStart.getTime() - 1);

    if (
      lastClaimed &&
      lastClaimed >= yesterdayStartUTC &&
      lastClaimed <= yesterdayEndUTC
    ) {
      const streakDays = Math.min(gamer.dailyRewardStreak + 1, MAX_STREAK);
      gamer.dailyRewardStreak = streakDays;
      gamer.taskBalance = new Decimal(gamer.taskBalance)
        .add(calculateDailyReward(gamer).mul(streakDays))
        .toDecimalPlaces(2)
        .toString();
      // gamer.exp = gamer.exp + streakDays;
    } else {
      const streakDays = 1;
      gamer.dailyRewardStreak = streakDays;
      gamer.taskBalance = new Decimal(gamer.taskBalance)
        .add(calculateDailyReward(gamer))
        .toDecimalPlaces(2)
        .toString();
      // gamer.exp = gamer.exp + streakDays;
    }

    gamer.dailyRewardLastClaimed = now;
    await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async increaseRank(telegramId: string) {
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    const gamer = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError('Gamer not found');
    }

    const setting = await this.getSetting('is-game-enabled');
    if (setting !== 'enabled') {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      return gamer;
    }

    const balance = new Decimal(gamer.balance);

    if (
      (!gamer.rank || gamer.rank === GamerRank.bronzeMedal) &&
      gamer.exp >= 100 &&
      balance.gte(500000)
    ) {
      gamer.rank = GamerRank.silverMedal;
      gamer.balance = balance.sub(500000).toDecimalPlaces(2).toString();
    } else if (
      gamer.rank === GamerRank.silverMedal &&
      gamer.exp >= 200 &&
      balance.gte(2500000)
    ) {
      gamer.rank = GamerRank.goldMedal;
      gamer.balance = balance.sub(2500000).toDecimalPlaces(2).toString();
    } else if (
      gamer.rank === GamerRank.goldMedal &&
      gamer.exp >= 300 &&
      balance.gte(10000000)
    ) {
      gamer.rank = GamerRank.bronzeCup;
      gamer.balance = balance.sub(10000000).toDecimalPlaces(2).toString();
    } else if (
      gamer.rank === GamerRank.bronzeCup &&
      gamer.exp >= 400 &&
      balance.gte(15000000)
    ) {
      gamer.rank = GamerRank.silverCup;
      gamer.balance = balance.sub(15000000).toDecimalPlaces(2).toString();
    } else if (
      gamer.rank === GamerRank.silverCup &&
      gamer.exp >= 500 &&
      balance.gte(25000000)
    ) {
      gamer.rank = GamerRank.goldCup;
      gamer.balance = balance.sub(25000000).toDecimalPlaces(2).toString();
    } else {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError('Highest rank reached or conditions not met');
    }
    await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    return gamer;
  }

  async getUserBoostInfo(telegramId: string) {
    const now = new Date();

    const boosterConditions = Object.keys(Boosters).map((boosterKey) => {
      const booster = Boosters[boosterKey];
      const boostTimeAgo = new Date();
      boostTimeAgo.setHours(boostTimeAgo.getHours() - booster.hours);

      return {
        telegramId,
        item: booster.id,
        createdAt: { $gte: boostTimeAgo },
      };
    });

    return this.txModel.find({
      $or: boosterConditions,
    });
  }

  async setSetting(key: string, value: string) {
    const setting = await this.settingsModel.findOne({
      key,
    });
    if (!setting) {
      await this.settingsModel.create({
        key,
        value,
      });
    } else {
      setting.value = value;
      await setting.save();
    }
  }

  async getSetting(key: string) {
    const setting = await this.settingsModel.findOne({
      key,
    });
    if (!setting) {
      throw new LogicError(`Setting ${key} is undefined`);
    }
    return setting.value;
  }

  async getDropInfo(telegramId: string) {
    const gamer = await this.dropInfoModel.findOne({
      telegramId,
    });
    if (gamer && gamer.data) {
      return JSON.parse(gamer.data);
    }

    return null;
  }

  async getOrCreateCasesForUser(telegramId: string): Promise<PersonalCase[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const personalCases = await this.personalCaseModel.find({
        telegramId,
        expirationDate: { $gte: startOfDay, $lte: endOfDay },
      });

      const globalCase = personalCases.find((c) => c.isGlobal);
      const adBasedCases = personalCases.filter((c) => c.isAdBased);
      const normalCases = personalCases.filter(
        (c) => !c.isGlobal && !c.isAdBased,
      );

      if (!globalCase) {
        const lastGlobalCaseSettings = await this.globalCaseModel
          .findOne({
            updateTime: { $gte: startOfDay, $lte: endOfDay },
          })
          .sort({ updateTime: -1 });

        if (!lastGlobalCaseSettings) {
          const lastGlobalCaseSettings = new this.globalCaseModel({
            code: this.generateUnpredictableCode(4),
            updateTime: new Date(),
          });
          await lastGlobalCaseSettings.save();
        }

        const newGlobalCase = new this.personalCaseModel({
          telegramId,
          code: lastGlobalCaseSettings.code,
          reward: 0,
          maxAttempts: 15,
          isGlobal: true,
          expirationDate: endOfDay,
        });

        await newGlobalCase.save();
        personalCases.push(newGlobalCase);
      }

      const normalCasesToCreate = 10 - normalCases.length;
      for (let i = 0; i < normalCasesToCreate; i++) {
        const newNormalCase = new this.personalCaseModel({
          telegramId,
          code: this.generateUnpredictableCode(4),
          reward: 0,
          maxAttempts: 15,
          isGlobal: false,
          isAdBased: false,
          expirationDate: endOfDay,
        });

        await newNormalCase.save();
        personalCases.push(newNormalCase);
      }

      const adBasedCasesToCreate = 10 - adBasedCases.length;
      for (let i = 0; i < adBasedCasesToCreate; i++) {
        const newAdBasedCase = new this.personalCaseModel({
          telegramId,
          code: this.generateUnpredictableCode(4),
          reward: 0,
          maxAttempts: 15,
          isGlobal: false,
          isAdBased: true,
          isAdWatched: false,
          expirationDate: endOfDay,
        });

        await newAdBasedCase.save();
        personalCases.push(newAdBasedCase);
      }

      return personalCases;
    } catch (error) {
      throw error;
    }
  }

  generateUnpredictableCode(length: number): string {
    return Array.from({ length }, () =>
      Math.floor(crypto.randomInt(0, 10)).toString(),
    ).join('');
  }

  async checkCodeAndLogAttempt(
    telegramId: string,
    caseId: string,
    inputCode: string,
  ): Promise<{
    status: string;
    reward?: number;
    correctDigits?: number;
    attempts?: number;
    message?: string;
  }> {
    const personalCase = await this.personalCaseModel.findOne({
      _id: caseId,
      telegramId,
      isCompleted: false,
    });

    if (!personalCase) {
      return {
        status: 'error',
        message: 'Personal case not found or already completed',
      };
    }

    if (personalCase.isAdBased && !personalCase.isAdWatched) {
      return {
        status: 'error',
        message: 'You haven`t watched the commercial',
      };
    }

    if (personalCase.attempts >= personalCase.maxAttempts) {
      return {
        status: 'error',
        message: 'The number of attempts exceeded',
        attempts: personalCase.attempts,
      };
    }

    personalCase.attempts += 1;

    if (personalCase.code === inputCode) {
      const gamer = await this.gameModel.findOne({
        telegramId,
      });

      const currentTaskBalance = new Decimal(gamer.taskBalance || '0');
      const reward = calculateDailyReward(gamer);

      const updatedTaskBalance = currentTaskBalance
        .add(reward)
        .toDecimalPlaces(2)
        .toString();

      personalCase.reward = reward.toNumber();
      personalCase.isCompleted = true;
      gamer.taskBalance = updatedTaskBalance;

      await gamer.save();
      await personalCase.save();
      await this.logUserAttempt(
        telegramId,
        personalCase.id,
        personalCase.code,
        personalCase.reward,
        true,
        personalCase.isGlobal,
        personalCase.isAdBased,
        personalCase.isAdWatched,
      );

      return {
        status: 'success',
        reward: personalCase.reward,
        attempts: personalCase.attempts,
      };
    }

    await personalCase.save();
    await this.logUserAttempt(
      telegramId,
      personalCase.id,
      inputCode,
      personalCase.reward,
      false,
      personalCase.isGlobal,
      personalCase.isAdBased,
      personalCase.isAdWatched,
    );

    const correctDigits = this.compareCodes(personalCase.code, inputCode);

    return {
      status: 'partial_success',
      correctDigits,
      attempts: personalCase.attempts,
    };
  }

  compareCodes(correctCode: string, inputCode: string): number {
    return correctCode.split('').filter((digit, i) => digit === inputCode[i])
      .length;
  }

  async logUserAttempt(
    telegramId: string,
    caseId: string,
    code: string,
    reward: number,
    isSuccess: boolean,
    isGlobal: boolean,
    isAdBased: boolean,
    isAdWatched: boolean,
  ) {
    const attempt = new this.userAttemptModel({
      telegramId,
      caseId,
      code,
      reward,
      attemptTime: new Date(),
      isSuccess,
      isGlobal,
      isAdBased,
      isAdWatched,
    });
    await attempt.save();
  }

  async getAvailableCasesForUser(
    telegramId: string,
  ): Promise<PersonalCaseDTO[]> {
    await this.getOrCreateCasesForUser(telegramId);

    const personalCases = await this.personalCaseModel
      .find({
        telegramId,
        $or: [
          { expirationDate: { $gte: new Date() } },
          { expirationDate: { $exists: false } },
        ],
      })
      .sort({ _id: 1 })
      .exec();

    return personalCases.map((caseDoc, index) => ({
      id: caseDoc._id.toString(),
      containerNumber: index + 1,
      isCompleted: caseDoc.isCompleted,
      isGlobal: caseDoc.isGlobal,
      attempts: caseDoc.attempts,
      maxAttempts: caseDoc.maxAttempts,
      isAdBased: caseDoc.isAdBased,
      isAdWatched: caseDoc.isAdWatched,
    }));
  }

  async addExtraAttempts(telegramId: string): Promise<PersonalCaseDTO> {
    try {
      const personalCase = await this.personalCaseModel
        .findOne({
          telegramId,
          isCompleted: false,
          $or: [
            { expirationDate: { $gte: new Date() } },
            { expirationDate: { $exists: false } },
          ],
        })
        .sort({ _id: 1 });

      if (!personalCase) {
        throw new Error('No available case found');
      }

      personalCase.maxAttempts += 10;

      await personalCase.save();

      return {
        id: personalCase._id.toString(),
        isGlobal: personalCase.isGlobal,
        attempts: personalCase.attempts,
        maxAttempts: personalCase.maxAttempts,
        isAdBased: personalCase.isAdBased,
        isAdWatched: personalCase.isAdWatched,
      };
    } catch (error) {
      throw error;
    }
  }

  async markAdAsWatched(telegramId: string): Promise<PersonalCaseDTO> {
    try {
      const personalCase = await this.personalCaseModel
        .findOne({
          telegramId,
          isAdBased: true,
          isAdWatched: false,
          $or: [
            { expirationDate: { $gte: new Date() } },
            { expirationDate: { $exists: false } },
          ],
        })
        .sort({ _id: 1 });

      if (!personalCase) {
        throw new Error('No available ad-based case found');
      }

      personalCase.isAdWatched = true;

      await personalCase.save();

      return {
        id: personalCase._id.toString(),
        isGlobal: personalCase.isGlobal,
        attempts: personalCase.attempts,
        maxAttempts: personalCase.maxAttempts,
        isAdBased: personalCase.isAdBased,
        isAdWatched: personalCase.isAdWatched,
      };
    } catch (error) {
      throw error;
    }
  }
}
