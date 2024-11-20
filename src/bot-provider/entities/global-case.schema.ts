import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: true })
export class GlobalCase extends Document {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  updateTime: Date;
}

export type GlobalCaseDocument = GlobalCase & Document;

export const GlobalCaseSchema = SchemaFactory.createForClass(GlobalCase);
