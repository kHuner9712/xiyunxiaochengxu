import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { BusinessEventModule } from './common/business-event.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AddressModule } from './address/address.module';
import { BabyProfileModule } from './baby-profile/baby-profile.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { SupplierModule } from './supplier/supplier.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { CouponModule } from './coupon/coupon.module';
import { ActivityModule } from './activity/activity.module';
import { MemberModule } from './member/member.module';
import { PointsModule } from './points/points.module';
import { AftersaleModule } from './aftersale/aftersale.module';
import { ContentModule } from './content/content.module';
import { UploadModule } from './upload/upload.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { HomeModule } from './home/home.module';
import { SearchModule } from './search/search.module';
import { ShareModule } from './share/share.module';
import { ScheduleModule } from './schedule/schedule.module';
import { HealthModule } from './health/health.module';
import { PickupStoreModule } from './pickup-store/pickup-store.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AdminMustChangePasswordGuard } from './common/guards/admin-must-change-password.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    BusinessEventModule,
    AuthModule,
    UserModule,
    AddressModule,
    BabyProfileModule,
    ProductModule,
    CategoryModule,
    BrandModule,
    SupplierModule,
    CartModule,
    OrderModule,
    PaymentModule,
    CouponModule,
    ActivityModule,
    MemberModule,
    PointsModule,
    AftersaleModule,
    ContentModule,
    UploadModule,
    AdminModule,
    DashboardModule,
    SystemConfigModule,
    HomeModule,
    SearchModule,
    ShareModule,
    ScheduleModule,
    HealthModule,
    PickupStoreModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AdminMustChangePasswordGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
