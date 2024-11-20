import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class BonusTon {
  @Prop({ type: String, index: true, unique: false })
  public telegramId: string;

  @Prop()
  public createdAt: Date;

  @Prop()
  public hash: string;

  @Prop({ default: '0' })
  public bonus: string;
}

export type BonusTonDocument = BonusTon & Document;

export const BonusTonSchema = SchemaFactory.createForClass(BonusTon);
