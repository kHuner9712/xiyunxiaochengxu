import { SetMetadata } from '@nestjs/common';

export const TRANSFORM_SKIP_KEY = 'transformSkip';
export const SkipTransform = () => SetMetadata(TRANSFORM_SKIP_KEY, true);
