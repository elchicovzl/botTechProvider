import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { Request } from 'express';

/**
 * Validates the X-Twilio-Signature header using Twilio's official SDK.
 *
 * NOTE: Signature verification with ngrok requires the URL to match EXACTLY
 * what Twilio used when signing. We reconstruct it from x-forwarded-proto /
 * x-forwarded-host headers that ngrok injects automatically.
 *
 * For sandbox / local testing you can disable this guard by commenting out
 * `@UseGuards(TwilioSignatureGuard)` in the controller. Re-enable before
 * going to production.
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);
  private readonly authToken: string;

  constructor(private readonly configService: ConfigService) {
    this.authToken = this.configService.getOrThrow('TWILIO_AUTH_TOKEN');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-twilio-signature'] as string;

    if (!signature) {
      this.logger.warn('Missing X-Twilio-Signature header');
      throw new ForbiddenException('Missing signature');
    }

    // Reconstruct the URL as Twilio sees it (ngrok-aware)
    const proto = request.headers['x-forwarded-proto'] ?? request.protocol;
    const host = request.headers['x-forwarded-host'] ?? request.headers.host;
    const url = `${proto}://${host}${request.originalUrl}`;

    const isValid = twilio.validateRequest(
      this.authToken,
      signature,
      url,
      request.body as Record<string, string>,
    );

    if (!isValid) {
      this.logger.warn(`Invalid Twilio signature for URL: ${url}`);
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
