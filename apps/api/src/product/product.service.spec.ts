import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';

function createMockPrisma() {
  return {
    product: {
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      count: jest.fn() as any,
    },
    productSku: {
      findMany: jest.fn() as any,
      updateMany: jest.fn() as any,
      create: jest.fn() as any,
    },
    $transaction: jest.fn((fn: any) => fn({
      product: {
        create: jest.fn() as any,
        update: jest.fn() as any,
      },
      productSku: {
        updateMany: jest.fn() as any,
        create: jest.fn() as any,
        findMany: jest.fn() as any,
      },
    })) as any,
  };
}

describe('ProductService', () => {
  let service: ProductService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ProductService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('ProductService validateProductComplianceBeforePublish', () => {
    it('食品商品缺少生产许可证编号时应拒绝上架', () => {
      const product = {
        attributes: {
          compliance: {
            isFood: true,
            productionLicenseNo: '',
            foodBusinessCertNo: 'SC123',
            manufacturer: '厂家A',
            shelfLife: '12个月',
            storageCondition: '常温',
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).toThrow(BadRequestException);
    });

    it('保健食品缺少批准文号时应拒绝上架', () => {
      const product = {
        attributes: {
          compliance: {
            isHealthSupplement: true,
            healthSupplementApprovalNo: '',
            suitableFor: '成人',
            notSuitableFor: '儿童',
            precautions: '不可过量',
            certImages: [],
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).toThrow(BadRequestException);
    });

    it('奶粉缺少配方注册号时应拒绝上架', () => {
      const product = {
        attributes: {
          compliance: {
            isInfantFormula: true,
            infantFormulaRegNo: '',
            manufacturer: '厂家B',
            shelfLife: '24个月',
            storageCondition: '阴凉干燥',
            certImages: [],
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).toThrow(BadRequestException);
    });

    it('合规信息完整的食品商品应允许上架', () => {
      const product = {
        category: { name: '食品' },
        attributes: {
          compliance: {
            isFood: true,
            productionLicenseNo: 'SC123456',
            foodBusinessCertNo: 'JY123',
            manufacturer: '厂家A',
            shelfLife: '12个月',
            storageCondition: '常温',
            certImages: ['https://example.com/cert.jpg'],
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).not.toThrow();
    });

    it('合规信息完整的保健食品应允许上架', () => {
      const product = {
        attributes: {
          compliance: {
            isHealthSupplement: true,
            healthSupplementApprovalNo: '国食健字G2000',
            suitableFor: '成人',
            notSuitableFor: '儿童',
            precautions: '不可过量',
            certImages: ['https://example.com/cert.jpg'],
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).not.toThrow();
    });

    it('合规信息完整的奶粉应允许上架', () => {
      const product = {
        attributes: {
          compliance: {
            isInfantFormula: true,
            infantFormulaRegNo: 'YP20210001',
            manufacturer: '厂家B',
            shelfLife: '24个月',
            storageCondition: '阴凉干燥',
            certImages: ['https://example.com/cert.jpg'],
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).not.toThrow();
    });

    it('无合规信息的商品应拒绝上架', () => {
      const product = { attributes: null };
      expect(() => service['validateProductComplianceBeforePublish'](product)).toThrow(BadRequestException);
    });

    it('普通非高合规商品显式标记 isRegulated=false 时允许上架', () => {
      const product = {
        attributes: {
          compliance: {
            isRegulated: false,
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).not.toThrow();
    });

    it('类目命中奶粉关键词时即使未显式声明也要校验奶粉字段', () => {
      const product = {
        category: { name: '婴幼儿奶粉' },
        attributes: {
          compliance: {
            certImages: ['https://example.com/cert.jpg'],
            manufacturer: '厂家',
            shelfLife: '12个月',
            storageCondition: '阴凉干燥',
          },
        },
      };
      expect(() => service['validateProductComplianceBeforePublish'](product)).toThrow(BadRequestException);
    });
  });
});
