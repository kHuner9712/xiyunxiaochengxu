# 禧孕母婴用品私域商城小程序

禧孕文化传媒有限公司自营母婴用品线上私域商城小程序。

## 项目性质

本项目为甲方自营商城，不是多商户平台。所有商品、订单、支付、发货、售后、会员、客服和营销活动均由禧孕文化传媒有限公司统一管理。

## 技术栈

| 层级 | 技术 |
|------|------|
| 小程序端 | uni-app + Vue3 + TypeScript |
| 管理后台 | Vue3 + Vite + TypeScript + Element Plus |
| 后端 API | Node.js + NestJS + TypeScript |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| ORM | Prisma |
| 文件存储 | 本地 + 预留腾讯云 COS / 阿里云 OSS |
| 支付 | 微信支付 V3 |
| 登录 | 微信小程序登录 |
| 部署 | Docker Compose + Nginx + HTTPS |

## 项目结构

```
baby-mall/
  apps/
    miniprogram/        # 微信小程序端，uni-app
    admin-web/          # 运营管理后台
    api/                # 后端 API 服务
  packages/
    shared/             # 前后端共享类型、常量、工具
  docs/
    00_PROJECT_OVERVIEW.md
    01_PRODUCT_REQUIREMENTS.md
    02_USER_ROLES_AND_PERMISSIONS.md
    03_INFORMATION_ARCHITECTURE.md
    04_MINIPROGRAM_PAGES.md
    05_ADMIN_PAGES.md
    06_DATABASE_DESIGN.md
    07_API_SPEC.md
    08_BUSINESS_RULES.md
    09_MARKETING_AND_MEMBER_SYSTEM.md
    10_ORDER_PAYMENT_AFTERSALE.md
    11_DEPLOYMENT_GUIDE.md
    12_ACCEPTANCE_CHECKLIST.md
  deploy/
    docker-compose.yml
    nginx/
    scripts/
  README.md
  .env.example
```

## 文档体系

| 文档 | 说明 |
|------|------|
| [00_PROJECT_OVERVIEW.md](docs/00_PROJECT_OVERVIEW.md) | 项目总览 |
| [01_PRODUCT_REQUIREMENTS.md](docs/01_PRODUCT_REQUIREMENTS.md) | 产品需求文档 |
| [02_USER_ROLES_AND_PERMISSIONS.md](docs/02_USER_ROLES_AND_PERMISSIONS.md) | 用户角色和权限 |
| [03_INFORMATION_ARCHITECTURE.md](docs/03_INFORMATION_ARCHITECTURE.md) | 信息架构 |
| [04_MINIPROGRAM_PAGES.md](docs/04_MINIPROGRAM_PAGES.md) | 小程序页面设计 |
| [05_ADMIN_PAGES.md](docs/05_ADMIN_PAGES.md) | 后台页面设计 |
| [06_DATABASE_DESIGN.md](docs/06_DATABASE_DESIGN.md) | 数据库设计 |
| [07_API_SPEC.md](docs/07_API_SPEC.md) | API 接口文档 |
| [08_BUSINESS_RULES.md](docs/08_BUSINESS_RULES.md) | 业务规则 |
| [09_MARKETING_AND_MEMBER_SYSTEM.md](docs/09_MARKETING_AND_MEMBER_SYSTEM.md) | 会员与营销系统 |
| [10_ORDER_PAYMENT_AFTERSALE.md](docs/10_ORDER_PAYMENT_AFTERSALE.md) | 订单、支付、售后 |
| [11_DEPLOYMENT_GUIDE.md](docs/11_DEPLOYMENT_GUIDE.md) | 部署指南 |
| [12_ACCEPTANCE_CHECKLIST.md](docs/12_ACCEPTANCE_CHECKLIST.md) | 验收清单 |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose
- MySQL 8.0
- Redis 7

### 安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 后端开发

```bash
cd apps/api

# 配置环境变量
cp .env.example .env

# 初始化数据库
pnpm prisma:migrate:dev

# 启动开发服务器
pnpm dev
```

### 小程序开发

```bash
cd apps/miniprogram

# 启动开发模式
pnpm dev:mp-weixin

# 使用微信开发者工具打开 dist/dev/mp-weixin 目录
```

### 管理后台开发

```bash
cd apps/admin-web

# 启动开发服务器
pnpm dev
```

### 生产部署

详见 [部署指南](docs/11_DEPLOYMENT_GUIDE.md)

```bash
cd deploy

# 启动所有服务
docker-compose up -d
```

## 一键检查命令

```bash
# 安装依赖
pnpm install

# 验证 API（Prisma schema + 生成客户端）
pnpm --filter @baby-mall/api prisma:validate
pnpm --filter @baby-mall/api prisma:generate

# 运行测试
pnpm --filter @baby-mall/api test:ci

# 构建验证
pnpm build:api      # 后端构建
pnpm build:admin    # 管理后台构建
pnpm build:mini     # 小程序构建

# Release Gate（上线前综合检查）
pnpm release:check

# Docker 冒烟测试（需要 Docker 环境）
pnpm docker:up
pnpm smoke:all
```

## 上线前检查

正式上线前必须完成 [GO_LIVE.md](GO_LIVE.md) 中的全部验收项。

快速验证命令：

```bash
# API 验证（Prisma schema + 测试 + 构建）
pnpm validate:api

# Release Gate（上线前综合检查）
pnpm release:check

# 小程序构建
pnpm build:mini

# Docker 冒烟测试（需要 Docker 环境）
pnpm smoke:all
```

## 核心业务说明

- **自营商城**：所有商品由甲方统一采购、定价、销售
- **供应商管理**：供应商仅作为供货来源，不提供独立后台，不允许自行发布商品和收款
- **会员体系**：普通会员 → 银卡 → 金卡 → 黑金，四级会员体系
- **积分系统**：下单、签到、分享等获取积分，积分可抵扣订单金额
- **营销系统**：新人礼包、限时折扣、满减满赠、组合套餐、优惠券
- **复购系统**：周期购提醒、按宝宝月龄推荐、基于历史订单推荐

## 许可证

私有项目，未经授权禁止使用。
