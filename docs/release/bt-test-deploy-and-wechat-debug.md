# 宝塔测试环境部署 + 微信小程序测试号联调手册

> 适用阶段：测试环境首次部署 + 微信小程序测试号联调
> 执行人：开发
> 前置条件：一台已安装宝塔面板的服务器、微信开发者工具、HBuilderX
> 目标耗时：2-3 小时
> 最后更新：2026-04-24

---

## 第 1 步：宝塔建站 + 数据库（10 分钟）

### 1.1 安装 LNMP 环境

宝塔面板 → 软件商店，安装：

| 软件 | 版本 | 说明 |
|------|------|------|
| Nginx | 1.28+ | Web 服务器 |
| PHP | 8.1.x | FastCGI 模式 |
| MySQL | 5.7.x | 数据库 |

PHP 8.1 必装扩展（宝塔 → PHP 8.1 → 安装扩展）：

| 扩展 | 必须 |
|------|------|
| pdo_mysql | ✅ |
| mbstring | ✅ |
| curl | ✅ |
| gd | ✅ |
| openssl | ✅ |
| json | ✅ |
| xml | ✅ |
| bcmath | ✅ |
| fileinfo | ✅ |
| redis | 建议 |

### 1.2 创建站点

```
宝塔面板 → 网站 → 添加站点
  域名：填写服务器 IP 或测试域名（如 test.xiyun.com）
  根目录：/www/wwwroot/xiyun-api
  PHP 版本：PHP-81
  数据库：创建 MySQL 数据库
    数据库名：xiyun_test
    用户名：xiyun_test
    密码：生成强密码（≥16位，含大小写+数字+特殊字符）
    字符集：utf8mb4
    排序规则：utf8mb4_general_ci
```

**记录下来**：
```
DB_HOST = 127.0.0.1
DB_PORT = 3306
DB_NAME = xiyun_test
DB_USER = xiyun_test
DB_PASS = _____________
SITE_DIR = /www/wwwroot/xiyun-api
```

### 1.3 设置网站运行目录

```
宝塔面板 → 网站 → 设置 → 网站目录
  运行目录：/public
  防跨站：关闭（ThinkPHP 需要）
```

---

## 第 2 步：部署 shopxo-backend（15 分钟）

### 2.1 上传代码

```bash
cd /www/wwwroot/xiyun-api

# 克隆仓库
git clone https://github.com/kHuner9712/xiyun.git /tmp/xiyun
cp -r /tmp/xiyun/shopxo-backend/* .
cp -r /tmp/xiyun/shopxo-backend/.env.production.example .
rm -rf /tmp/xiyun
```

### 2.2 配置 .env

```bash
cp .env.production.example .env
vi .env
```

修改为：

```ini
APP_DEBUG = false

[DATABASE]
TYPE = mysql
HOSTNAME = 127.0.0.1
DATABASE = xiyun_test
USERNAME = xiyun_test
PASSWORD = 你的强密码
HOSTPORT = 3306
CHARSET = utf8mb4
PREFIX = sxo_

[LANG]
default_lang = zh-cn
```

### 2.3 Composer 安装

```bash
cd /www/wwwroot/xiyun-api

# 如果服务器没有 composer
curl -sS https://getcomposer.org/installer | php
php composer.phar install --no-dev --optimize-autoloader

# 如果已有 composer
composer install --no-dev --optimize-autoloader
```

### 2.4 目录权限

```bash
cd /www/wwwroot/xiyun-api
chown -R www:www .

find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

chmod 755 runtime/
chmod 755 public/upload/
chmod 755 public/download/
chmod 755 config/
chmod 755 public/rsakeys/

chmod -R 555 app/
chmod -R 555 extend/
chmod -R 555 thinkphp/
```

### 2.5 安全加固

```bash
# 删除安装入口
rm -f public/install.php

# 重命名后台入口
mv public/adminwlmqhs.php public/你的秘密入口名.php
```

### 2.6 配置 Nginx 伪静态

宝塔面板 → 网站 → 设置 → 伪静态，选择 `thinkphp`，或手动填入：

```nginx
location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=$1 last;
    }
}
```

### 2.7 Nginx 安全配置

宝塔面板 → 网站 → 设置 → 配置文件，在 `server { }` 块内添加：

