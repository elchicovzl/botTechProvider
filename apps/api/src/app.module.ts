import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma';
import { CryptoModule } from './common/crypto';
import { JwtAuthGuard } from './common/guards';
import { GlobalExceptionFilter } from './common/filters';
import { TenantInterceptor } from './common/interceptors';
import { validateEnv } from './common/config';
import { AuthModule } from './auth';
import { TenantsModule } from './tenants';
import { QueueModule } from './queue';
import { HealthController } from './health.controller';
import { StorageModule } from './storage';
import { WhatsAppModule } from './whatsapp';
import { ConversationsModule } from './conversations';
import { BotsModule } from './bots';
import { RagModule } from './rag';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req }: { req: Request }) => ({ req }),
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    TenantsModule,
    QueueModule,
    StorageModule,
    WhatsAppModule,
    ConversationsModule,
    BotsModule,
    RagModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
