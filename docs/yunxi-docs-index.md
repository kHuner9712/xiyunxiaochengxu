# 孕禧小程序 — 文档索引

> 最后更新：2026-04-25
> 本索引只保留当前发布链路中真正有用的文档入口

---

## 〇、上线前必读文档（按顺序阅读）

| 序号 | 文档 | 路径 | 必读原因 |
|:---:|------|------|---------|
| 1 | 一期允许功能范围 | [docs/compliance/phase-one-scope.md](compliance/phase-one-scope.md) | 明确一期合规边界，哪些能做哪些不能做 |
| 2 | 一期禁用功能清单 | [docs/compliance/disabled-features.md](compliance/disabled-features.md) | 前后端双重拦截机制，禁用插件清单 |
| 3 | 隐私数据映射表 | [docs/compliance/privacy-data-map.md](compliance/privacy-data-map.md) | 母婴资料字段合规说明，收集目的/删除方式 |
| 4 | 宝塔+Nginx 生产部署检查清单 | [docs/deploy/bt-nginx-production-checklist.md](deploy/bt-nginx-production-checklist.md) | 部署逐项检查，环境/安全/微信/功能开关 |
| 5 | 上线前检查脚本 | `scripts/preflight/preflight-production-check.sh` | 一键检查生产配置安全性 |

---

## 一、发布链路文档（执行文档，按流程顺序）

| 序号 | 文档 | 路径 | 用途 | 类型 |
|:---:|------|------|------|:---:|
| 1 | 体验版部署 Runbook | [docs/release/experience-deploy-runbook.md](release/experience-deploy-runbook.md) | 7 步一键部署体验版 | 执行 |
| 2 | 体验版上线执行清单 | [docs/release/experience-version-launch-checklist.md](release/experience-version-launch-checklist.md) | 5 阶段详细版清单，首次部署逐项确认 | 执行 |
| 3 | 后台首次登录配置清单 | [docs/release/admin-first-login-checklist.md](release/admin-first-login-checklist.md) | 后端部署后 11 步配置 | 执行 |
| 4 | 运营首批数据模板 | [docs/release/seed-content-template.md](release/seed-content-template.md) | 活动/商品/文章/妈妈说录入示例 | 执行 |
| 5 | 体验版 Smoke Test | [docs/release/experience-smoke-test.md](release/experience-smoke-test.md) | 18 步核心链路验收 | 执行 |
| 6 | 提审切换 Runbook | [docs/release/submit-switch-runbook.md](release/submit-switch-runbook.md) | 从体验版切到提审版 8 步 | 执行 |
| 7 | 提审材料准备清单 | [docs/release/submission-materials-checklist.md](release/submission-materials-checklist.md) | 服务类目/隐私/截图/测试账号/客服 | 执行 |
| 8 | 宝塔部署与回滚手册 | [docs/release/bt-deploy-rollback-guide.md](release/bt-deploy-rollback-guide.md) | 宝塔+Nginx+HTTPS+安全加固+回滚 | 参考 |
| 9 | 数据库迁移执行顺序 | [docs/release/db-migration-order.md](release/db-migration-order.md) | SQL 执行顺序+一键脚本+验证 | 执行 |
| 10 | 正式上线前人工配置清单 | [docs/release/pre-launch-config-checklist.md](release/pre-launch-config-checklist.md) | 三阶段配置项 | 执行 |
| 11 | UAT 最终验收清单 | [docs/release/uat-final-checklist.md](release/uat-final-checklist.md) | 真机验收 16 大类 24 阻断项 | 执行 |
| 12 | 数据看板指标口径 | [docs/release/dashboard-metrics-spec.md](release/dashboard-metrics-spec.md) | 6 大分区 25+ 指标口径定义 | 参考 |

## 二、合规文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 一期允许功能范围 | [docs/compliance/phase-one-scope.md](compliance/phase-one-scope.md) | 一期合规边界：允许/禁止功能清单 |
| 隐私数据映射表 | [docs/compliance/privacy-data-map.md](compliance/privacy-data-map.md) | 母婴资料字段收集目的/使用场景/删除方式 |
| 一期禁用功能清单 | [docs/compliance/disabled-features.md](compliance/disabled-features.md) | 前后端双重拦截机制、禁用插件与功能开关映射 |