```nginx
# 禁止访问敏感目录
location ~* ^/(runtime|config|app|extend|thinkphp|vendor)/ {
    return 404;
}

# 禁止访问隐藏文件
location ~ /\. {
    return 404;
}

# 禁止访问敏感文件
location ~* \.(sql|env|example|git|gitignore)$ {
    return 404;
}

# 上传文件大小限制
client_max_body_size 20m;
```

### 2.8 验证后端基础运行

```bash
# 测试 API 是否可访问
curl -s http://你的IP/api.php?s=index/index | head -50
# 预期：返回 JSON 数据

# 测试后台入口
curl -s -o /dev/null -w "%{http_code}" http://你的IP/你的秘密入口名.php
# 预期：200 或 302
```

---

## 第 3 步：执行 SQL 迁移（10 分钟）

### 3.1 按顺序执行

```bash
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME="xiyun_test"
DB_USER="xiyun_test"
DB_PASS="你的强密码"
MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME"
SITE_DIR="/www/wwwroot/xiyun-api"

# 1. ShopXO 主库（不可重复执行！）
$MYSQL < $SITE_DIR/config/shopxo.sql

# 2. 禧孕核心表（不可重复执行！）
$MYSQL < /tmp/xiyun/docs/muying-final-migration.sql
# 如果已删除临时目录，从仓库重新获取
cd /www/wwwroot/xiyun-api && git clone --depth 1 https://github.com/kHuner9712/xiyun.git /tmp/xiyun
$MYSQL < /tmp/xiyun/docs/muying-final-migration.sql

# 3. 功能开关初始化（幂等，可重复执行）
$MYSQL < /tmp/xiyun/docs/sql/muying-feature-switch-migration.sql

# 4. 反馈审核字段（幂等）
$MYSQL < /tmp/xiyun/docs/muying-feedback-review-migration.sql

# 5. 邀请奖励统一（幂等）
$MYSQL < /tmp/xiyun/docs/muying-invite-reward-unify-migration.sql

# 6. 功能开关补充（幂等）
$MYSQL < /tmp/xiyun/docs/muying-feature-flag-upgrade-migration.sql

# 7. 后台菜单权限（幂等）
$MYSQL < /tmp/xiyun/docs/muying-admin-power-migration.sql
```

### 3.2 导入演示数据（可选）

```bash
$MYSQL < /tmp/xiyun/docs/sql/xiyun-init-config.sql
$MYSQL < /tmp/xiyun/docs/sql/xiyun-init-activity-demo.sql
$MYSQL < /tmp/xiyun/docs/sql/xiyun-init-feedback-demo.sql
```

### 3.3 验证数据库

```bash
# 检查核心表
$MYSQL -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME IN ('sxo_activity','sxo_activity_signup','sxo_invite_reward','sxo_muying_feedback','sxo_config','sxo_payment','sxo_user','sxo_power');"

# 检查功能开关
$MYSQL -e "SELECT only_tag, value, name FROM sxo_config WHERE only_tag LIKE 'feature_%_enabled' ORDER BY only_tag;"
# 预期：高风险=0，一期核心=1

# 检查后台菜单
$MYSQL -e "SELECT id, name FROM sxo_power WHERE name='禧孕运营';"
# 预期：返回禧孕运营菜单
```

---

## 第 4 步：上线前检查脚本（5 分钟）

```bash
cd /tmp/xiyun

# Shell 版
bash scripts/preflight/preflight-production-check.sh \
  --repo /tmp/xiyun \
  --env /www/wwwroot/xiyun-api/.env

# PHP 版
php scripts/preflight/preflight-production-check.php \
  --env=/www/wwwroot/xiyun-api/.env \
  --repo=/tmp/xiyun
```

**预期结果**：0 BLOCKER，可能有 WARN（测试环境可接受）

如果出现 BLOCKER，按提示修复后重新检查。

---

## 第 5 步：配置测试域名 HTTPS（10 分钟）

### 5.1 方式一：使用 IP + 端口（最快，测试环境可用）

```
宝塔面板 → 网站 → 设置
  直接使用 IP 访问即可，无需域名
  微信开发者工具中勾选"不校验合法域名"
```

### 5.2 方式二：使用测试域名 + Let's Encrypt

