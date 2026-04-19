# 孕禧小程序 — 发布参数落地执行清单

> 按"发布当天执行"顺序排列，每一步标注：填什么、填哪里、怎么验证、容易漏的地方。

---

## 第一阶段：获取参数（发布前 1 天）

| 序号 | 操作                     | 获取什么                    | 从哪里获取                     | 记录到                        |
| ---- | ------------------------ | --------------------------- | ------------------------------ | ----------------------------- |
| 1    | 确认微信小程序 AppID     | AppID                       | 微信后台 → 开发管理 → 开发设置 | release-values-template.md §1 |
| 2    | 确认微信小程序 AppSecret | AppSecret                   | 同上（需管理员扫码查看）       | 同上                          |
| 3    | 确认服务器 IP/域名       | API_DOMAIN                  | 服务器提供商 / DNS 管理后台    | §2                            |
| 4    | 确认 SSL 证书            | 证书路径                    | 证书提供商 / 运维              | §2                            |
| 5    | 确认数据库连接信息       | DB_HOST/PORT/NAME/USER/PASS | 运维 / 数据库管理后台          | §3                            |
| 6    | 确认客服电话             | CONTACT_PHONE               | 运营                           | §5                            |
| 7    | 准备 Logo 图片           | 正方形+手机端 Logo          | 设计师提供                     | §5                            |
| 8    | 准备隐私政策/注册协议    | 协议 URL                    | 法务/运营提供                  | §6                            |

### 容易漏的地方

- AppSecret 需要管理员扫码，提前确认管理员可联系
- SSL 证书可能过期，提前检查有效期
- Logo 图片尺寸必须符合要求（300×300 / 220×66）
- 隐私政策 URL 必须是 HTTPS
- 数据库密码需确认：`.env.example` 中是 `shopxo_dev_123`，`database.php` 中是 `root123456`，必须统一

---

## 第二阶段：服务器配置（发布当天上午）

| 序号 | 操作                   | 填什么                                             | 填到哪里                                             | 验证方式                                         |
| ---- | ---------------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| 1    | 创建后端 .env          | 从 `.env.example` 复制                             | `cp shopxo-backend/.env.example shopxo-backend/.env` | `cat .env` 确认存在                              |
| 2    | 修改 .env 数据库配置   | DB_HOST/PORT/NAME/USER/PASS                        | 编辑 `shopxo-backend/.env`                           | `mysql -u USER -p -h HOST DB_NAME -e "SELECT 1"` |
| 3    | 修改 .env 调试开关     | `APP_DEBUG=false`                                  | 编辑 `shopxo-backend/.env`                           | `grep APP_DEBUG .env` → false                    |
| 4    | 确认密码一致性         | `.env` 密码 = `database.php` 密码 = MySQL 实际密码 | 对比三处                                             | 手动核对                                         |
| 5    | 配置 Nginx             | API_DOMAIN、DEPLOY_PATH、SSL_CERT_PATH             | `/etc/nginx/sites-available/yunxi.conf`              | `nginx -t && systemctl reload nginx`             |
| 6    | 修改 Nginx server_name | `localhost` → 实际域名                             | `docker/nginx/default.conf` 或 Nginx 配置文件        | `nginx -t`                                       |
| 7    | 确认表前缀             | DB*PREFIX = `sxo*`                                 | 安装向导中填写                                       | `SHOW TABLES LIKE 'sxo_%'`                       |
| 8    | 替换 SQL 中的客服电话  | `{{CONTACT_PHONE}}` → 真实号码                     | `docs/sql/yunxi-init-activity-demo.sql` 中 6 处      | `grep CONTACT_PHONE *.sql` → 无命中              |
| 9    | 执行数据库 SQL         | —                                                  | 依次执行 migration + init SQL                        | `bash check-server.sh`                           |
| 10   | 配置后台               | 站点名称=孕禧、Logo、搜索关键词                    | 后台 → 系统设置                                      | 打开小程序检查                                   |
| 11   | 配置协议 URL           | 隐私政策 URL、注册协议 URL                         | 后台 → 协议管理                                      | 登录页点击协议链接                               |
| 12   | 删除 install.php       | —                                                  | `rm public/install.php`                              | `ls public/install.php` → 不存在                 |
| 13   | 关闭调试               | APP_DEBUG=false、show_error_msg=false              | `.env` + `config/app.php`                            | `check-server.sh` 检查                           |

### 容易漏的地方

- **.env 文件不存在**：仓库中只有 `.env.example`，必须手动复制创建 `.env`
- **密码不一致**：`.env.example` 密码 (`shopxo_dev_123`) ≠ `database.php` 密码 (`root123456`)，必须统一
- 表前缀必须填 `sxo_`，填错则所有扩展表查询失败
- install.php 删除后无法再安装，确保数据库已初始化
- 协议 URL 必须在后台配置，否则登录页点击无反应
- SQL 中 `{{CONTACT_PHONE}}` 有 6 处，必须全部替换

---

## 第三阶段：微信后台配置（发布当天上午）

