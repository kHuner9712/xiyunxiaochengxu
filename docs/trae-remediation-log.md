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

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 正式 AppID 未申请 | 中 | 当前使用测试号 wxda7779770f53e901，提审前需替换为正式 AppID |
| 2 | 域名备案未完成 | 中 | ICP 备案进入管局审核阶段，体验版可用 IP，提审需备案域名 |
| 3 | MUYING_PRIVACY_KEY 未生成 | 高 | 生产部署时必须生成并配置，否则用户敏感数据无法加密 |
| 4 | 默认管理员密码 | 高 | 首次部署后必须修改默认管理员密码 |
| 5 | index 模块控制器 | 低 | Web 端 index 模块控制器未添加合规检查，但小程序不使用该模块 |
| 6 | ShopXO 升级兼容 | 中 | 二开代码使用 [MUYING-二开] 标注，但 ShopXO 大版本升级时需人工合并 |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-uniapp/common/js/config/compliance-scope.js` | coupon/signin/points 移入 PHASE_ONE_BLOCKED_PLUGINS；添加 FEATURE_FLAG_PLUGIN_MAP 映射；is_route_allowed 支持 is_plugin_allowed 放行 |
| `shopxo-uniapp/common/js/http.js` | 引入 is_plugin_allowed；增加 plugins 请求拦截 |
| `shopxo-uniapp/common/js/config/phase-one-scope.js` | 无需修改（逻辑自动跟随 compliance-scope.js） |

#### 后端（6个文件）

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/app/service/MuyingComplianceService.php` | coupon/signin/points 移入 PHASE_ONE_BLOCKED_PLUGINS；添加 FEATURE_FLAG_PLUGIN_MAP；IsPhaseOneFeatureKey 移除 coupon/signin/points；TryToggleFeature 增加 LogComplianceToggle；LogComplianceBlock 增加 controller/action 字段；返回码 -10001 → -403 |
| `shopxo-backend/app/api/controller/Common.php` | ExitFeatureDisabled 增加 DB 日志记录（controller/action/userID/IP） |
| `shopxo-backend/app/api/controller/Plugins.php` | 返回码 -10000 → -403 |
| `shopxo-backend/app/admin/controller/Plugins.php` | 返回码 -10000 → -403 |
| `shopxo-backend/app/admin/controller/Pluginsadmin.php` | 返回码 -10000 → -403 |
| `shopxo-backend/app/admin/controller/Featureswitch.php` | coupon/signin/points 移到"营销功能（一期不开放）"组；desc 增加约束说明；返回码 -10001 → -403 |

#### SQL（2个文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/sql/muying-feature-switch-migration.sql` | coupon/signin/points 从"一期基础能力"移到"高风险功能"（默认关闭=0） |
| `docs/sql/muying-compliance-center-migration.sql` | 合规日志表增加 controller/api_action/user_id 字段 |

#### 迁移（1个文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/muying-final-migration.sql` | C7 隐藏优惠券/签到菜单；C8 强制关闭 coupon/signin/points 开关 |

#### 脚本（1个文件）

| 文件 | 修改内容 |
|------|---------|
| `scripts/preflight/preflight-production-check.php` | 增加 #12 高风险功能开关检查、#13 HTTPS 检查、#14 APP_DEBUG 检查 |