```
1. 将测试域名（如 test.xiyun.com）A 记录指向服务器 IP
2. 宝塔面板 → 网站 → 设置 → SSL → Let's Encrypt
3. 勾选域名 → 申请证书
4. 开启强制 HTTPS
```

### 5.3 验证 HTTPS

```bash
curl -I https://你的域名/api.php?s=index/index
# 预期：HTTP/2 200
```

---

## 第 6 步：配置前端测试号（10 分钟）

### 6.1 创建前端环境配置

在本地开发机上：

```bash
cd shopxo-uniapp

# 创建测试环境配置
cat > .env.production << 'EOF'
UNI_APP_ENV=production
UNI_APP_REQUEST_URL=https://你的域名或IP/
VUE_APP_UNI_APP_REQUEST_URL=https://你的域名或IP/
UNI_APP_STATIC_URL=https://你的域名或IP/
VUE_APP_UNI_APP_STATIC_URL=https://你的域名或IP/
UNI_APP_WX_APPID=wxda7779770f53e901
VUE_APP_UNI_APP_WX_APPID=wxda7779770f53e901
EOF
```

> ⚠ 如果使用 IP + HTTP（非 HTTPS），URL 填 `http://你的IP/`

### 6.2 确认 AppID

```bash
# 检查 manifest.json 中 mp-weixin.appid
grep -A2 'mp-weixin' manifest.json | head -5
# 应为 wxda7779770f53e901

# 检查 project.config.json 中 appid
grep appid project.config.json | head -1
# 应为 wxda7779770f53e901
```

### 6.3 微信后台配置 request 合法域名

登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)：

```
开发管理 → 开发设置 → 服务器域名
  request 合法域名：https://你的域名
  uploadFile 合法域名：https://你的域名
  downloadFile 合法域名：https://你的域名
```

> 如果使用 IP 测试，在微信开发者工具中勾选"不校验合法域名"即可。

---

## 第 7 步：编译到微信开发者工具（5 分钟）

### 7.1 HBuilderX 编译

```
1. 用 HBuilderX 打开 shopxo-uniapp 目录
2. 点击 发行 → 小程序-微信
3. 等待编译完成
4. 编译产物在 unpackage/dist/build/mp-weixin/
```

### 7.2 微信开发者工具导入

```
1. 打开微信开发者工具
2. 导入项目 → 选择 unpackage/dist/build/mp-weixin/ 目录
3. AppID：wxda7779770f53e901
4. 勾选"不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"
5. 点击确定
```

### 7.3 验证编译产物

```
微信开发者工具中：
1. 控制台无报错
2. 首页正常加载
3. Network 面板能看到 API 请求
```

---

## 第 8 步：联调测试（30-60 分钟）

### 8.1 后台初始化（首次部署必须）

1. 浏览器访问 `https://你的域名/你的秘密入口名.php`
2. 使用默认管理员账号登录
3. 修改默认密码
4. 确认"禧孕运营"菜单完整（6 个子菜单）
5. 配置站点名称：禧孕母婴
6. 配置客服电话
7. 配置隐私弹窗文案
8. 确认功能开关（activity/invite/feedback/content 应为开启）
9. 配置邀请奖励积分
10. 配置隐私政策 + 用户协议

### 8.2 联调检查清单

