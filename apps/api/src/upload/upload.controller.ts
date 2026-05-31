import { Controller, Post, Get, Param, Query, UploadedFile, UseInterceptors, Body, Res, BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

class FileListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  fileType?: string;
}

@Controller('common/file')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @CurrentUser('roleType') roleType: string,
    @Body('groupName') groupName?: string,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    return this.uploadService.uploadFile(file, userId, roleType === 'admin' ? 'admin' : 'user', groupName);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.uploadService.findById(id);
  }
}

@Controller('admin/file')
export class AdminUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('list')
  @RequirePermission('system:file')
  async list(@Query() dto: FileListDto) {
    return this.uploadService.findAll(dto);
  }

  @Get(':id')
  @RequirePermission('system:file')
  async detail(@Param('id') id: string) {
    return this.uploadService.findById(id);
  }

  @Post('upload')
  @RequirePermission('system:file')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Body('groupName') groupName?: string,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    return this.uploadService.uploadFile(file, userId, 'admin', groupName);
  }
}
