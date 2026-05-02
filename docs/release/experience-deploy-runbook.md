# 体验版部署 Runbook

> 适用阶段：体验版上线（测试号 AppID + 服务器 IP + 未启用正式支付）  
> 执行人：开发/运维  
> 输入物：服务器 IP、宝塔面板账号、测试号 AppID  
> 输出物：可扫码体验的微信小程序体验版  
> 目标耗时：1 小时  
> 最后更新：2026-04-25

---

> ⚠ 本文档只包含体验版步骤，不包含正式提审或正式支付配置

---

## 第 1 步：宝塔建站 + 数据库（5 分钟）

```bash
# 宝塔面板 → 网站 → 添加站点
# 域名填写：服务器 IP 或测试域名
# 创建数据库：字符集 utf8mb4，排序规则 utf8mb4_general_ci
# 记录：数据库名 / 用户名 / 密码
```

---

## 第 2 步：一键部署后端（10 分钟）

```bash
bash scripts/deploy/bootstrap-backend.sh \
  --site-dir /www/wwwroot/xiyun-api \
  --env=experience \
  --db-host 127.0.0.1 \
  --db-name xiyun \
  --db-user xiyun \
  --db-pass YOUR_DB_PASSWORD
```

脚本会自动完成：克隆代码 → 配置 .env → composer install → 修复权限 → 导库+迁移

---

## 第 3 步：配置 Nginx（5 分钟）

```bash
# 宝塔面板 → 网站 → 设置 → 配置文件
# 参照 docs/release/bt-deploy-rollback-guide.md 中的 Nginx 配置
# 确认 URL 重写规则生效
```

验证：
```bash
curl -s http://你的IP/api.php?s=common.index.index | head -20
# 应返回 JSON
```

---

## 第 4 步：后台初始化配置（15 分钟）

按 [admin-first-login-checklist.md](admin-first-login-checklist.md) 执行 11 步：

1. 修改默认密码
2. 确认"禧孕运营"菜单完整（7 个子菜单，含禧孕数据看板）
3. 配置站点名称
4. 配置客服电话
5. 配置隐私弹窗文案
6. 配置功能开关（activity/invite/feedback/content 开启）
7. 配置邀请奖励（首单积分 50-100）
8. 配置协议内容（隐私政策 + 用户协议）
9. 录入首批内容（1 活动 + 2 商品 + 1 文章）
10. 配置首页布局
11. 最终验证

---

## 第 5 步：前端编译上传（10 分钟）

```bash
# 1. 填写测试号 AppID
# 编辑 shopxo-uniapp/manifest.json → mp-weixin.appid → wxda7779770f53e901
# 编辑 shopxo-uniapp/project.config.json → appid → wxda7779770f53e901

# 2. 创建 .env.production
cat > shopxo-uniapp/.env.production << 'EOF'
UNI_APP_REQUEST_URL=http://你的服务器IP/
UNI_APP_WX_APPID=wxda7779770f53e901
EOF

# 3. HBuilderX → 发行 → 小程序-微信
# 4. 微信开发者工具打开 unpackage/dist/build/mp-weixin
# 5. 勾选"不校验合法域名"
# 6. 点击"上传"
```

---

## 第 6 步：部署后验收（10 分钟）

```bash
# 自动验收
bash scripts/deploy/post-deploy-check.sh \
  --site-dir /www/wwwroot/xiyun-api \
  --api-url http://你的IP/ \
  --db-name xiyun --db-user xiyun --db-pass YOUR_DB_PASSWORD \
  --env=experience
```

确认输出：**0 BLOCKER**

---

## 第 7 步：Smoke Test（5 分钟）

按 [experience-smoke-test.md](experience-smoke-test.md) 执行 18 步验收。

---

## 部署前备份（每次部署前必做）

```bash
BACKUP_DIR="/www/backup/xiyun/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份数据库
mysqldump -h 127.0.0.1 -u xiyun -pYOUR_DB_PASSWORD xiyun > "$BACKUP_DIR/db.sql"

# 备份 .env
cp /www/wwwroot/xiyun-api/.env "$BACKUP_DIR/env"

# 记录当前 commit
cd /www/wwwroot/xiyun-api && git rev-parse HEAD > "$BACKUP_DIR/commit.txt"
```

---

## 回滚

```bash
bash scripts/deploy/rollback-guide.sh \
  --site-dir /www/wwwroot/xiyun-api \
  --backup-dir /www/backup/xiyun/YYYYMMDD_HHMMSS \
  --db-name xiyun --db-user xiyun --db-pass YOUR_DB_PASSWORD \
  --confirm
```
