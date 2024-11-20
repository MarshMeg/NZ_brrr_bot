import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class Settings {
  @Prop()
  public key: string;

  @Prop()
  public value: string;
}

export type SettingsDocument = Settings & Document;

export const SettingsSchema = SchemaFactory.createForClass(Settings);
