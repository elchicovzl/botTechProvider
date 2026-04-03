import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { ObjectType, Field } from '@nestjs/graphql';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { EmbeddedSignupService } from './embedded-signup.service';

@ObjectType()
class EmbeddedSignupResultType {
  @Field()
  wabaId!: string;

  @Field()
  phoneNumberId!: string;

  @Field()
  displayPhoneNumber!: string;
}

@Resolver()
export class EmbeddedSignupResolver {
  constructor(
    private readonly embeddedSignupService: EmbeddedSignupService,
  ) {}

  @Mutation(() => EmbeddedSignupResultType)
  async completeEmbeddedSignup(
    @CurrentUser() user: JwtPayload,
    @Args('code') code: string,
  ): Promise<EmbeddedSignupResultType> {
    return this.embeddedSignupService.completeSignup(user.tenantId, code);
  }
}
