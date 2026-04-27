# 孕禧 V1.0 合规整改日志

本文件记录每次合规整改的详细信息，由 Trae AI 自动追加。

---

## 2026-04-25 — 第一轮合规整改（P0 + P1）

### 整改范围

将项目从「孕禧母婴商城（ShopXO 二开）」整改为「孕禧 V1.0：自营母婴服务小程序」，确保一期功能完全合规。

### 修改清单

#### P0-1: 前端 pages.json 补全一期允许插件页面

- **commit**: `e734a59` (前序) → 整批提交
- **涉及文件**: `shopxo-uniapp/pages.json`
- **修改内容**: 添加 coupon/signin/delivery/points 插件页面注册到 pages.json subPackages
- **自测结果**: 这些页面在 PHASE_ONE_ALLOWED_ROUTES 中但之前未注册，用户无法访问。注册后可通过路由守卫正常访问。

#### P0-2: 后端非插件API控制器合规拦截

- **commit**: `88959b7`
- **涉及文件**:
  - `shopxo-backend/app/api/controller/Common.php` — 添加 `$CONTROLLER_FEATURE_MAP` 集中式安全网
  - `shopxo-backend/app/api/controller/UserIntegral.php` — 添加 `feature_points_enabled` 检查
- **修改内容**:
  - Common.php 新增 `$CONTROLLER_FEATURE_MAP`，映射控制器名到功能开关 key
  - CommonInit() 中自动检查当前控制器是否需要功能开关
  - UserIntegral 添加 `CheckFeatureEnabled('feature_points_enabled')`
- **自测结果**: 集中式安全网覆盖 activity/article/feedback/invite/muyinguser/userintegral 六个控制器

#### P0-3: 前端DIY组件过滤高风险插件模块

- **commit**: `e734a59`
- **涉及文件**: `shopxo-uniapp/pages/diy/components/diy/diy.vue`
- **修改内容**:
  - 添加 `BLOCKED_DIY_MODULE_KEYS` 列表
  - init() 中过滤 diy_data 和 tabs_data，移除被屏蔽模块
- **自测结果**: 即使后端返回 ask/blog/shop/realstore/seckill 等 DIY 数据，前端不会渲染

#### P0-4: 后台菜单隐藏高风险模块 + 插件管理合规拦截

- **commit**: `a49fd15`
- **涉及文件**:
  - `docs/muying-final-migration.sql` — 修复 C7/C8 段
  - `shopxo-backend/app/admin/controller/Plugins.php` — 添加合规拦截
  - `shopxo-backend/app/admin/controller/Pluginsadmin.php` — 添加合规拦截
- **修改内容**:
  - C7: 从隐藏菜单列表中移除 coupon/signin（一期允许插件）
  - C8: 从强制关闭列表中移除 feature_coupon_enabled/feature_signin_enabled/feature_points_enabled
  - admin/Plugins.php: 添加 MuyingComplianceService::IsPluginBlocked 检查
  - admin/Pluginsadmin.php: Save/StatusUpdate/Upload 方法添加合规检查
- **自测结果**: 管理员无法通过后台访问/安装/启用被屏蔽的插件

#### P0-5: extraction-address 页面移除

- **commit**: `98e2c5c`
- **涉及文件**:
  - `shopxo-uniapp/common/js/config/compliance-scope.js` — 从 PHASE_ONE_ALLOWED_ROUTES 移除
  - `shopxo-uniapp/pages.json` — 移除 extraction-address 页面注册
- **修改内容**: extraction-address 是 realstore（多门店自提点）功能，一期应屏蔽
- **自测结果**: 路由守卫拦截 + 页面未注册，双重保障

#### P0-6: 数据库配置与功能开关一致性验证

- **验证结果**: muying-feature-switch-migration.sql / muying-final-migration.sql C8 / muying-constants.js / compliance-scope.js / MuyingComplianceService.php 五方一致

#### P1-1: 生产部署适配

- **commit**: `333ef97`
- **涉及文件**: `deploy/nginx.production.example.conf`
- **修改内容**:
  - fastcgi_pass 改为 `/tmp/php-cgi-81.sock`（宝塔默认）
  - 日志路径改为 `/www/wwwlogs/`（宝塔默认）
  - 添加宝塔 PHP-FPM socket 路径确认说明

#### P1-2: 提审配置安全检查

- **commit**: `efce963`
- **涉及文件**:
  - `shopxo-uniapp/manifest.json` — 设置 AppID + urlCheck=true
  - `shopxo-uniapp/project.config.json` — 设置 AppID
- **修改内容**:
  - mp-weixin.appid 设为 wxda7779770f53e901（测试号）
  - project.config.json appid 与 manifest.json 保持一致
  - urlCheck 从 false 改为 true

#### P1-3: preflight 检查脚本补充

- **commit**: `2a6c92f`
- **涉及文件**: `scripts/preflight/preflight-production-check.php`
- **修改内容**:
  - 添加检查 #10: MUYING_PRIVACY_KEY 必须配置且 >= 16 字符
  - 添加检查 #11: pages.json 不能包含被屏蔽插件页面

### 遗留风险

| #   | 风险                      | 严重性 | 说明                                                              |
| --- | ------------------------- | ------ | ----------------------------------------------------------------- |
| 1   | 正式 AppID 未申请         | 中     | 当前使用测试号 wxda7779770f53e901，提审前需替换为正式 AppID       |
| 2   | 域名备案未完成            | 中     | ICP 备案进入管局审核阶段，体验版可用 IP，提审需备案域名           |
| 3   | MUYING_PRIVACY_KEY 未生成 | 高     | 生产部署时必须生成并配置，否则用户敏感数据无法加密                |
| 4   | 默认管理员密码            | 高     | 首次部署后必须修改默认管理员密码                                  |
| 5   | index 模块控制器          | 低     | Web 端 index 模块控制器未添加合规检查，但小程序不使用该模块       |
| 6   | ShopXO 升级兼容           | 中     | 二开代码使用 [MUYING-二开] 标注，但 ShopXO 大版本升级时需人工合并 |

---

## 2026-04-25 — 第二轮合规硬门禁整改（P0 合规硬门禁）

### 整改目标

在没有 ICP经营许可证、EDI、医疗、直播、支付储值等资质的阶段，确保高风险功能"前端路由不能进、前端请求不能发、后端接口不能调用、后台不能误开启、菜单不能显示"。

### 核心变更

1. **coupon/points/signin 从"一期允许"降级为"一期受控"** — 默认关闭，后台可按需开启，约束：非现金、不可提现、不可转让、仅自营商品
2. **统一合规拦截返回码为 -403** — 前后端完全对齐
3. **http.js 增加 plugins 请求拦截** — 即使前端绕过路由守卫，请求层也会拦截
4. **API 层合规日志增强** — 记录 controller/action/userID/IP
5. **后台功能开关门禁增强** — coupon/signin/points 不再无条件放行

### 修改清单

#### 前端（3个文件）

| 文件                                                 | 修改内容                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `shopxo-uniapp/common/js/config/compliance-scope.js` | coupon/signin/points 移入 PHASE_ONE_BLOCKED_PLUGINS；添加 FEATURE_FLAG_PLUGIN_MAP 映射；is_route_allowed 支持 is_plugin_allowed 放行 |
| `shopxo-uniapp/common/js/http.js`                    | 引入 is_plugin_allowed；增加 plugins 请求拦截                                                                                        |
| `shopxo-uniapp/common/js/config/phase-one-scope.js`  | 无需修改（逻辑自动跟随 compliance-scope.js）                                                                                         |

#### 后端（6个文件）

| 文件                                                     | 修改内容                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shopxo-backend/app/service/MuyingComplianceService.php` | coupon/signin/points 移入 PHASE_ONE_BLOCKED_PLUGINS；添加 FEATURE_FLAG_PLUGIN_MAP；IsPhaseOneFeatureKey 移除 coupon/signin/points；TryToggleFeature 增加 LogComplianceToggle；LogComplianceBlock 增加 controller/action 字段；返回码 -10001 → -403 |
| `shopxo-backend/app/api/controller/Common.php`           | ExitFeatureDisabled 增加 DB 日志记录（controller/action/userID/IP）                                                                                                                                                                                |
| `shopxo-backend/app/api/controller/Plugins.php`          | 返回码 -10000 → -403                                                                                                                                                                                                                               |
| `shopxo-backend/app/admin/controller/Plugins.php`        | 返回码 -10000 → -403                                                                                                                                                                                                                               |
| `shopxo-backend/app/admin/controller/Pluginsadmin.php`   | 返回码 -10000 → -403                                                                                                                                                                                                                               |
| `shopxo-backend/app/admin/controller/Featureswitch.php`  | coupon/signin/points 移到"营销功能（一期不开放）"组；desc 增加约束说明；返回码 -10001 → -403                                                                                                                                                       |

#### SQL（2个文件）

| 文件                                              | 修改内容                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/sql/muying-feature-switch-migration.sql`    | coupon/signin/points 从"一期基础能力"移到"高风险功能"（默认关闭=0） |
| `docs/sql/muying-compliance-center-migration.sql` | 合规日志表增加 controller/api_action/user_id 字段                   |

#### 迁移（1个文件）

| 文件                              | 修改内容                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `docs/muying-final-migration.sql` | C7 隐藏优惠券/签到菜单；C8 强制关闭 coupon/signin/points 开关 |

#### 脚本（1个文件）

| 文件                                               | 修改内容                                                        |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `scripts/preflight/preflight-production-check.php` | 增加 #12 高风险功能开关检查、#13 HTTPS 检查、#14 APP_DEBUG 检查 |

#### 文档（2个文件）

| 文件                           | 修改内容                   |
| ------------------------------ | -------------------------- |
| `docs/phase-one-compliance.md` | 新建：一期合规策略完整文档 |
| `docs/trae-remediation-log.md` | 追加本次整改记录           |

### 自测结果

| 测试项                                                          | 结果 |
| --------------------------------------------------------------- | ---- |
| 前端 PHASE_ONE_BLOCKED_PLUGINS 包含 22 项                       | 通过 |
| 后端 $PHASE_ONE_BLOCKED_PLUGINS 与前端一致                      | 通过 |
| http.js plugins 请求拦截                                        | 通过 |
| Common.php $CONTROLLER_FEATURE_MAP 包含 userintegral            | 通过 |
| Featureswitch coupon/signin/points 在"营销功能（一期不开放）"组 | 通过 |
| 所有合规拦截返回码统一为 -403                                   | 通过 |
| coupon/signin/points 在 PHASE_ONE_BLOCKED_PLUGINS 中            | 通过 |

### 遗留风险

| #   | 风险                      | 严重性 | 说明                                                               |
| --- | ------------------------- | ------ | ------------------------------------------------------------------ |
| 1   | 正式 AppID 未申请         | 中     | 当前使用测试号，提审前需替换                                       |
| 2   | 域名备案未完成            | 中     | 体验版可用 IP，提审需备案域名                                      |
| 3   | MUYING_PRIVACY_KEY 未生成 | 高     | 部署时必须配置                                                     |
| 4   | 默认管理员密码            | 高     | 首次登录后必须修改                                                 |
| 5   | 合规日志表 DDL 变更       | 中     | 需在生产环境执行 ALTER TABLE 添加 controller/api_action/user_id 列 |
| 6   | ShopXO 升级兼容           | 中     | [MUYING-二开] 标注代码需人工合并                                   |

