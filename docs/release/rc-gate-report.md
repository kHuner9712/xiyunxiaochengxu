# RC 封板报告 — 禧孕母婴自营商城一期 v0.1.0-rc1

> 项目：禧孕母婴自营商城一期  
> 版本：v0.1.0-rc1  
> 封板日期：2026-04-25  
> 仓库：https://github.com/kHuner9712/xiyun  
> 结论：**代码层面已封板，体验版可立即部署；提审需等待正式 AppID + 备案域名**

---

## 一、版本定位

禧孕母婴自营商城一期，包含以下核心功能：

| 功能模块 | 说明 | 状态 |
|----------|------|------|
| 母婴自营商城 | 品牌自营商品浏览、下单、支付（支付需商户号） | ✅ 已完成 |
| 官方活动报名 | 活动列表/详情/报名/取消/候补/签到核销 | ✅ 已完成 |
| 基础会员画像 | 孕育阶段设置（备孕/孕期/产后）、预产期、宝宝生日、月龄计算 | ✅ 已完成 |
| 一级邀请 | 邀请码生成、分享注册、首单奖励、奖励补发/撤销 | ✅ 已完成 |
| 审核制妈妈说/反馈 | 用户提交反馈、后台审核、敏感词拦截、前端展示 | ✅ 已完成 |
| 合规中心 | 隐私数据加密/脱敏、资质门禁、功能开关、导出审计 | ✅ 已完成 |
| 后台数据看板 | 6 大分区 25+ 指标、时间范围筛选、空数据兼容 | ✅ 已完成 |
| 首页阶段推荐 | 按用户阶段推荐商品/活动/内容 | ✅ 已完成 |
| 功能开关中心 | 前后端双重拦截、5 个核心开关 | ✅ 已完成 |

---

## 二、一期明确禁用功能

以下功能在一期中**已通过前后端双重拦截禁用**，不可使用：

| 禁用功能 | 拦截方式 | 说明 |
|----------|----------|------|
| 第三方商家入驻 | 功能开关 + API 守卫 + 路由拦截 | ShopXO 多商户插件已关闭 |
| 多门店/门店入驻 | 功能开关 + API 守卫 + 路由拦截 | realstore 插件已关闭 |
| 多级分销 | 功能开关 + API 守卫 + 路由拦截 | distribution 插件已关闭 |
| 钱包/余额/提现 | 功能开关 + API 守卫 + 路由拦截 | wallet/coin 插件已关闭 |
| UGC 社区 | 功能开关 + API 守卫 + 路由拦截 | ask/blog 插件已关闭 |
| 医疗问诊 | 功能开关 + API 守卫 + 路由拦截 | hospital 插件已关闭 |
| 直播/视频 | 功能开关 + API 守卫 + 路由拦截 | weixinliveplayer/video 插件已关闭 |
| 付费会员 | 功能开关 + API 守卫 + 路由拦截 | membershiplevelvip 插件已关闭 |
| 礼品卡 | 功能开关 + API 守卫 + 路由拦截 | giftcard/givegift 插件已关闭 |
| 高风险商品类目 | 资质门禁 + 商品上架拦截 | 一期宽松模式，二期严格模式 |

> 拦截机制详情见 [docs/compliance/disabled-features.md](../compliance/disabled-features.md)

---

## 三、必须人工确认项

以下项目无法通过代码自动完成，**必须人工确认后才能进入下一阶段**：

### 3.1 体验版前必须确认

| 序号 | 确认项 | 负责人 | 当前状态 |
|------|--------|--------|----------|
| 1 | 测试号 AppID 已填入 manifest.json + project.config.json | 开发 | ⬜ 待确认 |
| 2 | 后端 .env 数据库连接信息已填入 | 开发 | ⬜ 待确认 |
| 3 | 后台管理员默认密码已修改 | 运营 | ⬜ 待确认 |
| 4 | 客服电话已配置 | 运营 | ⬜ 待确认 |
| 5 | 功能开关已确认（activity/invite/feedback/content 开启） | 运营 | ⬜ 待确认 |
| 6 | 首批内容已录入（≥1 活动 + ≥2 商品 + ≥1 文章） | 运营 | ⬜ 待确认 |

### 3.2 提审前必须确认

