import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { BotsService } from './bots.service';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { BotType, CreateBotInputType, UpdateBotInputType } from './dto';

@Resolver(() => BotType)
export class BotsResolver {
  constructor(private readonly botsService: BotsService) {}

  @Query(() => [BotType])
  async bots(@CurrentUser() user: JwtPayload): Promise<BotType[]> {
    return this.botsService.findAll(user.tenantId) as unknown as BotType[];
  }

  @Query(() => BotType)
  async bot(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<BotType> {
    return this.botsService.findById(user.tenantId, id) as unknown as BotType;
  }

  @Mutation(() => BotType)
  async createBot(
    @CurrentUser() user: JwtPayload,
    @Args('input') input: CreateBotInputType,
  ): Promise<BotType> {
    return this.botsService.create(user.tenantId, input) as unknown as BotType;
  }

  @Mutation(() => BotType)
  async updateBot(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
    @Args('input') input: UpdateBotInputType,
  ): Promise<BotType> {
    return this.botsService.update(
      user.tenantId,
      id,
      input,
    ) as unknown as BotType;
  }

  @Mutation(() => BotType)
  async activateBot(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<BotType> {
    return this.botsService.activateBot(
      user.tenantId,
      id,
    ) as unknown as BotType;
  }

  @Mutation(() => BotType)
  async deactivateBot(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<BotType> {
    return this.botsService.deactivateBot(
      user.tenantId,
      id,
    ) as unknown as BotType;
  }

  @Mutation(() => BotType)
  async deleteBot(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<BotType> {
    return this.botsService.deleteBot(
      user.tenantId,
      id,
    ) as unknown as BotType;
  }
}
