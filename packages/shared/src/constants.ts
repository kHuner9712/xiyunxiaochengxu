export const MEMBER_LEVELS = [
  { code: 0, name: '普通会员', minGrowth: 0, maxGrowth: 999, discountRate: null, pointsRate: 10 },
  { code: 1, name: '银卡会员', minGrowth: 1000, maxGrowth: 4999, discountRate: 98, pointsRate: 20 },
  { code: 2, name: '金卡会员', minGrowth: 5000, maxGrowth: 19999, discountRate: 95, pointsRate: 30 },
  { code: 3, name: '黑金会员', minGrowth: 20000, maxGrowth: null, discountRate: 90, pointsRate: 50 },
] as const;

export const ORDER_AUTO_CLOSE_MINUTES = 30;
export const ORDER_AUTO_COMPLETE_DAYS = 15;
export const ORDER_AUTO_COMPLETE_REMIND_DAYS = 12;

export const POINTS_PER_YUAN = 1;
export const POINTS_SIGN_IN_BASE = 5;
export const POINTS_SIGN_IN_MAX = 15;
export const POINTS_SHARE_AWARD = 2;
export const POINTS_SHARE_DAILY_LIMIT = 10;
export const POINTS_PROFILE_AWARD = 10;
export const POINTS_REVIEW_AWARD = 5;
export const POINTS_REVIEW_DAILY_LIMIT = 20;
export const POINTS_REGISTER_AWARD = 50;
export const POINTS_DEDUCT_RATE = 100;
export const POINTS_DEDUCT_MAX_PERCENT = 30;
export const POINTS_EXPIRE_MONTHS = 12;

export const FREIGHT_FREE_AMOUNT = 9900;
export const FREIGHT_DEFAULT_FEE = 1000;
export const FREIGHT_REMOTE_FEE = 2000;
export const FREIGHT_REMOTE_AREAS = ['新疆', '西藏', '内蒙古', '青海', '甘肃'];

export const CART_MAX_QUANTITY = 99;
export const CART_MAX_ITEMS = 99;
export const ADDRESS_MAX_COUNT = 20;

export const AFTERSALE_MAX_IMAGES = 6;
export const AFTERSALE_APPLY_DAYS = 7;

export const UPLOAD_MAX_SIZE = 10 * 1024 * 1024;
export const UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];

export const SUCCESS_CODE = 0;
export const ERROR_CODE = -1;
export const UNAUTHORIZED_CODE = 40101;
export const FORBIDDEN_CODE = 40301;
export const NOT_FOUND_CODE = 40401;
export const PARAM_ERROR_CODE = 40001;
export const BUSINESS_ERROR_CODE = 11001;