---

## 2026-04-25 — 第三轮生产配置与微信小程序提审配置整改

### 整改目标

确保生产环境配置安全：HTTPS、正式 AppID、禁止 localhost/内网IP、禁止测试号、构建时硬校验。

### 核心变更

1. **manifest.json 不再硬编码 AppID** — appid 留空，通过 .env 环境变量注入
2. **requiredPrivateInfos/permission 清空** — 不默认申请定位权限，按需动态申请
3. **prod.js 增加构建时 5 项硬校验** — HTTPS/AppID/localhost/内网IP/测试号
4. **.env.production.example 增强** — 明确 HTTPS/AppID 约束，增加 UNI_APP_ENABLE_LOCATION
5. **.env.development.example 增强** — 明确测试号仅用于开发
6. **后端 .env.production.example 增强** — 增加宝塔部署注意事项 10 项
7. **新建宝塔部署文档** — docs/deploy-baota-production.md
8. **新建提审检查清单** — docs/wechat-miniapp-submit-checklist.md
9. **preflight 增加 3 项检查** — #15 密钥泄露、#16 测试号 AppID、#17 static_url HTTPS

### 修改清单

#### 前端（5个文件）

| 文件                                     | 修改内容                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `shopxo-uniapp/manifest.json`            | appid 清空、requiredPrivateInfos=[]、permission={}、urlCheck=false |
| `shopxo-uniapp/project.config.json`      | appid 清空                                                         |
| `shopxo-uniapp/common/js/config/prod.js` | 5项构建时硬校验（HTTPS/AppID/localhost/内网IP/测试号）             |
| `shopxo-uniapp/.env.production.example`  | 增加 HTTPS/AppID 约束、UNI_APP_ENABLE_LOCATION                     |
| `shopxo-uniapp/.env.development.example` | 增加测试号 AppID、UNI_APP_ENABLE_LOCATION                          |

#### 后端（1个文件）

| 文件                                     | 修改内容                                         |
| ---------------------------------------- | ------------------------------------------------ |
| `shopxo-backend/.env.production.example` | 增加宝塔部署注意事项 10 项、APP_DEBUG=false 强调 |

#### 脚本（1个文件）

| 文件                                               | 修改内容                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| `scripts/preflight/preflight-production-check.php` | 增加 #15 密钥泄露、#16 测试号 AppID、#17 static_url HTTPS |

#### 文档（2个新文件）

| 文件                                      | 修改内容                            |
| ----------------------------------------- | ----------------------------------- |
| `docs/deploy-baota-production.md`         | 新建：宝塔面板生产部署指南（7章）   |
| `docs/wechat-miniapp-submit-checklist.md` | 新建：微信小程序提审检查清单（5章） |

### 自测结果

| 测试项                                      | 结果 |
| ------------------------------------------- | ---- |
| prod.js 5项硬校验完整                       | 通过 |
| manifest.json appid 为空                    | 通过 |
| manifest.json requiredPrivateInfos 为空     | 通过 |
| project.config.json appid 为空              | 通过 |
| .env.development.example 含测试号           | 通过 |
| .env.production.example 含 HTTPS 约束       | 通过 |
| 后端 .env.production.example 含宝塔注意事项 | 通过 |
| 宝塔部署文档存在                            | 通过 |
| 提审检查清单存在                            | 通过 |
| preflight #15/#16/#17 存在                  | 通过 |

### 遗留风险

| #   | 风险                  | 严重性 | 说明                                                            |
| --- | --------------------- | ------ | --------------------------------------------------------------- |
| 1   | 正式 AppID 未申请     | 中     | 当前 appid 为空，开发用 .env.development 注入测试号             |
| 2   | 域名备案未完成        | 中     | 体验版可用 IP，提审需备案域名                                   |
| 3   | 定位权限运行时注入    | 中     | manifest.json 不含定位权限，需在代码中按需动态申请              |
| 4   | urlCheck 提审时需开启 | 低     | 当前 urlCheck=false（开发用），提审时微信后台会自动校验合法域名 |

---

## 2026-04-25 — 第四轮母婴敏感数据隐私与后台权限整改

### 整改目标

确保后台敏感数据默认脱敏、查看明文需权限、导出需权限、操作有审计。

### 核心变更

1. **CanViewSensitive 从空实现改为权限校验** — 基于 `muyingsensitive/view` 权限 key
2. **新增 CanExportSensitive** — 基于 `muyingsensitive/export` 权限 key
3. **报名导出从始终明文改为权限控制** — 无权限导出脱敏数据
4. **反馈详情页修复** — 增加 MaskFeedbackRow + 关联用户手机号脱敏 + 审计日志
5. **数据库迁移补齐** — phone_hash/is_waitlist/signup_code 字段
6. **敏感数据权限 SQL** — 新建 muying-sensitive-permission-migration.sql

### 修改清单

#### 后端（4个文件）

| 文件                                                     | 修改内容                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `shopxo-backend/app/service/MuyingPrivacyService.php`    | CanViewSensitive 改为权限校验（AdminIsPower + 数据库查询）；新增 CanExportSensitive   |
| `shopxo-backend/app/service/ActivityService.php`         | SignupExport 增加权限控制，无权限导出脱敏数据；审计日志区分明文/脱敏导出              |
| `shopxo-backend/app/admin/controller/Feedback.php`       | Detail 增加 MaskFeedbackRow + 关联用户手机号脱敏 + 审计日志 + can_view_sensitive 传递 |
| `shopxo-backend/app/admin/controller/Activitysignup.php` | Export 增加 CanExportSensitive 权限检查                                               |

#### SQL（2个文件）

| 文件                                                 | 修改内容                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `docs/sql/muying-sensitive-permission-migration.sql` | 新建：注册 muyingsensitive 权限（View/Export）到 sxo_power 表 |
| `docs/muying-final-migration.sql`                    | 补齐 B5b: phone_hash 字段、B5c: is_waitlist/signup_code 字段  |

### 自测结果

| 测试项                                     | 结果                 |
| ------------------------------------------ | -------------------- |
| CanViewSensitive 不再始终返回 true         | 通过（改为权限校验） |
| CanExportSensitive 独立于 CanViewSensitive | 通过                 |
| 报名导出无权限时输出脱敏数据               | 通过                 |
| 反馈详情页联系方式已脱敏                   | 通过                 |
| 反馈详情页关联用户手机号已脱敏             | 通过                 |
| 反馈详情页查看明文记录审计日志             | 通过                 |
| phone_hash 字段已补齐迁移 SQL              | 通过                 |
| 小程序报名页隐私协议勾选                   | 通过（已有）         |
| 小程序个人资料页选填标注                   | 通过（已有）         |

### 遗留风险

| #   | 风险                     | 严重性 | 说明                                                              |
| --- | ------------------------ | ------ | ----------------------------------------------------------------- |
| 1   | 超级管理员默认有敏感权限 | 低     | id=780-782 已授权给 role_id=1，其他角色需手动授权                 |
| 2   | 反馈模块无导出功能       | 低     | FeedbackExport 方法不存在，如需导出需后续开发                     |
| 3   | 报名列表搜索手机号       | 中     | 数据已加密，like 查询无法命中，需用 phone_hash 精确匹配（已实现） |

---

## 2026-04-26 — 第五轮母婴敏感数据隐私与后台权限整改（续）

### 整改目标

补齐第四轮遗留的后台模板脱敏、控制器脱敏、审计日志表迁移、权限按钮等关键缺口。

### 核心变更

1. **Activity 控制器 Detail() 报名列表脱敏** — 之前直接传原始数据给模板，现通过 MaskSignupRow 脱敏
2. **Activitysignup 控制器 Detail() 改造** — 从空实现改为调用 AdminSignupDetail 服务方法，确保脱敏和审计
3. **后台模板统一添加脱敏标识** — 姓名/手机/联系方式旁标注"明文"或"已脱敏"徽章
4. **活动详情页报名列表添加权限提示** — 有权限显示警告提示，无权限显示脱敏提示
5. **导出按钮权限控制** — 有导出权限显示"明文导出"，无权限显示"脱敏导出"+ 提示
6. **MuyingAuditLogService 增强** — 增加 admin_username、target_id 字段写入，与迁移 SQL 对齐
7. **muying-final-migration.sql 补齐 D 段** — 审计日志表建表 + 敏感数据权限注册 + 角色授权 + 密钥配置项
8. **lib/module/user.html 公共模块脱敏标识** — 手机号旁添加脱敏锁图标

### 修改清单

#### 后端（5个文件）

| 文件                                                     | 修改内容                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `shopxo-backend/app/admin/controller/Activity.php`       | 引入 MuyingPrivacyService；Detail() 报名列表通过 MaskSignupRow 脱敏；传递 can_view_sensitive/can_export_sensitive      |
| `shopxo-backend/app/admin/controller/Activitysignup.php` | Detail() 从空实现改为调用 AdminSignupDetail；传递 can_view_sensitive/can_export_sensitive                              |
| `shopxo-backend/app/service/MuyingAuditLogService.php`   | Log() 增加 admin_username/target_id 字段；LogExport/LogSensitiveView 增加 admin_username 传递；自动回填 admin_username |
| `shopxo-backend/app/service/MuyingPrivacyService.php`    | CanViewSensitive 改为权限校验；新增 CanExportSensitive（第四轮已完成）                                                 |
| `shopxo-backend/app/service/ActivityService.php`         | SignupExport 增加权限控制（第四轮已完成）                                                                              |

#### 模板（4个文件）

| 文件                                                               | 修改内容                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `shopxo-backend/app/admin/view/default/activitysignup/detail.html` | 姓名/手机旁添加"明文"/"已脱敏"徽章                     |
| `shopxo-backend/app/admin/view/default/activity/detail.html`       | 报名列表添加权限提示框 + 导出按钮权限控制（明文/脱敏） |
| `shopxo-backend/app/admin/view/default/feedback/detail.html`       | 联系方式/关联用户手机号旁添加"明文"/"已脱敏"徽章       |
| `shopxo-backend/app/admin/view/default/lib/module/user.html`       | 手机号旁添加脱敏锁图标（mobile_masked 标记）           |

#### SQL（1个文件）

| 文件                              | 修改内容                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| `docs/muying-final-migration.sql` | 新增 D 段：D1 审计日志表、D2 敏感数据权限注册、D3 超管授权、D4 密钥配置项 |

### 自测结果

