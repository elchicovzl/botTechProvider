import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql';
import { tenantStorage, TenantStore } from '../context';
import { JwtPayload } from '../decorators';

/**
 * Intercepts every request and sets the tenant context in AsyncLocalStorage.
 * This allows the Prisma tenant middleware to access tenantId without DI.
 *
 * Runs AFTER the JWT auth guard has populated req.user.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    let user: JwtPayload | undefined;

    try {
      const ctx = GqlExecutionContext.create(context);
      user = ctx.getContext().req?.user;
    } catch {
      user = context.switchToHttp().getRequest().user;
    }

    if (!user?.tenantId) {
      // Public routes or webhooks — no tenant context
      return next.handle();
    }

    const store: TenantStore = {
      tenantId: user.tenantId,
      userId: user.sub,
    };

    return new Observable((subscriber) => {
      tenantStorage.run(store, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
