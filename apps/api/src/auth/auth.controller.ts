import { Controller, Post, Get, Put, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipMustChangePassword } from '../common/decorators/skip-must-change-password.decorator';
import { AdminLoginDto, ChangePasswordDto } from './dto/admin-login.dto';
import { WeappLoginDto } from './dto/weapp-login.dto';
import { BindPhoneDto } from './dto/bind-phone.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('captcha')
  async getCaptcha() {
    return this.authService.getCaptcha();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(
      dto.username,
      dto.password,
      dto.captchaId,
      dto.captchaCode,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @SkipMustChangePassword()
  @Post('logout')
  async logout(@CurrentUser('id') adminId: string, @CurrentUser('tokenId') tokenId: string) {
    await this.authService.adminLogout(adminId, tokenId);
    return null;
  }

  @SkipMustChangePassword()
  @Get('info')
  async getInfo(@CurrentUser('id') adminId: string) {
    return this.authService.getAdminInfo(adminId);
  }

  @SkipMustChangePassword()
  @Put('password')
  async changePassword(
    @CurrentUser('id') adminId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      adminId,
      dto.oldPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }
}

@Controller('weapp/auth')
export class WeappAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: WeappLoginDto) {
    return this.authService.weappLogin(dto.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('phone')
  async bindPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: BindPhoneDto,
  ) {
    return this.authService.bindPhone(
      userId,
      dto.code,
      dto.encryptedData,
      dto.iv,
    );
  }
}
