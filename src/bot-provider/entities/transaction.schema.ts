import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class Transaction {
  @Prop({ type: String, index: true })
  public telegramId: string;

  @Prop()
  public createdAt: Date;

  @Prop({ type: String, index: true, unique: true })
  public hash: string;

  @Prop({ default: '0' })
  public amount: string;

  @Prop()
  public item: string;

  @Prop()
  public lt: string;

  @Prop()
  public uTime: number;

  @Prop()
  public sendToAddress: string;

  @Prop({ default: '0' })
  public claimed: string;
}

export type TransactionDocument = Transaction & Document;

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