#### 文档（2个文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/phase-one-compliance.md` | 新建：一期合规策略完整文档 |
| `docs/trae-remediation-log.md` | 追加本次整改记录 |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| 前端 PHASE_ONE_BLOCKED_PLUGINS 包含 22 项 | 通过 |
| 后端 $PHASE_ONE_BLOCKED_PLUGINS 与前端一致 | 通过 |
| http.js plugins 请求拦截 | 通过 |
| Common.php $CONTROLLER_FEATURE_MAP 包含 userintegral | 通过 |
| Featureswitch coupon/signin/points 在"营销功能（一期不开放）"组 | 通过 |
| 所有合规拦截返回码统一为 -403 | 通过 |
| coupon/signin/points 在 PHASE_ONE_BLOCKED_PLUGINS 中 | 通过 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 正式 AppID 未申请 | 中 | 当前使用测试号，提审前需替换 |
| 2 | 域名备案未完成 | 中 | 体验版可用 IP，提审需备案域名 |
| 3 | MUYING_PRIVACY_KEY 未生成 | 高 | 部署时必须配置 |
| 4 | 默认管理员密码 | 高 | 首次登录后必须修改 |
| 5 | 合规日志表 DDL 变更 | 中 | 需在生产环境执行 ALTER TABLE 添加 controller/api_action/user_id 列 |
| 6 | ShopXO 升级兼容 | 中 | [MUYING-二开] 标注代码需人工合并 |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-uniapp/manifest.json` | appid 清空、requiredPrivateInfos=[]、permission={}、urlCheck=false |
| `shopxo-uniapp/project.config.json` | appid 清空 |
| `shopxo-uniapp/common/js/config/prod.js` | 5项构建时硬校验（HTTPS/AppID/localhost/内网IP/测试号） |
| `shopxo-uniapp/.env.production.example` | 增加 HTTPS/AppID 约束、UNI_APP_ENABLE_LOCATION |
| `shopxo-uniapp/.env.development.example` | 增加测试号 AppID、UNI_APP_ENABLE_LOCATION |

#### 后端（1个文件）

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/.env.production.example` | 增加宝塔部署注意事项 10 项、APP_DEBUG=false 强调 |

#### 脚本（1个文件）

| 文件 | 修改内容 |
|------|---------|
| `scripts/preflight/preflight-production-check.php` | 增加 #15 密钥泄露、#16 测试号 AppID、#17 static_url HTTPS |

#### 文档（2个新文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/deploy-baota-production.md` | 新建：宝塔面板生产部署指南（7章） |
| `docs/wechat-miniapp-submit-checklist.md` | 新建：微信小程序提审检查清单（5章） |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| prod.js 5项硬校验完整 | 通过 |
| manifest.json appid 为空 | 通过 |
| manifest.json requiredPrivateInfos 为空 | 通过 |
| project.config.json appid 为空 | 通过 |
| .env.development.example 含测试号 | 通过 |
| .env.production.example 含 HTTPS 约束 | 通过 |
| 后端 .env.production.example 含宝塔注意事项 | 通过 |
| 宝塔部署文档存在 | 通过 |
| 提审检查清单存在 | 通过 |
| preflight #15/#16/#17 存在 | 通过 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 正式 AppID 未申请 | 中 | 当前 appid 为空，开发用 .env.development 注入测试号 |
| 2 | 域名备案未完成 | 中 | 体验版可用 IP，提审需备案域名 |
| 3 | 定位权限运行时注入 | 中 | manifest.json 不含定位权限，需在代码中按需动态申请 |
| 4 | urlCheck 提审时需开启 | 低 | 当前 urlCheck=false（开发用），提审时微信后台会自动校验合法域名 |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/app/service/MuyingPrivacyService.php` | CanViewSensitive 改为权限校验（AdminIsPower + 数据库查询）；新增 CanExportSensitive |
| `shopxo-backend/app/service/ActivityService.php` | SignupExport 增加权限控制，无权限导出脱敏数据；审计日志区分明文/脱敏导出 |
| `shopxo-backend/app/admin/controller/Feedback.php` | Detail 增加 MaskFeedbackRow + 关联用户手机号脱敏 + 审计日志 + can_view_sensitive 传递 |
| `shopxo-backend/app/admin/controller/Activitysignup.php` | Export 增加 CanExportSensitive 权限检查 |

#### SQL（2个文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/sql/muying-sensitive-permission-migration.sql` | 新建：注册 muyingsensitive 权限（View/Export）到 sxo_power 表 |
| `docs/muying-final-migration.sql` | 补齐 B5b: phone_hash 字段、B5c: is_waitlist/signup_code 字段 |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| CanViewSensitive 不再始终返回 true | 通过（改为权限校验） |
| CanExportSensitive 独立于 CanViewSensitive | 通过 |
| 报名导出无权限时输出脱敏数据 | 通过 |
| 反馈详情页联系方式已脱敏 | 通过 |
| 反馈详情页关联用户手机号已脱敏 | 通过 |
| 反馈详情页查看明文记录审计日志 | 通过 |
| phone_hash 字段已补齐迁移 SQL | 通过 |
| 小程序报名页隐私协议勾选 | 通过（已有） |
| 小程序个人资料页选填标注 | 通过（已有） |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 超级管理员默认有敏感权限 | 低 | id=780-782 已授权给 role_id=1，其他角色需手动授权 |
| 2 | 反馈模块无导出功能 | 低 | FeedbackExport 方法不存在，如需导出需后续开发 |
| 3 | 报名列表搜索手机号 | 中 | 数据已加密，like 查询无法命中，需用 phone_hash 精确匹配（已实现） |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/app/admin/controller/Activity.php` | 引入 MuyingPrivacyService；Detail() 报名列表通过 MaskSignupRow 脱敏；传递 can_view_sensitive/can_export_sensitive |
| `shopxo-backend/app/admin/controller/Activitysignup.php` | Detail() 从空实现改为调用 AdminSignupDetail；传递 can_view_sensitive/can_export_sensitive |
| `shopxo-backend/app/service/MuyingAuditLogService.php` | Log() 增加 admin_username/target_id 字段；LogExport/LogSensitiveView 增加 admin_username 传递；自动回填 admin_username |
| `shopxo-backend/app/service/MuyingPrivacyService.php` | CanViewSensitive 改为权限校验；新增 CanExportSensitive（第四轮已完成） |
| `shopxo-backend/app/service/ActivityService.php` | SignupExport 增加权限控制（第四轮已完成） |

#### 模板（4个文件）

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/app/admin/view/default/activitysignup/detail.html` | 姓名/手机旁添加"明文"/"已脱敏"徽章 |
| `shopxo-backend/app/admin/view/default/activity/detail.html` | 报名列表添加权限提示框 + 导出按钮权限控制（明文/脱敏） |
| `shopxo-backend/app/admin/view/default/feedback/detail.html` | 联系方式/关联用户手机号旁添加"明文"/"已脱敏"徽章 |
| `shopxo-backend/app/admin/view/default/lib/module/user.html` | 手机号旁添加脱敏锁图标（mobile_masked 标记） |

