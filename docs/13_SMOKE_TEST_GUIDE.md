# 禧孕母婴用品私域商城小程序 - 冒烟测试指南

## 1. 什么是冒烟测试

冒烟测试（Smoke Test）是一种快速验证软件系统核心功能是否正常工作的测试方法，主要用于：

- **部署验证**：确认系统部署成功后能正常启动
- **集成验证**：验证数据库、Redis、API、Nginx 等组件协同工作
- **上线前检查**：在上线前快速确认核心功能无明显问题

## 2. 本地启动流程

### 2.1 前置条件

- 已安装 Docker 和 Docker Compose
- 已安装 Node.js 18+ 和 pnpm 8+
- 已克隆项目代码

### 2.2 构建项目

```bash
# 安装依赖
pnpm install

# 构建 API 服务
pnpm build:api

# 构建管理后台
pnpm build:admin
```

### 2.3 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，配置必要参数
vim .env
```

必要配置项：

```env
# 数据库配置
DB_PASSWORD=your_secure_password
DB_NAME=baby_mall

# Redis 配置（可选密码）
REDIS_PASSWORD=

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your_jwt_secret_change_this

# 微信支付配置（生产环境必须）
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_MCH_ID=
WECHAT_API_V3_KEY=

# 管理员账号配置
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123

# 运行种子数据（首次启动需要）
RUN_SEED=true

# 启用验证码绕过（用于冒烟测试）
SMOKE_TEST_BYPASS_CAPTCHA=true
```

### 2.4 启动 Docker 服务

```bash
# 使用项目根目录脚本启动
pnpm docker:up

# 或者手动进入 deploy 目录
cd deploy
docker compose up -d --build
```

启动后等待约 30-60 秒，等待所有服务就绪。

### 2.5 访问服务

- **管理后台**：http://localhost:8080/admin
- **API 健康检查**：http://localhost:8080/api/health
- **API 直接访问**：http://localhost:3001/api/health

## 3. 运行冒烟测试

### 3.1 基础冒烟测试

```bash
# 使用根目录脚本
pnpm smoke

# 或者手动进入 deploy 目录
cd deploy
bash scripts/smoke-test.sh
```

该测试会检查：

1. ✅ Docker Compose 服务状态
2. ✅ MySQL 健康状态
3. ✅ Redis 健康状态
4. ✅ API 健康检查（/api/health）
5. ✅ Nginx 代理（通过 Nginx 访问 /api/health）

### 3.2 后台登录测试

```bash
# 使用根目录脚本
pnpm smoke:login

# 或者手动进入 deploy 目录
cd deploy
bash scripts/smoke-admin-login.sh
```

该测试会检查：

1. ✅ 获取验证码接口
2. ✅ 管理员登录（支持验证码绕过）
3. ✅ 获取用户信息接口

## 4. 冒烟测试脚本详解

### 4.1 smoke-test.sh 核心逻辑

```bash
# 1. 检查 Docker 服务状态
docker compose ps

# 2. 检查 MySQL 健康
docker compose exec mysql mysqladmin ping

# 3. 检查 Redis 健康
docker compose exec redis redis-cli ping

# 4. 检查 API 健康
curl http://localhost:3001/api/health

# 5. 检查 Nginx 代理
curl http://localhost:8080/api/health
```

### 4.2 smoke-admin-login.sh 核心逻辑

```bash
# 1. 获取验证码
curl -s http://localhost:3001/api/admin/auth/captcha

# 2. 登录（使用 bypass 绕过验证码）
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","captchaId":"smoke-test","captchaCode":"bypass"}'

# 3. 获取用户信息
curl http://localhost:3001/api/admin/auth/info \
  -H "Authorization: Bearer <access_token>"
```

## 5. 常见失败原因

### 5.1 Docker 服务未启动

**症状**：
```
❌  Docker Compose 未运行
```

**解决**：
```bash
# 检查 Docker 是否运行
docker info

# 启动 Docker（根据操作系统不同）
# Mac/Linux
sudo systemctl start docker

