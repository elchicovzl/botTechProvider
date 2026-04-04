import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { LoginThrottleGuard } from '../common/guards';
import {
  AuthPayloadType,
  TokenPairType,
  LoginInputType,
  RegisterInputType,
  UserType,
  ForgotPasswordInputType,
  ResetPasswordInputType,
} from './dto';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayloadType)
  @Public()
  @UseGuards(LoginThrottleGuard)
  async register(
    @Args('input') input: RegisterInputType,
  ): Promise<AuthPayloadType> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayloadType)
  @Public()
  @UseGuards(LoginThrottleGuard)
  async login(@Args('input') input: LoginInputType): Promise<AuthPayloadType> {
    return this.authService.login(input);
  }

  @Mutation(() => TokenPairType)
  @Public()
  async refreshToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<TokenPairType> {
    return this.authService.refreshTokens(refreshToken);
  }

  @Mutation(() => Boolean)
  async logout(
    @Args('refreshToken') refreshToken: string,
  ): Promise<boolean> {
    await this.authService.logout(refreshToken);
    return true;
  }

  @Mutation(() => Boolean)
  @Public()
  @UseGuards(LoginThrottleGuard)
  async forgotPassword(
    @Args('input') input: ForgotPasswordInputType,
  ): Promise<boolean> {
    await this.authService.requestPasswordReset(input.email);
    // Always return true to prevent email enumeration
    return true;
  }

  @Mutation(() => Boolean)
  @Public()
  async resetPassword(
    @Args('input') input: ResetPasswordInputType,
  ): Promise<boolean> {
    await this.authService.resetPassword(input.token, input.password);
    return true;
  }

  @Query(() => UserType)
  async me(@CurrentUser() user: JwtPayload): Promise<UserType> {
    const dbUser = await this.authService.findUserById(user.sub);
    return {
      id: user.sub,
      email: dbUser?.email ?? '',
      firstName: dbUser?.firstName ?? null,
      lastName: dbUser?.lastName ?? null,
      role: user.role,
      tenantId: user.tenantId,
    };
  }
}