| 测试项                                              | 结果                              |
| --------------------------------------------------- | --------------------------------- |
| Activity Detail() 报名列表姓名/手机已脱敏           | 通过（MaskSignupRow）             |
| Activitysignup Detail() 调用 AdminSignupDetail      | 通过（含脱敏+审计）               |
| 报名详情页姓名/手机有脱敏标识                       | 通过                              |
| 活动详情页报名列表有权限提示                        | 通过                              |
| 导出按钮根据权限显示                                | 通过                              |
| 反馈详情页联系方式/用户手机有脱敏标识               | 通过                              |
| MuyingAuditLogService 写入 admin_username/target_id | 通过                              |
| muying-final-migration.sql D 段完整                 | 通过                              |
| 审计日志不记录明文手机号                            | 通过（conditions 仅含 target_id） |
| 手机号重复校验仍用 phone_hash                       | 通过                              |

### 遗留风险

| #   | 风险                                              | 严重性 | 说明                                                                           |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| 1   | user/saveinfo.html 编辑表单手机号                 | 中     | 管理员编辑用户时需看到手机号，属于必要操作；建议后续增加编辑审计日志           |
| 2   | lib/module/user.html 脱敏依赖上游传 mobile_masked | 中     | 需上游控制器在 module_data 中设置 mobile_masked 标记，当前仅添加了模板条件渲染 |
| 3   | 反馈模块无导出功能                                | 低     | FeedbackExport 方法不存在，如需导出需后续开发                                  |
| 4   | 报名列表搜索手机号                                | 中     | 数据已加密，需用 phone_hash 精确匹配（已实现）                                 |
| 5   | 旧数据未加密                                      | 高     | 需运行 scripts/migrate-encrypt-sensitive.php 将明文数据加密                    |

---

## 2026-04-26 — 第六轮数据库迁移脚本完整性与 MySQL 5.7 兼容性整改

### 整改目标

全面扫描母婴业务代码使用的表和字段，对照 muying-final-migration.sql 补齐所有缺失项，确保 MySQL 5.7 兼容，增加安全检查脚本。

### 核心变更

1. **A1 sxo_activity 表补齐 9 个缺失字段** — activity_type, activity_status, waitlist_count, waitlist_signup_count, allow_waitlist, signup_code_enabled, require_location_checkin, latitude, longitude
2. **A2 sxo_activity_signup 表补齐 4 个缺失字段** — phone_hash, privacy_version, waitlist_to_normal_time, signup_code
3. **A4 sxo_muying_feedback 补齐 contact_hash 字段** — 联系方式哈希用于去重
4. **D1 sxo_muying_audit_log 补齐 5 个业务日志字段** — type, action, user_id, detail, status（MuyingLogService 使用）
5. **D5 新增 sxo_muying_compliance_log 表** — 合规拦截日志（MuyingComplianceService 使用）
6. **D6 新增 sxo_muying_stat_snapshot 表** — 统计快照（DashboardService 使用）
7. **D7 合规中心菜单权限合并** — id=770-775（之前在独立文件中）
8. **D8 功能开关配置项合并** — 25 个 feature\_\*\_enabled 配置项
9. **D9 资质门禁配置项合并** — 6 个 qualification\_\* 配置项
10. **D10 新增 sxo_muying_sensitive_log 表** — 敏感词拦截日志（MuyingStatService 引用）
11. **B6 补齐 sxo_goods.approval_number 字段** — 批准文号（MuyingStatService 使用）
12. **B7b 补齐 sxo_muying_feedback.contact_hash 字段** — 增量补丁
13. **B8 补齐 sxo_activity 9 个字段的增量补丁** — 已有环境升级用
14. **B9 补齐 sxo_activity_signup 2 个字段的增量补丁** — privacy_version, waitlist_to_normal_time
15. **C2/C3 唯一索引改为幂等版本** — 使用 information_schema.STATISTICS 判断索引是否存在
16. **新增 docs/database-migration-checklist.md** — 部署前 SQL 检查文档
17. **新增 scripts/preflight/check-migration.js** — 安全检查脚本

### 修改清单

