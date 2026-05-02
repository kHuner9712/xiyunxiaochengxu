# 禧孕小程序 — 上线前预检脚本

## 文件说明

| 文件 | 用途 | 执行方式 |
|------|------|---------|
| `run-rc-gate.sh` | **RC 门禁一键检查（总控）** | `bash run-rc-gate.sh [选项]` |
| `check-release-placeholders.sh` | 发布占位符与配置值检查 | `bash check-release-placeholders.sh [选项] /path/to/repo` |
| `check-wechat-submit-readiness.sh` | 提审就绪自动化检查 | `bash check-wechat-submit-readiness.sh [/path/to/repo]` |
| `check-server.sh` | 服务器环境+数据库全量预检 | `bash check-server.sh [选项] [/path/to/backend]` |
| `check-runtime-config.sh` | 运行时配置完整性检查 | `bash check-runtime-config.sh [选项]` |
| `check-admin-bootstrap.sh` | 后台管理初始化检查 | `bash check-admin-bootstrap.sh [/path/to/repo]` |
| `check-placeholders.sh` | 占位符残留扫描（通用版） | `bash check-placeholders.sh [选项] [/path/to/repo]` |
| `check-api-health.sh` | API 健康检查（验收用） | `bash check-api-health.sh [BASE_URL]` |
| `check-db.sql` | 纯数据库结构预检 | `mysql -u root -p shopxo < check-db.sql` |
| `lib-env.sh` | .env 公共解析库（被其他脚本引用） | 不单独执行 |

## 快速开始

### RC 门禁（推荐）

```bash
# 体验版模式
bash run-rc-gate.sh --mode=experience --repo . --backend ./shopxo-backend

# 提审模式
bash run-rc-gate.sh --mode=submit --repo . --backend ./shopxo-backend --env ./shopxo-backend/.env
```

### 单独执行各脚本

```bash
# 发布占位符检查（体验版模式）
bash check-release-placeholders.sh --mode=experience .

# 提审就绪检查
bash check-wechat-submit-readiness.sh .

# 服务器环境预检
bash check-server.sh --env /var/www/xiyun/shopxo-backend/.env /var/www/xiyun/shopxo-backend

# 运行时配置检查
bash check-runtime-config.sh --env /var/www/xiyun/shopxo-backend/.env

# 后台初始化检查
bash check-admin-bootstrap.sh .

# 通用占位符扫描
bash check-placeholders.sh --strict .

# API 健康检查
bash check-api-health.sh http://你的服务器IP/

# 数据库结构预检
mysql -u shopxo -p shopxo < check-db.sql
```

## run-rc-gate.sh 选项

| 选项 | 说明 |
|------|------|
| `--mode=experience` | 体验版模式（允许测试号 AppID + IP） |
| `--mode=submit` | 提审模式（要求正式 AppID + HTTPS 域名） |
| `--repo PATH` | 仓库根目录（默认 `.`） |
| `--backend PATH` | 后端代码目录（默认 `.`） |
| `--env FILE` | 从 .env 文件读取数据库连接信息 |
| `--no-color` | 关闭彩色输出（适合 CI/CD） |
| `--help` | 显示帮助 |

## check-release-placeholders.sh 选项

| 选项 | 说明 |
|------|------|
| `--mode=experience` | 体验版模式（允许测试号 AppID + IP，默认） |
| `--mode=submit` | 提审模式（要求正式 AppID + HTTPS 域名） |
| `--no-color` | 关闭彩色输出 |
| `--help` | 显示帮助 |

## check-server.sh 选项

| 选项 | 说明 |
|------|------|
| `--no-color` | 关闭彩色输出 |
| `--quiet` | 只输出 FAIL/WARN |
| `--strict` | WARN 也视为阻断 |
| `--env FILE` | 从 .env 文件读取数据库连接 |
| `--help` | 显示帮助 |

## check-placeholders.sh 选项

| 选项 | 说明 |
|------|------|
| `--no-color` | 关闭彩色输出 |
| `--docs-also` | 同时扫描文档 |
| `--strict` | SQL 占位符也阻断 |
| `--help` | 显示帮助 |

## .env 解析策略

所有脚本通过 `lib-env.sh` 统一解析 .env，支持两种格式：

**优先级 1：ThinkPHP/INI 风格**
```ini
[DATABASE]
HOSTNAME = 127.0.0.1
DATABASE = xiyun
USERNAME = xiyun
PASSWORD = your_pass
HOSTPORT = 3306
PREFIX = sxo_
```

**优先级 2：扁平变量风格**
```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=xiyun
DB_USER=xiyun
DB_PASS=your_pass
DB_PREFIX=sxo_
```

环境变量优先级最高，不会被 .env 覆盖。

## 结果判定

| 场景 | 退出码 | 结论 |
|------|:---:|------|
| 全 PASS | 0 | ✅ 可以发布 |
| 有 WARN 无 FAIL | 0 | ⚠️ 建议修复后上线 |
| 有 BLOCKER/FAIL | 1 | ❌ 不可发布 |