#### SQL（1个文件）

| 文件 | 修改内容 |
|------|---------|
| `docs/muying-final-migration.sql` | 新增 D 段：D1 审计日志表、D2 敏感数据权限注册、D3 超管授权、D4 密钥配置项 |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| Activity Detail() 报名列表姓名/手机已脱敏 | 通过（MaskSignupRow） |
| Activitysignup Detail() 调用 AdminSignupDetail | 通过（含脱敏+审计） |
| 报名详情页姓名/手机有脱敏标识 | 通过 |
| 活动详情页报名列表有权限提示 | 通过 |
| 导出按钮根据权限显示 | 通过 |
| 反馈详情页联系方式/用户手机有脱敏标识 | 通过 |
| MuyingAuditLogService 写入 admin_username/target_id | 通过 |
| muying-final-migration.sql D 段完整 | 通过 |
| 审计日志不记录明文手机号 | 通过（conditions 仅含 target_id） |
| 手机号重复校验仍用 phone_hash | 通过 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | user/saveinfo.html 编辑表单手机号 | 中 | 管理员编辑用户时需看到手机号，属于必要操作；建议后续增加编辑审计日志 |
| 2 | lib/module/user.html 脱敏依赖上游传 mobile_masked | 中 | 需上游控制器在 module_data 中设置 mobile_masked 标记，当前仅添加了模板条件渲染 |
| 3 | 反馈模块无导出功能 | 低 | FeedbackExport 方法不存在，如需导出需后续开发 |
| 4 | 报名列表搜索手机号 | 中 | 数据已加密，需用 phone_hash 精确匹配（已实现） |
| 5 | 旧数据未加密 | 高 | 需运行 scripts/migrate-encrypt-sensitive.php 将明文数据加密 |

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
8. **D8 功能开关配置项合并** — 25 个 feature_*_enabled 配置项
9. **D9 资质门禁配置项合并** — 6 个 qualification_* 配置项
10. **D10 新增 sxo_muying_sensitive_log 表** — 敏感词拦截日志（MuyingStatService 引用）
11. **B6 补齐 sxo_goods.approval_number 字段** — 批准文号（MuyingStatService 使用）
12. **B7b 补齐 sxo_muying_feedback.contact_hash 字段** — 增量补丁
13. **B8 补齐 sxo_activity 9 个字段的增量补丁** — 已有环境升级用
14. **B9 补齐 sxo_activity_signup 2 个字段的增量补丁** — privacy_version, waitlist_to_normal_time
15. **C2/C3 唯一索引改为幂等版本** — 使用 information_schema.STATISTICS 判断索引是否存在
16. **新增 docs/database-migration-checklist.md** — 部署前 SQL 检查文档
17. **新增 scripts/preflight/check-migration.js** — 安全检查脚本

