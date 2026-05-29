# 禧孕母婴用品私域商城小程序 - 冒烟测试指南

## 1. 什么是冒烟测试

冒烟测试（Smoke Test）是一种快速验证软件系统核心功能是否正常工作的测试方法，主要用于：

- **部署验证**：确认系统部署成功后能正常启动
- **集成验证**：验证数据库、Redis、API、Nginx 等组件协同工作
- **上线前检查**：在上线前快速确认核心功能无明显问题

## 2. 本地冒烟 vs 生产冒烟

| 对比项 | 本地冒烟 | 生产冒烟 |
|--------|----------|----------|
| DB_PASSWORD | 默认 baby_mall_2024，无需设置 | 必须通过环境变量传入 |
| REDIS_PASSWORD | 可选 | 通常必须设置 |
| SMOKE_TEST_BYPASS_CAPTCHA | 可设为 true | **禁止**设为 true |
| LOGIN_MODE | bypass（默认） | manual |
| ADMIN_PASSWORD | 默认 admin123 | 必须使用生产密码 |
| Nginx | 可选 | 必须 |

⚠️ **重要**：`SMOKE_TEST_BYPASS_CAPTCHA=true` 仅限本地/测试环境使用。生产环境设置此选项会导致验证码被绕过，存在严重安全风险。

## 3. 本地启动流程

### 3.1 前置条件

- 已安装 Docker 和 Docker Compose
- 已安装 curl
- 已安装 Node.js 18+ 和 pnpm 8+
- 已克隆项目代码
- jq 为可选项（未安装时自动降级为文本解析）

### 3.2 构建项目

```bash
# 安装依赖
pnpm install

# 构建 API 服务
pnpm build:api

# 构建管理后台
pnpm build:admin
```

### 3.3 配置环境变量

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

# 启用验证码绕过（仅限本地冒烟测试）
SMOKE_TEST_BYPASS_CAPTCHA=true
```

### 3.4 启动 Docker 服务

```bash
# 使用项目根目录脚本启动
pnpm docker:up

# 或者手动进入 deploy 目录
cd deploy
docker compose up -d --build
```

启动后等待约 30-60 秒，等待所有服务就绪。

### 3.5 访问服务

- **管理后台**：http://localhost:8080/admin
- **API 健康检查**：http://localhost:8080/api/health
- **API 直接访问**：http://localhost:3001/api/health

## 4. 运行冒烟测试

### 4.1 全量冒烟测试（推荐）

```bash
# 顺序执行基础测试 + 后台登录测试
pnpm smoke:all
```

### 4.1.1 公网部署冒烟测试（生产推荐）

```bash
API_BASE_URL=https://api.yourdomain.com \
ADMIN_BASE_URL=https://admin.yourdomain.com \
PAY_NOTIFY_URL=https://api.yourdomain.com/api/weapp/pay/callback \
REFUND_NOTIFY_URL=https://api.yourdomain.com/api/weapp/pay/refund-callback \
pnpm smoke:public
```

说明：
- 仅校验连通性与健康状态，不依赖真实支付成功。
- 会检查 API/后台/uploads/HTTPS/回调 URL 可达性。
- 如执行机可访问 Docker，还会检查最近定时任务日志关键词。

### 4.2 基础冒烟测试

```bash
# 使用根目录脚本
pnpm smoke

# 或者手动进入 deploy 目录
cd deploy
bash scripts/smoke-test.sh
```

该测试会检查：

1. ✅ 运行依赖（docker、docker compose、curl、jq 可选）
2. ✅ Docker Compose 服务状态
3. ✅ MySQL 健康状态（支持 DB_PASSWORD 环境变量）
4. ✅ Redis 健康状态（支持 REDIS_PASSWORD 环境变量）
5. ✅ API 健康检查（/api/health）
6. ✅ Nginx 代理（通过 Nginx 访问 /api/health）

**环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| API_PORT | 3001 | API 服务端口 |
| NGINX_PORT | 80 | Nginx 端口 |
| DB_PASSWORD | baby_mall_2024 | MySQL 密码（未设置时使用默认值并警告） |
| REDIS_PASSWORD | (空) | Redis 密码（非空时自动使用 -a 参数） |

### 4.3 后台登录测试

#### bypass 模式（默认，仅限非生产环境）

```bash
# 确保 .env 中设置了 SMOKE_TEST_BYPASS_CAPTCHA=true
pnpm smoke:login
```

bypass 模式会自动使用 `smoke-test` / `bypass` 作为验证码凭据绕过验证码校验。脚本会检查 `SMOKE_TEST_BYPASS_CAPTCHA` 环境变量，如果未设置为 `true`，会明确报错并提示。

#### manual 模式（适用于生产环境）

```bash
# 第一步：获取验证码 ID
LOGIN_MODE=manual pnpm smoke:login
# 脚本会输出 captchaId，并提示你输入验证码

