import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if(process.env.MODE === "development"){
    app.enableCors({ origin: process.env.CLIENT_URL ?? 'http://localhost:3000' });
  }
  // TODO: 운영상황일때 cors
  await app.listen(process.env.PORT ?? 5173);
}

await bootstrap();
