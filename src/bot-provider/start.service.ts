import { Injectable } from '@nestjs/common';
import { Bot, GrammyError, InlineKeyboard } from 'grammy';
import {
  CONFIRM_SUBSCRIPTIONS_BTN,
  isValidChatMember,
  STATISTICS_BTN,
} from './constants';
import * as process from 'process';
import { ReferralHandlerService } from './referral/referral-handler.service';
import { InvalidReferralError } from './referral/errors/invalid-referral.error';
import { CacheService } from './cache/cache.service';
import mongoose from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class StartService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly referralHandlerService: ReferralHandlerService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async handleStart(ctx) {
    try {
      if (ctx.message.chat.type != 'private') {
        return;
      }

      await this.referralHandlerService.upsertUser(ctx);

      // Check if the user is a member
      const menu = new InlineKeyboard().text(
        CONFIRM_SUBSCRIPTIONS_BTN,
        CONFIRM_SUBSCRIPTIONS_BTN,
      );

      let message = `Hello stranger! Welcome to the best monetization bot in the world.\n`;
      message += `Subscribe to our channel and let's continue:\n\n`;
      message += `https://t.me/brrrrren\n`;
      await ctx.reply(message, {
        reply_markup: menu,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch (error) {
      if (error instanceof InvalidReferralError) {
        await ctx.reply('*🚸 Wrong Refer Link *', { parse_mode: 'Markdown' });
      } else if (error instanceof GrammyError) {
        console.error('An error occurred:', JSON.stringify(error.description));
      } else {
        console.error('An unknown error occurred:', error);
      }
    }
  }

  async checkSubscription(ctx, bot) {
    // Use the getChatMember method to check if the user is a member
    const isTgChannelMember = await this.isTgChannelMember(
      process.env.TG_CHANNEL_ID,
      ctx.from.id,
      bot,
    );

    // Check if the user is a member
    if (!isTgChannelMember) {
      return false;
    }

    return true;
  }

  async confirmSubscriptions(ctx, bot) {
    const isSubscribed = await this.checkSubscription(ctx, bot);
    if (!isSubscribed) {
      await this.replyNotSubscribed(ctx);
      return;
    }

    const isSubConfirmationInProgress =
      await this.cacheService.isUserSubscribed(ctx.from.id);
    if (isSubConfirmationInProgress) {
      await ctx.reply(
        'You have already confirmed your subscriptions. Use /mystats command to monitor your stats.',
        {
          parse_mode: 'Markdown',
        },
      );
      return;
    }

    await this.cacheService.setIsUserSubscribed(ctx.from.id);

    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();
    await this.referralHandlerService.markUserAsSubscribed(ctx);
    const user = await this.referralHandlerService.updateUsersBalance(ctx);
    await transactionSession.commitTransaction();
    await transactionSession.endSession();

    if (
      ctx.update?.callback_query?.message?.message_id &&
      ctx.update.callback_query.message.chat.id
    ) {
      ctx.api.deleteMessage(
        ctx.update.callback_query.message.chat.id,
        ctx.update.callback_query.message.message_id,
      );
    }

    const menu = new InlineKeyboard()
      .text(STATISTICS_BTN, STATISTICS_BTN)
      .webApp('Game', process.env.FRONT_END_URL);
    let message = `Great! Now you can see your stats and start sharing your ref link worldwide and start earning!\n`;
    message += `Use /mystats command to monitor your stats!\n\n`;
    message += `Balance: ${user.balance}\n`;
    message += `Referral bonus: ${user.referralBonus} %\n`;
    message += `Referral link: https://t.me/brrrrrgamebot?start=${user._id}`;
    await ctx.reply(message, {
      reply_markup: menu,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }

  async isTgChannelMember(chatId: string, userId: number, bot: Bot) {
    try {
      const chatMember = await bot.api.getChatMember(chatId, userId);
      return chatMember && isValidChatMember(chatMember.status);
    } catch (error) {
      if (error instanceof GrammyError) {
        console.error('An error occurred:', JSON.stringify(error.description));
      } else {
        console.error('An unknown error occurred:', error);
      }
    }
  }

  async replyShowStats(ctx, bot) {
    const user = await this.referralHandlerService.getUser(ctx.from.id);

    const isSubscribed = await this.checkSubscription(ctx, bot);
    if (!isSubscribed) {
      await this.replyNotSubscribed(ctx);
      return;
    }
    if (!user) {
      return;
    }

    const menu = new InlineKeyboard()
      .text(STATISTICS_BTN, STATISTICS_BTN)
      .webApp('Game', process.env.FRONT_END_URL);
    let message = `📊Yor Bot Live Status Here\n\n`;
    message += `Balance: ${user.balance}\n`;
    message += `Referral bonus: ${user.referralBonus} %\n`;
    message += `Referral link: https://t.me/brrrrrgamebot?start=${user._id}`;
    await ctx.reply(message, {
      reply_markup: menu,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }

  async replyNotSubscribed(ctx) {
    const menu = new InlineKeyboard().text(
      CONFIRM_SUBSCRIPTIONS_BTN,
      CONFIRM_SUBSCRIPTIONS_BTN,
    );

    let message = `You should be a member our channel:\n\n`;
    message += `[brrrrr en](https://t.me/brrrrren)\n`;
    await ctx.reply(message, {
      reply_markup: menu,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }
}
