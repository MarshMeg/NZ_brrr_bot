import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as process from 'process';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  validateTelegramData(initData: string): boolean {
    const urlParams = new URLSearchParams(initData);

    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();

    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
      dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1);

    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN);
    const calculatedHash = crypto
      .createHmac('sha256', secret.digest())
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }

  generateJWT(user: any): string {
    const payload = {
      id: user.id,
    };

    return this.jwtService.sign(payload);
  }

  authenticateTelegramUser(initData: string): string {
    if (!this.validateTelegramData(initData)) {
      throw new UnauthorizedException('Invalid data from Telegram');
    }

    const params = new URLSearchParams(initData);

    const userJson = params.get('user');
    if (!userJson) {
      throw new UnauthorizedException('User data is missing');
    }

    const user = JSON.parse(userJson);

    if (!user.id) {
      throw new UnauthorizedException('User data is missing or incorrect');
    }

    return this.generateJWT(user);
  }
}
