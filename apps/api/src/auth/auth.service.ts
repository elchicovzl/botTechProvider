import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma';
import { JwtPayload } from '../common/decorators';

interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    tenantId: string;
  };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  tenantName: string;
  tenantSlug: string;
}

interface LoginInput {
  email: string;
  password: string;
}

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Find a user by ID — used for the `me` query.
   */
  async findUserById(userId: string) {
    return this.prisma.db.user.findFirst({
      where: { id: userId },
    });
  }

  /**
   * Register a new user + tenant atomically.
   * Creates tenant first, then user, within a single transaction.
   */
  async register(input: RegisterInput): Promise<AuthPayload> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // Atomic transaction: create Tenant + User
    // Note: We use $transaction on the base client since tenant context
    // doesn't exist yet during registration.
    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      // Check if slug is taken
      const existingTenant = await tx.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
      if (existingTenant) {
        throw new ConflictException('This slug is already taken');
      }

      // Check if email is taken (globally — email must be unique across tenants for login)
      const existingUser = await tx.user.findFirst({
        where: { email: input.email },
      });
      if (existingUser) {
        throw new ConflictException('An account with this email already exists');
      }

      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          role: 'ADMIN',
        },
      });

      return { user, tenant };
    });

    const tokens = await this.generateTokenPair(user.id, tenant.id, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`New tenant registered: ${tenant.slug} (${tenant.id})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
      },
    };
  }

  /**
   * Login with email + password.
   * Returns the same error message for wrong email and wrong password
   * to prevent user enumeration.
   */
  async login(input: LoginInput): Promise<AuthPayload> {
    const genericError = 'Invalid email or password';

    // Find user by email (no tenant context — login is global)
    const user = await this.prisma.db.user.findFirst({
      where: { email: input.email },
      include: { tenant: true },
    });

    if (!user) {
      // Still hash to prevent timing attacks
      await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      throw new UnauthorizedException(genericError);
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException(genericError);
    }

    const tokens = await this.generateTokenPair(
      user.id,
      user.tenantId,
      user.role,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Refresh token rotation.
   * Each refresh token is single-use — using it generates a new pair
   * and revokes the old one.
   *
   * If a revoked token is used (theft detection), ALL tokens for
   * that user are revoked immediately.
   */
  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const storedToken = await this.prisma.db.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Theft detection: revoked token was reused
    if (storedToken.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${storedToken.userId} — revoking all tokens`,
      );
      await this.revokeAllTokens(storedToken.userId);
      throw new UnauthorizedException('Token reuse detected — all sessions revoked');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the used token
    await this.prisma.db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new pair
    const user = storedToken.user;
    const tokens = await this.generateTokenPair(
      user.id,
      user.tenantId,
      user.role,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Request password reset — generates a 1-hour token.
   * In MVP, the token is returned directly (no email service yet).
   * In production, this would send an email with the reset link.
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    // Find user by email (no tenant context)
    const user = await this.prisma.db.user.findFirst({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { resetToken: '' };
    }

    // Generate reset token (random 32 bytes, base64url)
    const resetToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store as a special refresh token with short expiry
    // We reuse the RefreshToken model with a convention: tokens starting with 'reset:' prefix in hash lookup
    await this.prisma.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `reset:${tokenHash}`,
        expiresAt,
      },
    });

    return { resetToken };
  }

  /**
   * Reset password using a valid reset token.
   * Revokes ALL refresh tokens for the user (security measure).
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = `reset:${this.hashToken(token)}`;

    const storedToken = await this.prisma.db.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password + revoke ALL tokens (reset token + all refresh tokens)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: storedToken.userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.log(`Password reset completed for user ${storedToken.userId}`);
  }

  /**
   * Logout — revoke the provided refresh token.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  private async generateTokenPair(
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      tenantId,
      role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = randomBytes(32).toString('base64url');

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    rawToken: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.db.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private async revokeAllTokens(userId: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