# 第二步：使用验证码登录
CAPTCHA_ID=<获取到的ID> CAPTCHA_CODE=<验证码> LOGIN_MODE=manual pnpm smoke:login
```

manual 模式不会绕过验证码，适用于生产环境或需要验证完整登录流程的场景。

**环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| API_PORT | 3001 | API 服务端口 |
| ADMIN_USERNAME | admin | 管理员用户名 |
| ADMIN_PASSWORD | admin123 | 管理员密码 |
| LOGIN_MODE | bypass | 登录模式（bypass / manual） |
| SMOKE_TEST_BYPASS_CAPTCHA | false | 是否启用验证码绕过 |
| CAPTCHA_ID | (空) | manual 模式验证码 ID |
| CAPTCHA_CODE | (空) | manual 模式验证码 |

## 5. 冒烟测试脚本详解

### 5.1 smoke-test.sh 核心逻辑

```bash
# 0. 依赖检查
command -v docker && docker compose version && command -v curl

# 1. 检查 Docker 服务状态
docker compose ps  # 无 jq 时使用 grep -c "running" 兜底

# 2. 检查 MySQL 健康
docker compose exec mysql mysqladmin ping -h localhost -uroot -p"$DB_PASSWORD"

# 3. 检查 Redis 健康
# 有密码时
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
# 无密码时
docker compose exec redis redis-cli ping

# 4. 检查 API 健康
curl http://localhost:3001/api/health

# 5. 检查 Nginx 代理
curl http://localhost:80/api/health
```

### 5.2 smoke-admin-login.sh 核心逻辑

```bash
# bypass 模式（需要 SMOKE_TEST_BYPASS_CAPTCHA=true）
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","captchaId":"smoke-test","captchaCode":"bypass"}'

# manual 模式（需要手动获取验证码）
# 1. 获取验证码
curl -s http://localhost:3001/api/admin/auth/captcha
# 2. 使用验证码登录
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","captchaId":"<id>","captchaCode":"<code>"}'

# 3. 获取用户信息
curl http://localhost:3001/api/admin/auth/info \
  -H "Authorization: Bearer <access_token>"
```

## 6. 常见失败原因

### 6.1 Docker 服务未启动

**症状**：
```
❌  Docker Compose 未运行
    排查: cd deploy && docker compose up -d
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

### 6.2 端口被占用

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

### 6.3 MySQL 连接失败

**症状**：
```
❌  MySQL 健康检查失败
    排查: cd deploy && docker compose logs mysql
    排查: 确认 DB_PASSWORD 环境变量是否正确
```

**解决**：
```bash
# 查看 MySQL 日志
cd deploy
docker compose logs mysql

# 检查 .env 中的 DB_PASSWORD 是否正确
# 确保 MySQL 容器已完全启动（可能需要 30-60 秒）
```

### 6.4 Redis 连接失败

**症状**：
```
❌  Redis 健康检查失败
    排查: 如 Redis 需要密码，请设置 REDIS_PASSWORD 环境变量
```

**解决**：
```bash
# 查看 Redis 日志
cd deploy
docker compose logs redis

# 如果 Redis 设置了密码，确保 REDIS_PASSWORD 环境变量正确
export REDIS_PASSWORD=your_redis_password
```

### 6.5 API 健康检查失败

**症状**：
```
❌  API 服务不可达
    排查: cd deploy && docker compose logs api
    排查: 确认 API_PORT=3001 是否正确
```

