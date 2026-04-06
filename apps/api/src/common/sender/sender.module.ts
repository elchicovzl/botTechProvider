import { Global, Module } from '@nestjs/common';
import { SenderResolverService } from './sender-resolver.service';

@Global()
@Module({
  providers: [SenderResolverService],
  exports: [SenderResolverService],
})
export class SenderModule {}
