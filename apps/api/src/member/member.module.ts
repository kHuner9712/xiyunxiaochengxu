import { Module } from '@nestjs/common';
import { WeappMemberController, AdminMemberController } from './member.controller';
import { MemberService } from './member.service';
import { AtomicMemberService } from './atomic-member.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappMemberController, AdminMemberController],
  providers: [
    {
      provide: MemberService,
      useClass: AtomicMemberService,
    },
  ],
  exports: [MemberService],
})
export class MemberModule {}
