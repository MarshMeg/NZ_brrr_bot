import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

@Schema({ _id: true })
export class GamerTask {
  @Prop()
  public createdAt: Date;

  @Prop({ type: String, index: true })
  public telegramId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Task' })
  public taskId: string;

  @Prop()
  public bonus: number;
}

export type GamerTaskDocument = GamerTask & Document;

export const GamerTaskSchema = SchemaFactory.createForClass(GamerTask);

GamerTaskSchema.index({ telegramId: 1, taskId: 1 }, { unique: true });
