import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

export function getPublicUploadDir(uploadDir: string): string {
  return path.join(uploadDir, 'public');
}

export function configurePublicUploadStaticAssets(
  app: Pick<NestExpressApplication, 'useStaticAssets'>,
  uploadDir: string,
) {
  app.useStaticAssets(getPublicUploadDir(uploadDir), { prefix: '/uploads/public/' });
}