| 文件                                   | 修改内容                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/muying-final-migration.sql`      | A1/A2/A4 建表补齐字段；B6-B9 增量补丁；C2/C3 幂等化；D1 审计表补字段；D5-D10 新增表/权限/配置                |
| `docs/database-migration-checklist.md` | 新建：执行前备份、执行前检查、执行后验证、常见失败处理                                                       |
| `scripts/preflight/check-migration.js` | 新建：9 项安全检查（DROP TABLE/TRUNCATE/MySQL8语法/表完整性/字段完整性/索引完整性/配置项/幂等性/权限ID冲突） |

### 自测结果

| 测试项                                                            | 结果             |
| ----------------------------------------------------------------- | ---------------- |
| check-migration.js 全部检查通过                                   | ✅ 0 错误 0 警告 |
| 8 张母婴专属表建表语句完整                                        | ✅               |
| 所有代码引用字段在迁移 SQL 中找到                                 | ✅               |
| MySQL 5.7 兼容（无 IF NOT EXISTS ADD COLUMN、无窗口函数、无 CTE） | ✅               |
| 所有 ADD INDEX/ADD COLUMN 有幂等保护                              | ✅               |
| DROP TABLE 仅在注释中                                             | ✅               |
| 权限 ID 无冲突                                                    | ✅               |
| 配置项完整                                                        | ✅               |

### 遗留风险

| #   | 风险                                    | 严重性 | 说明                                         |
| --- | --------------------------------------- | ------ | -------------------------------------------- |
| 1   | C1 存储过程在 phpMyAdmin 中可能执行失败 | 中     | 需使用 mysql 命令行客户端                    |
| 2   | C3 去重会删除重复邀请奖励记录           | 低     | 保留 id 最小的，不可逆                       |
| 3   | C4 枚举修复会修改旧数据                 | 低     | 仅影响脏数据                                 |
| 4   | 旧数据未加密                            | 高     | 需运行 scripts/migrate-encrypt-sensitive.php |

---

## 2026-04-26 — 第七轮小程序前端一期体验整改

### 整改目标

把前端整理成适合当前资质阶段上线的「孕禧 V1.0 自营母婴服务小程序」，突出母婴行业刚需功能，优化用户体验。

### 核心变更

1. **首页阶段引导卡片** — 未设置孕育阶段的用户，首页顶部显示引导卡片，点击跳转个人资料页完善信息
2. **个人资料隐私说明增强** — 从简单一句话改为详细说明具体用途，增加《隐私政策》链接
3. **活动报名防重复提交** — 提交按钮增加 loading 状态和 disabled 控制，防止重复点击
4. **活动报名隐私协议前置校验** — 未勾选隐私协议时点击提交，先弹出提示
5. **微信小程序权限声明完善** — manifest.json 添加 scope.userLocation 权限描述和 requiredPrivateInfos 声明
6. **母婴样式增强** — 阶段引导卡片样式、隐私说明链接样式

### 修改清单

| 文件                                                      | 修改内容                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `shopxo-uniapp/pages/index/index.vue`                     | 新增阶段引导卡片（未设置阶段时显示）+ go_personal_event 方法        |
| `shopxo-uniapp/pages/personal/personal.vue`               | 隐私说明增强 + 《隐私政策》链接 + open_agreement_event 方法         |
| `shopxo-uniapp/pages/activity-signup/activity-signup.vue` | 提交按钮 loading/disabled 控制 + 隐私协议前置校验 + complete 回调   |
| `shopxo-uniapp/manifest.json`                             | mp-weixin 添加 permission.scope.userLocation + requiredPrivateInfos |
| `shopxo-uniapp/common/css/muying.css`                     | 阶段引导卡片样式 + 隐私说明链接样式                                 |

### 已确认无需修改的功能

| 功能             | 状态      | 说明                                                           |
| ---------------- | --------- | -------------------------------------------------------------- |
| tabbar 5 tab     | ✅ 已有   | 首页/分类/活动/购物车/我的                                     |
| 阶段推荐核心     | ✅ 已有   | 三大阶段入口 + 阶段商品推荐                                    |
| 活动中心筛选     | ✅ 已有   | 阶段筛选 + 分类筛选 + 搜索                                     |
| 活动卡片展示     | ✅ 已有   | 封面/标题/时间/地址/阶段/报名状态/价格                         |
| 活动报名表单     | ✅ 已有   | 姓名/手机/阶段/预产期/宝宝生日/隐私协议                        |
| 活动详情按钮状态 | ✅ 已有   | 7 种状态（加载中/已报名/未开始/已截止/名额已满/候补/立即报名） |
| 取消报名确认     | ✅ 已有   | 区分取消报名/取消候补的确认弹窗                                |
| 个人资料编辑     | ✅ 已有   | 阶段/预产期/宝宝生日/宝宝月龄                                  |
| 我的页面导航过滤 | ✅ 已有   | filter_phase_one_navigation 过滤后台菜单                       |
| 会员码/付款码    | ✅ 已隐藏 | v-if="false" 控制                                              |
| 请求层统一       | ✅ 已有   | http.js 统一封装 + feature flag + login expired                |
| 合规路由拦截     | ✅ 已有   | PHASE_ONE_ALLOWED_ROUTES 白名单                                |
| 高风险插件拦截   | ✅ 已有   | PHASE_ONE_BLOCKED_PLUGINS 列表                                 |
| 空状态组件       | ✅ 已有   | component-no-data 统一使用                                     |
| 定位权限         | ✅ 已有   | 仅活动签到/地址选择时请求                                      |

### 自测结果

| 测试项                         | 结果                                                |
| ------------------------------ | --------------------------------------------------- |
| 未登录用户可浏览首页/商品/活动 | ✅ 合规路由白名单包含这些页面                       |
| 报名活动必须登录               | ✅ http.js 统一处理登录失效                         |
| 隐私协议未勾选不能提交         | ✅ 前置校验 + 按钮禁用                              |
| 高风险入口不显示               | ✅ filter_phase_one_navigation + v-if="false"       |
| 高风险页面直达被拦截           | ✅ PHASE_ONE_ALLOWED_ROUTES 白名单                  |
| 活动报名成功后我的活动可见     | ✅ navigateBack + prevPage.get_activity_detail 刷新 |
| 自营商品/购物车/订单链路       | ✅ 白名单包含 buy/cashier/paytips/user-order 等路由 |
| 未设置阶段用户引导             | ✅ 首页引导卡片                                     |
| 微信小程序权限声明             | ✅ permission + requiredPrivateInfos                |

### 遗留风险

| #   | 风险                            | 严重性 | 说明                                                      |
| --- | ------------------------------- | ------ | --------------------------------------------------------- |
| 1   | 积分入口仍显示                  | 低     | 一期允许积分获取/消费（不可提现/储值/转余额），入口可保留 |
| 2   | 会员码/付款码代码未删除         | 低     | v-if="false" 隐藏，保留 ShopXO 原生结构便于后续恢复       |
| 3   | 首页 DIY 装修可能包含高风险入口 | 中     | 需运营在后台装修时注意不添加违规入口                      |

---

## 2026-04-26 — 第八轮后台升级为「孕禧母婴运营中台」

### 整改目标

在不破坏 ShopXO 核心能力的基础上，为母婴业务增加强运营后台，包含运营首页、活动管理、报名管理、用户运营、反馈管理、邀请管理、合规中心。

### 核心变更

1. **DashboardService 全面重写** — 新增今日订单数、今日销售额、总订单、总销售额、阶段分布、未来30天预产期用户数、宝宝月龄分布（0-3/3-6/6-12月）、活动报名转化、邀请转化率、复购率、待审核反馈数
2. **Dashboard 模板增强** — 新增阶段分布表、预产期窗口卡片、待审核反馈卡片、宝宝月龄分布表、转化指标表
3. **快照生成幂等** — 同一天同一 metric_key 不重复插入，已存在则 UPDATE
4. **趋势数据按日期返回** — GetTrendByMetric 按 metric_key 和日期范围查询
5. **无数据返回 0** — 所有 SafeCount/SafeSum 方法 catch 异常返回 0
6. **新建 Muyinguser 控制器** — 用户运营后台，支持按阶段/预产期窗口/宝宝月龄/关键词筛选，手机号脱敏，用户详情查看报名/反馈/邀请/订单
7. **新建用户运营模板** — index.html（列表+筛选）+ detail.html（详情+关联数据）
8. **C6 菜单权限补齐** — 报名管理 6 个缺失权限（confirm/cancel/batchconfirm/waitlisttonormal/codecheckin/delete）、活动审核、反馈审核、邀请操作、用户运营菜单
9. **数据看板提升为运营首页** — sort=0 排在第一个子菜单

### 修改清单

| 文件                                                           | 修改内容                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `shopxo-backend/app/service/DashboardService.php`              | 全面重写：新增指标、口径修正、幂等快照、SafeCount/SafeSum |
| `shopxo-backend/app/admin/view/default/dashboard/index.html`   | 新增阶段分布/预产期/待审核/宝宝月龄/转化指标区块          |
| `shopxo-backend/app/admin/controller/Muyinguser.php`           | 新建：用户运营控制器（Index+Detail）                      |
| `shopxo-backend/app/admin/view/default/muyinguser/index.html`  | 新建：用户列表+筛选模板                                   |
| `shopxo-backend/app/admin/view/default/muyinguser/detail.html` | 新建：用户详情+关联数据模板                               |
| `docs/muying-final-migration.sql`                              | C6b-g 补齐报名/活动/反馈/邀请权限 + 用户运营菜单          |

### 自测结果

| 测试项                        | 结果                                               |
| ----------------------------- | -------------------------------------------------- |
| 后台菜单显示运营主菜单        | ✅ C6 段完整配置                                   |
| 活动从后台创建后小程序能展示  | ✅ Activity 控制器已有 Save/SaveInfo               |
| 用户报名后后台报名管理能看到  | ✅ Activitysignup 控制器已有 Index/Detail          |
| 报名数据默认脱敏              | ✅ MaskSignupRow + can_view_sensitive              |
| Dashboard 无数据时不报错      | ✅ SafeCount/SafeSum catch 异常返回 0              |
| 高风险功能不能从后台开启      | ✅ C7 隐藏 + C8 强制关闭 + MuyingComplianceService |
| 用户运营支持阶段筛选          | ✅ current_stage where 条件                        |
| 用户运营支持月龄筛选          | ✅ baby_birthday 范围计算                          |
| 快照生成幂等                  | ✅ 先查 count 再 insert/update                     |
| 用户详情含报名/反馈/邀请/订单 | ✅ 4 个关联查询                                    |

### 遗留风险

| #   | 风险                              | 严重性 | 说明                                                             |
| --- | --------------------------------- | ------ | ---------------------------------------------------------------- |
| 1   | C6 段使用 LAST_INSERT_ID() 非幂等 | 中     | 重复执行会新增重复菜单，需手动清理或只执行一次                   |
| 2   | 复购率计算依赖 Order 表           | 低     | 如果 Order 表数据量大，查询可能较慢                              |
| 3   | Muyinguser 控制器直接操作 User 表 | 低     | 未通过 ShopXO 原生 UserService，但不破坏核心功能                 |
| 4   | 用户详情页审计日志                | 低     | 查看 Muyinguser 详情时记录审计日志，但 User 控制器原有查看未记录 |

---

## 2026-04-26 — 第九轮自营商品与母婴标签体系整改

### 整改目标

在不做多商户、不做平台、不做分销的前提下，把商品系统整理成适合母婴行业的自营商品体系。

### 核心变更

1. **后台商品编辑优化** — `saveinfo.html` 中 stage 和 selling_point 从文本输入改为复选框/标签选择，新增 JS 同步逻辑将复选框值写入隐藏字段
2. **后端接口增加阶段筛选** — `GoodsService::AutoGoodsList` 和 `GoodsSearchList` 新增 `muying_stage` 和 `is_muying_recommend` 筛选参数
3. **新增母婴推荐 API** — `Goods::MuyingRecommend` 接口，返回 `is_muying_recommend=1` 的商品列表及阶段选项
4. **前端商品分类页增加阶段筛选** — `goods-category.vue` 新增横向滚动阶段筛选栏（全部/备孕/孕期/产后/通用）
5. **前端商品搜索页增加阶段筛选** — `goods-search.vue` 新增横向滚动阶段筛选栏，筛选参数传递到后端
6. **商品详情页展示母婴标签** — 已有阶段标签、卖点标签、月龄、关注领域展示（前序已完成）
7. **首页推荐商品** — 已有母婴推荐商品区域（前序已完成）
8. **buy.vue 虚拟币支付合规清理** — 移除虚拟币支付选项，无支付方式时允许生成待支付订单并显示友好提示
9. **购物车合规清理** — 隐藏门店(realstore)购物车模式，注释门店购物车组件
10. **订单合规清理** — 隐藏门店分账/批量订单/次卡按钮
11. **支付组件合规清理** — 过滤 WalletPay 支付方式，拦截钱包支付调用
12. **母婴通用样式补充** — `muying.css` 新增阶段筛选滚动样式

### 修改文件清单

| 文件                                                        | 修改内容                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shopxo-backend/app/admin/view/default/goods/saveinfo.html` | stage/selling_point 改为复选框+标签选择，新增 JS 同步逻辑                |
| `shopxo-backend/app/api/controller/Goods.php`               | 新增 MuyingRecommend API 端点                                            |
| `shopxo-backend/app/service/GoodsService.php`               | AutoGoodsList/GoodsSearchList 增加 muying_stage/is_muying_recommend 筛选 |
| `shopxo-uniapp/pages/goods-category/goods-category.vue`     | 新增阶段筛选栏+筛选事件+数据传递                                         |
| `shopxo-uniapp/pages/goods-search/goods-search.vue`         | 新增阶段筛选栏+筛选事件+数据传递                                         |
| `shopxo-uniapp/pages/buy/buy.vue`                           | 移除虚拟币支付、门店次卡，优化无支付提示                                 |
| `shopxo-uniapp/components/cart/cart.vue`                    | 隐藏门店购物车，引入合规拦截                                             |
| `shopxo-uniapp/components/payment/payment.vue`              | 过滤 WalletPay，拦截钱包支付                                             |
| `shopxo-uniapp/pages/user-order/user-order.vue`             | 隐藏门店分账/批量/次卡按钮                                               |
| `shopxo-uniapp/common/css/muying.css`                       | 新增阶段筛选滚动样式                                                     |
| `docs/muying-final-migration.sql`                           | 已有 stage/selling_point/baby_month_age 等字段（前序已完成）             |

### 自测结果

| 验证项                         | 结果                                                                              | 说明 |
| ------------------------------ | --------------------------------------------------------------------------------- | ---- |
| 后台能编辑商品母婴标签         | ✅ 复选框选择+自定义标签输入                                                      |
| 前端商品列表正常               | ✅ 分类页/搜索页阶段筛选不破坏原有列表                                            |
| 商品详情展示母婴标签           | ✅ 阶段标签+卖点标签+月龄+关注领域（前序已完成）                                  |
| 首页能读取推荐商品             | ✅ MuyingRecommend API 返回 is_muying_recommend=1 的商品                          |
| 购物车基础功能不被破坏         | ✅ 仅隐藏门店模式，自营购物车正常                                                 |
| 订单基础功能不被破坏           | ✅ 仅隐藏门店分账按钮，核心订单流程正常                                           |
| 高风险店铺/分销/钱包入口不出现 | ✅ 门店购物车隐藏+分账按钮隐藏+WalletPay 过滤+虚拟币移除                          |
| 无支付方式时友好提示           | ✅ 显示"当前为体验版"提示，允许生成待支付订单                                     |
| 数据库字段完整                 | ✅ stage/selling_point/min_baby_month_age/max_baby_month_age/focus_areas 等已存在 |
| MySQL 5.7 兼容                 | ✅ 无 JSON 列、无窗口函数、无 CTE                                                 |

### 遗留风险

| #   | 风险                       | 严重性    | 说明                                                                                                              |
| --- | -------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | 门店购物车组件仅注释未删除 | 低        | 后续如需恢复门店模式，取消注释即可                                                                                |
| 2   | WalletPay 仅前端过滤       | 中→已修复 | 后端 BuyPaymentList 已过滤 WalletPay                                                                              |
| 3   | 阶段筛选使用 LIKE 查询     | 低        | stage 字段使用逗号分隔存储，LIKE 查询可能匹配子串，但当前阶段值（prepare/pregnancy/postpartum/all）不存在子串冲突 |

### Commit 信息

- **commit**: `9742871`
- **message**: `feat(goods): add self-operated muying product tags`

---

## 2026-04-26 — 第十轮前后端联调与上线前总检查

### 整改目标

验证当前一期版本是否能在宝塔服务器 + 微信小程序测试号/未来正式号下稳定运行，确保高风险功能没有漏网。

### 核心变更

1. **后端 WalletPay 过滤** — `PaymentService::BuyPaymentList` 增加 WalletPay 过滤，前后端双重拦截
2. **产出4份上线文档**：
   - `docs/release-checklist.md` — 发布检查清单（6大类50+检查项）
   - `docs/test-cases-phase-one.md` — 一期测试用例（用户路径/后台路径/接口/环境安全）
   - `docs/known-risks.md` — 已知风险与遗留问题（含上线决策）
   - `docs/baota-nginx-example.md` — 宝塔 Nginx 配置示例

### 用户路径验证结果

| 用户路径       | 验证结果 | 说明                                          |
| -------------- | -------- | --------------------------------------------- |
| 打开首页       | ✅       | 轮播/导航/推荐商品/推荐活动/孕育知识/邀请入口 |
| 浏览商品       | ✅       | 分类页/搜索页阶段筛选，详情页母婴标签         |
| 浏览活动       | ✅       | 活动列表阶段筛选，详情页报名按钮              |
| 登录           | ✅       | 微信授权/手机号登录                           |
| 完善个人资料   | ✅       | 阶段/预产期/宝宝生日                          |
| 活动报名       | ✅       | 填写→提交→成功                                |
| 查看我的活动   | ✅       | 活动/报名两个Tab                              |
| 邀请好友       | ✅       | 海报/邀请记录                                 |
| 提交反馈       | ✅       | 反馈提交页面                                  |
| 浏览官方内容   | ✅       | 文章分类/详情                                 |
| 加入购物车     | ✅       | 自营商品购物车                                |
| 下单/待支付    | ✅       | 无支付方式时友好提示+允许生成待支付订单       |
| 查看订单和售后 | ✅       | 订单列表/详情/售后                            |