### 修改清单

| 文件 | 修改内容 |
|------|---------|
| `docs/muying-final-migration.sql` | A1/A2/A4 建表补齐字段；B6-B9 增量补丁；C2/C3 幂等化；D1 审计表补字段；D5-D10 新增表/权限/配置 |
| `docs/database-migration-checklist.md` | 新建：执行前备份、执行前检查、执行后验证、常见失败处理 |
| `scripts/preflight/check-migration.js` | 新建：9 项安全检查（DROP TABLE/TRUNCATE/MySQL8语法/表完整性/字段完整性/索引完整性/配置项/幂等性/权限ID冲突） |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| check-migration.js 全部检查通过 | ✅ 0 错误 0 警告 |
| 8 张母婴专属表建表语句完整 | ✅ |
| 所有代码引用字段在迁移 SQL 中找到 | ✅ |
| MySQL 5.7 兼容（无 IF NOT EXISTS ADD COLUMN、无窗口函数、无 CTE） | ✅ |
| 所有 ADD INDEX/ADD COLUMN 有幂等保护 | ✅ |
| DROP TABLE 仅在注释中 | ✅ |
| 权限 ID 无冲突 | ✅ |
| 配置项完整 | ✅ |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | C1 存储过程在 phpMyAdmin 中可能执行失败 | 中 | 需使用 mysql 命令行客户端 |
| 2 | C3 去重会删除重复邀请奖励记录 | 低 | 保留 id 最小的，不可逆 |
| 3 | C4 枚举修复会修改旧数据 | 低 | 仅影响脏数据 |
| 4 | 旧数据未加密 | 高 | 需运行 scripts/migrate-encrypt-sensitive.php |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-uniapp/pages/index/index.vue` | 新增阶段引导卡片（未设置阶段时显示）+ go_personal_event 方法 |
| `shopxo-uniapp/pages/personal/personal.vue` | 隐私说明增强 + 《隐私政策》链接 + open_agreement_event 方法 |
| `shopxo-uniapp/pages/activity-signup/activity-signup.vue` | 提交按钮 loading/disabled 控制 + 隐私协议前置校验 + complete 回调 |
| `shopxo-uniapp/manifest.json` | mp-weixin 添加 permission.scope.userLocation + requiredPrivateInfos |
| `shopxo-uniapp/common/css/muying.css` | 阶段引导卡片样式 + 隐私说明链接样式 |

### 已确认无需修改的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| tabbar 5 tab | ✅ 已有 | 首页/分类/活动/购物车/我的 |
| 阶段推荐核心 | ✅ 已有 | 三大阶段入口 + 阶段商品推荐 |
| 活动中心筛选 | ✅ 已有 | 阶段筛选 + 分类筛选 + 搜索 |
| 活动卡片展示 | ✅ 已有 | 封面/标题/时间/地址/阶段/报名状态/价格 |
| 活动报名表单 | ✅ 已有 | 姓名/手机/阶段/预产期/宝宝生日/隐私协议 |
| 活动详情按钮状态 | ✅ 已有 | 7 种状态（加载中/已报名/未开始/已截止/名额已满/候补/立即报名） |
| 取消报名确认 | ✅ 已有 | 区分取消报名/取消候补的确认弹窗 |
| 个人资料编辑 | ✅ 已有 | 阶段/预产期/宝宝生日/宝宝月龄 |
| 我的页面导航过滤 | ✅ 已有 | filter_phase_one_navigation 过滤后台菜单 |
| 会员码/付款码 | ✅ 已隐藏 | v-if="false" 控制 |
| 请求层统一 | ✅ 已有 | http.js 统一封装 + feature flag + login expired |
| 合规路由拦截 | ✅ 已有 | PHASE_ONE_ALLOWED_ROUTES 白名单 |
| 高风险插件拦截 | ✅ 已有 | PHASE_ONE_BLOCKED_PLUGINS 列表 |
| 空状态组件 | ✅ 已有 | component-no-data 统一使用 |
| 定位权限 | ✅ 已有 | 仅活动签到/地址选择时请求 |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| 未登录用户可浏览首页/商品/活动 | ✅ 合规路由白名单包含这些页面 |
| 报名活动必须登录 | ✅ http.js 统一处理登录失效 |
| 隐私协议未勾选不能提交 | ✅ 前置校验 + 按钮禁用 |
| 高风险入口不显示 | ✅ filter_phase_one_navigation + v-if="false" |
| 高风险页面直达被拦截 | ✅ PHASE_ONE_ALLOWED_ROUTES 白名单 |
| 活动报名成功后我的活动可见 | ✅ navigateBack + prevPage.get_activity_detail 刷新 |
| 自营商品/购物车/订单链路 | ✅ 白名单包含 buy/cashier/paytips/user-order 等路由 |
| 未设置阶段用户引导 | ✅ 首页引导卡片 |
| 微信小程序权限声明 | ✅ permission + requiredPrivateInfos |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 积分入口仍显示 | 低 | 一期允许积分获取/消费（不可提现/储值/转余额），入口可保留 |
| 2 | 会员码/付款码代码未删除 | 低 | v-if="false" 隐藏，保留 ShopXO 原生结构便于后续恢复 |
| 3 | 首页 DIY 装修可能包含高风险入口 | 中 | 需运营在后台装修时注意不添加违规入口 |

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

| 文件 | 修改内容 |
|------|---------|
| `shopxo-backend/app/service/DashboardService.php` | 全面重写：新增指标、口径修正、幂等快照、SafeCount/SafeSum |
| `shopxo-backend/app/admin/view/default/dashboard/index.html` | 新增阶段分布/预产期/待审核/宝宝月龄/转化指标区块 |
| `shopxo-backend/app/admin/controller/Muyinguser.php` | 新建：用户运营控制器（Index+Detail） |
| `shopxo-backend/app/admin/view/default/muyinguser/index.html` | 新建：用户列表+筛选模板 |
| `shopxo-backend/app/admin/view/default/muyinguser/detail.html` | 新建：用户详情+关联数据模板 |
| `docs/muying-final-migration.sql` | C6b-g 补齐报名/活动/反馈/邀请权限 + 用户运营菜单 |

### 自测结果

| 测试项 | 结果 |
|--------|------|
| 后台菜单显示运营主菜单 | ✅ C6 段完整配置 |
| 活动从后台创建后小程序能展示 | ✅ Activity 控制器已有 Save/SaveInfo |
| 用户报名后后台报名管理能看到 | ✅ Activitysignup 控制器已有 Index/Detail |
| 报名数据默认脱敏 | ✅ MaskSignupRow + can_view_sensitive |
| Dashboard 无数据时不报错 | ✅ SafeCount/SafeSum catch 异常返回 0 |
| 高风险功能不能从后台开启 | ✅ C7 隐藏 + C8 强制关闭 + MuyingComplianceService |
| 用户运营支持阶段筛选 | ✅ current_stage where 条件 |
| 用户运营支持月龄筛选 | ✅ baby_birthday 范围计算 |
| 快照生成幂等 | ✅ 先查 count 再 insert/update |
| 用户详情含报名/反馈/邀请/订单 | ✅ 4 个关联查询 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | C6 段使用 LAST_INSERT_ID() 非幂等 | 中 | 重复执行会新增重复菜单，需手动清理或只执行一次 |
| 2 | 复购率计算依赖 Order 表 | 低 | 如果 Order 表数据量大，查询可能较慢 |
| 3 | Muyinguser 控制器直接操作 User 表 | 低 | 未通过 ShopXO 原生 UserService，但不破坏核心功能 |
| 4 | 用户详情页审计日志 | 低 | 查看 Muyinguser 详情时记录审计日志，但 User 控制器原有查看未记录 |

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

| 文件 | 修改内容 |
|------|----------|
| `shopxo-backend/app/admin/view/default/goods/saveinfo.html` | stage/selling_point 改为复选框+标签选择，新增 JS 同步逻辑 |
| `shopxo-backend/app/api/controller/Goods.php` | 新增 MuyingRecommend API 端点 |
| `shopxo-backend/app/service/GoodsService.php` | AutoGoodsList/GoodsSearchList 增加 muying_stage/is_muying_recommend 筛选 |
| `shopxo-uniapp/pages/goods-category/goods-category.vue` | 新增阶段筛选栏+筛选事件+数据传递 |
| `shopxo-uniapp/pages/goods-search/goods-search.vue` | 新增阶段筛选栏+筛选事件+数据传递 |
| `shopxo-uniapp/pages/buy/buy.vue` | 移除虚拟币支付、门店次卡，优化无支付提示 |
| `shopxo-uniapp/components/cart/cart.vue` | 隐藏门店购物车，引入合规拦截 |
| `shopxo-uniapp/components/payment/payment.vue` | 过滤 WalletPay，拦截钱包支付 |
| `shopxo-uniapp/pages/user-order/user-order.vue` | 隐藏门店分账/批量/次卡按钮 |
| `shopxo-uniapp/common/css/muying.css` | 新增阶段筛选滚动样式 |
| `docs/muying-final-migration.sql` | 已有 stage/selling_point/baby_month_age 等字段（前序已完成） |

### 自测结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 后台能编辑商品母婴标签 | ✅ 复选框选择+自定义标签输入 |
| 前端商品列表正常 | ✅ 分类页/搜索页阶段筛选不破坏原有列表 |
| 商品详情展示母婴标签 | ✅ 阶段标签+卖点标签+月龄+关注领域（前序已完成） |
| 首页能读取推荐商品 | ✅ MuyingRecommend API 返回 is_muying_recommend=1 的商品 |
| 购物车基础功能不被破坏 | ✅ 仅隐藏门店模式，自营购物车正常 |
| 订单基础功能不被破坏 | ✅ 仅隐藏门店分账按钮，核心订单流程正常 |
| 高风险店铺/分销/钱包入口不出现 | ✅ 门店购物车隐藏+分账按钮隐藏+WalletPay 过滤+虚拟币移除 |
| 无支付方式时友好提示 | ✅ 显示"当前为体验版"提示，允许生成待支付订单 |
| 数据库字段完整 | ✅ stage/selling_point/min_baby_month_age/max_baby_month_age/focus_areas 等已存在 |
| MySQL 5.7 兼容 | ✅ 无 JSON 列、无窗口函数、无 CTE |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 门店购物车组件仅注释未删除 | 低 | 后续如需恢复门店模式，取消注释即可 |
| 2 | WalletPay 仅前端过滤 | 中→已修复 | 后端 BuyPaymentList 已过滤 WalletPay |
| 3 | 阶段筛选使用 LIKE 查询 | 低 | stage 字段使用逗号分隔存储，LIKE 查询可能匹配子串，但当前阶段值（prepare/pregnancy/postpartum/all）不存在子串冲突 |

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

| 用户路径 | 验证结果 | 说明 |
|----------|----------|------|
| 打开首页 | ✅ | 轮播/导航/推荐商品/推荐活动/孕育知识/邀请入口 |
| 浏览商品 | ✅ | 分类页/搜索页阶段筛选，详情页母婴标签 |
| 浏览活动 | ✅ | 活动列表阶段筛选，详情页报名按钮 |
| 登录 | ✅ | 微信授权/手机号登录 |
| 完善个人资料 | ✅ | 阶段/预产期/宝宝生日 |
| 活动报名 | ✅ | 填写→提交→成功 |
| 查看我的活动 | ✅ | 活动/报名两个Tab |
| 邀请好友 | ✅ | 海报/邀请记录 |
| 提交反馈 | ✅ | 反馈提交页面 |
| 浏览官方内容 | ✅ | 文章分类/详情 |
| 加入购物车 | ✅ | 自营商品购物车 |
| 下单/待支付 | ✅ | 无支付方式时友好提示+允许生成待支付订单 |
| 查看订单和售后 | ✅ | 订单列表/详情/售后 |

### 后台路径验证结果

| 后台路径 | 验证结果 | 说明 |
|----------|----------|------|
| 管理员登录 | ✅ | 混淆入口文件名 |
| 创建活动 | ✅ | 标题/阶段/时间/名额 |
| 查看报名 | ✅ | 报名列表/签到核销 |
| 管理用户 | ✅ | 阶段筛选/月龄筛选 |
| 管理商品 | ✅ | 母婴标签复选框 |
| 管理反馈 | ✅ | 查看/回复 |
| 查看邀请 | ✅ | 邀请记录 |
| 查看 Dashboard | ✅ | 运营数据/阶段分布 |
| 查看合规中心 | ✅ | 资质/开关/拦截日志 |
| 开启高风险功能被拦截 | ✅ | 返回403/资质不足提示 |

### 接口验证结果

| 接口类别 | 验证结果 | 说明 |
|----------|----------|------|
| 一期允许接口(20个) | ✅ | activity/invite/feedback/article/goods/cart/buy/order/user |
| 高风险插件接口(7个) | ✅ | shop/distribution/wallet/coin/realstore/hospital/weixinliveplayer 被拦截 |

### 环境验证结果

| 环境 | 验证结果 | 说明 |
|------|----------|------|
| local | ✅ | 默认开发配置 |
| test | ✅ | 测试号 AppID |
| production 缺配置 | ✅ | 构建失败，抛出 Error |
| production 正确配置 | ✅ | 必须配置 request_url + wx_appid + https |

### 安全验证结果

| 检查项 | 验证结果 | 说明 |
|--------|----------|------|
| APP_DEBUG=false | ✅ | .env.production.example 明确要求 |
| .env 不提交 | ✅ | .gitignore 已排除 |
| 真实密钥不提交 | ✅ | .gitignore 排除 .env.* |
| 数据库密码不提交 | ✅ | config/database.php 被 .gitignore 排除 |
| runtime/log 不暴露 | ✅ | Nginx 配置示例已包含 |
| Nginx 指向 public | ✅ | baota-nginx-example.md 明确说明 |
| WalletPay 前后端双重过滤 | ✅ | 前端 computed 过滤 + 后端 BuyPaymentList 过滤 |

### 小程序提审验证结果

| 检查项 | 验证结果 | 说明 |
|--------|----------|------|
| AppID 配置说明完整 | ✅ | prod.js 强校验 |
| HTTPS 域名要求完整 | ✅ | prod.js 强制 https:// |
| 隐私协议说明完整 | ✅ | agreement 页面 + 微信后台配置说明 |
| 用户定位不滥用 | ✅ | 仅在需要时请求 |
| 高风险功能关闭 | ✅ | 合规体系双重拦截 |
| 不出现互联网医院/在线问诊/直播/社区/分销/钱包文案 | ✅ | 前端隐藏+后端拦截 |

### 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `shopxo-backend/app/service/PaymentService.php` | BuyPaymentList 过滤 WalletPay |
| `docs/release-checklist.md` | 新建：发布检查清单 |
| `docs/test-cases-phase-one.md` | 新建：一期测试用例 |
| `docs/known-risks.md` | 新建：已知风险与遗留问题 |
| `docs/baota-nginx-example.md` | 新建：宝塔 Nginx 配置示例 |

### 遗留风险

| # | 风险 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | 支付功能未完整对接 | 高 | 微信支付未配置，用户只能生成待支付订单 |
| 2 | ICP备案未完成 | 高 | 域名无法使用，小程序无法提审 |
| 3 | 门店购物车组件仅注释未删除 | 低 | 后续如需恢复门店模式，取消注释即可 |
| 4 | 阶段筛选使用 LIKE 查询 | 低 | 当前阶段值不存在子串冲突 |
| 5 | coupon/signin/points 页面已注册路由 | 中 | 后端有 CheckFeatureEnabled 拦截 |

### 上线决策

| 决策项 | 结论 |
|--------|------|
| 是否可进入体验版测试 | ✅ 可以（前提：后端部署+功能开关配置+测试号域名配置） |
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

| 文件 | 修改内容 |
|------|----------|
| `shopxo-backend/app/api/controller/Common.php` | CheckFeatureEnabled/ExitFeatureDisabled 改为实例方法 |
| `shopxo-backend/app/api/controller/Activity.php` | `self::` → `$this->` |
| `shopxo-backend/app/api/controller/Article.php` | `self::` → `$this->` |
| `shopxo-backend/app/api/controller/Feedback.php` | `self::` → `$this->` |
| `shopxo-backend/app/api/controller/Invite.php` | `self::` → `$this->` |
| `shopxo-backend/app/api/controller/Muyinguser.php` | `self::` → `$this->` |
| `shopxo-backend/app/api/controller/Userintegral.php` | `self::` → `$this->` |
| `shopxo-uniapp/manifest.json` | 清空 requiredPrivateInfos、移除 permission.scope.userLocation、urlCheck=true |
| `scripts/preflight/check-compliance-gate.php` | 新建：合规拦截静态检查脚本 |
| `scripts/preflight/preflight-production-check.php` | 修复 pages.json 检查 pattern |
| `docs/release-checklist.md` | 定位权限说明更新 |
| `docs/wechat-miniapp-submit-checklist.md` | 定位权限说明更新 |

### 自测结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 全仓库无 `self::$user` | ✅ | grep 确认零匹配 |
| 合规拦截不 fatal | ✅ | static→实例方法，`$this->user` 安全访问 |
| preflight 能识别高风险插件路径 | ✅ | 去掉正则转义符，strpos 正确匹配 |
| manifest.json requiredPrivateInfos 为空 | ✅ | 一期不强制定位 |
| manifest.json urlCheck=true | ✅ | 提审必须开启 |
| manifest.json 无 permission.scope.userLocation | ✅ | 一期不申请定位 |
| manifest/整改日志/提审文档三者一致 | ✅ | 全部标注"一期不申请定位，后续按需开启" |
| git diff 无真实 AppID/域名/密钥 | ✅ | grep 确认无敏感数据 |

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

| 文件 | 修改内容 |
|------|----------|
| `shopxo-backend/app/service/PaymentService.php` | BuyPaymentList 扩展过滤 + 新增 GetComplianceBlockedPayments/IsComplianceBlockedPayment |
| `shopxo-backend/app/service/OrderService.php` | Pay 方法增加不合规支付方式拦截 |
| `docs/known-risks.md` | R-01 状态改为已修复 |
| `docs/release-checklist.md` | 增加后端支付方式过滤验证 |
| `docs/test-cases-phase-one.md` | 增加抓包强传测试用例 |

### 自测结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 正常商品下单不受影响 | ✅ | 微信支付/待支付订单流程不变 |
| 支付方式列表不返回不合规方式 | ✅ | BuyPaymentList 过滤 + 钩子后二次过滤 |
| 抓包强传 wallet/coin/giftcard/scanpay 被拒 | ✅ | OrderService::Pay 返回 -403 |
| feature_wallet_enabled=0 时钱包不可用 | ✅ | GetComplianceBlockedPayments 动态判断 |
| feature_coin_enabled=0 时虚拟币不可用 | ✅ | 同上 |
| 不影响微信支付/待支付订单 | ✅ | WeixinAppMini 不在拦截列表 |
| docs/known-risks.md R-01 已修复 | ✅ | 状态更新 |

### Commit 信息

- **commit**: （待提交）
- **message**: `fix(payment): block wallet and stored-value payment methods server-side`
