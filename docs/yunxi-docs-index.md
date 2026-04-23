# 孕禧小程序 — 上线相关文档入口

## 核心文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 最终上线 SQL | [docs/muying-final-migration.sql](muying-final-migration.sql) | 数据库建表+补丁+索引，唯一真相源 |
| 正式部署手册 | [docs/yunxi-production-deployment.md](yunxi-production-deployment.md) | 服务器部署全流程，照着执行 |
| 宝塔部署与回滚手册 | [docs/release/bt-deploy-rollback-guide.md](release/bt-deploy-rollback-guide.md) | 宝塔+Nginx+HTTPS+安全加固+回滚步骤 |
| 首批内容清单 | [docs/yunxi-launch-content-checklist.md](yunxi-launch-content-checklist.md) | 后台初始化内容，照着配置 |
| 首页内容填写模板 | [docs/templates/yunxi-home-content-template.md](templates/yunxi-home-content-template.md) | 后台人工填写操作模板 |
| 一期验收测试清单 | [docs/release/uat-acceptance-checklist.md](release/uat-acceptance-checklist.md) | 发布前 11 模块验收测试项+自动化脚本 |
| RC 封板前总检查报告 | [docs/release/rc-gate-report.md](release/rc-gate-report.md) | 代码完成度+不一致修复+剩余阻塞项 |
| 正式上线前人工配置清单 | [docs/release/pre-launch-config-checklist.md](release/pre-launch-config-checklist.md) | 所有需人工填写的配置项汇总 |
| 后台菜单注册迁移 | [docs/muying-admin-power-migration.sql](muying-admin-power-migration.sql) | 注册孕禧运营菜单到后台 |

## 初始化 SQL 脚本

| 脚本 | 路径 | 用途 | 可重复执行 |
|------|------|------|:-:|
| 自定义配置项 | [docs/sql/yunxi-init-config.sql](sql/yunxi-init-config.sql) | 邀请奖励/品牌/登录/搜索配置 | ✅ |
| 活动演示数据 | [docs/sql/yunxi-init-activity-demo.sql](sql/yunxi-init-activity-demo.sql) | 6条活动样例，覆盖4阶段5分类 | ✅ |
| 妈妈说演示数据 | [docs/sql/yunxi-init-feedback-demo.sql](sql/yunxi-init-feedback-demo.sql) | 5条反馈样例，覆盖3阶段 | ✅ |

## 执行顺序

1. `muying-final-migration.sql`（A→B→C 段，按段内顺序）
2. `yunxi-init-config.sql`（配置项初始化）
3. `yunxi-init-activity-demo.sql`（活动演示数据，可选）
4. `yunxi-init-feedback-demo.sql`（妈妈说演示数据，可选）
5. 后台人工配置（参考 `yunxi-home-content-template.md`）

## MySQL 版本要求

- 最低：MySQL 5.6+（utf8mb4）
- 推荐：MySQL 5.7+ / 8.0
- 所有 SQL 已兼容 5.6+，不依赖 `ADD COLUMN IF NOT EXISTS` 等仅 8.0+ 支持的语法

## 已废弃的旧文件

以下文件已合并到 `muying-final-migration.sql`，**不要直接执行**：

- `docs/muying-migration.sql`
- `docs/muying-mvp-migration.sql`
- `docs/muying-invite-code-migration.sql`
- `docs/muying-invite-idempotent-migration.sql`
- `docs/muying-enum-normalize-migration.sql`
- `shopxo-backend/sql/muying_feedback.sql`

## 项目结构

```
├── shopxo-backend/          # 后端（ThinkPHP）
├── shopxo-uniapp/           # 前端（uni-app 微信小程序）
└── docs/                    # 文档与 SQL
    ├── muying-final-migration.sql       # 最终上线 SQL
    ├── yunxi-production-deployment.md   # 部署手册
    ├── yunxi-launch-content-checklist.md # 内容清单
    ├── sql/                             # 初始化 SQL 脚本
    │   ├── yunxi-init-config.sql        # 配置项初始化
    │   ├── yunxi-init-activity-demo.sql # 活动演示数据
    │   └── yunxi-init-feedback-demo.sql # 妈妈说演示数据
    └── templates/                       # 内容填写模板
        └── yunxi-home-content-template.md # 首页内容模板
```
