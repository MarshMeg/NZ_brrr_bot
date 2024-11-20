import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

@Schema({ _id: true })
export class User {
  @Prop({ type: String, index: true, unique: true })
  public telegramId: string;

  @Prop()
  public name: string;

  @Prop()
  public createdAt: Date;

  @Prop()
  public updatedAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  public dadReferrerId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  public grandDadReferrerId: string;

  @Prop({ default: 0 })
  public balance: number;

  @Prop({ default: 10 })
  public referralBonus: number;

  @Prop({ default: false })
  public isSubscribed: boolean;

  @Prop()
  public twitter?: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
