import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import Redis from 'ioredis';

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly logger = new Logger(LoginThrottleGuard.name);
  private readonly redis: Redis;
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_SECONDS = 900; // 15 minutes

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let request: { ip?: string; connection?: { remoteAddress?: string } };

    try {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext<{ req: typeof request }>().req;
    } catch {
      request = context.switchToHttp().getRequest();
    }

    const ip =
      request?.ip ??
      request?.connection?.remoteAddress ??
      'unknown';
    const key = `throttle:auth:${ip}`;

    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, this.WINDOW_SECONDS);
    }

    if (attempts > this.MAX_ATTEMPTS) {
      this.logger.warn(
        `Rate limit exceeded for IP ${ip} (${attempts} attempts)`,
      );
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Too many attempts. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