| 序号 | 确认项 | 负责人 | 当前状态 |
|------|--------|--------|----------|
| 1 | **域名备案通过** | 运营 | ⬜ 待确认 |
| 2 | **HTTPS 证书部署** | 开发 | ⬜ 待确认 |
| 3 | **微信正式 AppID** | 运营 | ⬜ 待确认 |
| 4 | **微信合法域名已配置** | 运营 | ⬜ 待确认 |
| 5 | **商户号/支付配置** | 运营 | ⬜ 待确认 |
| 6 | **用户协议/隐私协议** 内容完整且与微信后台一致 | 运营 | ⬜ 待确认 |
| 7 | **客服入口** 可用 | 运营 | ⬜ 待确认 |
| 8 | **测试账号** 已准备 | 运营 | ⬜ 待确认 |
| 9 | **小程序服务类目** 已选择 | 运营 | ⬜ 待确认 |
| 10 | APP_DEBUG 已关闭 | 开发 | ⬜ 待确认 |
| 11 | install.php 已删除 | 开发 | ⬜ 待确认 |
| 12 | 后台入口已重命名 | 开发 | ⬜ 待确认 |

---

## 四、技术状态

### 4.1 运行环境要求

| 组件 | 最低版本 | 推荐版本 | 当前服务器版本 |
|------|----------|----------|----------------|
| PHP | 8.0+ | 8.1.x | 8.1.32 ✅ |
| MySQL | 5.6+ (utf8mb4) | 5.7+ / 8.0 | 5.7.44 ✅ |
| Nginx | 1.20+ | 1.24+ | 1.28.1 ✅ |
| 宝塔面板 | 7.x+ | 最新正式版 | 已安装 ✅ |

### 4.2 PHP 扩展要求

| 扩展 | 必需 | 说明 |
|------|------|------|
| openssl | ✅ | 支付/加密 |
| pdo_mysql | ✅ | 数据库驱动 |
| mbstring | ✅ | 字符处理 |
| json | ✅ | JSON 编解码 |
| gd | ✅ | 图片处理 |
| curl | ✅ | HTTP 请求 |
| redis | 建议 | 缓存（未安装则使用文件缓存） |

### 4.3 Nginx 配置要求

- root 指向 `shopxo-backend/public`
- 支持 ThinkPHP 伪静态（try_files）
- 禁止访问 .env / .git / runtime / vendor / config / composer
- 上传目录禁止执行 PHP
- HTTPS 配置（提审/正式阶段必须）
- 详见 [deploy/nginx.production.example.conf](../../deploy/nginx.production.example.conf)

### 4.4 SQL 迁移顺序

> 除 shopxo.sql 和 muying-final-migration.sql 外，其余迁移均为幂等迁移，部署脚本会直接执行，执行后统一验证。

| 序号 | SQL 文件 | 位置 | 用途 | 可否重复 |
|------|----------|------|------|---------|
| 1 | `shopxo.sql` | `shopxo-backend/config/shopxo.sql` | ShopXO 主库初始化（含 DROP TABLE） | ❌ |
| 2 | `muying-final-migration.sql` | `docs/muying-final-migration.sql` | 禧孕核心表+补丁+索引 | ❌ |
| 3 | `muying-feature-switch-migration.sql` | `docs/sql/muying-feature-switch-migration.sql` | 功能开关完整初始化+资质门禁 | ✅ 幂等 |
| 4 | `muying-feedback-review-migration.sql` | `docs/muying-feedback-review-migration.sql` | 反馈审核字段 | ✅ 幂等 |
| 5 | `muying-invite-reward-unify-migration.sql` | `docs/muying-invite-reward-unify-migration.sql` | 邀请奖励统一 | ✅ 幂等 |
| 6 | `muying-privacy-security-migration.sql` | `docs/sql/muying-privacy-security-migration.sql` | 隐私安全字段+审计日志表 | ✅ 幂等 |
| 7 | `muying-goods-compliance-migration.sql` | `docs/sql/muying-goods-compliance-migration.sql` | 商品合规字段 | ✅ 幂等 |
| 8 | `muying-activity-upgrade-migration.sql` | `docs/muying-activity-upgrade-migration.sql` | 活动升级（候补/签到码） | ✅ 幂等 |
| 9 | `muying-feature-flag-upgrade-migration.sql` | `docs/muying-feature-flag-upgrade-migration.sql` | 功能开关升级补丁（v2 开关） | ✅ 幂等 |
| 10 | `muying-admin-power-migration.sql` | `docs/muying-admin-power-migration.sql` | 后台菜单权限（700-760） | ✅ 幂等 |
| 11 | `muying-compliance-center-migration.sql` | `docs/sql/muying-compliance-center-migration.sql` | 合规中心菜单（770-775）+合规日志 | ✅ 幂等 |

> 详细执行命令和验证方式见 [db-migration-order.md](db-migration-order.md)

### 4.5 环境变量配置

#### 后端 `shopxo-backend/.env`

