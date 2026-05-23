# 14. 上线与回滚指南

## 14.1 上线前检查

### 自动化 Release Gate

```bash
pnpm release:check
```

该脚本会自动检查：
1. Prisma Schema 验证
2. API 单元测试 + E2E 测试
3. API 构建
4. Admin Web 构建
5. 敏感文件未被 git 追踪
6. 数据库迁移文件存在
7. Schema 与 Migration 关键字段一致性
8. .env.example 必要变量
9. 部署脚本可执行权限
10. Docker 环境（可选）
11. Git 状态

### CI 手动触发

在 GitHub Actions 页面，选择 `Release Gate Check` workflow，点击 `Run workflow` 手动触发。

## 14.2 数据库备份

```bash
# 全库备份
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅备份关键表
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
  orders order_items order_payments order_refunds order_logs \
  aftersale_orders product_skus user_coupons users \
  refund_callback_logs business_events \
  > backup_critical_$(date +%Y%m%d_%H%M%S).sql
```

## 14.3 部署步骤

### 14.3.1 拉取代码

```bash
git pull origin main
```

### 14.3.2 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 14.3.3 生成 Prisma Client

```bash
pnpm --filter @baby-mall/api prisma generate
```

### 14.3.4 执行数据库迁移

```bash
# 查看待执行的迁移
pnpm --filter @baby-mall/api prisma migrate status

# 执行迁移（生产环境必须用 deploy，不要用 reset）
pnpm --filter @baby-mall/api prisma migrate deploy
```

> **注意**：`prisma migrate deploy` 只执行未应用的迁移，不会重置数据库。`prisma migrate reset` 会删除所有数据，**绝对不要在生产环境使用**。

### 14.3.5 构建

```bash
pnpm build:api
pnpm build:admin
```

### 14.3.6 启动服务

```bash
# Docker 部署
docker compose up -d --build

# 或直接启动
pnpm --filter @baby-mall/api start:prod
```

### 14.3.7 Seed 注意事项

- 生产环境**不要**执行 `prisma db seed`，除非是首次部署。
- Seed 会创建测试数据，包括管理员账号、示例商品等。
- 如需添加初始管理员，请使用专门的 seed 脚本并指定 `--only-admin` 参数。

## 14.4 冒烟测试

```bash
# 健康检查
curl -f http://localhost:3000/api/health || echo "API 健康检查失败"

# 管理后台可访问
curl -f http://localhost:5173/ || echo "Admin Web 不可访问"

# 使用冒烟测试脚本
pnpm smoke
```

## 14.5 支付/退款回调验证

### 14.5.1 验证支付回调

1. 在管理后台创建一笔测试订单
2. 使用微信支付沙箱完成支付
3. 确认：
   - 订单状态从 `pending_payment` 变为 `pending_delivery`
   - 支付记录状态为 `SUCCESS`
   - 优惠券状态从 `LOCKED` 变为 `USED`（如有）
   - `business_events` 表无 critical/error 事件

### 14.5.2 验证退款回调

1. 对测试订单发起退款
2. 确认：
   - 退款记录状态为 `success`
   - 售后单状态为 `refunded`
   - 库存已归还
   - 积分已处理
   - `business_events` 表无 critical/error 事件

### 14.5.3 验证对账补偿

1. 在管理后台"对账与补偿中心"页面
2. 点击"触发支付对账"，确认返回结果正常
3. 点击"触发退款对账"，确认返回结果正常
4. 输入一个退款单号，点击"同步退款状态"，确认返回结果正常

## 14.6 回滚方案

### 14.6.1 代码回滚

```bash
# 查看最近提交
git log --oneline -10

# 回滚到指定版本
git revert <commit-hash>

# 或回滚到上一个版本
git revert HEAD

# 重新部署
docker compose up -d --build
```

### 14.6.2 数据库回滚

> **重要**：Prisma 不支持自动回滚迁移。数据库回滚需要手动执行 SQL。

```bash
# 查看已应用的迁移
pnpm --filter @baby-mall/api prisma migrate status

# 手动回滚最近一次迁移
# 1. 查看迁移 SQL
cat apps/api/prisma/migrations/<migration_name>/migration.sql

# 2. 编写反向 SQL
# 3. 手动执行
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < rollback.sql

# 4. 更新迁移记录
DELETE FROM _prisma_migrations WHERE migration_name = '<migration_name>';
```

### 14.6.3 全库恢复

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup_YYYYMMDD_HHMMSS.sql
```

### 14.6.4 Docker 回滚

```bash
# 查看当前运行的容器
docker compose ps

# 回滚到上一个镜像版本
docker compose down
docker tag baby-mall-api:latest baby-mall-api:rollback
docker compose up -d

# 如果使用镜像仓库
docker compose pull  # 拉取上一版本
docker compose up -d
```

## 14.7 关键异常可观测

上线后请关注 `business_events` 表：

```sql
-- 检查 critical/error 事件
SELECT * FROM business_events
WHERE level IN ('critical', 'error')
ORDER BY created_at DESC
LIMIT 20;

-- 检查支付相关异常
SELECT * FROM business_events
WHERE biz_type = 'payment' AND level IN ('critical', 'error')
ORDER BY created_at DESC;

-- 检查退款相关异常
SELECT * FROM business_events
WHERE biz_type = 'refund' AND level IN ('critical', 'error')
ORDER BY created_at DESC;
```

如配置了 `ALERT_WEBHOOK_URL`，critical 级别事件会自动推送到 Webhook。
