import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: true })
export class UserAttempt extends Document {
  @Prop({ required: true })
  telegramId: string;

  @Prop({ required: true })
  caseId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  reward: number;

  @Prop({ required: true })
  attemptTime: Date;

  @Prop({ required: true })
  isSuccess: boolean;

  @Prop({ required: true })
  isGlobal: boolean;

  @Prop({ required: false, default: false })
  isAdBased: boolean;

  @Prop({ required: false, default: false })
  isAdWatched: boolean;
}

export type UserAttemptDocument = UserAttempt & Document;

export const UserAttemptSchema = SchemaFactory.createForClass(UserAttempt);