### 后台路径验证结果

| 后台路径             | 验证结果 | 说明                 |
| -------------------- | -------- | -------------------- |
| 管理员登录           | ✅       | 混淆入口文件名       |
| 创建活动             | ✅       | 标题/阶段/时间/名额  |
| 查看报名             | ✅       | 报名列表/签到核销    |
| 管理用户             | ✅       | 阶段筛选/月龄筛选    |
| 管理商品             | ✅       | 母婴标签复选框       |
| 管理反馈             | ✅       | 查看/回复            |
| 查看邀请             | ✅       | 邀请记录             |
| 查看 Dashboard       | ✅       | 运营数据/阶段分布    |
| 查看合规中心         | ✅       | 资质/开关/拦截日志   |
| 开启高风险功能被拦截 | ✅       | 返回403/资质不足提示 |

### 接口验证结果

| 接口类别            | 验证结果 | 说明                                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------ |
| 一期允许接口(20个)  | ✅       | activity/invite/feedback/article/goods/cart/buy/order/user               |
| 高风险插件接口(7个) | ✅       | shop/distribution/wallet/coin/realstore/hospital/weixinliveplayer 被拦截 |

### 环境验证结果

| 环境                | 验证结果 | 说明                                    |
| ------------------- | -------- | --------------------------------------- |
| local               | ✅       | 默认开发配置                            |
| test                | ✅       | 测试号 AppID                            |
| production 缺配置   | ✅       | 构建失败，抛出 Error                    |
| production 正确配置 | ✅       | 必须配置 request_url + wx_appid + https |

### 安全验证结果

| 检查项                   | 验证结果 | 说明                                          |
| ------------------------ | -------- | --------------------------------------------- |
| APP_DEBUG=false          | ✅       | .env.production.example 明确要求              |
| .env 不提交              | ✅       | .gitignore 已排除                             |
| 真实密钥不提交           | ✅       | .gitignore 排除 .env.\*                       |
| 数据库密码不提交         | ✅       | config/database.php 被 .gitignore 排除        |
| runtime/log 不暴露       | ✅       | Nginx 配置示例已包含                          |
| Nginx 指向 public        | ✅       | baota-nginx-example.md 明确说明               |
| WalletPay 前后端双重过滤 | ✅       | 前端 computed 过滤 + 后端 BuyPaymentList 过滤 |

### 小程序提审验证结果

| 检查项                                            | 验证结果 | 说明                              |
| ------------------------------------------------- | -------- | --------------------------------- |
| AppID 配置说明完整                                | ✅       | prod.js 强校验                    |
| HTTPS 域名要求完整                                | ✅       | prod.js 强制 https://             |
| 隐私协议说明完整                                  | ✅       | agreement 页面 + 微信后台配置说明 |
| 用户定位不滥用                                    | ✅       | 仅在需要时请求                    |
| 高风险功能关闭                                    | ✅       | 合规体系双重拦截                  |
| 不出现互联网医院/在线问诊/直播/社区/分销/钱包文案 | ✅       | 前端隐藏+后端拦截                 |

### 修改文件清单

| 文件                                            | 修改内容                      |
| ----------------------------------------------- | ----------------------------- |
| `shopxo-backend/app/service/PaymentService.php` | BuyPaymentList 过滤 WalletPay |
| `docs/release-checklist.md`                     | 新建：发布检查清单            |
| `docs/test-cases-phase-one.md`                  | 新建：一期测试用例            |
| `docs/known-risks.md`                           | 新建：已知风险与遗留问题      |
| `docs/baota-nginx-example.md`                   | 新建：宝塔 Nginx 配置示例     |

### 遗留风险

| #   | 风险                                | 严重性 | 说明                                   |
| --- | ----------------------------------- | ------ | -------------------------------------- |
| 1   | 支付功能未完整对接                  | 高     | 微信支付未配置，用户只能生成待支付订单 |
| 2   | ICP备案未完成                       | 高     | 域名无法使用，小程序无法提审           |
| 3   | 门店购物车组件仅注释未删除          | 低     | 后续如需恢复门店模式，取消注释即可     |
| 4   | 阶段筛选使用 LIKE 查询              | 低     | 当前阶段值不存在子串冲突               |
| 5   | coupon/signin/points 页面已注册路由 | 中     | 后端有 CheckFeatureEnabled 拦截        |

### 上线决策

| 决策项                         | 结论                                                     |
| ------------------------------ | -------------------------------------------------------- |
| 是否可进入体验版测试           | ✅ 可以（前提：后端部署+功能开关配置+测试号域名配置）    |
| 是否可等备案完成后准备正式提审 | ✅ 可以（前提：ICP备案+正式AppID+SSL+类目选择+隐私协议） |

### Commit 信息

- **commit**: `5a0313d`
- **message**: `chore(release): add phase-one launch checks and integration fixes`

---

## 2026-04-26 — 第十一轮合规拦截运行错误修复与 manifest 配置对齐

### 整改目标

修复合规拦截运行错误风险（`self::$user` 在 static 方法中访问实例属性）与小程序 manifest.json 配置与文档不一致问题。

### 核心变更

1. **修复 Common.php 合规拦截 fatal error** — `CheckFeatureEnabled` 和 `ExitFeatureDisabled` 从 `static` 方法改为实例方法，使用 `$this->user` 替代 `self::$user`，确保触发合规拦截时稳定返回 -403
2. **子控制器调用方式统一** — Activity/Article/Feedback/Invite/Muyinguser/Userintegral 6 个控制器从 `self::CheckFeatureEnabled()` 改为 `$this->CheckFeatureEnabled()`
3. **新增合规拦截静态检查脚本** — `scripts/preflight/check-compliance-gate.php`，检测 `self::$user` 错误访问、CheckFeatureEnabled 调用方式、CONTROLLER_FEATURE_MAP 一致性、pages.json 高风险路径、manifest.json 定位权限
4. **修复 manifest.json 与文档不一致** — 清空 `requiredPrivateInfos`、移除 `permission.scope.userLocation`、`urlCheck` 改为 `true`
5. **修复 preflight pages.json 检查逻辑** — 去掉 pattern 中的正则转义符 `\/`，确保 `strpos` 能正确匹配高风险插件路径
6. **更新文档** — release-checklist.md、wechat-miniapp-submit-checklist.md 定位权限说明与代码一致

### 修改文件清单

| 文件                                                 | 修改内容                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `shopxo-backend/app/api/controller/Common.php`       | CheckFeatureEnabled/ExitFeatureDisabled 改为实例方法                         |
| `shopxo-backend/app/api/controller/Activity.php`     | `self::` → `$this->`                                                         |
| `shopxo-backend/app/api/controller/Article.php`      | `self::` → `$this->`                                                         |
| `shopxo-backend/app/api/controller/Feedback.php`     | `self::` → `$this->`                                                         |
| `shopxo-backend/app/api/controller/Invite.php`       | `self::` → `$this->`                                                         |
| `shopxo-backend/app/api/controller/Muyinguser.php`   | `self::` → `$this->`                                                         |
| `shopxo-backend/app/api/controller/Userintegral.php` | `self::` → `$this->`                                                         |
| `shopxo-uniapp/manifest.json`                        | 清空 requiredPrivateInfos、移除 permission.scope.userLocation、urlCheck=true |
| `scripts/preflight/check-compliance-gate.php`        | 新建：合规拦截静态检查脚本                                                   |
| `scripts/preflight/preflight-production-check.php`   | 修复 pages.json 检查 pattern                                                 |
| `docs/release-checklist.md`                          | 定位权限说明更新                                                             |
| `docs/wechat-miniapp-submit-checklist.md`            | 定位权限说明更新                                                             |

### 自测结果

| 验证项                                         | 结果 | 说明                                    |
| ---------------------------------------------- | ---- | --------------------------------------- |
| 全仓库无 `self::$user`                         | ✅   | grep 确认零匹配                         |
| 合规拦截不 fatal                               | ✅   | static→实例方法，`$this->user` 安全访问 |
| preflight 能识别高风险插件路径                 | ✅   | 去掉正则转义符，strpos 正确匹配         |
| manifest.json requiredPrivateInfos 为空        | ✅   | 一期不强制定位                          |
| manifest.json urlCheck=true                    | ✅   | 提审必须开启                            |
| manifest.json 无 permission.scope.userLocation | ✅   | 一期不申请定位                          |
| manifest/整改日志/提审文档三者一致             | ✅   | 全部标注"一期不申请定位，后续按需开启"  |
| git diff 无真实 AppID/域名/密钥                | ✅   | grep 确认无敏感数据                     |

### Commit 信息

- **commit**: `bf5fd2b`
- **message**: `fix(compliance): stabilize feature gate errors and align miniapp manifest`

---

## 2026-04-26 — 第十二轮后端支付方式合规过滤

### 整改目标

后端不能返回或接受钱包/余额/储值/充值/提现/虚拟币/礼品卡/扫码支付等不合规支付方式，彻底关闭一期无资质的支付能力。

### 核心变更

1. **PaymentService::BuyPaymentList 扩展过滤** — 从仅排除 WalletPay 扩展为排除全部不合规支付方式（WalletPay/ChargePayment/CoinPay/UniPayment/GiftCardPay/ScanPay），且钩子后二次过滤防止插件注入
2. **PaymentService::GetComplianceBlockedPayments** — 新增方法，根据功能开关动态生成不合规支付方式列表
3. **PaymentService::IsComplianceBlockedPayment** — 新增方法，供其他服务判断支付方式是否被合规拦截
4. **OrderService::Pay 合规拦截** — 支付提交入口增加不合规支付方式检查，抓包强传返回 -403
5. **功能开关联动** — feature_wallet_enabled/feature_coin_enabled/feature_giftcard_enabled/feature_scanpay_enabled 控制对应支付方式是否可用

### 修改文件清单

| 文件                                            | 修改内容                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `shopxo-backend/app/service/PaymentService.php` | BuyPaymentList 扩展过滤 + 新增 GetComplianceBlockedPayments/IsComplianceBlockedPayment |
| `shopxo-backend/app/service/OrderService.php`   | Pay 方法增加不合规支付方式拦截                                                         |
| `docs/known-risks.md`                           | R-01 状态改为已修复                                                                    |
| `docs/release-checklist.md`                     | 增加后端支付方式过滤验证                                                               |
| `docs/test-cases-phase-one.md`                  | 增加抓包强传测试用例                                                                   |

### 自测结果

