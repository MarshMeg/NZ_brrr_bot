import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

@Schema({ _id: true })
export class Referral {
  @Prop()
  public createdAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  public referrerId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  public referralId: string;

  @Prop()
  public bonus: number;
}

export type ReferralDocument = Referral & Document;

export const ReferralSchema = SchemaFactory.createForClass(Referral);

ReferralSchema.index({ referrerId: 1, referralId: 1 }, { unique: true });
