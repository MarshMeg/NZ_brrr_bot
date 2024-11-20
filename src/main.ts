// import { otelSDK } from './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { writeHeapSnapshot } from 'node:v8';
// import * as morgan from 'morgan';

async function bootstrap() {
  // await otelSDK.start();
  dotenv.config();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONT_END_URL,
    // origin: '*',
  });

  // setInterval(() => {
  //   console.log(`XXX Stats:`, writeHeapSnapshot());
  // }, 5000); // Log every second
  // app.use(morgan('combined'));

  await app.listen(3000);
}

bootstrap();
