import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class Gamer {
  @Prop({ type: String, index: true, unique: true })
  public telegramId: string;

  @Prop()
  public createdAt: Date;

  @Prop()
  public snapshotTime: Date;

  @Prop({ default: '0' })
  public balance: string;

  @Prop({ default: '0' })
  public taskBalance: string;

  @Prop({ default: 1 })
  public moneyStorageLvl: number;

  @Prop({ default: 1 })
  public paperStorageLvl: number;

  @Prop({ default: 1 })
  public printingSpeedLvl: number;

  @Prop({ default: 1 })
  public banknoteLvl: number;

  @Prop({ default: '0' })
  public paperAmount: string;

  @Prop({ default: '0' })
  public usedBankBalance: string;

  @Prop()
  public rank?: string;

  @Prop()
  public username?: string;

  @Prop()
  public firstName?: string;

  @Prop()
  public lastName?: string;

  @Prop({ type: Date, default: null })
  public dailyRewardLastClaimed: Date;

  @Prop({ default: 0 })
  public dailyRewardStreak: number;

  @Prop({ type: Number, default: 0 })
  public exp: number;
}

export type GamerDocument = Gamer & Document;

export const GamerSchema = SchemaFactory.createForClass(Gamer);
