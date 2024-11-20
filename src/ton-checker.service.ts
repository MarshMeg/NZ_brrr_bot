import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlockchainService } from './bot-provider/game/blockchain.service';

@Injectable()
export class TonCheckerService {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Cron('* * * * *')
  async handleCron() {
    try {
      console.log('CRON started');
      await this.blockchainService.triggerTxChecks();
      console.log('CRON ended');
    } catch (e) {
      console.log('CRON failed', e);
    }
  }

  @Cron('* * * * *')
  async handleBuyCron() {
    try {
      console.log('BUY CRON started');
      await this.blockchainService.triggerBuyTxChecks();
      console.log('BUY CRON ended');
    } catch (e) {
      console.log('BUY CRON failed', e);
    }
  }

  @Cron('* * * * *')
  async handleClaimCron() {
    try {
      console.log('Claim CRON started');
      await this.blockchainService.triggerClaimTxChecks();
      console.log('Claim CRON ended');
    } catch (e) {
      console.log('Claim CRON failed', e);
    }
  }
}