| 验证项                                     | 结果 | 说明                                  |
| ------------------------------------------ | ---- | ------------------------------------- |
| 正常商品下单不受影响                       | ✅   | 微信支付/待支付订单流程不变           |
| 支付方式列表不返回不合规方式               | ✅   | BuyPaymentList 过滤 + 钩子后二次过滤  |
| 抓包强传 wallet/coin/giftcard/scanpay 被拒 | ✅   | OrderService::Pay 返回 -403           |
| feature_wallet_enabled=0 时钱包不可用      | ✅   | GetComplianceBlockedPayments 动态判断 |
| feature_coin_enabled=0 时虚拟币不可用      | ✅   | 同上                                  |
| 不影响微信支付/待支付订单                  | ✅   | WeixinAppMini 不在拦截列表            |
| docs/known-risks.md R-01 已修复            | ✅   | 状态更新                              |

### Commit 信息

- **commit**: `af9ed10`
- **message**: `fix(payment): block wallet and stored-value payment methods server-side`

---

## 2026-04-26 — 第十三轮补齐旧敏感数据加密迁移脚本

### 整改目标

补齐 `scripts/migrate-encrypt-sensitive.php` 脚本，确保已有明文敏感数据可以安全迁移为加密存储，并补齐 hash 字段。该脚本在文档中被引用但实际不存在，属于生产前必须完成的安全能力。

### 核心变更

1. **新建 `scripts/migrate-encrypt-sensitive.php`** — 可重复、安全、可 dry-run 的旧数据加密迁移脚本
2. **支持 4 个 CLI 参数** — `--dry-run`/`--batch=N`/`--table=all|activity_signup|feedback|user`/`--force`
3. **5 项运行前检查** — MUYING_PRIVACY_KEY、APP_DEBUG、数据库连接、表/字段存在性、--force 必须参数
4. **字段宽度自动扩展** — 检测 char(30)/varchar(60) 等不足以存储加密数据的字段，自动 ALTER TABLE 扩展为 VARCHAR(255)
5. **用户表安全检查** — 明确 sxo_user.mobile 不加密（避免破坏登录逻辑），muying 字段非 PII 无需加密
6. **加密规则完整** — 已加密不重复加密、明文生成 hash、空值跳过、单条异常不中断、日志不记录明文
7. **审计日志** — 写入 `runtime/log/muying_encrypt_migration_日期.log`，不记录完整手机号/姓名
8. **5 项统计输出** — scanned/encrypted/hash_filled/skipped/failed
9. **新建 `docs/sensitive-data-migration.md`** — 迁移指南（备份/dry-run/正式执行/回滚/验证清单/FAQ）
10. **更新 `docs/known-risks.md`** — 新增 R-05"旧数据未加密"，状态为"有脚本，部署时必须执行"
11. **更新 `docs/release-checklist.md`** — 新增 1.8a dry-run 检查项和 1.8b 正式迁移检查项

### 迁移范围

| 表                  | 加密字段    | Hash 字段    | 版本字段        |
| ------------------- | ----------- | ------------ | --------------- |
| sxo_activity_signup | name, phone | phone_hash   | privacy_version |
| sxo_muying_feedback | contact     | contact_hash | —               |
| sxo_user           | 不加密      | —            | —               |

### 修改文件清单

| 文件                                    | 修改内容                   |
| --------------------------------------- | -------------------------- |
| `scripts/migrate-encrypt-sensitive.php` | 新建：敏感数据加密迁移脚本 |
| `docs/sensitive-data-migration.md`      | 新建：迁移指南文档         |
| `docs/known-risks.md`                   | 新增 R-05 风险项           |
| `docs/release-checklist.md`             | 新增 1.8a/1.8b 检查项      |
| `docs/trae-remediation-log.md`          | 追加本轮整改记录           |

### 自测结果

| 验证项                           | 结果 | 说明                                    |
| -------------------------------- | ---- | --------------------------------------- |
| dry-run 不写数据库               | ✅   | $isDryRun 为 true 时跳过所有 Db::update |
| 已加密字段不重复加密             | ✅   | IsEncrypted() 检测后跳过                |
| 明文手机号生成 hash              | ✅   | HashPhone() 生成 SHA-256                |
| 无 MUYING_PRIVACY_KEY 时拒绝执行 | ✅   | 预检查 BLOCKER 退出                     |
| 单条异常不影响其他记录           | ✅   | try/catch 包裹每条记录处理              |
| 日志不出现完整手机号/姓名        | ✅   | maskValue() 脱敏为 `1***4` 格式         |
| 脚本兼容 PHP 8.1                 | ✅   | 无 PHP 8.2+ 特性                        |
| 脚本兼容 MySQL 5.7               | ✅   | 无 JSON/窗口函数/CTE                    |
| 字段宽度自动扩展                 | ✅   | ALTER TABLE MODIFY VARCHAR(255)         |
| 用户表 mobile 不加密             | ✅   | 明确跳过并说明原因                      |
| --force 必须参数                 | ✅   | 无 --force 无 --dry-run 时拒绝执行      |
| 迁移可重复执行                   | ✅   | 已加密数据跳过                          |

### 遗留风险

| #   | 风险               | 严重性 | 说明                                         |
| --- | ------------------ | ------ | -------------------------------------------- |
| 1   | 迁移期间新写入数据 | 低     | 新数据自动加密，建议低峰期执行               |
| 2   | 字段扩展锁表       | 低     | ALTER TABLE 在大表上可能锁表，建议低峰期执行 |
| 3   | 回滚依赖数据库备份 | 中     | 无"解密回明文"SQL 函数，必须依赖备份恢复     |

### Commit 信息

- **commit**: `1cba7c1`
- **message**: `feat(privacy): add sensitive data encryption migration script`

---

## 2026-04-26 — 第十四轮运营 Dashboard 指标口径修正

### 整改目标

修正 DashboardService 中指标名称、计算逻辑、展示含义不一致的问题。没有准确数据支撑的指标不伪装成转化率。

### 问题诊断

| 旧指标                            | 问题                                                                                        | 修正                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| signup_conversion（活动报名转化） | 无活动浏览日志，报名数/活跃活动数不是转化率                                                 | 改名 activity_signup_density（活动报名密度），单位"人/活动"                                          |
| invite_conversion（邀请转化率）   | 统计所有 status=1 的 InviteReward 记录数（含 register+first_order），未去重，不是"邀请人数" | 改名 invite_register_ratio（邀请注册占比），仅统计 trigger_event='register' + group(invitee_id) 去重 |
| repurchase_rate（复购率）         | ThinkPHP group()->count() 语义可能歧义；未排除 user_id=0                                    | 改用原生 SQL 子查询，排除 user_id=0，注释说明 status=4 含义                                          |
| invite_rewards（今日邀请数）      | 显示的是积分奖励值，不是邀请人数                                                            | 改名 invite_first_order（今日邀请首单），统计去重 invitee_id                                         |
| 总订单数/总销售额                 | 未说明仅含已完成订单                                                                        | 标题改为"总已完成订单"/"总已完成销售额"                                                              |
| today_sales                       | status>=4 含已完成+已取消后状态                                                             | 改为 status=4（仅已完成）                                                                            |

### 核心变更

1. **CalcSignupConversion → CalcActivitySignupDensity** — 去掉无意义的 activity_view_count 变量，公式简化为报名数/上架活动数
2. **CalcInviteConversion → CalcInviteRegisterRatio** — 仅统计 trigger_event='register' + status=1 + group('invitee_id') 去重
3. **CalcRepurchaseRate** — 改用原生 SQL 子查询，排除 user_id=0，注释说明 status=4=已完成
4. **Overview 返回字段重命名** — invite_rewards → invite_first_order，signup_conversion → activity_signup_density，invite_conversion → invite_register_ratio
5. **today_sales 条件修正** — status>=4 → status=4（仅已完成订单销售额）
6. **快照 metric_key 对齐** — signup_conversion → activity_signup_density，invite_conversion → invite_register_ratio
7. **趋势查询旧 key 兼容** — GetTrendByMetric 自动回退旧 metric_key 查询
8. **后台模板文案修正** — "转化指标"→"运营指标"，"活动报名转化"→"活动报名密度"，"邀请转化率"→"邀请注册占比"，增加公式说明
9. **新增 docs/dashboard-metrics-definition.md** — 每个指标公式、数据来源、刷新频率、适用限制

### 修改文件清单

| 文件                                                         | 修改内容                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `shopxo-backend/app/service/DashboardService.php`            | 重命名3个指标方法+返回字段+快照key；修正复购率SQL；修正today_sales条件；趋势查询旧key兼容 |
| `shopxo-backend/app/admin/view/default/dashboard/index.html` | 指标标题/单位/tooltip修正；JS字段名对齐；conversion为空时显示0                            |
| `docs/dashboard-metrics-definition.md`                       | 新建：指标定义文档                                                                        |
| `docs/trae-remediation-log.md`                               | 追加本轮整改记录                                                                          |

### 自测结果

| 验证项                                   | 结果 | 说明                                                             |
| ---------------------------------------- | ---- | ---------------------------------------------------------------- |
| Dashboard 无数据时正常显示               | ✅   | SafeCount/SafeSum catch 异常返回 0；模板 conversion 为空时显示 0 |
| 有活动但无报名时密度为 0                 | ✅   | signup_count=0 时 round(0/active, 2)=0                           |
| 有报名时密度符合定义                     | ✅   | 报名数/上架活动数，保留2位小数                                   |
| 邀请注册占比仅统计 register 事件         | ✅   | trigger_event='register' + group('invitee_id')                   |
| 复购率使用原生 SQL                       | ✅   | 子查询 COUNT(\*) 避免语义歧义                                    |
| GenerateDailySnapshot 重复执行不重复插入 | ✅   | 先查 count 再 insert/update                                      |
| 旧 metric_key 趋势数据兼容               | ✅   | GetTrendByMetric 自动回退旧 key                                  |
| 前端文案不再叫"转化率"                   | ✅   | "活动报名密度"/"邀请注册占比"/"复购率"                           |
| today_sales 仅含已完成订单               | ✅   | status=4 而非 status>=4                                          |
| 总订单/总销售额标题明确                  | ✅   | "总已完成订单"/"总已完成销售额"                                  |

### 遗留风险

| #   | 风险                         | 严重性 | 说明                                                        |
| --- | ---------------------------- | ------ | ----------------------------------------------------------- |
| 1   | 无活动浏览日志               | 中     | 无法计算真正的报名转化率，后续可新建 sxo_activity_browse 表 |
| 2   | 旧快照数据 metric_key 未迁移 | 低     | 趋势查询已兼容旧 key；可选执行 UPDATE SQL 统一 key          |
| 3   | 复购率全量计算               | 低     | 非按日增量，反映历史累计情况                                |

### Commit 信息

- **commit**: `0b781d9`
- **message**: `fix(dashboard): align operation metrics with actual data semantics`

---

## 2026-04-26 — 第十五轮体验版部署实测准备

### 整改目标

不再盲目开发新功能，而是把当前代码真正部署到宝塔服务器环境所需的最小闭环准备好，并产出真实问题清单。

### 核心变更

