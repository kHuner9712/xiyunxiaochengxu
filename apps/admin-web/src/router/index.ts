import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const AdminLayout = () => import('@/layouts/AdminLayout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false },
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'Odometer', permission: 'dashboard' },
      },
      {
        path: 'product',
        name: 'Product',
        redirect: '/product/list',
        meta: { title: '商品管理', icon: 'Goods', permission: 'product' },
        children: [
          {
            path: 'list',
            name: 'ProductList',
            component: () => import('@/views/product/list.vue'),
            meta: { title: '商品列表', permission: 'product:list' },
          },
          {
            path: 'edit',
            name: 'ProductEdit',
            component: () => import('@/views/product/edit.vue'),
            meta: { title: '商品编辑', permission: 'product:edit', hidden: true },
          },
          {
            path: 'edit/:id',
            name: 'ProductEditById',
            component: () => import('@/views/product/edit.vue'),
            meta: { title: '编辑商品', permission: 'product:edit', hidden: true },
          },
          {
            path: 'category',
            name: 'ProductCategory',
            component: () => import('@/views/product/category.vue'),
            meta: { title: '分类管理', permission: 'product:category' },
          },
          {
            path: 'brand',
            name: 'ProductBrand',
            component: () => import('@/views/product/brand.vue'),
            meta: { title: '品牌管理', permission: 'product:brand' },
          },
          {
            path: 'stock',
            name: 'ProductStock',
            component: () => import('@/views/product/stock.vue'),
            meta: { title: '库存管理', permission: 'product:stock' },
          },
        ],
      },
      {
        path: 'order',
        name: 'Order',
        redirect: '/order/list',
        meta: { title: '订单管理', icon: 'List', permission: 'order' },
        children: [
          {
            path: 'list',
            name: 'OrderList',
            component: () => import('@/views/order/list.vue'),
            meta: { title: '订单列表', permission: 'order:list' },
          },
          {
            path: 'detail/:id',
            name: 'OrderDetail',
            component: () => import('@/views/order/detail.vue'),
            meta: { title: '订单详情', permission: 'order:detail', hidden: true },
          },
          {
            path: 'delivery',
            name: 'OrderDelivery',
            component: () => import('@/views/order/delivery.vue'),
            meta: { title: '发货管理', permission: 'order:deliver' },
          },
          {
            path: 'aftersale',
            name: 'OrderAftersale',
            component: () => import('@/views/order/aftersale.vue'),
            meta: { title: '售后列表', permission: 'order:aftersale' },
          },
          {
            path: 'aftersale-detail/:id',
            name: 'AftersaleDetail',
            component: () => import('@/views/order/aftersale-detail.vue'),
            meta: { title: '售后详情', permission: 'order:aftersale', hidden: true },
          },
          {
            path: 'refund',
            name: 'OrderRefund',
            component: () => import('@/views/order/refund-list.vue'),
            meta: { title: '退款记录', permission: 'order:aftersale:refund' },
          },
          {
            path: 'refund-detail/:id',
            name: 'RefundDetail',
            component: () => import('@/views/order/refund-detail.vue'),
            meta: { title: '退款详情', permission: 'order:aftersale:refund', hidden: true },
          },
          {
            path: 'reconcile',
            name: 'ReconcileCenter',
            component: () => import('@/views/order/reconcile-center.vue'),
            meta: { title: '对账与补偿', permission: 'system:config' },
          },
        ],
      },
      {
        path: 'user',
        name: 'User',
        redirect: '/user/list',
        meta: { title: '用户管理', icon: 'User', permission: 'user' },
        children: [
          {
            path: 'list',
            name: 'UserList',
            component: () => import('@/views/user/list.vue'),
            meta: { title: '用户列表', permission: 'user:list' },
          },
          {
            path: 'detail/:id',
            name: 'UserDetail',
            component: () => import('@/views/user/detail.vue'),
            meta: { title: '用户详情', permission: 'user:detail', hidden: true },
          },
          {
            path: 'member-level',
            name: 'MemberLevel',
            component: () => import('@/views/user/member-level.vue'),
            meta: { title: '会员等级', permission: 'user:member' },
          },
          {
            path: 'points-rule',
            name: 'PointsRule',
            component: () => import('@/views/user/points-rule.vue'),
            meta: { title: '积分规则', permission: 'user:points' },
          },
          {
            path: 'baby',
            name: 'BabyProfile',
            component: () => import('@/views/user/baby.vue'),
            meta: { title: '宝宝档案', permission: 'user:baby' },
          },
        ],
      },
      {
        path: 'marketing',
        name: 'Marketing',
        redirect: '/marketing/coupon-list',
        meta: { title: '营销管理', icon: 'Present', permission: 'marketing' },
        children: [
          {
            path: 'coupon-list',
            name: 'CouponList',
            component: () => import('@/views/marketing/coupon-list.vue'),
            meta: { title: '优惠券列表', permission: 'marketing:coupon' },
          },
          {
            path: 'coupon-edit',
            name: 'CouponEdit',
            component: () => import('@/views/marketing/coupon-edit.vue'),
            meta: { title: '优惠券编辑', permission: 'marketing:coupon', hidden: true },
          },
          {
            path: 'coupon-edit/:id',
            name: 'CouponEditById',
            component: () => import('@/views/marketing/coupon-edit.vue'),
            meta: { title: '编辑优惠券', permission: 'marketing:coupon', hidden: true },
          },
          {
            path: 'activity-list',
            name: 'ActivityList',
            component: () => import('@/views/marketing/activity-list.vue'),
            meta: { title: '活动列表', permission: 'marketing:activity' },
          },
          {
            path: 'activity-edit',
            name: 'ActivityEdit',
            component: () => import('@/views/marketing/activity-edit.vue'),
            meta: { title: '活动编辑', permission: 'marketing:activity', hidden: true },
          },
          {
            path: 'activity-edit/:id',
            name: 'ActivityEditById',
            component: () => import('@/views/marketing/activity-edit.vue'),
            meta: { title: '编辑活动', permission: 'marketing:activity', hidden: true },
          },
          {
            path: 'banner',
            name: 'Banner',
            component: () => import('@/views/marketing/banner.vue'),
            meta: { title: 'Banner管理', permission: 'marketing:banner' },
          },
          {
            path: 'recommendation',
            name: 'Recommendation',
            component: () => import('@/views/marketing/recommendation.vue'),
            meta: { title: '推荐位管理', permission: 'marketing:recommendation' },
          },
          {
            path: 'home-decor',
            name: 'HomeDecor',
            component: () => import('@/views/marketing/home-decor.vue'),
            meta: { title: '首页装修', permission: 'marketing:decor' },
          },
          {
            path: 'merchant-promotion-source',
            name: 'MerchantPromotionSource',
            component: () => import('@/views/marketing/merchant-promotion-source.vue'),
            meta: { title: '商家推广码', permission: 'marketing:activity' },
          },
          {
            path: 'benefit-package',
            name: 'BenefitPackage',
            component: () => import('@/views/marketing/benefit-package.vue'),
            meta: { title: '权益卡管理', permission: 'marketing:activity' },
          },
          {
            path: 'benefit-package-verify',
            name: 'BenefitPackageVerify',
            component: () => import('@/views/marketing/benefit-package-verify.vue'),
            meta: { title: '权益核销', permission: 'pickup:verify' },
          },
          {
            path: 'benefit-package-records',
            name: 'BenefitPackageRecords',
            component: () => import('@/views/marketing/benefit-package-records.vue'),
            meta: { title: '权益记录', permission: 'marketing:activity' },
          },
          {
            path: 'merchant-settlement-rules',
            name: 'MerchantSettlementRules',
            component: () => import('@/views/marketing/merchant-settlement-rules.vue'),
            meta: { title: '分佣规则', permission: 'marketing:activity' },
          },
          {
            path: 'merchant-settlement-records',
            name: 'MerchantSettlementRecords',
            component: () => import('@/views/marketing/merchant-settlement-records.vue'),
            meta: { title: '分佣明细', permission: 'marketing:activity' },
          },
          {
            path: 'merchant-settlement-batches',
            name: 'MerchantSettlementBatches',
            component: () => import('@/views/marketing/merchant-settlement-batches.vue'),
            meta: { title: '结算批次', permission: 'marketing:activity' },
          },
          {
            path: 'group-buy-activity',
            name: 'GroupBuyActivity',
            component: () => import('@/views/marketing/group-buy-activity.vue'),
            meta: { title: '拼团活动', permission: 'marketing:activity' },
          },
          {
            path: 'group-buy-groups',
            name: 'GroupBuyGroups',
            component: () => import('@/views/marketing/group-buy-groups.vue'),
            meta: { title: '拼团团单', permission: 'marketing:activity' },
          },
          {
            path: 'flash-sale-activity',
            name: 'FlashSaleActivity',
            component: () => import('@/views/marketing/flash-sale-activity.vue'),
            meta: { title: '秒杀活动', permission: 'marketing:activity' },
          },
          {
            path: 'flash-sale-orders',
            name: 'FlashSaleOrders',
            component: () => import('@/views/marketing/flash-sale-orders.vue'),
            meta: { title: '秒杀订单', permission: 'marketing:activity' },
          },
          {
            path: 'activity-content',
            name: 'ActivityContent',
            component: () => import('@/views/marketing/activity-content.vue'),
            meta: { title: '活动内容', permission: 'marketing:activity' },
          },
          {
            path: 'share-campaign',
            name: 'ShareCampaign',
            component: () => import('@/views/share/campaign.vue'),
            meta: { title: '裂变活动', permission: 'share:campaign' },
          },
          {
            path: 'share-records',
            name: 'ShareRecords',
            component: () => import('@/views/share/records.vue'),
            meta: { title: '分享数据', permission: 'share:record' },
          },
        ],
      },
      {
        path: 'content',
        name: 'Content',
        redirect: '/content/list',
        meta: { title: '内容管理', icon: 'Document', permission: 'content' },
        children: [
          {
            path: 'list',
            name: 'ContentList',
            component: () => import('@/views/content/list.vue'),
            meta: { title: '内容列表', permission: 'content:list' },
          },
          {
            path: 'edit',
            name: 'ContentEdit',
            component: () => import('@/views/content/edit.vue'),
            meta: { title: '内容编辑', permission: 'content:edit', hidden: true },
          },
          {
            path: 'edit/:id',
            name: 'ContentEditById',
            component: () => import('@/views/content/edit.vue'),
            meta: { title: '编辑内容', permission: 'content:edit', hidden: true },
          },
        ],
      },
      {
        path: 'pickup-store',
        name: 'PickupStore',
        redirect: '/pickup-store/list',
        meta: { title: '自提管理', icon: 'MapLocation', permission: 'pickup' },
        children: [
          {
            path: 'list',
            name: 'PickupStoreList',
            component: () => import('@/views/pickup-store/list.vue'),
            meta: { title: '自提点管理', permission: 'pickup:store' },
          },
          {
            path: 'verify',
            name: 'PickupStoreVerify',
            component: () => import('@/views/pickup-store/verify.vue'),
            meta: { title: '自提核销', permission: 'pickup:verify' },
          },
        ],
      },
      {
        path: 'supplier',
        name: 'Supplier',
        redirect: '/supplier/list',
        meta: { title: '供应商管理', icon: 'Van', permission: 'supplier' },
        children: [
          {
            path: 'list',
            name: 'SupplierList',
            component: () => import('@/views/supplier/list.vue'),
            meta: { title: '供应商管理', permission: 'supplier:list' },
          },
        ],
      },
      {
        path: 'statistics',
        name: 'Statistics',
        redirect: '/statistics/index',
        meta: { title: '数据统计', icon: 'DataAnalysis', permission: 'statistics' },
        children: [
          {
            path: 'index',
            name: 'StatisticsIndex',
            component: () => import('@/views/statistics/index.vue'),
            meta: { title: '数据统计', permission: 'statistics:index' },
          },
        ],
      },
      {
        path: 'system',
        name: 'System',
        redirect: '/system/admin',
        meta: { title: '系统管理', icon: 'Setting', permission: 'system' },
        children: [
          {
            path: 'admin',
            name: 'SystemAdmin',
            component: () => import('@/views/system/admin.vue'),
            meta: { title: '管理员管理', permission: 'system:admin' },
          },
          {
            path: 'role',
            name: 'SystemRole',
            component: () => import('@/views/system/role.vue'),
            meta: { title: '角色权限', permission: 'system:role' },
          },
          {
            path: 'config',
            name: 'SystemConfig',
            component: () => import('@/views/system/config.vue'),
            meta: { title: '系统配置', permission: 'system:config' },
          },
          {
            path: 'customer-service',
            name: 'CustomerServiceConfig',
            component: () => import('@/views/system/customer-service.vue'),
            meta: { title: '客服配置', permission: 'system:customer-service' },
          },
          {
            path: 'log',
            name: 'SystemLog',
            component: () => import('@/views/system/log.vue'),
            meta: { title: '操作日志', permission: 'system:log' },
          },
          {
            path: 'business-events',
            name: 'BusinessEvents',
            component: () => import('@/views/system/business-events.vue'),
            meta: { title: '业务事件', permission: 'system:log' },
          },
          {
            path: 'business-event-detail/:id',
            name: 'BusinessEventDetail',
            component: () => import('@/views/system/business-event-detail.vue'),
            meta: { title: '事件详情', permission: 'system:log', hidden: true },
          },
          {
            path: 'change-password',
            name: 'ChangePassword',
            component: () => import('@/views/system/change-password.vue'),
            meta: { title: '修改密码', skipMustChangePassword: true },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth === false || to.path === '/login') {
    if (to.path === '/login' && userStore.accessToken) {
      next('/dashboard')
      return
    }
    next()
    return
  }

  if (!userStore.accessToken) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (!userStore.userInfo.id && userStore.accessToken) {
    try {
      await userStore.fetchUserInfo()
    } catch {
      userStore.logout()
      return
    }
  }

  if (userStore.userInfo.mustChangePassword && !to.meta.skipMustChangePassword) {
    next('/system/change-password')
    return
  }

  next()
})

export default router