| 序号 | 操作         | 填什么                            | 填到哪里                              | 验证方式 |
| ---- | ------------ | --------------------------------- | ------------------------------------- | -------- |
| 1    | 服务器域名   | `https://实际域名`                | 微信后台 → 开发管理 → 服务器域名      | 保存成功 |
| 2    | 隐私保护指引 | 手机号/位置/头像/图片等接口用途   | 微信后台 → 设置 → 用户隐私保护指引    | 提交成功 |
| 3    | 服务类目     | 医疗→健康咨询 / 生活服务→母婴护理 | 微信后台 → 设置 → 基本设置 → 服务类目 | 审核通过 |

### 容易漏的地方

- 服务器域名必须包含 `https://` 前缀
- 隐私保护指引中每个接口都要填写用途说明
- 服务类目审核可能需要 1-3 天，提前提交

---

## 第四阶段：前端构建与上传（发布当天下午）

| 序号 | 操作               | 填什么                                      | 填到哪里                                          | 验证方式               |
| ---- | ------------------ | ------------------------------------------- | ------------------------------------------------- | ---------------------- |
| 1    | 填入 AppID         | 实际 AppID 值                               | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` | 打开项目不报错         |
| 2    | 设置环境变量       | `UNI_APP_REQUEST_URL` = `https://实际域名/` | HBuilderX 发行配置                                | 构建产物中搜索域名确认 |
| 3    | 构建发行版         | —                                           | HBuilderX → 发行 → 小程序-微信                    | 构建成功无报错         |
| 4    | 微信开发者工具上传 | 版本号 `1.0.0`                              | 微信开发者工具 → 上传                             | 版本管理中出现开发版   |
| 5    | 体验版测试         | —                                           | 微信后台 → 版本管理 → 设为体验版                  | 真机扫码体验           |

### 容易漏的地方

- manifest.json 中 appid 当前为空字符串，不填入无法编译
- 环境变量设置错误会导致接口 404，真机预览时检查 Network
- 上传版本号一旦提交不可修改，确认填 `1.0.0`
- `prod.js` 中 `UNI_APP_REQUEST_URL` 为空时只会 console.error，不会阻断构建，但上线后接口不通

---

## 第五阶段：提交审核（发布当天下午）

| 序号 | 操作         | 填什么         | 参考文档                      |
| ---- | ------------ | -------------- | ----------------------------- |
| 1    | 填写功能页面 | 页面路径列表   | `wechat-review-package.md` §3 |
| 2    | 填写版本描述 | v1.0.0 说明    | `version-note-template.md`    |
| 3    | 填写测试账号 | "无需测试账号" | `wechat-review-package.md` §6 |
| 4    | 提交审核     | —              | —                             |

### 容易漏的地方

- 功能页面路径必须与 pages.json 一致
- 版本描述中不要出现"测试""demo"等字眼

---

## 第六阶段：审核通过后发布

| 序号 | 操作                         | 验证方式                       |
| ---- | ---------------------------- | ------------------------------ |
| 1    | 点击"发布"                   | 版本管理显示"已发布"           |
| 2    | 真机扫码验证                 | 参考 `release-checklist.md` §4 |
| 3    | 运行 `check-server.sh`       | 全部 PASS 或仅有 WARN          |
| 4    | 运行 `check-placeholders.sh` | 代码/配置中无残留占位符        |

---

## 参数替换验证总表

| #   | 参数                       | 替换位置                        | 验证命令/方式                       | 容易漏 |
| --- | -------------------------- | ------------------------------- | ----------------------------------- | :----: |
| 1   | AppID (空→实际值)          | manifest.json → mp-weixin.appid | `grep '"appid"' manifest.json`      |   ⚠️   |
| 2   | `{{API_DOMAIN}}`           | Nginx + 前端环境变量 + 微信后台 | 真机 Network 面板                   |   ⚠️   |
| 3   | `{{CDN_DOMAIN}}`           | 前端环境变量                    | 图片加载正常                        |        |
| 4   | `{{DEPLOY_PATH}}`          | Nginx root + 脚本               | `ls DEPLOY_PATH`                    |        |
| 5   | `{{DB_HOST}}` 等           | .env → DATABASE.\*              | `mysql -u ... -e "SELECT 1"`        |        |
| 6   | 密码一致性                 | .env + database.php + MySQL     | 三处密码相同                        |   ⚠️   |
| 7   | `{{CONTACT_PHONE}}`        | SQL 数据 + 后台配置             | 活动详情页检查                      |   ⚠️   |
| 8   | `{{ADMIN_ENTRY}}`          | 部署文档记录                    | `ls public/admin*.php`              |        |
| 9   | `{{SSL_CERT_PATH}}`        | Nginx 配置                      | `nginx -t`                          |        |
| 10  | APP_DEBUG                  | .env → false                    | `grep APP_DEBUG .env`               |   ⚠️   |
| 11  | Nginx server_name          | default.conf                    | `nginx -t`                          |   ⚠️   |
| 12  | Logo 图片                  | 后台上传                        | 小程序中查看                        |   ⚠️   |
| 13  | 协议 URL                   | 后台配置                        | 登录页点击链接                      |   ⚠️   |
| 14  | install.php                | 删除                            | `ls public/install.php` → 不存在    |        |
| 15  | SQL 中 `{{CONTACT_PHONE}}` | yunxi-init-activity-demo.sql    | `grep CONTACT_PHONE *.sql` → 无命中 |   ⚠️   |

⚠️ = 容易遗漏，发布前重点检查
