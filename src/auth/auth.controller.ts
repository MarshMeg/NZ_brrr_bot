import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  authenticateTelegram(@Body('initData') initData: string): any {
    try {
      const jwt = this.authService.authenticateTelegramUser(initData);
      return { access_token: jwt };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
