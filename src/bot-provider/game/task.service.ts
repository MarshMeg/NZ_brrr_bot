import { Inject, Injectable } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../entities/user.schema';
import { Gamer, GamerDocument } from '../entities/gamer.schema';
import { ReferralHandlerService } from '../referral/referral-handler.service';
import { GamerTask, GamerTaskDocument } from '../entities/gamer-task.schema';
import { Task, TaskDocument } from '../entities/task.schema';
import { LogicError } from './errors/logic.error';
import { Bot, GrammyError } from 'grammy';
import { isValidChatMember } from '../constants';
import Decimal from 'decimal.js';
import { BANKNOTE_DENOMINATION, PRINTING_SPEED } from './constants';
import { Settings, SettingsDocument } from '../entities/settings.schema';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Gamer.name) private gameModel: Model<GamerDocument>,
    @InjectModel(GamerTask.name)
    private gamerTaskModel: Model<GamerTaskDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    @Inject(Bot) private bot: Bot,
    private readonly referralService: ReferralHandlerService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async createTask(
    link: string,
    title: string,
    tgChannelId: string,
    completionLimit: number,
    rewardedMinutes: number,
    isConfirmationDisabled: boolean,
    lang: string[],
    exp: number,
  ) {
    const task = await this.taskModel.create({
      link,
      title,
      tgChannelId,
      completionLimit,
      createdAt: new Date(),
      rewardedMinutes,
      isConfirmationDisabled,
      lang,
      exp: exp ?? 0,
    });
    return task;
  }

  async deleteTask(id: string) {
    await this.taskModel.deleteOne({
      _id: id,
    });
  }

  async getTaskList() {
    return this.taskModel.find();
  }

  async updateTask(id: string, completionLimit: string) {
    await this.taskModel.updateMany(
      {
        _id: id,
      },
      { completionLimit },
    );
  }

  async markAsCompleted(telegramId: string, taskId: string) {
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    const gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError(`Gamer does not exist`);
    }

    const setting = await this.settingsModel.findOne({
      key: 'is-game-enabled',
    });
    if (!setting) {
      throw new LogicError(`Setting 'is-game-enabled' is undefined`);
    }
    if (setting?.value !== 'enabled') {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      return gamer;
    }

    const task: any = await this.taskModel.findById(taskId);
    if (!task) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError(`Task does not exist`);
    }

    if (task.completionLimit && task.completedTimes >= task.completionLimit) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError(`Task reached completion limit`);
    }

    const gamerTask: any = await this.gamerTaskModel.findOne({
      telegramId,
      taskId,
    });
    if (gamerTask) {
      await transactionSession.abortTransaction();
      await transactionSession.endSession();
      throw new LogicError(`Task already completed`);
    }

    if (!task.isConfirmationDisabled) {
      const isMember = await this.isTgChannelMember(
        task.tgChannelId,
        Number(telegramId),
      );
      if (!isMember) {
        await transactionSession.abortTransaction();
        await transactionSession.endSession();
        throw new LogicError('Not a tg channel member');
      }
    }

    task.completedTimes = task.completedTimes + 1;
    await task.save();

    const bonus = new Decimal(task.bonus ?? 0).gt(0)
      ? task.bonus
      : new Decimal(task.rewardedMinutes ?? 0)
          .mul(PRINTING_SPEED[gamer.printingSpeedLvl])
          .mul(BANKNOTE_DENOMINATION[gamer.banknoteLvl])
          .mul(60);

    await this.gamerTaskModel.create({
      taskId: task._id,
      telegramId,
      createdAt: new Date(),
      bonus,
    });

    gamer.taskBalance = new Decimal(gamer.taskBalance ?? 0)
      .add(bonus)
      .toDecimalPlaces(2);
    if (task.exp && task.exp > 0) {
      gamer.exp = gamer.exp + task.exp;
    }
    await gamer.save();

    await transactionSession.commitTransaction();
    await transactionSession.endSession();
  }

  async getUserTaskList(telegramId: string, lang?: string) {
    const user: any = await this.userModel.findOne({
      telegramId,
    });
    if (!user) {
      throw new LogicError(`User does not exist`);
    }
    const gamer: any = await this.gameModel.findOne({
      telegramId,
    });
    if (!gamer) {
      throw new LogicError(`Gamer does not exist`);
    }

    let taskList: any =
      (await this.taskModel.find().sort({ createdAt: -1 })) ?? [];

    taskList = taskList.filter(
      (task) =>
        (task.completionLimit && task.completedTimes < task.completionLimit) ||
        !task.completionLimit,
    );
    if (!taskList?.length) {
      return [];
    }

    if (lang) {
      taskList = taskList.filter(
        (task) => task.lang?.length === 0 || task.lang?.includes(lang),
      );
    }
    if (!taskList.length) {
      return [];
    }

    const gamerTaskList: any =
      (await this.gamerTaskModel.find({
        telegramId,
      })) ?? [];

    return taskList.map((task) => {
      task.isCompleted = gamerTaskList.some(
        (gamerTask) => gamerTask.taskId.toString() === task._id.toString(),
      );
      task.bonus = new Decimal(task.bonus ?? 0).gt(0)
        ? task.bonus
        : new Decimal(task.rewardedMinutes ?? 0)
            .mul(PRINTING_SPEED[gamer.printingSpeedLvl])
            .mul(BANKNOTE_DENOMINATION[gamer.banknoteLvl])
            .mul(60)
            .toDecimalPlaces(2);
      return task;
    });
  }

  async isTgChannelMember(chatId: string, userId: number) {
    try {
      const chatMember = await this.bot.api.getChatMember(chatId, userId);
      return chatMember && isValidChatMember(chatMember.status);
    } catch (error) {
      if (error instanceof GrammyError) {
        console.error('An error occurred:', JSON.stringify(error.description));
      } else {
        console.error('An unknown error occurred:', error);
      }
      throw new LogicError(error.description);
    }
  }
}
