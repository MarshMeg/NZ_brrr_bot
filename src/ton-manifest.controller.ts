import { Controller, Get } from '@nestjs/common';

@Controller('tonconnect-manifest.json')
export class TonManifestController {
  @Get()
  async getMetadata() {
    return {
      url: process.env.FRONT_END_URL,
      name: 'Brrr',
      iconUrl: 'https://i.ibb.co/L0pMjmS/square-Brrrrr-Logo.png',
      transaction: {
        messages: [
          {
            address: 'string',
            amount: 'string',
            data: {
              telegramId: 'string',
            },
          },
        ],
      },
    };
  }
}
