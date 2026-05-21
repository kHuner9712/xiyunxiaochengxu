import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { MemberService } from './member.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UpdateMemberLevelDto } from './dto/update-member-level.dto';

@Controller('weapp/member')
export class WeappMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Public()
  @Get('levels')
  async findAllLevels() {
    return this.memberService.findAllLevels();
  }

  @Get('info')
  async getMemberInfo(@CurrentUser('id') userId: string) {
    return this.memberService.getMemberInfo(userId);
  }

  @Get('benefits')
  async getBenefits(@CurrentUser('id') userId: string) {
    return this.memberService.getBenefits(userId);
  }
}

@Controller('admin/member')
export class AdminMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('levels')
  async findAllLevels() {
    return this.memberService.findAllLevels();
  }

  @Post('levels')
  async createLevel(@Body() dto: UpdateMemberLevelDto) {
    return this.memberService.createLevel(dto);
  }

  @Put('levels/:id')
  async updateLevel(@Param('id') id: string, @Body() dto: UpdateMemberLevelDto) {
    return this.memberService.updateLevel(id, dto);
  }
}
