import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('admin points production wiring', () => {
  it('exports the dedicated atomic adjustment service from PointsModule', () => {
    const source = read('apps/api/src/points/points.module.ts');
    expect(source).toContain('AdminPointsAdjustmentService');
    expect(source).toContain('exports: [PointsService, AdminPointsAdjustmentService]');
  });

  it('routes both admin point mutation endpoints through the atomic service with durable request identity', () => {
    const pointsController = read('apps/api/src/points/points.controller.ts');
    const userController = read('apps/api/src/user/user.controller.ts');
    const pointsDto = read('apps/api/src/points/dto/admin-points.dto.ts');
    const userDto = read('apps/api/src/user/dto/admin-user-mutation.dto.ts');

    expect(pointsController).toContain('adminPointsAdjustmentService.adjust(');
    expect(pointsController).toContain('dto.requestId,');
    expect(userController).toContain('adminPointsAdjustmentService.adjust(');
    expect(userController).toContain('body.requestId,');
    expect(userController).not.toContain('pointsService.adminAdjust(');
    expect(pointsDto).toContain('requestId!: string');
    expect(userDto).toContain('requestId!: string');
  });

  it('requires the dedicated user:points permission in both API and admin UI', () => {
    const userController = read('apps/api/src/user/user.controller.ts');
    const pointsController = read('apps/api/src/points/points.controller.ts');
    const userList = read('apps/admin-web/src/views/user/list.vue');
    const seed = read('apps/api/prisma/seed.ts');

    expect(userController).toMatch(/@Put\('points\/:id'\)[\s\S]{0,180}@RequirePermission\('user:points'\)/);
    expect(pointsController).toMatch(/@Post\('adjust'\)[\s\S]{0,180}@RequirePermission\('user:points'\)/);
    expect(userList).toContain(`v-permission="'user:points'"`);
    expect(seed).toContain("code: 'user:points'");
  });

  it('submits the displayed balance and stable request id as mutation guards', () => {
    const userApi = read('apps/admin-web/src/api/user.ts');
    const userList = read('apps/admin-web/src/views/user/list.vue');
    const userDto = read('apps/api/src/user/dto/admin-user-mutation.dto.ts');

    expect(userApi).toContain('expectedAvailablePoints: number');
    expect(userApi).toContain('requestId: string');
    expect(userApi).toContain('expectedAvailablePoints,');
    expect(userApi).toContain('requestId,');
    expect(userList).toContain('pointsForm.currentPoints,');
    expect(userList).toContain('pointsForm.requestId,');
    expect(userDto).toContain('expectedAvailablePoints!: number');
    expect(userDto).toContain('requestId!: string');
  });
});
