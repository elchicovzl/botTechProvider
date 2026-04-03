import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // CRITICAL: Required for Meta webhook signature verification
  });

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // Enable URL-encoded body parsing for Twilio webhooks (form-encoded POST).
  // NestJS enables JSON body parsing globally by default but NOT urlencoded.
  app.use('/webhooks', express.urlencoded({ extended: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}
bootstrap();
