import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    // Register BullMQ connection
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow('REDIS_URL'),
        },
      }),
    }),
    // Register individual queues
    BullModule.registerQueue(
      { name: QUEUES.DOCUMENT_INGEST },
      { name: QUEUES.MESSAGE_SEND },
      { name: QUEUES.WEBHOOK_PROCESS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
