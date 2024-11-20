import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../entities/user.schema';
import * as process from 'process';
import { InvalidReferralError } from './errors/invalid-referral.error';
import { Referral, ReferralDocument } from '../entities/referral.schema';
import { Bonus, BonusDocument } from '../entities/bonus.schema';
import Decimal from 'decimal.js';
import { Settings, SettingsDocument } from '../entities/settings.schema';

@Injectable()
export class ReferralHandlerService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Referral.name) private referralModel: Model<ReferralDocument>,
    @InjectModel(Bonus.name) private bonusModel: Model<BonusDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
  ) {}

  async upsertUser(ctx) {
    let userData: any = await this.userModel.findOne({
      telegramId: ctx.from.id,
    });
    if (!userData) {
      let referral;
      if (ctx.match) {
        referral = await this.userModel.findById(ctx.match);
        if (!referral) {
          throw new InvalidReferralError();
        }
      }

      userData = await this.userModel.create({
        telegramId: ctx.from.id,
        dadReferrerId: referral?._id ?? null,
        grandDadReferrerId: referral?.dadReferrerId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return userData;
  }

  async markUserAsSubscribed(ctx) {
    const userData: any = await this.userModel.findOne({
      telegramId: ctx.from.id,
    });
    if (!userData.isSubscribed) {
      await this.userModel.findByIdAndUpdate(userData._id, {
        telegramId: ctx.from.id,
      });
    }
    return userData;
  }

  async getUser(telegramId: string) {
    const userData: any = await this.userModel.findOne({
      telegramId,
    });
    // TODO: do smth if user does not exist
    return userData;
  }

  async updateUsersBalance(ctx) {
    const userData: any = await this.userModel.findOne({
      telegramId: ctx.from.id,
    });

    const shouldTrackReferralBonus = await this.shouldTrackReferrerBonus(
      userData._id,
      userData._id,
    );

    const dadReferrer: any = await this.userModel.findById(
      userData.dadReferrerId,
    );
    const grandDadReferrer: any = await this.userModel.findById(
      userData.grandDadReferrerId,
    );

    let bonus = Number(process.env.REFERRAL_BALANCE);
    const setting = (await this.settingsModel.findOne({
      key: 'is-game-enabled',
    })) as string;
    if (setting !== 'enabled') {
      bonus = 0;
    }

    // tracks ref bonus for user who made activity
    if (shouldTrackReferralBonus && dadReferrer) {
      await this.referralModel.create({
        createdAt: new Date(),
        referrerId: userData._id,
        referralId: userData._id,
        bonus,
      });
      userData.set('balance', Decimal.add(userData.balance, bonus));
      await userData.save();
    }

    // tracks ref bonus for user, who referred current user
    if (dadReferrer) {
      await this.updateReferrerBalance(dadReferrer, userData._id, bonus);
    } else {
      // specific case for marketer @slshow
      const marketer: any = await this.userModel.findOne({
        telegramId: '571331130',
      });
      if (marketer) {
        await this.userModel.findByIdAndUpdate(marketer._id, {
          balance: Decimal.add(
            marketer.balance,
            Decimal.mul(bonus, marketer.referralBonus).div(100),
          ),
        });
      }
    }
    // tracks ref bonus for user, who referred user, who referred current user
    if (grandDadReferrer) {
      await this.updateReferrerBalance(grandDadReferrer, userData._id, bonus);
    }
    return userData;
  }

  async updateReferrerBalance(
    referrerData: any,
    referralId: string,
    userBonus: number,
  ) {
    if (!referrerData) {
      console.log('Referrer does not exist:', {
        referrerData,
        referralId,
      });
      return;
    }
    const bonus = Decimal.mul(userBonus, referrerData.referralBonus).div(100);

    const shouldTrackReferrerBonus = await this.shouldTrackReferrerBonus(
      referrerData._id,
      referralId,
    );
    if (!shouldTrackReferrerBonus) {
      return;
    }

    await this.referralModel.create({
      createdAt: new Date(),
      referrerId: referrerData._id,
      referralId,
      bonus,
    });
    await this.userModel.findByIdAndUpdate(referrerData._id, {
      balance: bonus.add(referrerData.balance),
    });
  }

  async shouldTrackReferrerBonus(
    referrerId: string,
    referralId: string,
  ): Promise<boolean> {
    const referrerBonusData: any = await this.referralModel.findOne({
      referrerId,
      referralId,
    });
    if (referrerBonusData) {
      console.log('Bonus already counted in for:', {
        referrerId,
        referralId,
      });
      return false;
    }

    return true;
  }

  async updateBonus(telegramId, link) {
    try {
      const userData: any = await this.bonusModel.findOne({
        telegramId,
        link,
      });
      if (userData) {
        return;
      }
      await this.bonusModel.create({
        telegramId,
        link,
        createdAt: new Date(),
        bonus: 100,
      });
    } catch (e) {
      console.log(e?.message);
    }
  }
}
