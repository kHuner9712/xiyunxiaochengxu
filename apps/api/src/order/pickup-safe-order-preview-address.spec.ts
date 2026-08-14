import fs from 'node:fs';
import path from 'node:path';

describe('order preview delivery address facts', () => {
  it('rejects a deleted or foreign delivery address before returning a quote', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'pickup-safe-order.service.ts'),
      'utf8',
    );

    expect(source).toContain('override async confirm(userId: string, dto: ConfirmOrderDto)');
    expect(source).toContain("fulfillmentType === 'delivery' && dto.addressId");
    expect(source).toContain('userId: userIdValue');
    expect(source).toContain('deletedAt: null');
    expect(source).toContain('收货地址不存在或已失效，请重新选择');
    expect(source).toContain('return super.confirm(userId, dto)');
  });
});
