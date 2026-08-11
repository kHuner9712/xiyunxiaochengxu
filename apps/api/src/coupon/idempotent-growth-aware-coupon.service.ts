import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { GrowthAwareCouponService } from './growth-aware-coupon.service';

const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i;
const CLAIM_REQUEST_TTL_SECONDS = 24 * 60 * 60;
const ACTIVE_CLAIM_TTL_SECONDS = 120;

type ClaimRequestState =
  | { state: 'processing'; startedAt: number }
  | { state: 'success'; result: unknown };

@Injectable()
export class IdempotentGrowthAwareCouponService extends GrowthAwareCouponService {
  private readonly idempotencyLogger = new Logger(IdempotentGrowthAwareCouponService.name);

  constructor(
    prisma: PrismaService,
    private readonly couponRedis: RedisService,
  ) {
    super(prisma);
  }

  async receiveIdempotent(
    userId: string,
    couponId: string,
    clientRequestIdInput: string,
  ) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const couponIdValue = parsePositiveBigIntId(couponId, '优惠券');
    const clientRequestId = String(clientRequestIdInput || '').trim();
    if (!CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
      throw new ConflictException('领取请求标识无效，请刷新页面后重试');
    }

    const requestKey = this.requestKey(userIdValue, couponIdValue, clientRequestId);
    const activeKey = this.activeKey(userIdValue, couponIdValue);

    const existingState = await this.readRequestState(requestKey);
    if (existingState) return this.resolveExistingState(existingState);

    // Serialize all receive operations for the same user/coupon. This prevents a second device or a
    // different request id from entering the perLimit>1 path while the first physical action is
    // still unresolved. Redis failure is intentionally fail-closed: claim safety is more important
    // than allowing an unprotected asset mutation.
    const activeAcquired = await this.couponRedis.setNX(
      activeKey,
      clientRequestId,
      ACTIVE_CLAIM_TTL_SECONDS,
    );
    if (!activeAcquired) {
      const racedState = await this.readRequestState(requestKey);
      if (racedState) return this.resolveExistingState(racedState);
      throw new ConflictException('该优惠券有领取请求正在处理，请稍后重试');
    }

    try {
      const processingState: ClaimRequestState = {
        state: 'processing',
        startedAt: Date.now(),
      };
      const requestMarked = await this.couponRedis.setNX(
        requestKey,
        JSON.stringify(processingState),
        CLAIM_REQUEST_TTL_SECONDS,
      );
      if (!requestMarked) {
        const racedState = await this.readRequestState(requestKey);
        if (racedState) return this.resolveExistingState(racedState);
        throw new InternalServerErrorException('优惠券领取请求状态异常，请稍后重试');
      }

      let result: any;
      try {
        result = await super.receive(userId, couponId);
      } catch (error) {
        // A known business/DB failure means the claim did not return success, so the same physical
        // action may safely retry. If Redis deletion itself fails, leaving `processing` behind is
        // deliberately safer than permitting a possibly duplicated claim.
        try {
          await this.couponRedis.del(requestKey);
        } catch (cleanupError) {
          this.idempotencyLogger.error(
            `清理失败领券请求标记失败: user=${userIdValue} coupon=${couponIdValue}`,
            (cleanupError as Error)?.message,
          );
        }
        throw error;
      }

      try {
        const successState: ClaimRequestState = { state: 'success', result };
        await this.couponRedis.set(
          requestKey,
          JSON.stringify(successState),
          CLAIM_REQUEST_TTL_SECONDS,
        );
      } catch (cacheError) {
        // The MySQL transaction may already have committed. Never delete the processing marker here:
        // doing so would let the exact retry consume another per-user slot and another stock unit.
        this.idempotencyLogger.error(
          `领券已提交但幂等结果持久化失败: user=${userIdValue} coupon=${couponIdValue}`,
          (cacheError as Error)?.message,
        );
        throw new InternalServerErrorException(
          '优惠券领取结果待确认，请查看“我的优惠券”，不要重复领取',
        );
      }

      return result;
    } finally {
      try {
        await this.couponRedis.releaseLockWithLua(activeKey, clientRequestId);
      } catch (releaseError) {
        this.idempotencyLogger.warn(
          `释放领券并发锁失败，将等待TTL自动释放: user=${userIdValue} coupon=${couponIdValue} error=${(releaseError as Error)?.message || releaseError}`,
        );
      }
    }
  }

  private async readRequestState(key: string): Promise<ClaimRequestState | null> {
    const raw = await this.couponRedis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ClaimRequestState;
      if (parsed?.state === 'processing') return parsed;
      if (parsed?.state === 'success' && Object.prototype.hasOwnProperty.call(parsed, 'result')) {
        return parsed;
      }
    } catch {
      // handled below as fail-closed corruption
    }
    throw new InternalServerErrorException('优惠券领取幂等状态损坏，请联系管理员核查');
  }

  private resolveExistingState(state: ClaimRequestState) {
    if (state.state === 'success') return state.result;
    throw new ConflictException(
      '该次优惠券领取正在确认，请查看“我的优惠券”并稍后重试，勿重复操作',
    );
  }

  private requestKey(userId: bigint, couponId: bigint, requestId: string) {
    return `coupon:claim:request:${userId.toString()}:${couponId.toString()}:${requestId}`;
  }

  private activeKey(userId: bigint, couponId: bigint) {
    return `coupon:claim:active:${userId.toString()}:${couponId.toString()}`;
  }
}
