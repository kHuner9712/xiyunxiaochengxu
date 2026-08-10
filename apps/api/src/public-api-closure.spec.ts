import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('public API closure contracts', () => {
  it('routes public group views through the sanitizer instead of exposing the raw service response', () => {
    const controller = read('apps/api/src/group-buy/group-buy.controller.ts');
    const module = read('apps/api/src/group-buy/group-buy.module.ts');
    const publicView = read('apps/api/src/group-buy/public-group-buy-view.service.ts');

    expect(module).toContain('PublicGroupBuyViewService');
    expect(controller).toContain('this.publicView.findAvailableGroups');
    expect(controller).toContain('this.publicView.findGroupById');
    expect(publicView).not.toContain('orderId: member.orderId');
    expect(publicView).not.toContain('userId: member.userId');
    expect(publicView).not.toContain('leaderUserId: group.leaderUserId');
  });

  it('uses validated pagination DTOs for public promotion lists instead of manual Number conversion', () => {
    const groupController = read('apps/api/src/group-buy/group-buy.controller.ts');
    const flashController = read('apps/api/src/flash-sale/flash-sale.controller.ts');

    expect(groupController).toContain('@Query() query: PaginationDto');
    expect(flashController).toContain('@Query() query: PaginationDto');
    expect(groupController).not.toContain('Number(query.page)');
    expect(groupController).not.toContain('Number(query.pageSize)');
    expect(flashController).not.toContain('Number(query.page)');
    expect(flashController).not.toContain('Number(query.pageSize)');
  });

  it('keeps disabled pickup stores out of the public detail response', () => {
    const controller = read('apps/api/src/pickup-store/pickup-store.controller.ts');

    expect(controller).toContain('if (store.status !== 1)');
    expect(controller).toContain('自提点不存在或已停用');
  });
});
