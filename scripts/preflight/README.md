# 孕禧小程序 — 上线前预检脚本

## 文件说明

| 文件 | 用途 | 执行方式 |
|------|------|---------|
| `release-gate.sh` | **一键发布门禁（总控）** | `bash release-gate.sh [选项]` |
| `check-server.sh` | 服务器环境+数据库全量预检 | `bash check-server.sh [选项] [/path/to/backend]` |
| `check-placeholders.sh` | 占位符残留扫描 | `bash check-placeholders.sh [选项] [/path/to/repo]` |
| `check-db.sql` | 纯数据库结构预检 | `mysql -u root -p shopxo < check-db.sql` |

## 快速开始

### 发布当天推荐命令（一键门禁）

```bash
# 在服务器上执行，一条命令跑完全部预检
bash release-gate.sh --repo /var/www/yunxi --backend /var/www/yunxi/shopxo-backend --env /var/www/yunxi/shopxo-backend/.env

# 严格模式（WARN 也阻断）
bash release-gate.sh --strict --repo /var/www/yunxi --backend /var/www/yunxi/shopxo-backend

# 本地开发环境（跳过服务器和数据库检查，只跑占位符扫描）
bash release-gate.sh --skip-server --skip-db

# CI/CD 场景
bash release-gate.sh --no-color --strict --skip-db --repo . --backend ./shopxo-backend
```

### 单独执行各脚本

```bash
# 在服务器上执行，检查当前目录下的后端代码
bash check-server.sh /var/www/yunxi/shopxo-backend

# 指定数据库连接
DB_HOST=127.0.0.1 DB_USER=shopxo DB_PASS=yourpass \
  bash check-server.sh /var/www/yunxi/shopxo-backend

# 从 .env 文件读取数据库连接
bash check-server.sh --env /var/www/yunxi/shopxo-backend/.env /var/www/yunxi/shopxo-backend
```

### 仅检查数据库

```bash
mysql -u shopxo -p shopxo < check-db.sql
```

## check-server.sh 选项

