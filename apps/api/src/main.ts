import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // CRITICAL: Required for webhook signature verification
  });

  app.enableCors({
    origin: (origin, callback) => {
      // Allow any origin for webchat/widget (public, embeddable endpoints)
      // Allow dashboard origins for GraphQL
      const allowed = ['http://localhost:3000', 'http://localhost:3001'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        // Allow all other origins (webchat widget can be embedded anywhere)
        callback(null, true);
      }
    },
    credentials: true,
  });

  // Enable URL-encoded body parsing for Twilio webhooks (form-encoded POST)
  app.use('/webhooks', urlencoded({ extended: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}
bootstrap();
