import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class Task {
  @Prop()
  public title: string;

  @Prop()
  public link: string;

  @Prop({ type: String })
  public tgChannelId: string;

  @Prop({ default: 0 })
  public bonus: number;

  @Prop({ default: 0 })
  public rewardedMinutes: number;

  @Prop({ default: 0 })
  public completionLimit: number;

  @Prop({ default: 0 })
  public completedTimes: number;

  @Prop({ default: false })
  public isEnabled: boolean;

  @Prop({ default: false })
  public isConfirmationDisabled: boolean;

  @Prop()
  public createdAt: Date;

  @Prop()
  public lang: string[];

  @Prop({ default: 0 })
  public exp: number;
}

export type TaskDocument = Task & Document;

export const TaskSchema = SchemaFactory.createForClass(Task);
