# 体验版上线执行清单

> 适用阶段：体验版上线  
> 执行人：开发/运维  
> 输入物：服务器 IP、宝塔面板账号、测试号 AppID  
> 输出物：可扫码体验的微信小程序体验版  
> 限定条件：**在测试号 AppID + 服务器 IP/测试域名 + 未启用正式支付的前提下**  
> 最后更新：2026-04-25

---

> **快速部署**：完整一键流程请直接使用 [experience-deploy-runbook.md](experience-deploy-runbook.md)  
> 本文档为详细版清单，适合首次部署时逐项确认  
> **RC 封板版本**：v0.1.0-rc1 | 封板报告：[rc-gate-report.md](rc-gate-report.md)

---

## 阶段一：后端部署（约 2 小时）

> **执行人**：开发/运维  
> **输入物**：服务器 IP、宝塔面板账号、MySQL root 密码  
> **输出物**：可访问的后端 API + 后台管理页面  
> **失败回退**：删除站点目录 + 删除数据库，从 1.1 重新开始

### 1.1 创建网站和数据库
- [ ] 宝塔面板 → 网站 → 添加站点，域名填写测试域名或 IP
- [ ] 创建 MySQL 数据库，字符集 utf8mb4，排序规则 utf8mb4_general_ci
- [ ] 记录数据库名/用户名/密码

### 1.2 上传后端代码
- [ ] `cd /www/wwwroot/你的站点目录`
- [ ] `git clone https://github.com/kHuner9712/xiyun.git repo`
- [ ] `cp -r repo/shopxo-backend/* .`
- [ ] `rm -rf repo`

### 1.3 配置 .env
- [ ] `cp .env.production.example .env`
- [ ] 编辑 .env，填入：
  - `APP_DEBUG = true`（体验版先用 true，提审前改 false）
  - 数据库连接信息
  - 站点 URL

### 1.4 导入数据库
- [ ] `mysql -u 用户 -p 库名 < config/shopxo.sql`
- [ ] `mysql -u 用户 -p 库名 < docs/muying-final-migration.sql`
- [ ] `mysql -u 用户 -p 库名 < docs/muying-feedback-review-migration.sql`
- [ ] `mysql -u 用户 -p 库名 < docs/muying-invite-reward-unify-migration.sql`
- [ ] `mysql -u 用户 -p 库名 < docs/muying-feature-flag-upgrade-migration.sql`
- [ ] `mysql -u 用户 -p 库名 < docs/muying-admin-power-migration.sql`

### 1.5 安装依赖和设置权限
- [ ] `composer install --no-dev --optimize-autoloader`
- [ ] 运行权限修复脚本：`bash scripts/deploy/fix-permissions.sh /www/wwwroot/你的站点目录`
- [ ] 或手动执行：
  ```bash
  chown -R www:www .
  find . -type d -exec chmod 755 {} \;
  find . -type f -exec chmod 644 {} \;
  chmod 755 runtime/ public/upload/ public/download/ config/ public/rsakeys/
  ```
- [ ] ⚠ 绝不使用 `chmod -R 777`

### 1.6 Nginx 配置
- [ ] 宝塔面板 → 网站 → 设置 → 配置文件，参照 `docs/release/bt-deploy-rollback-guide.md` 中的 Nginx 配置
- [ ] 确认 URL 重写规则生效（访问 `http://域名/api.php?s=common.index.index` 返回 200）

### 1.7 验证后端
- [ ] 浏览器访问 `http://域名/api.php?s=common.index.index`，确认返回 JSON
- [ ] 访问 `http://域名/你的后台入口.php`，确认后台可登录
- [ ] 默认管理员账号登录，修改默认密码

### ✅ 阶段一验证脚本
```bash
bash scripts/preflight/check-release-placeholders.sh --mode=experience .
```
> 应全部 PASS 或仅 WARN（AppID 为空在体验版允许）

---

## 阶段二：后台配置（约 1 小时）

> **执行人**：运营/产品  
> **输入物**：后台管理员账号密码、客服电话、隐私弹窗文案、首批内容素材  
> **输出物**：配置完整的后台 + 可展示内容的首页  
> **失败回退**：后台重新编辑配置项，无需重新部署

### 2.1 注册后台菜单
- [ ] 上一步执行 muying-admin-power-migration.sql 后，刷新后台页面
- [ ] 确认左侧菜单出现"孕禧运营"分组及其下 6 个子菜单

