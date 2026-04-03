import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Extracts the authenticated user from the request.
 * Works for both REST and GraphQL contexts.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    let user: JwtPayload;

    // Try GraphQL context first
    try {
      const ctx = GqlExecutionContext.create(context);
      user = ctx.getContext().req?.user;
    } catch {
      // Fall back to HTTP context
      user = context.switchToHttp().getRequest().user;
    }

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
