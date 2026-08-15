import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RejectDto } from './reject.dto';

describe('RejectDto', () => {
  it('trims and accepts a valid rejection reason', async () => {
    const dto = plainToInstance(RejectDto, { rejectReason: '  不符合退款条件  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.rejectReason).toBe('不符合退款条件');
  });

  it('rejects whitespace-only and overlong reasons before persistence', async () => {
    const empty = plainToInstance(RejectDto, { rejectReason: '   ' });
    expect((await validate(empty)).some((error) => error.property === 'rejectReason')).toBe(true);

    const overlong = plainToInstance(RejectDto, { rejectReason: '拒'.repeat(201) });
    expect((await validate(overlong)).some((error) => error.property === 'rejectReason')).toBe(true);
  });
});
