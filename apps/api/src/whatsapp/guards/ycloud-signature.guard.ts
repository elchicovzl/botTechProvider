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
export class YCloudSignatureGuard implements CanActivate {
  private readonly logger = new Logger(YCloudSignatureGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.getOrThrow('YCLOUD_WEBHOOK_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signatureHeader = request.headers['ycloud-signature'] as string;

    if (!signatureHeader) {
      this.logger.warn('Missing ycloud-signature header');
      throw new ForbiddenException('Missing signature');
    }

    // Format: "{timestamp},{signature}"
    const [timestamp, signature] = signatureHeader.split(',');
    if (!timestamp || !signature) {
      throw new ForbiddenException('Invalid signature format');
    }

    const rawBody = (request as any).rawBody as Buffer;
    if (!rawBody) {
      throw new ForbiddenException('Cannot verify signature');
    }

    // Signature = HMAC-SHA256(secret, "{timestamp}.{body}")
    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    try {
      const isValid = timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
      if (!isValid) {
        this.logger.warn('Invalid YCloud webhook signature');
        throw new ForbiddenException('Invalid signature');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.warn('Signature verification failed');
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
