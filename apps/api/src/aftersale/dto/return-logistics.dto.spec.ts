import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReturnLogisticsDto } from './return-logistics.dto';

async function validateDto(payload: Record<string, unknown>) {
  return validate(plainToInstance(ReturnLogisticsDto, payload));
}

describe('ReturnLogisticsDto', () => {
  it('accepts persisted-length logistics fields and optional contact details', async () => {
    await expect(validateDto({
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'SF1234567890',
      contactPhone: '+86 138-0013-8000',
      remark: '请查收',
    })).resolves.toHaveLength(0);

    await expect(validateDto({
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'SF1234567890',
      contactPhone: '',
      remark: '',
    })).resolves.toHaveLength(0);
  });

  it('rejects values that would exceed database or business boundaries', async () => {
    const companyErrors = await validateDto({
      returnLogisticsCompany: '物'.repeat(51),
      returnLogisticsNo: 'NO1',
    });
    expect(companyErrors.some((error) => error.property === 'returnLogisticsCompany')).toBe(true);

    const noErrors = await validateDto({
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'N'.repeat(51),
    });
    expect(noErrors.some((error) => error.property === 'returnLogisticsNo')).toBe(true);

    const phoneErrors = await validateDto({
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'NO1',
      contactPhone: 'not-a-phone',
    });
    expect(phoneErrors.some((error) => error.property === 'contactPhone')).toBe(true);

    const remarkErrors = await validateDto({
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'NO1',
      remark: '备'.repeat(501),
    });
    expect(remarkErrors.some((error) => error.property === 'remark')).toBe(true);
  });
});
