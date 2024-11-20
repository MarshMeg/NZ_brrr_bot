import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: true })
export class PersonalCase extends Document {
  @Prop({ required: true })
  telegramId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  reward: number;

  @Prop({ required: false })
  expirationDate: Date;

  @Prop({ required: true, default: false })
  isCompleted: boolean;

  @Prop({ required: true })
  isGlobal: boolean;

  @Prop({ required: true, default: 0 })
  attempts: number;

  @Prop({ required: true, default: 15 })
  maxAttempts: number;

  @Prop({ required: false, default: false })
  isAdBased: boolean;

  @Prop({ required: false, default: false })
  isAdWatched: boolean;
}

export type PersonalCaseDocument = PersonalCase & Document;

export const PersonalCaseSchema = SchemaFactory.createForClass(PersonalCase);
