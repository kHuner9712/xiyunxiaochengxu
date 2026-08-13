import { BadRequestException } from '@nestjs/common';

export const DIRECT_PROFILE_ASSET_GROUPS = ['user-avatar', 'baby-avatar'] as const;
export type DirectProfileAssetGroup = (typeof DIRECT_PROFILE_ASSET_GROUPS)[number];

export function extractPublicUploadPath(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  } else {
    pathname = raw.split(/[?#]/, 1)[0] || '';
  }

  const marker = '/uploads/public/';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return null;
  const storedPath = pathname.slice(markerIndex);
  if (!storedPath.startsWith(marker) || storedPath.length <= marker.length) return null;
  return storedPath;
}

export async function assertOwnedDirectProfileAsset(
  prisma: any,
  userId: bigint,
  value: string,
  expectedGroup: DirectProfileAssetGroup,
): Promise<{ id: bigint; filePath: string }> {
  const filePath = extractPublicUploadPath(value);
  if (!filePath) {
    throw new BadRequestException('头像必须使用当前账号上传的图片');
  }

  const asset = await prisma.fileAsset.findFirst({
    where: {
      filePath,
      uploaderId: userId,
      uploaderType: 'user',
      groupName: expectedGroup,
    },
    select: { id: true, filePath: true },
  });
  if (!asset) {
    throw new BadRequestException('头像文件不存在、用途不匹配或不属于当前账号');
  }
  return asset;
}