| 序号 | 功能 | 操作步骤 | 预期结果 | 实际结果 | 问题 |
|:---:|------|---------|---------|---------|------|
| 1 | 首页加载 | 打开小程序 | 首页正常显示，阶段 Tab 可切换 | | |
| 2 | 商品列表 | 点击分类/搜索 | 商品列表正常加载 | | |
| 3 | 商品详情 | 点击商品 | 详情页正常，图片/规格/库存显示 | | |
| 4 | 加入购物车 | 点击加入购物车 | 提示成功，购物车角标+1 | | |
| 5 | 购物车 | 进入购物车页 | 商品数量可修改，金额正确 | | |
| 6 | 下单 | 点击结算 → 提交订单 | 订单创建成功，跳转支付 | | |
| 7 | 支付 | 微信支付 | 支付流程正常（测试号可能无法真实支付） | | |
| 8 | 订单列表 | 我的 → 订单 | 订单列表正常，状态正确 | | |
| 9 | 活动列表 | 点击活动 Tab | 活动列表正常，阶段筛选可用 | | |
| 10 | 活动详情 | 点击活动 | 详情页正常，报名按钮可用 | | |
| 11 | 活动报名 | 填写报名信息 → 提交 | 报名成功提示 | | |
| 12 | 取消报名 | 我的报名 → 取消 | 取消成功，报名人数-1 | | |
| 13 | 后台确认 | 后台 → 报名管理 → 确认 | 状态变为已确认 | | |
| 14 | 后台签到 | 后台 → 报名管理 → 签到 | 状态变为已签到 | | |
| 15 | 后台取消 | 后台 → 报名管理 → 取消 | 取消成功，报名人数-1 | | |
| 16 | 批量确认 | 勾选多条 → 批量确认 | 批量确认成功 | | |
| 17 | 导出 CSV | 点击导出 | 下载 CSV 文件，数据正确 | | |
| 18 | 个人资料 | 我的 → 个人资料 | 母婴画像字段可编辑保存 | | |
| 19 | 邀请关系 | 我的 → 邀请 | 邀请码/海报显示，邀请记录可见 | | |
| 20 | 插件拦截 | 尝试访问 distribution 插件 API | 返回"该功能暂未开放" | | |
| 21 | 反馈 | 我的 → 反馈 | 反馈提交成功 | | |
| 22 | 收藏 | 商品/活动收藏 | 收藏/取消收藏正常 | | |

### 8.3 接口报错排查

如果接口返回错误，按以下步骤排查：

```bash
# 1. 查看 ThinkPHP 运行日志
tail -50 /www/wwwroot/xiyun-api/runtime/log/$(date +%Y%m)/$(date +%d).log

# 2. 查看 Nginx 错误日志
tail -50 /www/wwwlogs/你的域名.error.log

# 3. 查看 PHP 错误日志
tail -50 /www/server/php/81/var/log/php-fpm.log

# 4. 测试具体接口
curl -v "https://你的域名/api.php?s=activity/index&m=0&n=10"
curl -v "https://你的域名/api.php?s=goods/search&m=0&n=10"
curl -v "https://你的域名/api.php?s=plugins/index&pluginsname=distribution&pluginscontrol=index&pluginsaction=index"
# 预期最后一个返回: {"code":-10000,"msg":"该功能暂未开放"}
```

---

## 第 9 步：输出联调问题清单

### 9.1 问题记录模板

| 序号 | 功能 | 问题描述 | 严重程度 | 接口/页面 | 错误信息 | 修复建议 | 状态 |
|:---:|------|---------|:-------:|---------|---------|---------|:---:|
| 1 | | | P0/P1/P2 | | | | 待修 |
| 2 | | | | | | | |

严重程度定义：
- **P0**：核心链路阻断（无法下单/支付/登录）
- **P1**：功能异常但有替代路径
- **P2**：体验问题/样式问题

### 9.2 常见问题速查

| 症状 | 可能原因 | 排查命令/操作 |
|------|---------|-------------|
| API 返回 500 | .env 配置错误 / 权限问题 | `tail runtime/log/` |
| API 返回空 | 数据库未导入 / 伪静态未配 | `curl -v API地址` |
| 首页空白 | 前端 request_url 未配 | 检查 .env.production |
| 登录失败 | 微信 AppID 不匹配 | 检查 manifest.json |
| 支付失败 | 测试号无支付权限 | 正常，测试号限制 |
| 活动报名 404 | 迁移 SQL 未执行 | 检查 sxo_activity 表 |
| 功能开关无效 | config 缓存 | `php think clear` |
| 图片不显示 | 静态资源路径错误 | 检查 UNI_APP_STATIC_URL |
| 插件拦截不生效 | MyC 缓存 | 清除后台缓存 |
| 后台菜单缺失 | admin-power SQL 未执行 | 重新执行迁移 SQL |

---

## 部署后定时任务

宝塔面板 → 计划任务 → 添加：

| 任务类型 | 执行周期 | 脚本内容 |
|----------|----------|----------|
| Shell 脚本 | 每 1 分钟 | `cd /www/wwwroot/xiyun-api && php think order_close` |
| Shell 脚本 | 每 5 分钟 | `cd /www/wwwroot/xiyun-api && php think order_auto_confirm` |
| 备份数据库 | 每天 2:00 | 宝塔自动备份，保留 7 份 |