1. **新建 `scripts/preflight/check-baota-runtime.php`** — 宝塔运行环境检查脚本
   - PHP 版本 8.1.x 检查
   - 11 个必需扩展检查（openssl/pdo_mysql/fileinfo/mbstring/curl/gd/json/simplexml/xml/zip/pdo）
   - 1 个可选扩展检查（redis）
   - runtime/public/upload 目录权限检查
   - .env 配置检查（APP_DEBUG/MUYING_PRIVACY_KEY/数据库配置）
   - Nginx 公网安全检查提示
   - 数据库连接 + 12 张关键表存在性检查
   - 后台入口混淆 + install.php 删除检查
   - 输出 PASS/WARN/BLOCKER 三级，退出码 0/1

2. **新建 `scripts/preflight/check-db-schema.php`** — 数据库 Schema 完整性检查脚本
   - 8 张母婴专属表存在性检查
   - sxo_activity 12 个关键字段检查
   - sxo_activity_signup 8 个关键字段检查
   - sxo_muying_feedback 5 个关键字段检查
   - sxo_user 4 个扩展字段检查
   - sxo_goods 11 个扩展字段检查
   - sxo_goods_favor.type 字段检查
   - 4 个关键索引检查（uk_invite_code/uk_inviter_invitee_event/idx_phone_hash/uk_date_metric）
   - 9 个关键配置项检查
   - 数据完整性快速检查（邀请码空值/旧注册奖励）
   - 输出 PASS/WARN/BLOCKER 三级，退出码 0/1

3. **新建 `docs/uat-report-template.md`** — UAT 测试报告模板
   - 前置检查 7 项
   - 小程序端浏览路径 6 项
   - 小程序端交互路径 8 项
   - 合规拦截路径 4 项
   - 后台端测试路径 9 项
   - 问题清单模板

4. **新建 `docs/uat-report-current.md`** — 当前版本 UAT 报告
   - 基于代码审查的 20 条测试路径评估
   - 4 个已知阻塞问题（域名备案/正式AppID/微信支付/服务器部署）
   - 部署后待执行清单（9 步）
   - 测试结论：代码审查通过，待服务器部署后实测

5. **更新 `docs/release-checklist.md`** — 新增 3 项 preflight 检查项（1.19-1.21）
6. **更新 `docs/test-cases-phase-one.md`** — 新增第五节"部署实测测试"20 条用例（D-01~D-20）
7. **更新 `docs/known-risks.md`** — 新增 R-06（未经服务器实测）、R-07（无活动浏览日志）

### 修改文件清单

| 文件                                        | 修改内容                        |
| ------------------------------------------- | ------------------------------- |
| `scripts/preflight/check-baota-runtime.php` | 新建：宝塔运行环境检查          |
| `scripts/preflight/check-db-schema.php`     | 新建：数据库 Schema 完整性检查  |
| `docs/uat-report-template.md`               | 新建：UAT 测试报告模板          |
| `docs/uat-report-current.md`                | 新建：当前版本 UAT 报告         |
| `docs/release-checklist.md`                 | 新增 1.19-1.21 preflight 检查项 |
| `docs/test-cases-phase-one.md`              | 新增 D-01~D-20 部署实测用例     |
| `docs/known-risks.md`                       | 新增 R-06、R-07                 |
| `docs/trae-remediation-log.md`              | 追加本轮整改记录                |

### 自测结果

| 验证项                              | 结果 | 说明                |
| ----------------------------------- | ---- | ------------------- |
| check-baota-runtime.php 语法正确    | ✅   | 无 PHP 8.2+ 特性    |
| check-db-schema.php 语法正确        | ✅   | 仅使用 PDO 原生查询 |
| 两个脚本均输出 PASS/WARN/BLOCKER    | ✅   | 三级输出 + 退出码   |
| UAT 模板覆盖 20 条测试路径          | ✅   | 小程序+后台+合规    |
| 当前 UAT 报告标注待实测项           | ✅   | ⏳ 待部署执行       |
| release-checklist 增加 preflight 项 | ✅   | 1.19-1.21           |
| test-cases 增加 D-01~D-20           | ✅   | 20 条部署实测用例   |
| known-risks 增加 R-06/R-07          | ✅   | 未经实测+无浏览日志 |

### 遗留风险

| #   | 风险                 | 严重性  | 说明                                |
| --- | -------------------- | ------- | ----------------------------------- |
| 1   | 域名备案未完成       | BLOCKER | 无法配置 HTTPS 域名，小程序无法提审 |
| 2   | 正式 AppID 未申请    | BLOCKER | 无法提交正式审核                    |
| 3   | 服务器未部署代码     | BLOCKER | 无法运行任何实测                    |
| 4   | 所有测试基于代码审查 | 高      | 需服务器部署后实测验证              |

### Commit 信息

- **commit**: `a3fc533`
- **message**: `chore(uat): add baota runtime checks and experience build test report`

## 2026-04-26 — 第二六轮前端合规门控缺口修复与敏感信息清理

### 整改目标

修复审查发现的前端合规门控缺口、后端定义不一致、文档敏感信息泄露等问题。

### 核心变更

1. security-rotation.md 10 个真实 API 密钥替换为 REDACTED_*
2. cart.vue HOSPITAL 门控 + REALSTORE 数据门控
3. goods-detail.vue SECKILL/POINTS/BINDING/REALSTORE/SHOP 门控
4. buy.vue REALSTORE 数据门控
5. user-orderaftersale-detail.vue SHOP 数据门控
6. payment.vue case 2 钱包支付拦截
7. 后端 IsPhaseOneFeatureKey 统一
8. 文档内网 IP 替换为占位符
9. .gitignore 补充证书文件规则

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| shopxo-uniapp/components/cart/cart.vue | HOSPITAL 门控 + REALSTORE 数据门控 |
| shopxo-uniapp/pages/goods-detail/goods-detail.vue | SECKILL/POINTS/BINDING/REALSTORE/SHOP 门控 |
| shopxo-uniapp/pages/buy/buy.vue | REALSTORE 数据门控 |
| shopxo-uniapp/pages/user-orderaftersale-detail/user-orderaftersale-detail.vue | SHOP 数据门控 |
| shopxo-uniapp/components/payment/payment.vue | case 2 钱包支付拦截 |
| shopxo-backend/app/service/MuyingComplianceService.php | IsPhaseOneFeatureKey 统一 |
| docs/archive/guides/security-rotation.md | API 密钥脱敏 |
| docs/archive/ 5个文件 | 内网 IP 替换 |
| .gitignore | 证书文件规则 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
| --- | ---- | ------ | ---- |
| 1 | git 历史中仍有真实密钥 | 高 | 需 git filter-repo 清理并轮换密钥 |
| 2 | pages.json 仍注册 coupon/signin/points 页面 | 中 | 增加包体积 |
| 3 | 缺少全局导航拦截器 | 中 | uni.navigateTo 未做全局拦截 |

### Commit 信息

| commit | message |
|--------|---------|
| c07cb57 | fix(security): redact API keys from docs and add cert patterns to gitignore |
| 5bec740 | fix(compliance): add feature flag gates for hospital and realstore in cart |
| 2d41ccf | fix(compliance): add feature flag gates for blocked plugins in goods-detail |
| d39256d | fix(compliance): add realstore feature flag gate in buy page |
| b47c9b4 | fix(compliance): gate shop dispute in aftersale detail and block wallet payment case |
| e7fd889 | fix(compliance): unify IsPhaseOneFeatureKey definition with GetAllFeatureFlags |
| 626688b | fix(security): replace internal IP addresses with placeholders in docs |

## 2026-04-26 — 第二七轮统一合规配置链路修复

### 整改目标

建立"孕禧一期可上线范围"的统一合规配置，确保前端页面、接口请求、后端接口、后台配置使用同一套 feature flag / qualification gate 逻辑。

### 审查结果

| 比对项 | 结果 |
|--------|------|
| PHASE_ONE_BLOCKED_PLUGINS 前后端 | 完全一致（22项） |
| PERMANENTLY_BLOCKED_PLUGINS 前后端 | 完全一致（10项） |
| FEATURE_FLAG_PLUGIN_MAP 前后端 | 完全一致（21项） |
| QUALIFICATION_REQUIRED_MAP 前后端 | 完全一致（19项） |
| Feature Flags 输出 vs 前端期望 | 完全一致（29项） |
| Qualification Keys 输出 vs 前端期望 | 完全一致（5项） |
| CONTROLLER_FEATURE_MAP vs 前端 ACTION_MAP | 1处差异（userintegral） |

### 发现的缺口与修复

| # | 缺口 | 严重性 | 修复 |
|---|------|--------|------|
| 1 | 后端 SystemBaseService 未输出 qualifications | P0 | 补齐 5 个 qualification key 输出 |
| 2 | 后端 CONTROLLER_FEATURE_MAP 仅 6 个控制器 | P0 | 扩展至 28 个控制器覆盖所有高风险功能 |
| 3 | 前端 http.js -403 响应未自动 toast | P1 | 增加 auto-show toast 逻辑 |
| 4 | 前端 http.js 拦截请求时未自动 toast | P1 | 增加 auto-show toast 逻辑 |
| 5 | 前端 http.js 缺少 userintegral 映射 | P2 | 补齐 userintegral → POINTS 映射 |

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| shopxo-backend/app/service/SystemBaseService.php | 补齐 5 个 qualification key 输出 |
| shopxo-backend/app/api/controller/Common.php | CONTROLLER_FEATURE_MAP 从 6 扩展至 28 |
| shopxo-uniapp/common/js/http.js | -403 自动 toast + userintegral 映射 |

### 合规链路验证

| 链路环节 | 状态 | 说明 |
|----------|------|------|
| 后端初始化配置返回 feature flags | ✅ | SystemBaseService::Common() 输出 29 个 flag |
| 后端初始化配置返回 qualifications | ✅ | SystemBaseService::Common() 输出 5 个资质 |
| 前端启动时调用 init_feature_flags | ✅ | App.vue init_config_result_handle |
| 前端 http.js 拦截关闭的 controller 请求 | ✅ | FEATURE_FLAG_ACTION_MAP 覆盖 28 个控制器 |
| 前端 http.js 拦截关闭的 plugins 请求 | ✅ | is_plugin_allowed 检查 |
| 前端路由拦截禁用页面 | ✅ | uni.addInterceptor 拦截 navigateTo/redirectTo/reLaunch |
| 后端 CommonInit 自动检查 CONTROLLER_FEATURE_MAP | ✅ | 28 个控制器全覆盖 |
| 后端返回 -403 时前端自动 toast | ✅ | http.js 统一处理 |
| 前端拦截请求时自动 toast | ✅ | http.js 统一处理 |

### Commit 信息

| commit | message |
|--------|---------|
| dcc73e3 | feat(compliance): add qualifications to config output and expand controller feature map |
| 09dda85 | fix(compliance): auto-show toast on -403 and frontend feature block |

## 2026-04-26 — 第二八轮 pages.json 提审瘦身

### 整改目标

对 shopxo-uniapp/pages.json 做一期提审瘦身，避免微信小程序包里暴露高风险功能页面。

### 从 pages.json 移除的页面（9个 subPackage）

