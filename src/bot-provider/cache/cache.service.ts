import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { USER_LEADERBOARD, USER_SUBSCRIBED_PREFIX } from './constants';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async isUserSubscribed(userTgId: string) {
    const isInProgress = await this.cacheManager.get(
      USER_SUBSCRIBED_PREFIX + userTgId,
    );
    return !!isInProgress;
  }

  async setIsUserSubscribed(userTgId: string) {
    await this.cacheManager.set(
      USER_SUBSCRIBED_PREFIX + userTgId,
      true,
      10 * 1000,
    );
  }

  async getLeaderboard() {
    return this.cacheManager.get(USER_LEADERBOARD);
  }

  async setLeaderboard(result) {
    await this.cacheManager.set(
      USER_LEADERBOARD,
      JSON.stringify(result),
      28800 * 1000,
    );
  }
}