## 三、部署文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 宝塔+Nginx 生产部署检查清单 | [docs/deploy/bt-nginx-production-checklist.md](deploy/bt-nginx-production-checklist.md) | PHP/MySQL/Nginx/HTTPS/安全/微信/功能开关逐项检查 |

## 四、报告文档（只读参考）

| 文档 | 路径 | 用途 | 类型 |
|------|------|------|:---:|
| RC 封板前总检查报告 | [docs/release/rc-gate-report.md](release/rc-gate-report.md) | 代码完成度+死角排查+真实阻塞项+技术状态+部署步骤 | 报告 |
| RC Release Notes | [docs/release/rc-release-notes.md](release/rc-release-notes.md) | v0.1.0-rc1 功能亮点+合规边界+部署步骤+回滚方式 | 报告 |

## 五、数据库迁移 SQL（执行顺序见 db-migration-order.md）

### 主链路 SQL（必须按顺序执行，共 11 步）

> 除 shopxo.sql 和 muying-final-migration.sql 外，其余迁移均为幂等迁移，部署脚本会直接执行，执行后统一验证。

| 序号 | 文件 | 路径 | 用途 | 可重复 |
|:---:|------|------|------|:---:|
| 1 | shopxo.sql | `shopxo-backend/config/shopxo.sql` | ShopXO 主库初始化 | ❌ |
| 2 | muying-final-migration.sql | [docs/muying-final-migration.sql](muying-final-migration.sql) | 孕禧核心表+补丁+索引（唯一真相源） | ❌ |
| 3 | muying-feature-switch-migration.sql | [docs/sql/muying-feature-switch-migration.sql](sql/muying-feature-switch-migration.sql) | 功能开关完整初始化+资质门禁 | ✅ |
| 4 | muying-feedback-review-migration.sql | [docs/muying-feedback-review-migration.sql](muying-feedback-review-migration.sql) | 反馈审核字段 | ✅ |
| 5 | muying-invite-reward-unify-migration.sql | [docs/muying-invite-reward-unify-migration.sql](muying-invite-reward-unify-migration.sql) | 邀请奖励统一 | ✅ |
| 6 | muying-privacy-security-migration.sql | [docs/sql/muying-privacy-security-migration.sql](sql/muying-privacy-security-migration.sql) | 隐私安全字段+审计日志表 | ✅ |
| 7 | muying-goods-compliance-migration.sql | [docs/sql/muying-goods-compliance-migration.sql](sql/muying-goods-compliance-migration.sql) | 商品合规字段 | ✅ |
| 8 | muying-activity-upgrade-migration.sql | [docs/muying-activity-upgrade-migration.sql](muying-activity-upgrade-migration.sql) | 活动升级（候补/签到码） | ✅ |
| 9 | muying-feature-flag-upgrade-migration.sql | [docs/muying-feature-flag-upgrade-migration.sql](muying-feature-flag-upgrade-migration.sql) | 功能开关升级补丁（v2 开关） | ✅ |
| 10 | muying-admin-power-migration.sql | [docs/muying-admin-power-migration.sql](muying-admin-power-migration.sql) | 后台菜单权限（700-760） | ✅ |
| 11 | muying-compliance-center-migration.sql | [docs/sql/muying-compliance-center-migration.sql](sql/muying-compliance-center-migration.sql) | 合规中心菜单（770-775）+合规日志 | ✅ |

### 演示数据 SQL（可选）

| 文件 | 路径 | 用途 |
|------|------|------|
| yunxi-init-config.sql | [docs/sql/yunxi-init-config.sql](sql/yunxi-init-config.sql) | 配置项初始化 |
| yunxi-init-activity-demo.sql | [docs/sql/yunxi-init-activity-demo.sql](sql/yunxi-init-activity-demo.sql) | 活动演示数据 |
| yunxi-init-feedback-demo.sql | [docs/sql/yunxi-init-feedback-demo.sql](sql/yunxi-init-feedback-demo.sql) | 妈妈说演示数据 |

## 六、自动化脚本

### 部署脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| bootstrap-backend.sh | `scripts/deploy/bootstrap-backend.sh` | 一键部署后端 |
| run-migrations.sh | `scripts/deploy/run-migrations.sh` | 一键执行数据库迁移 |
| fix-permissions.sh | `scripts/deploy/fix-permissions.sh` | 修复目录权限 |
| post-deploy-check.sh | `scripts/deploy/post-deploy-check.sh` | 部署后自动验收 |
| rollback-guide.sh | `scripts/deploy/rollback-guide.sh` | 回滚 |