# Windows
# 在 Docker Desktop 中启动
```

### 5.2 端口被占用

**症状**：
```
Error: bind: address already in use
```

**解决**：
```bash
# 检查端口占用
lsof -i :3307  # MySQL
lsof -i :6379  # Redis
lsof -i :3001  # API
lsof -i :8080  # Nginx

# 杀死占用端口的进程，或修改 docker-compose.yml 中的端口映射
```

### 5.3 MySQL 连接失败

**症状**：
```
❌  MySQL 健康检查失败
```

**解决**：
```bash
# 查看 MySQL 日志
cd deploy
docker compose logs mysql

# 检查 .env 中的 DB_PASSWORD 是否正确
# 确保 MySQL 容器已完全启动（可能需要 30-60 秒）
```

### 5.4 API 健康检查失败

**症状**：
```
❌  API 服务不可达
```

**解决**：
```bash
# 查看 API 日志
cd deploy
docker compose logs api

# 检查环境变量配置是否正确
# 确保数据库和 Redis 已就绪
```

### 5.5 管理员登录失败

**症状**：
```
❌  登录失败
```

**可能原因**：
1. 未设置 `SMOKE_TEST_BYPASS_CAPTCHA=true`
2. 未运行种子数据（`RUN_SEED=true`）
3. 账号密码不正确
4. JWT_SECRET 配置问题

**解决**：
```bash
# 确保 .env 中设置正确
SMOKE_TEST_BYPASS_CAPTCHA=true
RUN_SEED=true
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123

# 重新启动服务
cd deploy
docker compose down
docker compose up -d
```

## 6. 完整上线前检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 1. Docker 服务运行正常 | ⬜ | 所有容器状态为 Up |
| 2. MySQL 健康检查通过 | ⬜ | mysqladmin ping 返回 ok |
| 3. Redis 健康检查通过 | ⬜ | redis-cli ping 返回 PONG |
| 4. API 健康检查通过 | ⬜ | /api/health 返回 ok |
| 5. Nginx 代理正常 | ⬜ | 通过 8080 端口访问 API 正常 |
| 6. 后台登录成功 | ⬜ | 能正常登录并获取用户信息 |
| 7. 数据库迁移已应用 | ⬜ | Prisma 迁移已执行 |
| 8. 种子数据已加载 | ⬜ | 管理员账号已创建 |
| 9. 文件上传目录存在 | ⬜ | uploads 目录可读写 |
| 10. HTTPS 证书配置（生产）| ⬜ | SSL 证书已配置 |

## 7. 关闭服务

```bash
# 使用根目录脚本
pnpm docker:down

# 或者手动进入 deploy 目录
cd deploy
docker compose down

# 如需删除数据卷（⚠️ 警告：会清除所有数据）
docker compose down -v
```

## 8. 快速参考命令

```bash
# 项目根目录
cd /path/to/baby-mall

# 启动服务
pnpm docker:up

# 查看服务状态
cd deploy && docker compose ps

# 查看日志
cd deploy && docker compose logs -f [service_name]

# 运行基础冒烟测试
pnpm smoke

# 运行后台登录测试
pnpm smoke:login

# 停止服务
pnpm docker:down
```

## 9. 生产环境注意事项

⚠️ **重要提示**：

1. 生产环境**不要**设置 `SMOKE_TEST_BYPASS_CAPTCHA=true`
2. 生产环境必须修改 `JWT_SECRET` 为强密码
3. 生产环境必须设置强密码的 `ADMIN_DEFAULT_PASSWORD`
4. 生产环境必须配置 HTTPS
5. 生产环境应该定期备份数据库
6. 生产环境不要使用默认的 `admin123` 密码
7. 生产环境首次登录后必须修改管理员密码

## 10. 下一步

冒烟测试通过后，可以进行：

1. **完整功能测试**：验证所有业务功能
2. **性能测试**：测试系统在高负载下的表现
3. **安全测试**：检查系统安全漏洞
4. **用户验收测试**：让最终用户验证功能是否符合预期
