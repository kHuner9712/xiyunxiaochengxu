import { Controller, Post, Get, Put, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminLoginDto, ChangePasswordDto } from './dto/admin-login.dto';
import { WeappLoginDto } from './dto/weapp-login.dto';
import { BindPhoneDto } from './dto/bind-phone.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('captcha')
  async getCaptcha() {
    return this.authService.getCaptcha();
  }

  @Public()
  @Post('login')
  async login(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(
      dto.username,
      dto.password,
      dto.captchaId,
      dto.captchaCode,
    );
  }

  @Get('info')
  async getInfo(@CurrentUser('id') adminId: string) {
    return this.authService.getAdminInfo(adminId);
  }

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
  @Post('login')
  async login(@Body() dto: WeappLoginDto) {
    return this.authService.weappLogin(dto.code);
  }

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
