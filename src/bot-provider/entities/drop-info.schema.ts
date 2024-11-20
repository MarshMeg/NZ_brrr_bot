import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class DropInfo {
  @Prop({ type: String, index: true, unique: true })
  public telegramId: string;

  @Prop()
  public data: string;

  @Prop()
  public datanew: string;
}

export type DropInfoDocument = DropInfo & Document;

export const DropInfoSchema = SchemaFactory.createForClass(DropInfo);
