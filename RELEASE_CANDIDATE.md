# RELEASE_CANDIDATE（2026-05-27）

## 1. 版本与结论

- 项目：禧孕优选
- 阶段：上线前最终完善（可进入预生产与真机验收）
- 结论：**RC 可用于预生产验收，不可直接正式上线（No-Go）**

## 2. 本次实际执行命令记录

### 2.1 基线命令（全部执行）

| 命令 | 结果 | 说明 |
|---|---|---|
| `pnpm install` | PASS | 依赖已就绪 |
| `pnpm --filter @baby-mall/api prisma:validate` | PASS | Schema 有效 |
| `pnpm --filter @baby-mall/api prisma:generate` | PASS | Client 生成成功 |
| `pnpm --filter @baby-mall/api test:ci` | PASS | 单测+e2e 全通过 |
| `pnpm build:api` | PASS | API 构建通过 |
| `pnpm build:admin` | PASS | Admin 构建通过 |
| `pnpm build:mini` | PASS | 小程序默认构建通过 |
| `pnpm release:check` | PASS | `PASS 88 / FAIL 0 / WARN 8` |

### 2.2 生产门禁命令（按要求尝试）

| 命令 | 结果 | 失败原因 |
|---|---|---|
| `REQUIRE_REAL_WX_APPID=true NODE_ENV=production pnpm release:check` | FAIL | 当前 Windows + bash 环境下直接 POSIX 写法不可执行（`node: not found`） |
| `cmd /c "set REQUIRE_REAL_WX_APPID=true&& set NODE_ENV=production&& pnpm release:check"` | FAIL | 缺真实 AppID 导致 `build:mini` 失败（符合人工/环境阻塞预期） |
| `pnpm release:check:prod` | FAIL | 缺真实 AppID，生产门禁触发失败（符合预期） |

### 2.3 Docker 配置命令

| 命令 | 结果 | 失败原因 |
|---|---|---|
| `cd deploy && docker compose --env-file ../.env.production config` | FAIL | 缺少 `.env.production` 文件 |

## 3. 阻塞项归类

### 3.1 人工阻塞（P0）

1. 真实 AppID。
2. 微信支付密钥与证书。
3. 备案号与高合规资质编号/证明材料。
4. 客服与售后最终口径。

### 3.2 环境阻塞（P0）

1. `.env.production` 未提供。
2. 服务器证书未提供。
3. 本机 Docker 未启动，未执行容器健康验收。

## 4. 发布建议

- 当前 RC 允许进入：预生产部署 + 体验版 + 真机验收。
- 当前 RC 不允许进入：正式发布。
- 待 `docs/OPERATOR_REQUIRED.md` 全项完成并通过真机支付退款闭环后，再发起下一次 Go/No-Go。