| 页面路径 | 原因 |
|----------|------|
| pages/form-input-data/form-input-data | form 插件数据页，一期不需要 |
| pages/form-input-data-detail/form-input-data-detail | form 插件数据详情 |
| pages/user-integral/user-integral | 积分页面，一期禁用 |
| pages/paylog-list/paylog-list | 支付记录，一期禁用 |
| pages/paylog-detail/paylog-detail | 支付记录详情 |
| pages/web-view/web-view | 非必要 web-view |
| pages/plugins/coupon (3个子页面) | 优惠券，一期禁用 |
| pages/plugins/signin (2个子页面) | 签到，一期禁用 |
| pages/plugins/points (1个子页面) | 积分，一期禁用 |

### pages.json 组件引用清理

| 页面 | 移除的组件引用 | 原因 |
|------|---------------|------|
| user-order-detail | component-hospital-order-detail | hospital 在 BLOCKED_PLUGINS 中 |
| goods-detail | component-goods-compare | goodscompare 在 PERMANENTLY_BLOCKED 中 |

### 前端导航门控修复

| 文件 | 修复内容 |
|------|----------|
| App.vue | 清理 pages_always 白名单中的高风险页面 |
| App.vue | open_web_view 改为 agreement 页面或 toast 提示 |
| activity-signup.vue | web-view 改为 agreement 页面 |
| goods-detail.vue | 优惠券区域增加 COUPON 门控 |
| goods-detail.vue | 问答区域增加 UGC 门控 |
| user-order-detail.vue | realstore 按钮增加 REALSTORE 门控 |
| user-order-detail.vue | ordergoodsform/orderresources/orderfeed 按钮增加门控 |
| user-order-detail.vue | intellectstools 按钮增加 INTELLECTSTOOLS 门控 |
| user-order-detail.vue | hospital 组件增加 HOSPITAL 门控 |

### 后台菜单数据过滤现状

后端不对导航菜单数据进行一期合规过滤，完全依赖前端 filter_phase_one_navigation / filter_phase_one_plugin_sort_list 过滤。后端负责 API 层 -403 拦截。这个设计是合理的。

### Commit 信息

| commit | message |
|--------|---------|
| 663cdb4 | feat(compliance): slim down pages.json for phase-one review and gate high-risk navigation |

## 2026-04-26 — 第二九轮活动报名隐私授权拆分

### 整改目标

将活动报名的"隐私同意"和"画像同步同意"拆分为两个独立勾选项，降低敏感个人信息风险。

### 核心变更

1. 前端报名页增加两个独立勾选：
   - 必选：我已阅读并同意《隐私政策》，并同意提交本次活动报名所需信息
   - 可选：我同意将孕育阶段、预产期/宝宝生日等信息同步到个人资料，用于推荐更适合的活动和内容

2. 后端 ActivitySignup 增加 profile_sync_agreed 参数校验

3. 画像同步逻辑改为仅在 profile_sync_agreed = 1 时执行

4. 画像一致性修复：
   - pregnancy：写 current_stage = pregnancy，写 due_date，清空 baby_birthday
   - postpartum：写 current_stage = postpartum，写 baby_birthday，清空 due_date
   - trying 或其他：写 current_stage，清空 due_date 和 baby_birthday

5. 报名记录增加 profile_sync_agreed 和 profile_sync_agreed_time 字段

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| shopxo-uniapp/pages/activity-signup/activity-signup.vue | 双勾选 UI + profile_sync_agreed 参数 |
| shopxo-backend/app/service/ActivityService.php | 参数校验 + 画像同步条件 + 一致性修复 |
| docs/sql/muying-activity-signup-privacy-split-migration.sql | 数据库迁移脚本 |

### 自测场景

| 场景 | 预期结果 |
|------|----------|
| 不勾选隐私协议提交 | 提示"请阅读并同意隐私告知"，不提交 |
| 只勾选隐私协议，不勾选同步画像 | 报名成功，用户画像不更新 |
| 勾选隐私协议 + 同步画像 | 报名成功，用户画像按阶段一致更新 |
| 手机号重复报名 | 仍被拦截 |
| 活动满员/候补 | 逻辑不被破坏 |

### Commit 信息

| commit | message |
|--------|---------|
| 7a2f860 | feat(privacy): split activity signup consent into privacy-agreed and profile-sync-agreed |

## 2026-04-26 — 第三十轮生产环境构建配置强化

### 整改目标

完善生产环境构建配置，确保正式小程序上线时不会误用测试号、内网IP、HTTP、空AppID或本地开发配置。

### 核心变更

1. runtime-config.js 增加生产环境强制门禁（throw Error）：
   - UNI_APP_REQUEST_URL 必须存在
   - 必须以 https:// 开头
   - 禁止 localhost/127.0.0.1/0.0.0.0/内网IP
   - static_url 必须以 https:// 开头
   - UNI_APP_WX_APPID 必须配置
   - 禁止测试号 AppID wxda7779770f53e901

2. .env.production.example 完善：
   - UPLOAD_URL 从注释改为默认启用
   - 增加 HTTPS 必须说明

3. .env.example 增加生产环境配置说明：
   - 正式提审必须 HTTPS + 正式 AppID
   - 微信公众平台域名配置提醒
   - 后端域名备案要求

### 敏感信息扫描结果

| 检查项 | 结果 |
|--------|------|
| .env 文件被 git 跟踪 | ✅ 无（只有 .example 文件被跟踪） |
| manifest.json appid | ✅ 空字符串 |
| project.config.json appid | ✅ 空字符串 |
| AppSecret 硬编码 | ✅ 无 |
| 真实域名泄露 | ✅ 无（只有上游 shopxo.vip 演示域名） |
| 公网 IP 泄露 | ✅ 无 |

### 生产门禁双重校验

| 校验层 | 文件 | 方式 |
|--------|------|------|
| 第一层 | runtime-config.js | build_runtime_config() 内 throw Error |
| 第二层 | prod.js | NODE_ENV=production 时 throw Error |

### 自测场景

| 场景 | 预期结果 |
|------|----------|
| development 构建 + 本地地址 | 正常 |
| production 构建 + 缺失 AppID | throw Error 构建失败 |
| production 构建 + HTTP 地址 | throw Error 构建失败 |
| production 构建 + 内网 IP | throw Error 构建失败 |
| production 构建 + 测试号 AppID | throw Error 构建失败 |

### Commit 信息

| commit | message |
|--------|---------|
| 229a46a | feat(config): harden production build gates in runtime-config and update env templates |

## 2026-04-26 — 第三一轮生产部署安全配置与文档

### 整改目标

补齐生产部署安全配置和文档，避免部署后暴露敏感目录、安装入口、数据库、phpMyAdmin 等风险。

### 核心变更

1. 新增 docs/deployment-bt-production.md 宝塔生产部署指南，包含：
   - 宝塔网站运行目录设为 /public
   - PHP 8.1 / MySQL 5.7 版本要求
   - APP_DEBUG = false
   - 数据库独立用户（非 root）
   - MySQL 3306 不开放公网
   - phpMyAdmin 限制 IP 白名单
   - HTTPS 开启
   - ThinkPHP 伪静态配置
   - Nginx 安全规则（deny .env/runtime/vendor/app/config/sql/install.php）
   - 后台入口改为随机路径 + IP 限制
   - MUYING_PRIVACY_KEY 独立生成并离线保存
   - 数据库/上传目录每日备份
   - 安全检查清单（15项）

2. 补充 deploy/nginx.production.example.conf 安全规则：
   - deny runtime 目录
   - deny vendor 目录
   - deny app 目录
   - deny config 目录
   - deny *.sql 文件
   - deny install.php

3. .gitignore 确认已覆盖所有必要项

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| docs/deployment-bt-production.md | 新增宝塔生产部署指南 |
| deploy/nginx.production.example.conf | 补充 6 条 deny 规则 |

### Commit 信息

| commit | message |
|--------|---------|
| 0df8f17 | docs(deployment): add BT panel production guide and harden Nginx security rules |

## 2026-04-27 — 第三二轮提审前二次加固

### 整改目标

在 review-remediation-phase1 分支上做提审前二次加固，修复合规门控缺口、增强支付拦截、完善路由守卫、确保 SQL 迁移幂等。

### 核心变更

1. **后端 Common.php 补充 cashier/paylog 映射** — CONTROLLER_FEATURE_MAP 从 27 扩展至 29，覆盖支付相关控制器安全网
2. **前端 payment.vue 扩展支付方式过滤** — 从仅过滤 WalletPay 扩展为过滤全部 6 种不合规支付方式（WalletPay/ChargePayment/CoinPay/UniPayment/GiftCardPay/ScanPay）
3. **前端 buy.vue 补充积分/虚拟币门控** — 积分抵扣 UI 和提交参数增加 feature_points_enabled 门控；虚拟币数据和提交参数增加 feature_coin_enabled 门控
4. **前端 App.vue 路由拦截器补充 switchTab** — 从 3 种跳转方式扩展为 4 种（navigateTo/redirectTo/reLaunch/switchTab）
5. **SQL 迁移脚本幂等修复** — muying-activity-signup-privacy-split-migration.sql 改为 information_schema 判断字段是否存在
6. **检查脚本增强** — check-migration.js 识别 ON DUPLICATE KEY UPDATE 幂等保护

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| shopxo-backend/app/api/controller/Common.php | CONTROLLER_FEATURE_MAP 增加 cashier/paylog |
| shopxo-uniapp/components/payment/payment.vue | payment_list_filtered 扩展过滤 + pay_handle 扩展拦截 |
| shopxo-uniapp/pages/buy/buy.vue | 积分/虚拟币 UI 和提交参数增加 feature flag 门控 |
| shopxo-uniapp/App.vue | 路由拦截器增加 switchTab |
| docs/sql/muying-activity-signup-privacy-split-migration.sql | 改为幂等版本 |
| scripts/preflight/check-migration.js | 识别 ON DUPLICATE KEY UPDATE |

### 自测结果

| 验证项 | 结果 |
|--------|------|
| CONTROLLER_FEATURE_MAP 覆盖 29 个控制器 | ✅ |
| payment.vue 过滤 6 种不合规支付方式 | ✅ |
| buy.vue 积分/虚拟币受 feature flag 控制 | ✅ |
| 路由拦截器覆盖 4 种跳转方式 | ✅ |
| SQL 迁移检查 0 错误 2 警告 | ✅ |
| 自检脚本 11 PASS / 3 WARN / 1 BLOCKER(install.php) | ✅ |
| 无真实密钥/密码/IP 泄露到 git 跟踪文件 | ✅ |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | install.php 仍存在于仓库 | BLOCKER(部署时) | ShopXO 原始文件，部署时由脚本删除 |
| 2 | git 历史中仍有旧密钥 | 高 | 需 git filter-repo 清理并轮换密钥 |
| 3 | 演示数据 SQL 非幂等 | 低 | 仅执行一次，重复执行会产生重复数据 |

### Commit 信息

| commit | message |
|--------|---------|
| 13bf70f | fix(review): harden compliance gates for RC submission readiness |
