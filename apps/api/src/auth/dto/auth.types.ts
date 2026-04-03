import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field()
  role!: string;

  @Field()
  tenantId!: string;
}

@ObjectType()
export class AuthPayloadType {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field(() => UserType)
  user!: UserType;
}

@ObjectType()
export class TokenPairType {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;
}

@InputType()
export class LoginInputType {
  @Field()
  email!: string;

  @Field()
  password!: string;
}

@InputType()
export class RegisterInputType {
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field()
  tenantName!: string;

  @Field()
  tenantSlug!: string;
}

@InputType()
export class ForgotPasswordInputType {
  @Field()
  email!: string;
}

@InputType()
export class ResetPasswordInputType {
  @Field()
  token!: string;

  @Field()
  password!: string;
}