| 选项 | 说明 |
|------|------|
| `--no-color` | 关闭彩色输出（适合重定向日志到文件） |
| `--quiet` | 只输出 FAIL/WARN，不输出 PASS（减少输出量） |
| `--strict` | WARN 也视为阻断上线（退出码 1） |
| `--env FILE` | 从 .env 文件读取 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS/DB_PREFIX |
| `--help` | 显示帮助 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_HOST` | `127.0.0.1` | 数据库主机 |
| `DB_PORT` | `3306` | 数据库端口 |
| `DB_NAME` | `shopxo` | 数据库名 |
| `DB_USER` | `root` | 数据库用户 |
| `DB_PASS` | （空） | 数据库密码 |
| `DB_PREFIX` | `sxo_` | 表前缀 |

## check-placeholders.sh 选项

| 选项 | 说明 |
|------|------|
| `--no-color` | 关闭彩色输出（适合重定向日志到文件） |
| `--docs-also` | 同时扫描 docs 目录中的占位符（默认只扫描代码和配置） |
| `--strict` | SQL 中的占位符也视为阻断上线（退出码 1） |
| `--help` | 显示帮助 |

路径参数为可选，默认为当前目录 `.`。选项和路径可按任意顺序排列。

### check-placeholders.sh 扫描规则

| 类别 | 扫描项 | 阻断级别 |
|------|--------|---------|
| 代码/配置 | `{{APP_ID}}`、`{{API_DOMAIN}}` 等 `{{...}}` 占位符 | FAIL |
| 代码/配置 | `400-000-0000`、`api.yunxi.com`、`cdn.yunxi.com`、`/var/www/yunxi` | FAIL |
| 代码/配置 | `shopxo_dev_123`、`root123456` 开发默认密码 | FAIL |
| 代码/配置 | manifest.json mp-weixin.appid 为空 | FAIL |
| 代码/配置 | .env 中 APP_DEBUG=true | FAIL |
| Nginx 配置 | server_name 为 localhost | WARN（不阻断） |
| SQL 文件 | `{{CONTACT_PHONE}}` 等 | WARN（`--strict` 时 FAIL） |
| 文档 | 所有占位符（`--docs-also` 时扫描） | WARN（不阻断） |

### check-placeholders.sh 排除规则

| 排除项 | 原因 |
|--------|------|
| `*/docs/*` | 文档中的占位符是示例说明，不是代码残留 |
| `*/node_modules/*` | 第三方依赖 |
| `*/.git/*` | 版本控制 |
| `*/uni_modules/*` | uni-app 插件 |
| `*/unpackage/*` | 构建产物 |
| `*/runtime/*` | 运行时缓存 |
| `*/vendor/*` | Composer 依赖 |
| `scripts/preflight/check-placeholders.sh` | 脚本自身包含占位符作为检测规则 |

### check-placeholders.sh 退出码

| 场景 | 退出码 | 含义 |
|------|:---:|------|
| 代码/配置无 FAIL，SQL 无命中或非 strict | 0 | 可以上线 |
| 代码/配置有 FAIL | 1 | 阻断上线 |
| SQL 有命中 + `--strict` | 1 | 阻断上线 |
| 文档有命中 | 0 | 不阻断（仅提醒） |

### check-placeholders.sh 执行示例

```bash
# 基本扫描（默认当前目录，只检查代码和配置）
bash check-placeholders.sh

# 指定仓库路径
bash check-placeholders.sh /path/to/repo

# 选项可放在路径前或后
bash check-placeholders.sh --no-color /path/to/repo
bash check-placeholders.sh /path/to/repo --no-color

# 同时扫描文档
bash check-placeholders.sh --docs-also

# 严格模式（SQL 占位符也阻断上线）
bash check-placeholders.sh --strict

# 组合使用
bash check-placeholders.sh --no-color --strict --docs-also /path/to/repo

# 无彩色输出 + 重定向日志（适合 CI/CD）
bash check-placeholders.sh --no-color . > placeholder-scan.log 2>&1
echo $?  # 0=通过 1=阻断

# 作为发布门禁使用
bash check-placeholders.sh --strict . && echo "可以发布" || echo "存在阻断项，不可发布"
```

### check-placeholders.sh 常见误用

| 误用 | 问题 | 正确写法 |
|------|------|---------|
| `bash check-placeholders.sh --no-color` | ✅ 正确，路径默认为 `.` | — |
| `bash check-placeholders.sh --strict` | ✅ 正确，路径默认为 `.` | — |
| `bash check-placeholders.sh --docs-also /tmp/repo` | ✅ 正确 | — |
| `bash check-placeholders.sh --unknown` | ❌ 报错退出码 1 | 使用 `--help` 查看选项 |
| 在 CI 中不使用 `--no-color` | 日志中出现乱码 | 加 `--no-color` |
| 期望文档占位符阻断上线 | 文档命中永远不阻断 | 文档占位符是示例，可保留 |

## 真实执行示例

### 示例1：标准检查

```bash
$ bash check-server.sh /var/www/yunxi/shopxo-backend

==========================================
 1. 基础环境
==========================================
[PASS] PHP 版本: 8.1.2 (≥8.0.2)
[PASS] MySQL 版本: 8.0 (≥5.6)
[PASS] Composer: Composer version 2.5.1 2023-09-01

==========================================
 4. 安全配置
==========================================
[PASS] install.php 已删除
[FAIL] APP_DEBUG = true | 修复: 修改 .env 中 APP_DEBUG=false

==========================================
 检查汇总
==========================================
  PASS: 18  WARN: 2  FAIL: 1  总计: 21

不建议上线 — 存在 1 个 FAIL 项，请按修复建议逐项处理。
```

### 示例2：静默模式 + 重定向日志

```bash
$ bash check-server.sh --no-color --quiet /var/www/yunxi/shopxo-backend > preflight.log 2>&1
$ echo $?
1
$ cat preflight.log
[FAIL] APP_DEBUG = true | 修复: 修改 .env 中 APP_DEBUG=false
[FAIL] 目录不可写: public/static/upload | 修复: chmod -R 755 ...

不建议上线 — 存在 2 个 FAIL 项，请按修复建议逐项处理。
```

### 示例3：严格模式（WARN 也阻断）

```bash
$ bash check-server.sh --strict /var/www/yunxi/shopxo-backend

==========================================
 检查汇总
==========================================
  PASS: 18  WARN: 2  FAIL: 0  总计: 20

不建议上线 (--strict) — 存在 2 个 WARN 项，--strict 模式下视为阻断。
```

### 示例4：从 .env 读取数据库连接

```bash
$ bash check-server.sh --env /var/www/yunxi/shopxo-backend/.env /var/www/yunxi/shopxo-backend
```

## 检查项清单

### check-server.sh 覆盖项

| 类别 | 检查项 | 阻断级别 |
|------|--------|---------|
| 基础环境 | PHP ≥8.0.2 | FAIL |
| 基础环境 | MySQL ≥5.6 | FAIL |
| 基础环境 | Composer 可用 | FAIL |
| PHP 扩展 | pdo_mysql, mbstring, curl, gd, openssl, json, xml | FAIL |
| PHP 扩展 | redis, bcmath（可选） | WARN |
| 目录权限 | runtime, upload, download, storage, rsakeys, resources | FAIL |
| 安全配置 | install.php 已删除 | FAIL |
| 安全配置 | APP_DEBUG = false | FAIL |
| 安全配置 | show_error_msg = false | FAIL |
| 安全配置 | 管理后台入口存在 | WARN |
| 数据库 | 连接成功 | FAIL |
| 数据库 | 必需表存在（7张） | FAIL |
| 数据库 | 关键字段存在（6个） | FAIL |
| 数据库 | 关键索引存在（2个） | FAIL |
| 配置项 | 6个关键配置项已插入 | FAIL |
| 数据完整性 | 邀请码空值 | WARN |
| 数据完整性 | 活动数据 | WARN |
| 数据完整性 | 妈妈说数据 | WARN |

### check-db.sql 覆盖项

| 类别 | 检查项 |
|------|--------|
| 必需表 | 7 张表是否存在 |
| 关键字段 | 9 个字段是否存在 |
| 关键索引 | 2 个唯一索引是否存在 |
| 配置项 | 6 个配置项是否存在且有值 |
| 数据完整性 | 邀请码空值、邀请奖励重复、活动数据、妈妈说数据 |
| 阶段筛选 | 备孕/孕期/产后分类关键词命中 |

## 结果判定与退出码

| 场景 | 退出码 | 最终建议 |
|------|:---:|---------|
| 全部 PASS | 0 | ✅ 可以上线 |
| 有 WARN 但无 FAIL | 0 | ⚠️ 建议修复后上线 |
| 有 WARN + `--strict` | 1 | ❌ 不建议上线 |
| 有 FAIL | 1 | ❌ 不建议上线 |

## 哪些问题会阻断上线

| # | FAIL 项 | 后果 | 修复方式 |
|---|---------|------|---------|
| 1 | PHP 版本不足 | 后端无法运行 | 升级 PHP |
| 2 | MySQL 版本不足 | SQL 语法报错 | 升级 MySQL |
| 3 | 必需 PHP 扩展缺失 | 功能异常 | `apt install php8.1-{ext}` |
| 4 | 目录不可写 | 上传/缓存失败 | `chmod/chown` |
| 5 | install.php 存在 | 安全风险 | `rm public/install.php` |
| 6 | APP_DEBUG = true | 暴露错误信息 | 修改 `.env` |
| 7 | 必需表缺失 | 功能不可用 | 执行 migration SQL A 段 |
| 8 | 关键字段缺失 | 功能报错 | 执行 migration SQL B 段 |
| 9 | 关键索引缺失 | 性能/数据一致性 | 执行 migration SQL C 段 |
| 10 | 邀请奖励配置缺失 | 奖励=0，伤害信任 | 执行 `yunxi-init-config.sql` |
| 11 | 商品分类无阶段关键词 | 阶段推荐返回空 | 创建含关键词的分类 |

## release-gate.sh — 一键发布门禁

### 执行流程

```
release-gate.sh
  ├── A. 占位符扫描 (check-placeholders.sh)
  │     检查代码/配置中的 {{...}} 占位符、开发默认值、空 AppID、APP_DEBUG 等
  ├── B. 服务器环境预检 (check-server.sh)
  │     检查 PHP/MySQL/扩展/权限/安全配置/数据库表结构
  ├── C. 数据库结构预检 (check-db.sql)
  │     检查必需表/字段/索引/配置项/数据完整性
  └── D. 汇总结论
        输出"可以发布 / 不建议发布" + 阻断项 + 建议修复项 + 下一步动作
```

### 选项

| 选项 | 说明 |
|------|------|
| `--repo PATH` | 仓库根目录（默认 `.`） |
| `--backend PATH` | 后端代码目录（默认 `.`） |
| `--env FILE` | 从 .env 文件读取数据库连接信息 |
| `--strict` | 严格模式：WARN 和 SQL 占位符也视为阻断 |
| `--no-color` | 关闭彩色输出（适合 CI/CD） |
| `--quiet` | 只输出 FAIL/WARN（传递给 check-server.sh） |
| `--skip-placeholders` | 跳过占位符扫描 |
| `--skip-server` | 跳过服务器环境预检 |
| `--skip-db` | 跳过数据库结构预检 |
| `--help` | 显示帮助 |

### 退出码

| 场景 | 退出码 | 结论 |
|------|:---:|------|
| 全 PASS | 0 | ✅ 可以进入发布流程 |
| 有 WARN 无 FAIL | 0 | ⚠️ 可以发布，但建议修复警告项 |
| 有 FAIL | 1 | ❌ 不建议发布 |

### 严格模式说明

`--strict` 模式下，以下情况也会导致退出码 1：

| 正常模式 | --strict 模式 |
|---------|-------------|
| SQL 占位符 → WARN（不阻断） | SQL 占位符 → FAIL（阻断） |
| 服务器 WARN 项 → 退出码 0 | 服务器 WARN 项 → 退出码 1 |

推荐在 CI/CD 和正式发布前使用 `--strict`。

### 执行示例

```bash
# 发布当天：在服务器上一条命令跑完全部预检
bash release-gate.sh --repo /var/www/yunxi --backend /var/www/yunxi/shopxo-backend --env /var/www/yunxi/shopxo-backend/.env

# 严格模式（推荐正式发布前使用）
bash release-gate.sh --strict --repo /var/www/yunxi --backend /var/www/yunxi/shopxo-backend

# 本地开发：只跑占位符扫描（跳过服务器和数据库）
bash release-gate.sh --skip-server --skip-db

# CI/CD：无彩色 + 严格 + 跳过数据库（CI 中可能无 mysql 客户端）
bash release-gate.sh --no-color --strict --skip-db --repo . --backend ./shopxo-backend
echo $?  # 0=可以发布 1=阻断

# 只跑服务器和数据库预检（跳过占位符扫描）
bash release-gate.sh --skip-placeholders --backend /var/www/yunxi/shopxo-backend --env /var/www/yunxi/shopxo-backend/.env

# 作为发布门禁（配合 go-live-runbook.md 使用）
bash release-gate.sh --strict --repo . --backend ./shopxo-backend && echo "✅ 门禁通过，可以发布" || echo "❌ 门禁未通过，不可发布"
```

### 输出示例

```
═══════════════════════════════════════════════════════════════
  孕禧小程序 — 一键发布门禁
═══════════════════════════════════════════════════════════════

  仓库路径:   /var/www/yunxi
  后端路径:   /var/www/yunxi/shopxo-backend
  严格模式:   否
  跳过项:     无

═══════════════════════════════════════════════════════════════
  A. 占位符残留扫描
═══════════════════════════════════════════════════════════════
  ...（占位符扫描详细输出）...
  [PASS] 占位符扫描通过

═══════════════════════════════════════════════════════════════
  B. 服务器环境预检
═══════════════════════════════════════════════════════════════
  ...（服务器预检详细输出）...
  [PASS] 服务器预检全部通过

═══════════════════════════════════════════════════════════════
  C. 数据库结构预检
═══════════════════════════════════════════════════════════════
  ...（数据库预检详细输出）...
  [PASS] 数据库预检全部通过

═══════════════════════════════════════════════════════════════
  发布门禁 — 最终结论
═══════════════════════════════════════════════════════════════

  执行耗时:   12 秒
  通过项:     3
  警告项:     0
  阻断项:     0

  结论: 可以进入发布流程

  下一步动作:
    1. 按 go-live-runbook.md 执行发布
    2. 发布后 1 小时内运行真机验证
    3. 发布后 24 小时检查运营数据

退出码: 0
```
