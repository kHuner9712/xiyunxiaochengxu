import { ForbiddenException } from '@nestjs/common';
import { AdminPrivilegeService } from './admin-privilege.service';

function operator(options?: { super?: boolean; permissions?: string[] }) {
  const permissions = options?.permissions ?? [];
  return {
    id: 1n,
    status: 1,
    deletedAt: null,
    adminUserRoles: [
      {
        role: {
          id: 11n,
          code: options?.super ? 'super_admin' : 'operator',
          name: options?.super ? '超级管理员' : '运营',
          status: 1,
          adminRolePermissions: permissions.map((code, index) => ({
            permission: { id: BigInt(100 + index), code },
          })),
        },
      },
    ],
  };
}

describe('AdminPrivilegeService', () => {
  it('blocks a non-super admin from assigning the super_admin role', async () => {
    const prisma: any = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue(
          operator({ permissions: ['system:admin'] }),
        ),
      },
      adminRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 99n,
            code: 'super_admin',
            name: '超级管理员',
            status: 1,
            adminRolePermissions: [],
          },
        ]),
      },
    };
    const service = new AdminPrivilegeService(prisma);

    await expect(service.assertCanAssignRoles('1', ['99'])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks a role manager from delegating permissions they do not have', async () => {
    const prisma: any = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue(
          operator({ permissions: ['system:role'] }),
        ),
      },
      adminPermission: {
        findMany: jest.fn().mockResolvedValue([
          { id: 200n, code: 'system:config' },
        ]),
      },
    };
    const service = new AdminPrivilegeService(prisma);

    await expect(
      service.assertCanDelegatePermissions('1', ['200']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks a non-super admin from mutating an account with permissions above their own scope', async () => {
    const prisma: any = {
      adminUser: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(operator({ permissions: ['system:admin'] }))
          .mockResolvedValueOnce({
            id: 2n,
            status: 1,
            deletedAt: null,
            adminUserRoles: [
              {
                role: {
                  id: 22n,
                  code: 'finance',
                  name: '财务',
                  status: 1,
                  adminRolePermissions: [
                    { permission: { id: 300n, code: 'system:config' } },
                  ],
                },
              },
            ],
          }),
      },
    };
    const service = new AdminPrivilegeService(prisma);

    await expect(service.assertCanMutateAdmin('1', '2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an active super admin to assign the super_admin role', async () => {
    const prisma: any = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue(
          operator({ super: true, permissions: [] }),
        ),
      },
      adminRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 99n,
            code: 'super_admin',
            name: '超级管理员',
            status: 1,
            adminRolePermissions: [],
          },
        ]),
      },
    };
    const service = new AdminPrivilegeService(prisma);

    await expect(service.assertCanAssignRoles('1', ['99'])).resolves.toBeUndefined();
  });
});