**解决**：
```bash
# 查看 API 日志
cd deploy
docker compose logs api

# 检查环境变量配置是否正确
# 确保数据库和 Redis 已就绪
```

### 6.6 管理员登录失败

**症状**：
```
❌  bypass 模式需要设置 SMOKE_TEST_BYPASS_CAPTCHA=true
    此选项仅限非生产环境使用!
```

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

# 或使用 manual 模式
LOGIN_MODE=manual pnpm smoke:login
```

### 6.7 jq 未安装

**症状**：
```
⚠️  jq 未安装，将使用文本解析兜底
```

**说明**：这不影响测试运行，脚本会自动降级为 `grep` 文本解析。如需安装 jq：

```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# CentOS/RHEL
sudo yum install jq
```

## 7. 完整上线前检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 1. Docker 服务运行正常 | ⬜ | 所有容器状态为 Up |
| 2. MySQL 健康检查通过 | ⬜ | mysqladmin ping 返回 ok |
| 3. Redis 健康检查通过 | ⬜ | redis-cli ping 返回 PONG |
| 4. API 健康检查通过 | ⬜ | /api/health 返回 ok |
| 5. Nginx 代理正常 | ⬜ | 通过 80 端口访问 API 正常 |
| 6. 后台登录成功 | ⬜ | 能正常登录并获取用户信息 |
| 7. 数据库迁移已应用 | ⬜ | Prisma 迁移已执行 |
| 8. 种子数据已加载 | ⬜ | 管理员账号已创建 |
| 9. 文件上传目录存在 | ⬜ | uploads 目录可读写 |
| 10. HTTPS 证书配置（生产）| ⬜ | SSL 证书已配置 |
| 11. SMOKE_TEST_BYPASS_CAPTCHA 未开启（生产）| ⬜ | 生产环境必须关闭 |

## 8. 关闭服务

```bash
# 使用根目录脚本
pnpm docker:down

# 或者手动进入 deploy 目录
cd deploy
docker compose down

# 如需删除数据卷（⚠️ 警告：会清除所有数据）
docker compose down -v
```

## 9. 快速参考命令

```bash
# 项目根目录
cd /path/to/baby-mall

# 启动服务
pnpm docker:up

# 查看服务状态
cd deploy && docker compose ps

# 查看日志
cd deploy && docker compose logs -f [service_name]

# 运行全量冒烟测试
pnpm smoke:all

# 运行基础冒烟测试
pnpm smoke

# 运行后台登录测试
pnpm smoke:login

# 生产环境冒烟测试
DB_PASSWORD=prod_pass REDIS_PASSWORD=prod_redis LOGIN_MODE=manual pnpm smoke:login

# 停止服务
pnpm docker:down
```

## 10. 生产环境注意事项

⚠️ **重要提示**：

1. 生产环境**不要**设置 `SMOKE_TEST_BYPASS_CAPTCHA=true`
2. 生产环境必须修改 `JWT_SECRET` 为强密码
3. 生产环境必须设置强密码的 `ADMIN_DEFAULT_PASSWORD`
4. 生产环境必须配置 HTTPS
5. 生产环境应该定期备份数据库
6. 生产环境不要使用默认的 `admin123` 密码
7. 生产环境首次登录后必须修改管理员密码
8. 生产环境冒烟测试使用 `LOGIN_MODE=manual` 模式
9. 生产环境必须通过 `DB_PASSWORD` 环境变量传入数据库密码

## 11. Shellcheck 建议

建议在 CI 中引入 shellcheck 对 shell 脚本进行静态检查：

```bash
# 安装 shellcheck
# Ubuntu/Debian
sudo apt-get install shellcheck

# macOS
brew install shellcheck

# 运行检查
shellcheck deploy/scripts/*.sh
```

shellcheck 不存在时不应导致 CI 失败。可在 CI 中添加：

```yaml
- name: Shellcheck
  run: command -v shellcheck && shellcheck deploy/scripts/*.sh || echo "shellcheck not installed, skipping"
```

## 12. 下一步

冒烟测试通过后，可以进行：

1. **完整功能测试**：验证所有业务功能
2. **性能测试**：测试系统在高负载下的表现
3. **安全测试**：检查系统安全漏洞
4. **用户验收测试**：让最终用户验证功能是否符合预期