### 预检脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| run-rc-gate.sh | `scripts/preflight/run-rc-gate.sh` | RC 门禁一键检查 |
| **preflight-production-check.sh** | `scripts/preflight/preflight-production-check.sh` | **上线前生产环境检查（APP_DEBUG/HTTPS/功能开关/测试AppID/风险配置）** |
| preflight-production-check.php | `scripts/preflight/preflight-production-check.php` | 上线前检查 PHP 版（Windows 友好） |
| check-release-placeholders.sh | `scripts/preflight/check-release-placeholders.sh` | 发布占位符与配置值检查 |
| check-wechat-submit-readiness.sh | `scripts/preflight/check-wechat-submit-readiness.sh` | 提审就绪检查 |
| check-server.sh | `scripts/preflight/check-server.sh` | 服务器环境预检 |
| check-runtime-config.sh | `scripts/preflight/check-runtime-config.sh` | 运行时配置检查 |
| check-admin-bootstrap.sh | `scripts/preflight/check-admin-bootstrap.sh` | 后台初始化检查 |
| **check-db-schema-readiness.sh** | `scripts/preflight/check-db-schema-readiness.sh` | **数据库 Schema 就绪检查（字段/表/配置/菜单/ID冲突）** |

### 预检脚本使用说明

```bash
# 上线前一键检查（推荐，Shell 版）
bash scripts/preflight/preflight-production-check.sh --env /www/wwwroot/yunxi/.env --repo /path/to/repo

# 上线前一键检查（Windows/PHP 版）
php scripts/preflight/preflight-production-check.php --env=shopxo-backend/.env

# RC 门禁完整检查
bash scripts/preflight/run-rc-gate.sh --mode=submit --env /www/wwwroot/yunxi/.env .
```

## 七、已归档文档

以下文档已移至 `docs/archive/`，不在当前发布链路中，仅供参考：

| 归档目录 | 内容 | 说明 |
|----------|------|------|
| `docs/archive/deployment/` | 旧部署文档 | 已被 bt-deploy-rollback-guide.md 替代 |
| `docs/archive/design/` | 设计文档 | 阶段性设计说明，开发参考 |
| `docs/archive/guides/` | 旧指南+项目总览 | 历史开发文档，含项目结构/本地启动/已知问题等 |
| `docs/archive/release/` | 旧发布文档 | 已被 release/ 下新文档替代 |
| `docs/archive/retro/` | 整改说明 | 历史整改记录 |
| `docs/archive/sql/` | 旧迁移 SQL | 已合并到 muying-final-migration.sql |

## 八、MySQL 版本要求

- 最低：MySQL 5.6+（utf8mb4）
- 推荐：MySQL 5.7+ / 8.0
- 所有 SQL 已兼容 5.6+，不依赖 `ADD COLUMN IF NOT EXISTS` 等仅 8.0+ 支持的语法

## 九、项目结构

```
├── shopxo-backend/              # 后端（ThinkPHP）
├── shopxo-uniapp/               # 前端（uni-app 微信小程序）
├── scripts/
│   ├── deploy/                  # 部署脚本（5 个）
│   └── preflight/               # 预检脚本（9 个 + 测试）
├── docs/
│   ├── muying-final-migration.sql         # 核心迁移 SQL（唯一真相源）
│   ├── muying-*-migration.sql             # 增量迁移 SQL（5 个）
│   ├── yunxi-docs-index.md                # 本索引
│   ├── compliance/                        # 合规文档（3 个）
│   │   ├── phase-one-scope.md             # 一期允许功能范围
│   │   ├── privacy-data-map.md            # 隐私数据映射表
│   │   └── disabled-features.md           # 一期禁用功能清单
│   ├── deploy/                            # 部署文档（1 个）
│   │   └── bt-nginx-production-checklist.md  # 宝塔生产部署检查清单
│   ├── release/                           # 发布链路文档（12 个）
│   ├── sql/                               # 迁移+演示数据 SQL（4 个）
│   └── archive/                           # 已归档文档
│       ├── deployment/                    # 旧部署文档
│       ├── design/                        # 设计文档
│       ├── guides/                        # 旧指南
│       ├── release/                       # 旧发布文档
│       ├── retro/                         # 整改说明
│       └── sql/                           # 旧迁移 SQL
├── deploy/                      # Nginx 生产配置示例
└── docker/                      # Docker 开发环境配置
```
