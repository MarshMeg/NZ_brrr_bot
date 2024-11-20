import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { map } from 'rxjs/operators';
import { Boosters } from './constants';
import { User, UserDocument } from '../entities/user.schema';
import { Gamer, GamerDocument } from '../entities/gamer.schema';
import Decimal from 'decimal.js';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  Transaction,
  TransactionDocument,
} from '../entities/transaction.schema';
import { BonusTon, BonusTonDocument } from '../entities/bonus-ton.schema';
import { DropWallet, DropWalletDocument } from '../entities/drop-wallet.schema';

@Injectable()
export class BlockchainService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Gamer.name) private gameModel: Model<GamerDocument>,
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
    @InjectModel(BonusTon.name) private bonusTonModel: Model<BonusTonDocument>,
    @InjectModel(DropWallet.name)
    private dropWalletModel: Model<DropWalletDocument>,
    private readonly httpService: HttpService,
  ) {}
  private datax = {};
  private datay = {};
  private cnt = 0;

  async triggerTxChecks() {
    const txLt =
      (
        await this.txModel.findOne(
          {
            item: { $in: ['p1', 'p2'] },
          },
          {},
          {
            sort: { uTime: -1 },
          },
        )
      )?.lt ?? null;

    let data = await lastValueFrom(
      this.httpService
        .get('https://toncenter.com/api/v2/getTransactions', {
          params: {
            address: 'UQBLl-oh_BkTQiSY2nGJr-psrx5vu_wLPsADKJ8kKlJexdeW',
            limit: 100,
            archival: false,
            ...(txLt && { to_lt: txLt }),
          },
        })
        .pipe(map((response) => response.data)),
    );

    let iter = 1;
    while (data.result.length > 0) {
      console.log(iter);
      let lastIdx = 0;
      for (let i = 0; i < data.result?.length; i++) {
        lastIdx = i;
        try {
          const message = data.result[i].in_msg?.message;
          if (!message) {
            continue;
          }

          const dataList = message.split(',');
          if (
            await this.txModel.findOne({
              hash: data.result[i].transaction_id.hash,
            })
          ) {
            continue;
          }

          if (data.result[i].in_msg.value !== Boosters[dataList[1]]?.price) {
            continue;
          }

          if (data.result[i]?.out_msgs?.length > 0) {
            console.log(
              `Fake transaction ${data.result[i].transaction_id.hash}`,
            );
            continue;
          }

          const user = await this.gameModel.findById(dataList[0]);

          await this.txModel.create({
            hash: data.result[i].transaction_id.hash,
            telegramId: user?.telegramId,
            item: dataList[1],
            amount: data.result[i].in_msg.value,
            lt: data.result[i].transaction_id.lt,
            uTime: data.result[i].utime,
            createdAt: new Date(),
            sendToAddress: data.result[i].in_msg.source,
          });

          if (!this.datax[data.result[i].in_msg.source]) {
            this.datax[data.result[i].in_msg.source] = [
              {
                txHash: data.result[i].transaction_id.hash,
                telegramId: user?.telegramId,
                item: dataList[1],
                amount: data.result[i].in_msg.value,
                fromAddress: data.result[i].in_msg.source,
              },
            ];
          } else {
            this.datax[data.result[i].in_msg.source].push({
              txHash: data.result[i].transaction_id.hash,
              telegramId: user?.telegramId,
              item: dataList[1],
              amount: data.result[i].in_msg.value,
              fromAddress: data.result[i].in_msg.source,
            });
          }

          this.cnt++;
          if (!this.datay[data.result[i].in_msg.source]) {
            this.datay[data.result[i].in_msg.source] = new Decimal(
              data.result[i].in_msg.value,
            );
          } else {
            this.datay[data.result[i].in_msg.source] = this.datay[
              data.result[i].in_msg.source
            ].add(data.result[i].in_msg.value);
          }
        } catch (e) {}
      }

      await new Promise((r) => setTimeout(r, 2000));

      data = await lastValueFrom(
        this.httpService
          .get('https://toncenter.com/api/v2/getTransactions', {
            params: {
              address: 'UQBLl-oh_BkTQiSY2nGJr-psrx5vu_wLPsADKJ8kKlJexdeW',
              limit: 100,
              archival: false,
              lt: data.result[lastIdx].transaction_id.lt,
              hash: data.result[lastIdx].transaction_id.hash,
            },
          })
          .pipe(map((response) => response.data)),
      );
      iter = iter + 1;

      if (this.cnt === 2879) {
        break;
      }
    }

    console.log(JSON.stringify(this.datax));
    console.log(JSON.stringify(this.datay));
    console.log(this.cnt);
  }

  async triggerBuyTxChecks() {
    const txLt =
      (
        await this.txModel.findOne(
          {
            item: { $in: ['l1', 'l2', 'l3'] },
          },
          {},
          {
            sort: { uTime: -1 },
          },
        )
      )?.lt ?? null;

    const data = await lastValueFrom(
      this.httpService
        .get('https://toncenter.com/api/v2/getTransactions', {
          params: {
            address: 'UQCa6yjmzXrurmkiyi4D0xfCKPTi5bT-gAdeIC00zayL2jw9',
            limit: 100,
            archival: false,
            ...(txLt && { to_lt: txLt }),
          },
        })
        .pipe(map((response) => response.data)),
    );

    for (let i = 0; i < data.result?.length; i++) {
      try {
        const message = data.result[i].in_msg?.message;
        if (!message) {
          continue;
        }

        const dataList = message.split(',');
        if (
          await this.txModel.findOne({
            hash: data.result[i].transaction_id.hash,
          })
        ) {
          continue;
        }

        if (!['l1', 'l2', 'l3'].includes(dataList[1] ?? null)) {
          continue;
        }

        if (data.result[i]?.out_msgs?.length > 0) {
          console.log(
            `Fake buy transaction ${data.result[i].transaction_id.hash}`,
          );
          continue;
        }

        const gamer = await this.gameModel.findById(dataList[0]);
        const user = await this.userModel.findOne({
          telegramId: gamer.telegramId,
        });

        await this.txModel.create({
          hash: data.result[i].transaction_id.hash,
          telegramId: gamer?.telegramId,
          item: dataList[1],
          sendToAddress: dataList[2],
          amount: data.result[i].in_msg.value,
          lt: data.result[i].transaction_id.lt,
          uTime: data.result[i].utime,
          createdAt: new Date(),
        });

        if (user.dadReferrerId) {
          const ref = await this.userModel.findById(user.dadReferrerId);
          await this.bonusTonModel.create({
            hash: data.result[i].transaction_id.hash,
            telegramId: ref?.telegramId,
            bonus: new Decimal(data.result[i].in_msg.value)
              .mul(new Decimal(ref?.referralBonus ?? 0).div(100).div(2))
              .toDecimalPlaces(2),
            createdAt: new Date(),
          });
        }
      } catch (e) {}
    }
  }

  async getRefRewardInfo(telegramId: string) {
    const refs = await this.bonusTonModel.find({
      telegramId,
    });

    return refs
      .reduce((total, ref) => {
        return total.add(ref.bonus ?? 0);
      }, new Decimal(0))
      .toDecimalPlaces(2);
  }

  async triggerClaimTxChecks() {
    const txLt =
      (
        await this.txModel.findOne(
          {
            item: { $in: ['cl'] },
          },
          {},
          {
            sort: { uTime: -1 },
          },
        )
      )?.lt ?? null;

    const data = await lastValueFrom(
      this.httpService
        .get('https://toncenter.com/api/v2/getTransactions', {
          params: {
            address: 'EQBDDKsGE2u7QzAk49LlZeLdR93S6yJHQ6780EvXa0iIu_Dy',
            limit: 100,
            archival: false,
            ...(txLt && { to_lt: txLt }),
          },
        })
        .pipe(map((response) => response.data)),
    );

    for (let i = 0; i < data.result?.length; i++) {
      try {
        const message = data.result[i].in_msg?.message;
        if (!message) {
          continue;
        }

        const dataList = message.split(',');
        if (
          await this.txModel.findOne({
            hash: data.result[i].transaction_id.hash,
          })
        ) {
          continue;
        }

        if (!['cl'].includes(dataList[1] ?? null)) {
          continue;
        }

        if (data.result[i]?.out_msgs?.length > 0) {
          console.log(
            `Fake claim transaction ${data.result[i].transaction_id.hash}`,
          );
          continue;
        }

        const gamer = await this.gameModel.findById(dataList[0]);
        const unclaimed = await this.getSaleInfo(dataList[0]);

        await this.txModel.create({
          hash: data.result[i].transaction_id.hash,
          telegramId: gamer?.telegramId,
          item: dataList[1],
          sendToAddress: dataList[2],
          amount: data.result[i].in_msg.value,
          lt: data.result[i].transaction_id.lt,
          uTime: data.result[i].utime,
          createdAt: new Date(),
        });
      } catch (e) {}
    }
  }

  async getSaleInfo(telegramId: string) {
    const transactions: any = await this.txModel.find({
      telegramId,
      item: ['l1', 'l2', 'l3'],
    });

    const optionsInfo = transactions.reduce(
      (sumList, item) => {
        sumList[item.item] = sumList[item.item].add(item.amount);
        return sumList;
      },
      { l1: new Decimal(0), l2: new Decimal(0), l3: new Decimal(0) },
    );

    const claimed = await this.getClaimedAmount(telegramId);
    const date = new Date(Date.UTC(2024, 6, 12, 16, 0, 0));
    const saleStartTimestamp = Math.floor(date.getTime() / 1000);
    const currentTimestampInSeconds = Math.floor(Date.now() / 1000);
    const total = new Decimal(optionsInfo['l1'])
      .add(new Decimal(optionsInfo['l2']).mul(1.25))
      .add(new Decimal(optionsInfo['l3']).mul(1.5));
    const unlocked = new Decimal(optionsInfo['l1'])
      .add(
        new Decimal(optionsInfo['l2'])
          .mul((currentTimestampInSeconds - saleStartTimestamp) / 1296000)
          .mul(1.25),
      )
      .add(
        new Decimal(optionsInfo['l3'])
          .mul((currentTimestampInSeconds - saleStartTimestamp) / 2678400)
          .mul(1.5),
      )
      .sub(claimed);

    return {
      unlocked,
      claimed,
      total,
    };
  }

  async getClaimedAmount(telegramId) {
    const transactions: any = await this.txModel.find({
      telegramId,
      item: ['cl'],
    });

    return transactions.reduce((sum, item) => {
      sum = sum.add(item.claimed ?? 0);
      return sum;
    }, new Decimal(0));
  }

  async saveChosenOption(telegramId: string, option: number, wallet: string) {
    const dropData: any = await this.dropWalletModel.findOne({
      telegramId,
    });

    if (dropData) {
      dropData.option = option;
      dropData.wallet = wallet;
      await dropData.save();
    } else {
      await this.dropWalletModel.create({
        telegramId,
        option,
        wallet,
        createdAt: new Date(),
      });
    }
  }

  async getChosenOption(telegramId: string) {
    return this.dropWalletModel.findOne({
      telegramId,
    });
  }

  async processSuccessfulPayment(
    telegramId: number,
    boosterId: string,
    totalAmount: number = 0,
    transactionHash: string = '',
    sendToAddress: string = ''
  ): Promise<void> {
    try {
      const now = new Date();

      const booster = Boosters[boosterId];
      if (!booster) {
        throw new HttpException('Неверный идентификатор бустера', HttpStatus.BAD_REQUEST);
      }

      const boostTimeAgo = new Date();
      boostTimeAgo.setHours(boostTimeAgo.getHours() - booster.hours);

      const activeBooster = await this.txModel.findOne({
        telegramId,
        item: boosterId,
        createdAt: { $gte: boostTimeAgo },
      });

      if (activeBooster) {
        throw new HttpException('У пользователя уже есть активный бустер', HttpStatus.CONFLICT);
      }

      await this.txModel.create({
        hash: transactionHash,
        telegramId: telegramId,
        item: boosterId,
        amount: totalAmount.toString(),
        lt: '',
        uTime: Math.floor(Date.now() / 1000),
        createdAt: new Date(),
        sendToAddress: sendToAddress,
      });

    } catch (error) {
      console.error('Ошибка при создании записи транзакции:', error.message);
    }
  }
}
