# 正式上线前人工配置清单

> 本清单列出所有"代码无法自动完成、必须人工填写或申请"的配置项。  
> 每项标注：类别 / 所在文件 / 当前状态 / 操作说明 / 是否阻塞发布

---

## 一、微信小程序核心配置（阻塞发布）

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 | 阻塞等级 |
|------|--------|----------|--------|----------|----------|
| 1.1 | 微信小程序 AppID | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` | `""` 空 | 在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册小程序后获取 AppID，填入此处 | 🔴 阻塞 |
| 1.2 | 微信小程序 AppID | `shopxo-uniapp/project.config.json` → `appid` | `""` 空 | 与 1.1 相同的 AppID，填入此处（微信开发者工具需要） | 🔴 阻塞 |
| 1.3 | 微信小程序 AppSecret | 后台 → 系统设置 → 小程序配置 | 未配置 | 在微信公众平台获取 AppSecret，填入后台配置（不提交到 Git） | 🔴 阻塞 |
| 1.4 | 微信支付商户号 | 后台 → 系统设置 → 支付配置 | 未配置 | 在 [pay.weixin.qq.com](https://pay.weixin.qq.com) 申请微信支付商户号 | 🔴 阻塞 |
| 1.5 | 微信支付商户密钥 | 后台 → 系统设置 → 支付配置 | 未配置 | 商户平台 API 密钥（不提交到 Git） | 🔴 阻塞 |
| 1.6 | 微信支付证书 | 后台 → 服务器上传 | 未配置 | 商户平台下载 apiclient_cert.pem / apiclient_key.pem | 🔴 阻塞 |

---

## 二、域名与备案（阻塞发布）

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 | 阻塞等级 |
|------|--------|----------|--------|----------|----------|
| 2.1 | 正式域名 | `shopxo-uniapp/.env.production` → `UNI_APP_REQUEST_URL` | 模板中为 `你的域名.com` | 购买域名并完成 ICP 备案后填入 | 🔴 阻塞 |
| 2.2 | 静态资源域名 | `shopxo-uniapp/.env.production` → `UNI_APP_STATIC_URL` | 模板中为 `你的域名.com` | 通常与 2.1 相同 | 🔴 阻塞 |
| 2.3 | 微信服务器域名配置 | 微信公众平台 → 开发管理 → 服务器域名 | 未配置 | 将正式域名添加到 request 合法域名、uploadFile 合法域名、downloadFile 合法域名 | 🔴 阻塞 |
| 2.4 | ICP 备案 | 域名服务商 / 管局 | 未完成 | 域名必须完成 ICP 备案，否则微信小程序无法通过审核 | 🔴 阻塞 |

---

## 三、后端环境配置（阻塞发布）

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 | 阻塞等级 |
|------|--------|----------|--------|----------|----------|
| 3.1 | 数据库连接 | `shopxo-backend/.env` → 数据库相关行 | 模板中为 `{{DB_HOST}}` 等 | 填入实际 MySQL 地址/库名/用户/密码 | 🔴 阻塞 |
| 3.2 | 数据库密码 | `shopxo-backend/.env` → `PASSWORD` | 模板中为 `{{DB_PASS}}` | 使用强密码，非 root/123456 | 🔴 阻塞 |
| 3.3 | APP_DEBUG | `shopxo-backend/.env` → `APP_DEBUG` | 模板中未明确 | 生产环境必须设为 `false` | 🔴 阻塞 |
| 3.4 | 后台入口重命名 | `shopxo-backend/public/` 目录 | 默认 `admin.php` | 将 admin.php 重命名为不易猜测的文件名 | 🟡 强烈建议 |
| 3.5 | install.php 删除 | `shopxo-backend/public/install.php` | 存在 | 部署完成后必须删除 | 🔴 阻塞 |

---

## 四、后台运营配置（不阻塞发布但影响功能）

| 序号 | 配置项 | 配置路径 | 操作说明 | 阻塞等级 |
|------|--------|----------|----------|----------|
| 4.1 | 客服电话 | 后台 → 系统设置 → 手机端配置 → `common_app_customer_service_tel` | 填入客服电话号码，否则用户中心"联系客服"入口不显示 | 🟡 建议配置 |
| 4.2 | 隐私弹窗文案 | 后台 → 系统设置 → 小程序配置 → `common_app_mini_weixin_privacy_content` | 填入清晰的隐私收集说明（已提供 SQL 模板） | 🟡 建议配置 |
| 4.3 | 首单奖励积分 | 后台 → 邀请奖励配置 → `muying_invite_first_order_reward` | 默认 0（不发放），需手动配置奖励值 | 🟡 按需配置 |
| 4.4 | 自动发放开关 | 后台 → 邀请奖励配置 → `muying_invite_first_order_auto_grant` | 默认 1（自动发放），如需手动审核可设为 0 | 🟡 按需配置 |
| 4.5 | 每日奖励上限 | 后台 → 邀请奖励配置 → `muying_invite_daily_limit` | 默认 0（不限制），建议设为合理上限 | 🟡 建议配置 |
| 4.6 | 邀请口号 | 后台 → 邀请奖励配置 → `muying_invite_slogan` | 邀请页顶部标题文案 | 🟡 按需配置 |
| 4.7 | 功能开关 | 后台 → 功能开关 | 确认一期核心功能已开启（activity/invite/feedback/content） | 🟡 建议检查 |
| 4.8 | 隐私政策内容 | 后台 → 协议管理 → 隐私政策 | 确认内容与前端 agreement.vue 一致 | 🟡 建议检查 |
| 4.9 | 用户协议内容 | 后台 → 协议管理 → 用户协议 | 确认内容完整 | 🟡 建议检查 |

---

## 五、App 端配置（一期不需要，二期按需）

| 序号 | 配置项 | 所在文件 | 说明 | 阻塞等级 |
|------|--------|----------|------|----------|
| 5.1 | 微信支付 AppID | `manifest.json` → `app-plus.distribute.sdkConfigs.payment.weixin.appid` | App 端微信支付，一期不涉及 | ⚪ 二期 |
| 5.2 | 微信登录 AppID | `manifest.json` → `app-plus.distribute.sdkConfigs.oauth.weixin.appid` | App 端微信登录，一期不涉及 | ⚪ 二期 |
| 5.3 | 高德地图 Key | `manifest.json` → `app-plus.distribute.sdkConfigs.maps.amap` | App 端地图，一期不涉及 | ⚪ 二期 |
| 5.4 | 其他小程序 AppID | `manifest.json` → mp-alipay/mp-baidu/mp-toutiao/mp-qq/mp-kuaishou | 一期仅微信小程序，其他平台不涉及 | ⚪ 二期 |

---

## 六、微信公众平台配置（阻塞提审）

| 序号 | 配置项 | 配置位置 | 操作说明 | 阻塞等级 |
|------|--------|----------|----------|----------|
| 6.1 | 服务器域名 | 开发管理 → 开发设置 → 服务器域名 | 添加 request/upload/download 合法域名 | 🔴 阻塞 |
| 6.2 | 隐私协议 | 设置 → 服务内容声明 → 用户隐私保护指引 | 填写位置信息/相册/摄像头收集目的，与前端隐私政策一致 | 🔴 阻塞 |
| 6.3 | 类目选择 | 设置 → 基本设置 → 服务类目 | 选择正确类目（母婴/电商等） | 🔴 阻塞 |
| 6.4 | 业务域名 | 开发管理 → 开发设置 → 业务域名 | 如需 webview 打开域名则配置 | 🟡 按需 |

---

## 快速操作指引

### 步骤 1：获取微信小程序 AppID（前置条件）
1. 注册微信公众平台账号
2. 创建小程序应用
3. 获取 AppID 和 AppSecret

### 步骤 2：域名与备案
1. 购买域名
2. 完成 ICP 备案（通常 7-20 个工作日）
3. 配置 DNS 解析到服务器 IP

### 步骤 3：服务器部署
1. 参照《宝塔正式部署与回滚手册》部署后端
2. 创建 `.env` 文件并填入真实配置
3. 删除 `install.php`，重命名后台入口

### 步骤 4：前端构建
1. 创建 `shopxo-uniapp/.env.production` 并填入正式域名和 AppID
2. 填写 `manifest.json` 中 `mp-weixin.appid`
3. 填写 `project.config.json` 中 `appid`
4. HBuilderX 编译微信小程序

### 步骤 5：微信后台配置
1. 配置服务器域名
2. 填写隐私保护指引
3. 选择服务类目

### 步骤 6：后台运营配置
1. 配置客服电话
2. 配置隐私弹窗文案
3. 配置邀请奖励
4. 检查功能开关
5. 录入首批内容

### 步骤 7：提审
1. 上传体验版
2. 完成体验版全流程验收
3. 提交审核