| 变量 | 说明 | 体验版 | 提审/正式 |
|------|------|--------|-----------|
| APP_DEBUG | 调试开关 | true | **必须 false** |
| DATABASE.TYPE | 数据库类型 | mysql | mysql |
| DATABASE.HOSTNAME | 数据库主机 | 填入实际值 | 填入实际值 |
| DATABASE.DATABASE | 数据库名 | 填入实际值 | 填入实际值 |
| DATABASE.USERNAME | 数据库用户（不要用 root） | 填入实际值 | 填入实际值 |
| DATABASE.PASSWORD | 数据库密码 | 填入实际值 | 填入实际值 |
| DATABASE.HOSTPORT | 数据库端口 | 3306 | 3306 |
| DATABASE.CHARSET | 字符集 | utf8mb4 | utf8mb4 |
| DATABASE.PREFIX | 表前缀 | sxo_ | sxo_ |
| MUYING_QUALIFICATION_MODE | 资质门禁模式 | phase_one | phase_one |
| MUYING_PRIVACY_KEY | 隐私加密密钥（**必填，缺失会阻断敏感数据写入**） | 生成 64 位 hex | 同左 |

#### 前端 `shopxo-uniapp/.env.production`

| 变量 | 说明 | 体验版 | 提审/正式 |
|------|------|--------|-----------|
| UNI_APP_ENV | 环境标识 | production | production |
| UNI_APP_REQUEST_URL | API 地址 | `http://服务器IP/` | **`https://备案域名/`** |
| UNI_APP_STATIC_URL | 静态资源地址 | 同上 | 同上 |
| UNI_APP_WX_APPID | 微信 AppID | 测试号 AppID | **正式 AppID** |

> 模板文件见 `shopxo-backend/.env.production.example` 和 `shopxo-uniapp/.env.production.example`

### 4.6 预检脚本使用方式

```bash
# 一键生产环境检查（推荐）
bash scripts/preflight/preflight-production-check.sh --env /www/wwwroot/xiyun/.env --repo /path/to/repo

# Windows/PHP 版
php scripts/preflight/preflight-production-check.php --env=shopxo-backend/.env

# RC 门禁完整检查
bash scripts/preflight/run-rc-gate.sh --mode=experience --env /www/wwwroot/xiyun/.env .

# 提审就绪检查
bash scripts/preflight/check-wechat-submit-readiness.sh .
```

---

## 五、宝塔部署步骤摘要

> 完整步骤见 [experience-version-launch-checklist.md](experience-version-launch-checklist.md) 和 [experience-deploy-runbook.md](experience-deploy-runbook.md)

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 宝塔创建网站+数据库 | 域名填测试域名或 IP，数据库字符集 utf8mb4 |
| 2 | 上传后端代码 | git clone → 复制到站点目录 |
| 3 | 配置 .env | 复制 .env.production.example → 填入数据库连接 |
| 4 | 导入 SQL | 按 4.4 顺序执行 11 个 SQL 文件 |
| 5 | 安装依赖+权限 | composer install + fix-permissions.sh |
| 6 | Nginx 配置 | 参照 nginx.production.example.conf |
| 7 | 验证后端 | 访问 API 返回 JSON + 后台可登录 |
| 8 | 后台配置 | 菜单注册+客服电话+功能开关+首批内容 |
| 9 | 前端构建 | 配置 AppID + API 地址 → HBuilderX 编译上传 |
| 10 | 体验版验收 | Smoke Test + 功能开关验收 |

---

## 六、小程序测试号与正式 AppID 切换步骤

> 完整步骤见 [submit-switch-runbook.md](submit-switch-runbook.md)

