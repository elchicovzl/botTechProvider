import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Injectable()
export class WebChatThrottleGuard implements CanActivate {
  private readonly requests = new Map<string, { count: number; windowStart: number }>();
  private readonly maxRequests = 10;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.params.sessionToken;
    if (!token) return true;

    const now = Date.now();
    const entry = this.requests.get(token);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.requests.set(token, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      const retryAfter = Math.ceil((entry.windowStart + this.windowMs - now) / 1000);
      throw new HttpException(
        { error: 'RATE_LIMIT_EXCEEDED', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
