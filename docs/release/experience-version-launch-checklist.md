# 体验版上线执行清单

> 按真实顺序执行，每步必须确认完成再进入下一步  
> 前提：已有服务器+宝塔+Nginx+PHP 8.1+MySQL 5.7.44  
> 最后更新：2026-04-24

---

## 阶段一：后端部署（约 2 小时）

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
- [ ] `chown -R www:www .`
- [ ] `chmod -R 755 .`
- [ ] `chmod -R 777 runtime/ public/upload/ config/`

### 1.6 Nginx 配置
- [ ] 宝塔面板 → 网站 → 设置 → 配置文件，参照 `docs/release/bt-deploy-rollback-guide.md` 中的 Nginx 配置
- [ ] 确认 URL 重写规则生效（访问 `http://域名/api.php?s=common.index.index` 返回 200）

### 1.7 验证后端
- [ ] 浏览器访问 `http://域名/api.php?s=common.index.index`，确认返回 JSON
- [ ] 访问 `http://域名/你的后台入口.php`，确认后台可登录
- [ ] 默认管理员账号登录，修改默认密码

---

## 阶段二：后台配置（约 1 小时）

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

---

## 阶段三：前端构建（约 1 小时）

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

### 5.1 基础功能验收
- [ ] 打开体验版小程序
- [ ] 注册/登录成功
- [ ] 阶段设置保存成功
- [ ] 首页推荐内容按阶段展示
- [ ] 活动列表加载 → 活动详情 → 报名成功
- [ ] 商品列表 → 商品详情 → 加入购物车
- [ ] 邀请页展示邀请码
- [ ] 意见反馈提交成功

### 5.2 权限验收
- [ ] 首页加载时不弹出任何权限授权弹窗
- [ ] 点击"选择位置"时弹出定位授权
- [ ] 点击头像时弹出相册授权
- [ ] 点击"一键获取手机号"时弹出手机号授权

### 5.3 功能开关验收
- [ ] 后台关闭 feature_activity_enabled → 前端首页活动区块消失
- [ ] 后台关闭 feature_feedback_enabled → 前端首页妈妈说区块消失 + 用户中心反馈入口消失
- [ ] 后台关闭 feature_invite_enabled → 前端首页邀请区块消失 + 用户中心邀请入口消失
- [ ] 后台关闭 feature_content_enabled → 前端首页孕育知识区块消失

### 5.4 运行自动检查脚本
- [ ] `bash scripts/preflight/check-wechat-review.sh .`
- [ ] `bash scripts/preflight/check-api-health.sh http://你的域名/api.php`
- [ ] 确认全部 PASS

---

## 阶段六：提审前准备（正式 AppID 和域名就绪后执行）

- [ ] 将 manifest.json 中 mp-weixin.appid 改为正式 AppID
- [ ] 将 project.config.json 中 appid 改为正式 AppID
- [ ] .env.production 中域名改为正式 HTTPS 域名
- [ ] 后端 .env 中 APP_DEBUG 改为 false
- [ ] 删除 public/install.php
- [ ] 重命名 public/admin.php
- [ ] 重新编译上传正式版
- [ ] 微信后台配置正式服务器域名
- [ ] 提交审核
