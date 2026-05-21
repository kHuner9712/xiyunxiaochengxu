import { Module } from '@nestjs/common';
import { WeappCategoryController, AdminCategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappCategoryController, AdminCategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
