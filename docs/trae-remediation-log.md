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
