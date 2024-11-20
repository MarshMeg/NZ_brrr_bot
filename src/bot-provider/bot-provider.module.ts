import { DynamicModule, Global, Module } from '@nestjs/common';
import { Bot } from 'grammy';
import { run } from '@grammyjs/runner';
import { StartService } from './start.service';
import { CONFIRM_SUBSCRIPTIONS_BTN, STATISTICS_BTN } from './constants';
import { Boosters } from '../bot-provider/game/constants';
import { ReferralHandlerService } from './referral/referral-handler.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.schema';
import { Referral, ReferralSchema } from './entities/referral.schema';
import { CacheService } from './cache/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import { Bonus, BonusSchema } from './entities/bonus.schema';
import { GameService } from './game/game.service';
import { Gamer, GamerSchema } from './entities/gamer.schema';
import { GamerTask, GamerTaskSchema } from './entities/gamer-task.schema';
import { Task, TaskSchema } from './entities/task.schema';
import { TaskService } from './game/task.service';
import { HttpModule } from '@nestjs/axios';
import { Transaction, TransactionSchema } from './entities/transaction.schema';
import { autoRetry } from '@grammyjs/auto-retry';
import { Settings, SettingsSchema } from './entities/settings.schema';
import { BonusTon, BonusTonSchema } from './entities/bonus-ton.schema';
import { BlockchainService } from './game/blockchain.service';
import { DropWallet, DropWalletSchema } from './entities/drop-wallet.schema';
import { DropInfo, DropInfoSchema } from './entities/drop-info.schema';
import { GlobalCase, GlobalCaseSchema } from './entities/global-case.schema';
import { UserAttempt, UserAttemptSchema } from './entities/user-attempt.schema';
import {
  PersonalCase,
  PersonalCaseSchema,
} from './entities/personal-case.schema';

@Global()
@Module({})
export class BotProviderModule {
  static forRoot(): DynamicModule {
    const botProvider = {
      provide: Bot,
      useFactory: async (
        startService: StartService,
        blockchainService: BlockchainService,
      ) => {
        console.log('Starting app...');

        // Handler of all errors, in order to prevent the bot from stopping
        process.on('uncaughtException', function (exception) {
          console.log(exception);
        });

        // Create a bot that uses 'polling' to fetch new updates
        const bot = new Bot(process.env.BOT_TOKEN);

        bot.api.config.use(autoRetry());
        bot.catch((exception) => {
          console.log(JSON.stringify(exception));
        });

        // bot.use(
        //   limit({
        //     // Allow only 3 messages to be handled every 2 seconds.
        //     timeFrame: 2000,
        //     limit: 3,
        //     // This is called when the limit is exceeded.
        //     onLimitExceeded: async (ctx) => {
        //       await ctx.reply('Please refrain from sending too many requests!');
        //     },
        //     // Note that the key should be a number in string format such as "123456789".
        //     keyGenerator: (ctx) => {
        //       return ctx.from?.id.toString();
        //     },
        //   }),
        // );
        // // Set the initial data of our session
        // bot.use(session({ initial: () => ({ amount: 0, comment: '' }) }));
        // // Install the conversation plugin
        // bot.use(conversations());

        // Register all handelrs
        bot.command('start', (ctx) => startService.handleStart(ctx));
        bot.command('mystats', (ctx) => startService.replyShowStats(ctx, bot));
        bot.on('callback_query:data', async (ctx) => {
          if (ctx.callbackQuery.data === CONFIRM_SUBSCRIPTIONS_BTN) {
            await startService.confirmSubscriptions(ctx, bot);
          }
          if (ctx.callbackQuery.data === STATISTICS_BTN) {
            await startService.replyShowStats(ctx, bot);
          }
          await ctx.answerCallbackQuery();
        });

        bot.on('message:successful_payment', async (ctx) => {
          const paymentData = ctx.message.successful_payment;
          const telegramId = ctx.from.id;
          const boosterId = paymentData.invoice_payload;
          const transactionHash = paymentData.telegram_payment_charge_id;
          const totalAmount = paymentData.total_amount;

          await blockchainService.processSuccessfulPayment(
            telegramId,
            boosterId,
            totalAmount,
            transactionHash,
          );
        });

        bot.on('pre_checkout_query', async (ctx) => {
          try {
            await ctx.answerPreCheckoutQuery(true);
            console.log(
              'Pre-checkout query confirmed:',
              ctx.preCheckoutQuery.id,
            );
          } catch (error) {
            console.error(
              'Ошибка при обработке pre_checkout_query:',
              error.message,
            );
            await ctx.answerPreCheckoutQuery(false, {
              error_message:
                'Произошла ошибка при проверке вашего заказа. Попробуйте снова.',
            });
          }
        });

        if (!bot.isInited()) {
          await bot.init();
        }
        // bot.start();
        run(bot);

        console.log(`Bot @${bot.botInfo.username} is up and running`);

        return bot;
      },
      inject: [StartService, BlockchainService],
    };
    return {
      module: BotProviderModule,
      imports: [
        CacheModule.register(),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Referral.name, schema: ReferralSchema },
          { name: Bonus.name, schema: BonusSchema },
          { name: Gamer.name, schema: GamerSchema },
          { name: GamerTask.name, schema: GamerTaskSchema },
          { name: Task.name, schema: TaskSchema },
          { name: Transaction.name, schema: TransactionSchema },
          { name: Settings.name, schema: SettingsSchema },
          { name: BonusTon.name, schema: BonusTonSchema },
          { name: DropWallet.name, schema: DropWalletSchema },
          { name: DropInfo.name, schema: DropInfoSchema },
          { name: GlobalCase.name, schema: GlobalCaseSchema },
          { name: UserAttempt.name, schema: UserAttemptSchema },
          { name: PersonalCase.name, schema: PersonalCaseSchema },
        ]),
        HttpModule,
      ],
      providers: [
        botProvider,
        StartService,
        ReferralHandlerService,
        CacheService,
        GameService,
        TaskService,
        BlockchainService,
      ],
      exports: [Bot, GameService, TaskService, BlockchainService],
    };
  }
}
