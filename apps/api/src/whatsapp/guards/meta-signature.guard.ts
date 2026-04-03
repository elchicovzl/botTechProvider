import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);
  private readonly appSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.appSecret = this.configService.getOrThrow('META_APP_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hub-signature-256'] as string;

    if (!signature) {
      this.logger.warn('Missing x-hub-signature-256 header');
      throw new ForbiddenException('Missing signature');
    }

    // rawBody is available because NestFactory.create has rawBody: true
    const rawBody = (request as any).rawBody as Buffer;
    if (!rawBody) {
      this.logger.error('rawBody not available — check NestFactory rawBody option');
      throw new ForbiddenException('Cannot verify signature');
    }

    const expectedSignature =
      'sha256=' +
      createHmac('sha256', this.appSecret).update(rawBody).digest('hex');

    try {
      const isValid = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        throw new ForbiddenException('Invalid signature');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      // Length mismatch in timingSafeEqual
      this.logger.warn('Signature verification failed (length mismatch)');
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
