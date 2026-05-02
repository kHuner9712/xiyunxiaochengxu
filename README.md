# 禧孕母婴商城 (ShopXO 二开) - 开发指南

> **当前版本**：v0.1.0-rc1 | **封板日期**：2026-04-25 | **状态**：代码已封板，体验版可部署

本仓库基于 ShopXO 开源电商系统二开，聚焦母婴商城一期：品牌展示、商品购买、活动报名、会员成长、邀请裂变。

**封板报告**：[docs/release/rc-gate-report.md](docs/release/rc-gate-report.md)  
**Release Notes**：[docs/release/rc-release-notes.md](docs/release/rc-release-notes.md)  
**文档索引**：[docs/xiyun-docs-index.md](docs/xiyun-docs-index.md)

## 1. 项目结构

```
xiyunxiaochengxu/
├── shopxo-backend/       # 后端 (ThinkPHP 6)
├── shopxo-uniapp/        # 前端 (uni-app 微信小程序)
├── docker/               # Docker 构建文件 (Nginx/PHP)
├── deploy/               # 部署配置 (Nginx 示例)
├── docs/                 # 项目文档、SQL 迁移、发布清单
├── scripts/              # 运维脚本 (预检、发布门禁)
├── docker-compose.yml    # 本地容器编排
└── .env.example          # 根环境变量模板
```

## 2. 二开代码边界 ⚠️

**核心原则：修改 ShopXO 原始文件时，必须用注释标注二开改动，方便后续升级合并。**

### 后端二开文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `app/extend/muying/MuyingStage.php` | **新增** | 母婴阶段枚举（唯一权威定义） |
| `app/service/ActivityService.php` | **新增** | 活动报名、收藏、核销 |
| `app/service/MuyingStatService.php` | **新增** | 母婴数据统计 |
| `app/service/FeedbackService.php` | **新增** | 用户反馈 |
| `app/service/InviteService.php` | **修改** | 在原 ShopXO Invite 基础上扩展邀请裂变 |
| `app/service/UserService.php` | **修改** | 增加 current_stage/due_date/baby_birthday 字段处理和校验 |
| `app/api/controller/Activity.php` | **新增** | 活动 API 控制器 |
| `app/api/controller/Feedback.php` | **新增** | 反馈 API 控制器 |
| `app/api/controller/Personal.php` | **新增** | 个人资料 API 控制器 |
| `app/admin/controller/Activity.php` | **新增** | 活动后台管理 |
| `app/admin/controller/Activitysignup.php` | **新增** | 报名后台管理 |
| `app/admin/controller/Muyingstat.php` | **新增** | 母婴统计后台 |
| `app/admin/form/Muyingstat.php` | **新增** | 母婴统计表单 |
| `app/admin/view/default/activity/` | **新增** | 活动后台视图 |
| `app/admin/view/default/activitysignup/` | **新增** | 报名后台视图 |
| `app/admin/view/default/muyingstat/` | **新增** | 统计后台视图 |
| `sql/muying_feedback.sql` | **新增** | 反馈表迁移 |

### 前端二开文件清单

| 文件/目录 | 类型 | 说明 |
|-----------|------|------|
| `common/js/config/muying-enum.js` | **新增** | 母婴阶段枚举（前端权威定义） |
| `common/js/config/phase-one-scope.js` | **新增** | 一期范围过滤（控制哪些插件入口可见） |
| `common/js/config/runtime-config.js` | **新增** | 运行时环境配置 |
| `common/css/muying.css` | **新增** | 母婴主题样式 |
| `components/stage-guide/` | **新增** | 阶段引导弹窗组件 |
| `components/stage-nav/` | **新增** | 首页阶段筛选导航组件 |
| `pages/activity/` | **新增** | 活动列表页 |
| `pages/activity-detail/` | **新增** | 活动详情页 |
| `pages/activity-signup/` | **新增** | 活动报名页 |
| `pages/my-activity/` | **新增** | 我的活动/报名页 |
| `pages/my-invite/` | **新增** | 我的邀请页 |
| `pages/invite/` | **新增** | 邀请落地页 |
| `pages/index/index.vue` | **修改** | 增加阶段推荐 Tab |
| `pages/user/user.vue` | **修改** | 增加母婴导航区、阶段标签 |
| `pages/personal/personal.vue` | **修改** | 增加母婴画像字段 |
| `App.vue` | **修改** | 增加母婴初始化逻辑 |

### 二开注释约定

在修改 ShopXO 原始文件时，使用以下注释格式标注二开代码：

```php
// [MUYING-二开] 增加母婴阶段校验
```

```javascript
// [MUYING-二开] 增加阶段筛选Tab
```

## 3. 前端启动 (shopxo-uniapp)

### ⚠️ 源码目录 ≠ 编译产物目录

