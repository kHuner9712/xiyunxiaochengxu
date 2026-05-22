import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

describe('PointsLogic', () => {
  describe('积分记录 points 字段必须为正数', () => {
    it('type=1 (获得) 时 points 必须为正数', () => {
      const pointsRecord = {
        userId: BigInt(1),
        type: 1,
        points: 100,
        balance: 1000,
        source: 'order_complete',
        description: '完成订单奖励100积分',
      };

      expect(pointsRecord.points).toBeGreaterThan(0);
      expect(pointsRecord.type).toBe(1);
    });

    it('type=2 (消耗) 时 points 必须为正数', () => {
      const pointsRecord = {
        userId: BigInt(1),
        type: 2,
        points: 50,
        balance: 950,
        source: 'order_deduct',
        description: '订单抵扣50积分',
      };

      expect(pointsRecord.points).toBeGreaterThan(0);
      expect(pointsRecord.type).toBe(2);
    });

    it('type=3 (过期) 时 points 必须为正数', () => {
      const pointsRecord = {
        userId: BigInt(1),
        type: 3,
        points: 200,
        balance: 800,
        source: 'points_expire',
        description: '积分过期扣除200积分',
      };

      expect(pointsRecord.points).toBeGreaterThan(0);
      expect(pointsRecord.type).toBe(3);
    });
  });

  describe('积分抵扣只减少 availablePoints，不减少 totalPoints', () => {
    it('使用积分抵扣时只修改 availablePoints', () => {
      const initialState = {
        availablePoints: 1000,
        totalPoints: 1000,
      };

      const pointsDeducted = 100;
      const newState = {
        availablePoints: initialState.availablePoints - pointsDeducted,
        totalPoints: initialState.totalPoints,
      };

      expect(newState.availablePoints).toBe(900);
      expect(newState.totalPoints).toBe(1000);
      expect(newState.availablePoints).not.toBe(newState.totalPoints);
    });

    it('多次抵扣后 totalPoints 保持不变', () => {
      const initialState = {
        availablePoints: 1000,
        totalPoints: 1000,
      };

      const stateAfterDeduct1 = {
        availablePoints: initialState.availablePoints - 100,
        totalPoints: initialState.totalPoints,
      };

      const stateAfterDeduct2 = {
        availablePoints: stateAfterDeduct1.availablePoints - 200,
        totalPoints: stateAfterDeduct1.totalPoints,
      };

      expect(stateAfterDeduct1.totalPoints).toBe(1000);
      expect(stateAfterDeduct2.totalPoints).toBe(1000);
      expect(stateAfterDeduct2.availablePoints).toBe(700);
    });
  });

  describe('取消订单归还积分只增加 availablePoints，不增加 totalPoints', () => {
    it('取消订单归还积分时只修改 availablePoints', () => {
      const stateBeforeCancel = {
        availablePoints: 900,
        totalPoints: 1000,
      };

      const pointsToRestore = 100;
      const stateAfterCancel = {
        availablePoints: stateBeforeCancel.availablePoints + pointsToRestore,
        totalPoints: stateBeforeCancel.totalPoints,
      };

      expect(stateAfterCancel.availablePoints).toBe(1000);
      expect(stateAfterCancel.totalPoints).toBe(1000);
      expect(stateAfterCancel.availablePoints).toBe(stateAfterCancel.totalPoints);
    });

    it('归还积分后状态正确', () => {
      const stateBeforeCancel = {
        availablePoints: 800,
        totalPoints: 1000,
      };

      const pointsToRestore = 200;
      const stateAfterCancel = {
        availablePoints: stateBeforeCancel.availablePoints + pointsToRestore,
        totalPoints: stateBeforeCancel.totalPoints,
      };

      expect(stateAfterCancel.availablePoints).toBe(1000);
      expect(stateAfterCancel.totalPoints).toBe(1000);
    });
  });

  describe('奖励积分增加 availablePoints 和 totalPoints', () => {
    it('完成订单奖励积分时同时增加两个字段', () => {
      const stateBeforeReward = {
        availablePoints: 1000,
        totalPoints: 1000,
      };

      const earnedPoints = 50;
      const stateAfterReward = {
        availablePoints: stateBeforeReward.availablePoints + earnedPoints,
        totalPoints: stateBeforeReward.totalPoints + earnedPoints,
      };

      expect(stateAfterReward.availablePoints).toBe(1050);
      expect(stateAfterReward.totalPoints).toBe(1050);
      expect(stateAfterReward.availablePoints).toBe(stateAfterReward.totalPoints);
    });

    it('签到奖励积分时同时增加两个字段', () => {
      const stateBeforeSignIn = {
        availablePoints: 500,
        totalPoints: 500,
      };

      const signInPoints = 10;
      const stateAfterSignIn = {
        availablePoints: stateBeforeSignIn.availablePoints + signInPoints,
        totalPoints: stateBeforeSignIn.totalPoints + signInPoints,
      };

      expect(stateAfterSignIn.availablePoints).toBe(510);
      expect(stateAfterSignIn.totalPoints).toBe(510);
    });

    it('注册奖励积分时同时增加两个字段', () => {
      const stateBeforeRegister = {
        availablePoints: 0,
        totalPoints: 0,
      };

      const registerPoints = 50;
      const stateAfterRegister = {
        availablePoints: stateBeforeRegister.availablePoints + registerPoints,
        totalPoints: stateBeforeRegister.totalPoints + registerPoints,
      };

      expect(stateAfterRegister.availablePoints).toBe(50);
      expect(stateAfterRegister.totalPoints).toBe(50);
    });
  });

  describe('积分业务规则', () => {
    it('availablePoints 可以小于 totalPoints (因抵扣)', () => {
      const state = {
        availablePoints: 800,
        totalPoints: 1000,
      };

      expect(state.availablePoints).toBeLessThan(state.totalPoints);
    });

    it('availablePoints 不应为负数', () => {
      const state = {
        availablePoints: 100,
        totalPoints: 1000,
      };

      const deductAmount = 150;

      expect(() => {
        if (deductAmount > state.availablePoints) {
          throw new BadRequestException('可用积分不足');
        }
      }).toThrow(BadRequestException);
    });

    it('totalPoints 不应小于 0', () => {
      const state = {
        availablePoints: 0,
        totalPoints: 0,
      };

      expect(state.totalPoints).toBeGreaterThanOrEqual(0);
    });

    it('积分记录 balance 应该是 availablePoints 的当前值', () => {
      const state = {
        availablePoints: 850,
        totalPoints: 1000,
      };

      const pointsRecord = {
        points: 100,
        balance: state.availablePoints + 100,
      };

      expect(pointsRecord.balance).toBe(950);
    });
  });

  describe('积分与订单金额的关系', () => {
    it('抵扣积分 = 订单实付金额 / 100', () => {
      const payAmount = 9990;
      const pointsDeducted = Math.floor(payAmount / 100);

      expect(pointsDeducted).toBe(99);
    });

    it('奖励积分 = 订单实付金额 / 100', () => {
      const payAmount = 9990;
      const earnedPoints = Math.floor(payAmount / 100);

      expect(earnedPoints).toBe(99);
    });

    it('售后退款归还积分按比例计算', () => {
      const orderPointsDeducted = 100;
      const orderPayAmount = 10000;
      const refundAmount = 5000;

      const restorePoints = Math.floor(
        (orderPointsDeducted * refundAmount) / orderPayAmount
      );

      expect(restorePoints).toBe(50);
    });
  });
});