| 步骤 | 操作 | 涉及文件/位置 |
|------|------|---------------|
| 1 | 获取正式 AppID | 微信公众平台 → 开发管理 |
| 2 | 替换 manifest.json appid | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` |
| 3 | 替换 project.config.json appid | `shopxo-uniapp/project.config.json` → `appid` |
| 4 | 替换 .env.production AppID | `shopxo-uniapp/.env.production` → `UNI_APP_WX_APPID` |
| 5 | 替换后端 AppSecret | 后台 → 小程序配置 |
| 6 | API 地址改 HTTPS 域名 | `shopxo-uniapp/.env.production` → `UNI_APP_REQUEST_URL` |
| 7 | 配置微信合法域名 | 微信公众平台 → 开发设置 → 服务器域名 |
| 8 | 关闭 APP_DEBUG | `shopxo-backend/.env` → `APP_DEBUG = false` |
| 9 | 删除 install.php | `shopxo-backend/public/install.php` |
| 10 | 重命名后台入口 | `shopxo-backend/public/admin.php` |
| 11 | 重新编译上传 | HBuilderX → 发行 → 小程序-微信 |

---

## 七、已知风险和限制

### 7.1 已知代码限制（不影响提审）

| 问题 | 等级 | 说明 |
|------|------|------|
| 120+ 个插件页面未在 pages.json 注册 | P2 | 一期路由守卫会拦截，不会导航到这些页面 |
| 15+ 个用户页面缺少显式登录检查 | P2 | API 层 is_login_check 兜底 |
| chooseAvatar 按钮 @tap 和 open-type 可能双重触发 | P2 | 实际测试未发现重复调用 |
| CheckFeatureEnabled 使用 exit() 硬终止 | P3 | 已改为 ApiExit() 统一响应，使用 HttpResponseException |
| MuyingPrivacyService::CanViewSensitive 权限过宽 | P3 | 二期增加角色检查 |

### 7.2 外部阻塞项

| 阻塞项 | 阻塞阶段 | 预计耗时 |
|--------|----------|----------|
| 正式微信小程序 AppID | 提审 | 1-3 天 |
| ICP 域名备案 | 提审 | 7-20 天 |
| 微信公众平台隐私保护指引 | 提审 | 30 分钟 |
| 微信公众平台合法域名 | 提审 | 30 分钟 |
| 微信支付商户号 | 正式发布 | 3-7 天 |

### 7.3 合规风险

| 风险 | 缓解措施 |
|------|----------|
| 提审时功能描述触发敏感词 | 提审材料禁用"平台入驻/社区/医疗/直播/分销/钱包"等词 |
| 高风险功能前端隐藏但后端仍可调用 | 已实现 API 守卫 + 路由拦截双重拦截 |
| 隐私数据泄露 | 已实现 AES-256-CBC 加密 + 脱敏展示 + fail-closed（密钥缺失时拒绝写入） |

---

## 八、GitHub Release 草稿

> 版本号：v0.1.0-rc1  
> 完整 Release Notes 见 [rc-release-notes.md](rc-release-notes.md)

### 功能亮点

- 🛒 母婴自营商城：商品浏览、下单、支付
- 📋 官方活动报名：报名/候补/签到核销
- 👤 基础会员画像：备孕/孕期/产后阶段设置、预产期、宝宝月龄
- 🔗 一级邀请裂变：邀请码、首单奖励、奖励管理
- 💬 审核制妈妈说/反馈：后台审核、敏感词拦截
- 🛡️ 合规中心：隐私加密/脱敏、资质门禁、功能开关
- 📊 后台数据看板：6 大分区 25+ 指标、时间范围筛选

### 合规边界

- 一期仅支持自营商品，不支持第三方商家入驻
- 一期仅支持一级邀请，不支持多级分销
- 反馈为审核制，非 UGC 公开社区
- 无医疗问诊、无直播/视频、无钱包/提现

### 部署步骤

1. 宝塔创建网站+数据库
2. 上传代码+配置 .env
3. 按顺序执行 11 个 SQL 迁移
4. composer install + 权限修复
5. Nginx 配置（参照示例）
6. 后台配置+录入内容
7. 前端编译上传

### 已知限制

- 支付功能需商户号（体验版可跳过）
- 提审需备案域名+正式 AppID
- 部分插件页面未注册（路由守卫已拦截）

### 回滚方式

```bash
# 数据库回滚
mysql -u USER -p DB < backup_before_deploy.sql

# 代码回滚
cd /www/wwwroot/xiyun-api
git log --oneline -5          # 找到回滚版本
git reset --hard <commit_hash>
composer install --no-dev
bash scripts/deploy/fix-permissions.sh /www/wwwroot/xiyun-api
```

---

## 九、自动化检查脚本清单

| 脚本 | 检查内容 | 输出等级 |
|------|----------|----------|
| `preflight-production-check.sh` | APP_DEBUG/HTTPS/功能开关/测试AppID/风险配置 | PASS/WARN/BLOCKER |
| `preflight-production-check.php` | 同上 + composer.lock/依赖版本/敏感文件跟踪/安装入口/调试残留/隐私fail-closed/高风险功能默认关闭/pages.json禁止页面 | PASS/WARN/BLOCKER |
| `check-release-placeholders.sh` | manifest/project.config/.env 占位符/空值/IP/测试值 | PASS/WARN/BLOCKER |
| `check-runtime-config.sh` | 数据库表/功能开关/邀请配置/客服电话/隐私协议/支付方式 | PASS/WARN/BLOCKER |
| `check-admin-bootstrap.sh` | 后台入口/控制器/视图/菜单权限 | PASS/WARN/BLOCKER |
| `check-wechat-submit-readiness.sh` | AppID/隐私合规/域名/安全配置/测试内容 | PASS/WARN/BLOCKER |
| `run-rc-gate.sh` | 一键执行上述全部检查 | PASS/WARN/BLOCKER |

---

## 十、封板确认签字

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 开发负责人 | | | |
| 测试负责人 | | | |
| 产品负责人 | | | |
| 运营负责人 | | | |