`shopxo-uniapp` 是 **uni-app 源码工程**，不是微信原生小程序目录。直接用微信开发者工具导入 `shopxo-uniapp` 会报"项目根目录中未找到 app.json"，因为源码目录中没有 `app.json`——它是编译后才生成的。

**正确流程**：

1. 用 HBuilderX 打开 `shopxo-uniapp` 目录
2. 在 HBuilderX 中点击 **运行 → 运行到小程序模拟器 → 微信开发者工具**
3. HBuilderX 会自动编译，生成编译产物到 `shopxo-uniapp/unpackage/dist/dev/mp-weixin/`
4. 用微信开发者工具导入 **`unpackage/dist/dev/mp-weixin/`** 目录（不是 `shopxo-uniapp/` 目录）

```
shopxo-uniapp/                          ← uni-app 源码（HBuilderX 打开这个）
├── pages/                              ← .vue 源码页面
├── manifest.json                       ← 小程序配置主来源（appid 等）
├── project.config.json                 ← 辅助配置（HBuilderX 编译时合并到产物）
└── unpackage/dist/dev/mp-weixin/       ← 编译产物（微信开发者工具导入这个）
    ├── app.json                        ← 编译后生成
    ├── app.wxss
    └── ...
```

### appid 配置说明

- **主来源**：`manifest.json` → `mp-weixin.appid`（当前值：`wxda7779770f53e901`）
- **辅助**：`project.config.json` → `appid`（应与 manifest.json 保持一致）
- HBuilderX 编译时，会将 manifest.json 的 appid 写入编译产物的 project.config.json
- 修改 appid 时，**必须同时修改两个文件**，以 manifest.json 为准

### 本地开发配置

- `project.private.config.json` 是本地文件，已被 Git 忽略，首次编译后自动生成
- `manifest.local.json` 是本地覆盖文件，已被 Git 忽略
- 共享的微信项目配置是 `project.config.json`

## 4. 后端启动 (shopxo-backend)

1. 复制环境模板：
   ```bash
   cd shopxo-backend
   copy .env.example .env   # Windows
   ```
2. 修改 `.env` 中的数据库配置。
3. 启动开发服务器：
   ```bash
   php think run
   ```

## 5. Docker 启动（推荐）

1. 复制根环境模板：
   ```bash
   copy .env.example .env   # Windows
   ```
2. 修改 `.env`（至少修改 `MYSQL_ROOT_PASSWORD`）。
3. 启动容器：
   ```bash
   docker compose up -d --build
   ```
4. 停止容器：
   ```bash
   docker compose down
   ```

默认端口：
- Nginx: `127.0.0.1:8080`
- MySQL: `127.0.0.1:13306`
- Redis: `127.0.0.1:16379`

## 6. 环境变量

根 `.env`（Docker/本地连接）：
- `MYSQL_ROOT_PASSWORD`: MySQL root 密码
- `MYSQL_DATABASE`: 初始数据库名
- `MYSQL_CHARSET` / `MYSQL_COLLATION`: 字符集
- `MYSQL_HOST_PORT`: MySQL 主机端口
- `REDIS_HOST_PORT`: Redis 主机端口
- `NGINX_HOST_PORT`: Nginx 主机端口
- `UNI_APP_REQUEST_URL`: 前端 API 基础 URL
- `UNI_APP_STATIC_URL`: 前端静态资源 URL（可选）

`shopxo-backend/.env`：
- `APP_DEBUG`: 调试开关（生产环境必须 `false`）
- `[DATABASE]`: 后端数据库连接配置

## 7. 微信小程序开发

1. 先用 HBuilderX 打开 `shopxo-uniapp` 源码目录，运行编译（**运行 → 运行到小程序模拟器 → 微信开发者工具**）。
2. 编译完成后，用微信开发者工具导入编译产物目录：`shopxo-uniapp/unpackage/dist/dev/mp-weixin/`。
3. 本地私有设置放在 `project.private.config.json`（自动生成，已忽略）。
4. 提交前确认不包含本地路径、私有配置、缓存文件或构建产物。

## 8. 母婴核心数据流

```
用户选择阶段 → PersonalSave 保存 current_stage/due_date/baby_birthday
     ↓
UserHandle 返回格式化数据 → 前端展示阶段标签/推荐
     ↓
活动报名 → ActivitySignup 校验 + 回填用户画像
     ↓
首页阶段推荐 → MuyingStage.getFilterTabs() 筛选商品
```

关键枚举定义（唯一权威源）：
- 后端：`app/extend/muying/MuyingStage.php`
- 前端：`common/js/config/muying-enum.js`

阶段值：`prepare`(备孕) / `pregnancy`(孕期) / `postpartum`(产后) / `all`(通用，仅筛选用)
