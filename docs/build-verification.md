# 构建验证指南

> 本文档为 RC 合并前的构建验收操作手册，覆盖后端 PHP 语法检查和前端微信小程序构建。
> **不要伪造执行结果**。每一步必须真实执行并记录输出。

---

## A. 后端 PHP 语法检查

### 前置条件

- PHP CLI >= 8.1（与生产环境版本一致）
- 在项目根目录执行

### 自动化脚本

```bash
bash scripts/check-php-syntax.sh
```

脚本会自动检测 `php` 命令是否可用，不可用时 `exit 1`。

### 手动逐文件检查

如果需要手动执行，逐个检查以下文件：

```bash
php -l shopxo-backend/app/admin/controller/Activity.php
php -l shopxo-backend/app/admin/controller/Article.php
php -l shopxo-backend/app/api/controller/Buy.php
php -l shopxo-backend/app/api/controller/Cashier.php
php -l shopxo-backend/app/api/controller/Common.php
php -l shopxo-backend/app/api/controller/Order.php
php -l shopxo-backend/app/api/controller/Paylog.php
php -l shopxo-backend/app/module/LayoutModule.php
php -l shopxo-backend/app/service/ActivityService.php
php -l shopxo-backend/app/service/AppCenterNavService.php
php -l shopxo-backend/app/service/AppHomeNavService.php
php -l shopxo-backend/app/service/DiyApiService.php
php -l shopxo-backend/app/service/MuyingComplianceService.php
php -l shopxo-backend/app/service/MuyingContentComplianceService.php
php -l shopxo-backend/app/service/PluginsService.php
php -l shopxo-backend/app/service/QuickNavService.php
php -l shopxo-backend/app/service/SystemBaseService.php
```

### 预期输出

每个文件输出：

```
No syntax errors detected in <file>
```

### 验收标准

- 全部文件输出 `No syntax errors detected`
- 无 `Parse error`、`syntax error`、`Fatal error` 等输出
- 脚本退出码为 0

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `php: command not found` | 未安装 PHP CLI 或未加入 PATH | 安装 PHP 8.1+ 并加入 PATH |
| `Parse error: syntax error` | 代码存在语法错误 | 修复后重新检查 |
| PHP 版本低于 8.1 | 匹配运算符等语法不兼容 | 升级 PHP CLI 到 8.1+ |

---

## B. 前端微信小程序构建

### 前置条件

- HBuilderX 已安装（官方下载：https://www.dcloud.io/hbuilderx.html）
- 微信开发者工具已安装（官方下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html）
- 已配置 `.env.production`（参照 `.env.production.example`）

### 构建步骤

#### 1. 配置环境变量

```bash
cd shopxo-uniapp
cp .env.production.example .env.production
```

编辑 `.env.production`，填入真实值：

- `UNI_APP_WX_APPID`：正式 AppID（不能是测试号 `wxda7779770f53e901`）
- `UNI_APP_REQUEST_URL`：生产 API 地址（必须 HTTPS）
- 各 feature flag 开关（一期关闭项设为 `0`）

#### 2. HBuilderX 打开项目

- 打开 HBuilderX
- 文件 → 打开目录 → 选择 `shopxo-uniapp`

#### 3. 执行发行构建

- 菜单：发行 → 小程序-微信
- 等待编译完成，控制台无报错

#### 4. 检查 AppID 注入

编译完成后，检查产物目录 `shopxo-uniapp/unpackage/dist/build/mp-weixin/`：

```bash
# 检查 manifest.json 中的 appid
grep -o '"appid"[[:space:]]*:[[:space:]]*"[^"]*"' shopxo-uniapp/unpackage/dist/build/mp-weixin/manifest.json

# 检查 project.config.json 中的 appid
grep -o '"appid"[[:space:]]*:[[:space:]]*"[^"]*"' shopxo-uniapp/unpackage/dist/build/mp-weixin/project.config.json
```

验收标准：
- `manifest.json` 中 `mp-weixin.appid` 为正式 AppID，非空、非测试号
- `project.config.json` 中 `appid` 为正式 AppID，非空、非测试号

#### 5. 检查生成的 mp-weixin 包

```bash
ls -la shopxo-uniapp/unpackage/dist/build/mp-weixin/
```

验收标准：
- 目录存在且包含 `app.json`、`app.js`、`app.wxss`
- `app.json` 中 `pages` 列表与 `pages.json` 一致
- 无多余的高风险页面路径（form-preview、customview 等）

#### 6. 微信开发者工具导入

- 打开微信开发者工具
- 导入项目 → 目录选择 `shopxo-uniapp/unpackage/dist/build/mp-weixin/`
- AppID 使用正式号

#### 7. 开启合法域名校验

- 微信开发者工具 → 详情 → 本地设置
- **取消勾选**「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
- 即：开启域名校验，确保生产环境域名配置正确

#### 8. 编译验证

- 微信开发者工具自动编译
- 控制台无报错
- 首页正常渲染

### 验收标准

| 检查项 | 预期结果 |
|--------|----------|
| HBuilderX 编译 | 控制台无报错 |
| AppID 注入 | manifest.json / project.config.json 为正式 AppID |
| mp-weixin 包完整性 | 包含 app.json / app.js / app.wxss |
| 高风险页面过滤 | 无 form-preview / customview 路径 |
| 微信开发者工具编译 | 无报错 |
| 合法域名校验 | 开启后无域名校验失败 |
| 首页渲染 | 正常显示 |

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `项目根目录中未找到 app.json` | 用微信开发者工具导入了源码目录而非编译产物 | 导入 `unpackage/dist/build/mp-weixin/` |
| AppID 为空或测试号 | `.env.production` 未配置或未生效 | 检查 `.env.production` 中 `UNI_APP_WX_APPID` |
| 编译报 `xxx is not defined` | 代码引用了未引入的模块 | 修复代码后重新构建 |
| 域名校验失败 | 服务器域名未在微信后台配置 | 登录 mp.weixin.qq.com 配置服务器域名 |

---

## 验收记录模板

完成上述检查后，将结果填入 `docs/release-candidate-check.md` 对应章节，格式如下：

### PHP 语法检查

```
执行人：XXX
执行时间：YYYY-MM-DD HH:MM
执行环境：PHP X.Y.Z / OS
命令：bash scripts/check-php-syntax.sh
结果：XX/XX PASS
退出码：0
```

### 前端构建

```
执行人：XXX
执行时间：YYYY-MM-DD HH:MM
执行环境：HBuilderX X.Y.Z / 微信开发者工具 X.Y.Z
构建结果：PASS / FAIL
AppID 注入：已确认 / 未确认
微信开发者工具编译：PASS / FAIL
合法域名校验：PASS / FAIL
```