### 2.2 填写后台配置
- [ ] 系统设置 → 小程序配置 → 填写隐私弹窗文案（`common_app_mini_weixin_privacy_content`）
- [ ] 系统设置 → 手机端配置 → 填写客服电话（`common_app_customer_service_tel`）
- [ ] 功能开关 → 确认一期核心功能开启（activity/invite/feedback/content）
- [ ] 邀请配置 → 设置首单奖励积分（`muying_invite_first_order_reward`，建议 50-100）
- [ ] 邀请配置 → 确认自动发放开关（`muying_invite_first_order_auto_grant = 1`）
- [ ] 协议管理 → 确认隐私政策和用户协议内容完整

### 2.3 录入首批内容
- [ ] 活动管理 → 新建至少 1 个活动（填写标题/时间/地点/封面/阶段标签）
- [ ] 商品管理 → 新建至少 2 个商品（填写标题/价格/封面/阶段标签/上架）
- [ ] 文章管理 → 新建至少 1 篇文章（填写标题/内容/发布）
- [ ] 首页设计 → 配置首页布局（确保活动/商品/文章区块可见）

### ✅ 阶段二验证脚本
```bash
bash scripts/preflight/check-runtime-config.sh --env /path/to/.env
bash scripts/preflight/check-admin-bootstrap.sh .
```
> 关键配置项应全部 PASS

---

## 阶段三：前端构建（约 1 小时）

> **执行人**：前端开发  
> **输入物**：测试号 AppID、后端 API 地址  
> **输出物**：可上传的微信小程序代码包  
> **失败回退**：修改 .env.production 重新编译

### 3.1 配置小程序 AppID
- [ ] 编辑 `shopxo-uniapp/manifest.json` → `mp-weixin.appid`，填入测试号 AppID（如 `wxda7779770f53e901`）
- [ ] 编辑 `shopxo-uniapp/project.config.json` → `appid`，填入相同 AppID

### 3.2 配置后端地址
- [ ] 创建 `shopxo-uniapp/.env.production`
- [ ] 填入 `UNI_APP_REQUEST_URL=http://你的服务器IP:端口/` 或测试域名
- [ ] 填入 `UNI_APP_STATIC_URL=http://你的服务器IP:端口/`
- [ ] 填入 `UNI_APP_WX_APPID=你的测试AppID`

### 3.3 编译上传
- [ ] HBuilderX → 发行 → 小程序-微信
- [ ] 编译完成后，用微信开发者工具打开 `unpackage/dist/build/mp-weixin` 目录
- [ ] 确认编译无报错
- [ ] 点击"上传"，填写版本号和备注

---

## 阶段四：微信后台配置（约 30 分钟）

> **执行人**：产品/运营  
> **输入物**：微信公众平台测试号账号  
> **输出物**：可扫码体验的体验版  
> **失败回退**：修改微信后台配置重新扫码

### 4.1 服务器域名
- [ ] 登录 mp.weixin.qq.com
- [ ] 开发管理 → 开发设置 → 服务器域名
- [ ] request 合法域名：添加 `https://你的域名`（需 HTTPS，体验版可跳过）
- [ ] uploadFile 合法域名：同上
- [ ] downloadFile 合法域名：同上
- [ ] **注意**：体验版在微信开发者工具中可勾选"不校验合法域名"，跳过此步

### 4.2 隐私保护指引
- [ ] 设置 → 服务内容声明 → 用户隐私保护指引
- [ ] 添加"位置信息"：用途="活动签到、收货地址选择"
- [ ] 添加"相册/摄像头"：用途="更换头像、上传反馈图片"
- [ ] 添加"手机号"：用途="登录和身份验证"

---

## 阶段五：体验版验收（约 2 小时）

> **执行人**：测试/产品  
> **输入物**：体验版小程序二维码  
> **输出物**：验收通过确认  
> **失败回退**：记录 bug → 开发修复 → 重新编译上传 → 重新验收

### 5.1 Smoke Test（必做，15~20 步）
- [ ] 按 `docs/release/experience-smoke-test.md` 执行完整链路验收

### 5.2 功能开关验收
- [ ] 后台关闭 feature_activity_enabled → 前端首页活动区块消失
- [ ] 后台关闭 feature_feedback_enabled → 前端首页妈妈说区块消失 + 用户中心反馈入口消失
- [ ] 后台关闭 feature_invite_enabled → 前端首页邀请区块消失 + 用户中心邀请入口消失
- [ ] 后台关闭 feature_content_enabled → 前端首页孕育知识区块消失

### 5.3 运行自动检查脚本
```bash
bash scripts/deploy/post-deploy-check.sh \
  --site-dir /www/wwwroot/yunxi-api \
  --api-url http://你的IP/ \
  --db-name yunxi --db-user yunxi --db-pass YOUR_PASSWORD \
  --env=experience
```
- [ ] 确认 0 BLOCKER

---

> **提审前准备**：体验版验收通过后，如需切换到提审版，请使用 [submit-switch-runbook.md](submit-switch-runbook.md)
