import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class Bonus {
  @Prop()
  public telegramId: string;

  @Prop()
  public link: string;

  @Prop()
  public createdAt: Date;

  @Prop()
  public updatedAt: Date;

  @Prop({ default: 0 })
  public bonus: number;
}

export type BonusDocument = Bonus & Document;

export const BonusSchema = SchemaFactory.createForClass(Bonus);

BonusSchema.index({ telegramId: 1, link: 1 }, { unique: true });
