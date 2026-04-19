# 孕禧小程序 — 上线前预检脚本

## 文件说明

| 文件 | 用途 | 执行方式 |
|------|------|---------|
| `check-server.sh` | 服务器环境+数据库全量预检 | `bash check-server.sh [选项] [/path/to/backend]` |
| `check-placeholders.sh` | 占位符残留扫描 | `bash check-placeholders.sh [选项] [/path/to/repo]` |
| `check-db.sql` | 纯数据库结构预检 | `mysql -u root -p shopxo < check-db.sql` |

## 快速开始

### 基本用法

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
| `--strict` | SQL 中的占位符也视为阻断上线 |
| `--help` | 显示帮助 |

### check-placeholders.sh 扫描规则

| 类别 | 扫描项 | 阻断级别 |
|------|--------|---------|
| 代码/配置 | `{{APP_ID}}`、`{{API_DOMAIN}}` 等 `{{...}}` 占位符 | FAIL |
| 代码/配置 | `400-000-0000`、`api.yunxi.com`、`cdn.yunxi.com`、`/var/www/yunxi` | FAIL |
| 代码/配置 | `shopxo_dev_123`、`root123456` 开发默认密码 | FAIL |
| 代码/配置 | manifest.json mp-weixin.appid 为空 | FAIL |
| 代码/配置 | .env 中 APP_DEBUG=true | FAIL |
| Nginx 配置 | server_name 为 localhost | WARN |
| SQL 文件 | `{{CONTACT_PHONE}}` 等 | WARN（`--strict` 时 FAIL） |
| 文档 | 所有占位符（`--docs-also` 时扫描） | WARN |

### check-placeholders.sh 执行示例

```bash
# 基本扫描（只检查代码和配置）
bash check-placeholders.sh .

# 同时扫描文档
bash check-placeholders.sh --docs-also .

# 严格模式（SQL 占位符也阻断上线）
bash check-placeholders.sh --strict .

# 无彩色输出 + 重定向日志
bash check-placeholders.sh --no-color . > placeholder-scan.log 2>&1
```

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
