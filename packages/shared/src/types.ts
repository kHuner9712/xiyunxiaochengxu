export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PENDING_DELIVERY = 'pending_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  AFTERSALE = 'aftersale',
}

export enum AftersaleStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
}

export enum AftersaleType {
  REFUND_ONLY = 1,
  RETURN_AND_REFUND = 2,
}

export enum CouponType {
  FULL_REDUCTION = 1,
  DISCOUNT = 2,
  NO_THRESHOLD = 3,
}

export enum ActivityType {
  FLASH_SALE = 'flash_sale',
  FULL_REDUCTION = 'full_reduction',
  FULL_GIFT = 'full_gift',
  COMBO = 'combo',
  NEW_USER_GIFT = 'new_user_gift',
}

export enum MemberLevelCode {
  NORMAL = 0,
  SILVER = 1,
  GOLD = 2,
  BLACK_GOLD = 3,
}

export enum PointsSourceType {
  ORDER_PURCHASE = 'order_purchase',
  SIGN_IN = 'sign_in',
  SHARE = 'share',
  PROFILE_COMPLETE = 'profile_complete',
  REVIEW = 'review',
  REGISTER = 'register',
  EXCHANGE = 'exchange',
  EXPIRE = 'expire',
  ADMIN_ADJUST = 'admin_adjust',
}

export enum PointsRecordType {
  EARN = 1,
  CONSUME = 2,
  EXPIRE = 3,
}

export enum ProductStatus {
  DRAFT = 3,
  ON_SALE = 1,
  OFF_SALE = 2,
}

export enum UserCouponStatus {
  UNUSED = 1,
  USED = 2,
  EXPIRED = 3,
}

export enum StockLogType {
  INBOUND = 1,
  OUTBOUND = 2,
  ORDER_DEDUCT = 3,
  AFTERSALE_RETURN = 4,
  ADJUST = 5,
}

export enum PaymentStatus {
  PENDING = 1,
  SUCCESS = 2,
  FAILED = 3,
  REFUNDED = 4,
}

export enum ApplicableType {
  ALL = 1,
  CATEGORY = 2,
  PRODUCT = 3,
}

export enum BannerLinkType {
  PRODUCT = 1,
  CATEGORY = 2,
  ACTIVITY = 3,
  PAGE = 4,
  NONE = 5,
}

export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export enum StorageType {
  LOCAL = 1,
  TENCENT_COS = 2,
  ALIYUN_OSS = 3,
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaginatedResponse<T = any> = ApiResponse<PaginatedData<T>>;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface AdminLoginDto {
  username: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

export interface AdminLoginVo {
  token: string;
  adminUser: {
    id: number;
    username: string;
    realName: string;
    avatar: string;
    roles: string[];
    permissions: string[];
  };
}

export interface WeappLoginDto {
  code: string;
}

export interface WeappLoginVo {
  token: string;
  isNewUser: boolean;
}

export interface CreateOrderDto {
  addressId: number;
  couponId?: number;
  pointsDeduct?: number;
  remark?: string;
  items: {
    skuId: number;
    quantity: number;
  }[];
}

export interface CreateAftersaleDto {
  orderItemId: number;
  type: AftersaleType;
  reason: string;
  description?: string;
  images?: string[];
}

export interface BabyProfileDto {
  nickname?: string;
  gender?: number;
  birthday: string;
  avatarUrl?: string;
  isDefault?: number;
}
