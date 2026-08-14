import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBenefitPackageDto,
  UpdateBenefitPackageDto,
} from './benefit-package.dto';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

async function validateDto<T extends object>(type: new () => T, payload: Record<string, unknown>) {
  return validate(plainToInstance(type, payload), validationOptions);
}

describe('benefit package production DTO contract', () => {
  it('accepts a create-only positive client request id', async () => {
    await expect(validateDto(CreateBenefitPackageDto, {
      name: '宝宝成长卡',
      clientRequestId: '123456789',
    })).resolves.toHaveLength(0);
  });

  it('rejects clientRequestId on update under production whitelist rules', async () => {
    const errors = await validateDto(UpdateBenefitPackageDto, {
      name: '宝宝成长卡',
      clientRequestId: '123456789',
    });
    expect(errors.some((error) => error.property === 'clientRequestId')).toBe(true);
  });

  it('rejects signed-INT overflow before package values reach MySQL', async () => {
    const errors = await validateDto(CreateBenefitPackageDto, {
      name: '宝宝成长卡',
      price: 2147483648,
      sortOrder: 2147483648,
      items: [{
        name: '检查服务',
        originalValue: 2147483648,
        sortOrder: 2147483648,
      }],
    });
    expect(errors.some((error) => error.property === 'price')).toBe(true);
    expect(errors.some((error) => error.property === 'sortOrder')).toBe(true);
    const itemsError = errors.find((error) => error.property === 'items');
    expect(itemsError).toBeDefined();
  });
});
