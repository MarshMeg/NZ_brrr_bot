import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class DropWallet {
  @Prop({ type: String, index: true, unique: true })
  public telegramId: string;

  @Prop()
  public createdAt: Date;

  @Prop({ type: String, index: true })
  public wallet: string;

  @Prop()
  public option: number;
}

export type DropWalletDocument = DropWallet & Document;

export const DropWalletSchema = SchemaFactory.createForClass(DropWallet);
