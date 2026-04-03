import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses JWT auth guard.
 * Use for: health check, webhook verification, login, register.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
