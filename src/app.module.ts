import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BotProviderModule } from './bot-provider/bot-provider.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AdminController } from './admin.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { AuthController } from './auth/auth.controller';
import { TonManifestController } from './ton-manifest.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TonCheckerService } from './ton-checker.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      cache: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.getOrThrow('MONGO_CONNECTION_STRING'),
        user: 'root',
        pass: 'example',
      }),
    }),
    BotProviderModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AppController,
    AdminController,
    AuthController,
    TonManifestController,
  ],
  providers: [AuthService, JwtStrategy, TonCheckerService],
})
export class AppModule {}
