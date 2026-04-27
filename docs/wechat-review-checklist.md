# 孕禧一期提审前自检清单

> 每次发版前逐项确认，确保不误开高风险功能、配置正确、隐私合规。

## 1. AppID 与环境

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 1.1 | 正式 AppID 已配置 | `UNI_APP_WX_APPID` 非空且非测试号 | `.env.production` |
| 1.2 | 不使用测试号 AppID | 不含 `wxda7779770f53e901` | `runtime-config.js` 门禁 |
| 1.3 | manifest.json AppID 一致 | `mp-weixin.appid` 与 `.env.production` 一致 | 对比两个文件 |
| 1.4 | project.config.json AppID 一致 | `appid` 与 `.env.production` 一致 | 对比两个文件 |

## 2. 网络与域名

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 2.1 | 生产 API 为 HTTPS | `UNI_APP_REQUEST_URL` 以 `https://` 开头 | `.env.production` |
| 2.2 | 域名已备案 | 域名通过 ICP 备案审核 | 工信部备案查询 |
| 2.3 | 微信合法域名已配置 | request/upload/download 域名已填入微信公众平台 | 微信公众平台后台 |
| 2.4 | 不使用 IP 或 localhost | URL 不含 `127.0.0.1`/`localhost`/内网IP | `runtime-config.js` 门禁 |
| 2.5 | 静态资源 URL 为 HTTPS | `UNI_APP_STATIC_URL` 以 `https://` 开头 | `.env.production` |

## 3. 隐私与协议

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 3.1 | 隐私政策可访问 | `/pages/agreement/agreement?type=privacy` 正常打开 | 真机/模拟器访问 |
| 3.2 | 用户协议可访问 | `/pages/agreement/agreement?type=user` 正常打开 | 真机/模拟器访问 |
| 3.3 | `__usePrivacyCheck__` 已开启 | manifest.json 中为 `true` | 检查 manifest.json |
| 3.4 | 活动报名隐私授权正常 | 报名时"必需信息"和"同步画像"两个勾选独立 | 真机测试 |
| 3.5 | requiredPrivateInfos 最小化 | 一期不强制定位，列表为空或仅含必要项 | manifest.json |
| 3.6 | 免责声明展示 | 文章详情/活动详情页底部有免责声明 | 真机访问 |

## 4. 高风险功能开关

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 4.1 | 优惠券已关闭 | `feature_coupon_enabled = 0` | 后台 → 合规中心 |
| 4.2 | 积分已关闭 | `feature_points_enabled = 0` | 后台 → 合规中心 |
| 4.3 | 钱包已关闭 | `feature_wallet_enabled = 0` | 后台 → 合规中心 |
| 4.4 | 分销已关闭 | `feature_distribution_enabled = 0` | 后台 → 合规中心 |
| 4.5 | 会员已关闭 | `feature_membership_enabled = 0` | 后台 → 合规中心 |
| 4.6 | 直播已关闭 | `feature_live_enabled = 0` | 后台 → 合规中心 |
| 4.7 | 医院/问诊已关闭 | `feature_hospital_enabled = 0` | 后台 → 合规中心 |
| 4.8 | UGC 已关闭 | `feature_ugc_enabled = 0` | 后台 → 合规中心 |
| 4.9 | 支付已关闭或已配置 | `feature_payment_enabled = 0` 或微信支付商户号已配置 | 后台 → 合规中心 |
| 4.10 | 扫码支付已关闭 | `feature_scanpay_enabled = 0` | 后台 → 合规中心 |
| 4.11 | 秒杀已关闭 | `feature_seckill_enabled = 0` | 后台 → 合规中心 |
| 4.12 | 礼品卡已关闭 | `feature_giftcard_enabled = 0` | 后台 → 合规中心 |
| 4.13 | 投诉已关闭 | `feature_complaint_enabled = 0` | 后台 → 合规中心 |
| 4.14 | 发票已关闭 | `feature_invoice_enabled = 0` | 后台 → 合规中心 |

## 5. 后端安全

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 5.1 | APP_DEBUG = false | `.env` 中 `APP_DEBUG = false` | 检查 `.env` |
| 5.2 | phpMyAdmin 不公网开放 | `http://域名/phpmyadmin` 返回 403/404 | 浏览器访问 |
| 5.3 | 数据库不公网开放 | 3306 端口不对外暴露 | `telnet 域名 3306` |
| 5.4 | 安装入口已删除 | `public/install.php` 不存在 | 检查文件 |
| 5.5 | 后台入口已重命名 | `admin.php` 已改为非默认名称 | 检查 `public/` 目录 |
| 5.6 | 敏感目录已屏蔽 | `.git`/`.env`/`vendor` 不可通过 HTTP 访问 | Nginx 配置 |
| 5.7 | 后台管理员密码已修改 | 非 admin/admin 默认密码 | 人工确认 |
| 5.8 | SQL 迁移已执行且表前缀正确 | 所有迁移 SQL 按顺序执行；表前缀为 sxo_（如不同需全局替换迁移脚本中的前缀） | `node scripts/preflight/check-migration.js` |
| 5.9 | 活动报名隐私授权字段已添加 | `sxo_activity_signup` 表含 `profile_sync_agreed` 和 `profile_sync_agreed_time` 字段 | `DESCRIBE sxo_activity_signup` |

## 6. Git 与敏感信息

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 6.1 | 敏感信息未提交 Git | `.env.production` 不在 Git 中 | `git ls-files` |
| 6.2 | .env.example 无真实密钥 | 占位符为 `{{XXX}}` 而非真实值 | 检查 `.env.*.example` |
| 6.3 | .gitignore 已配置 | `.env.production`/`.env.staging` 已忽略 | 检查 `.gitignore` |
| 6.4 | Git 历史无密钥泄露 | 无真实 API Key/Secret 在提交记录中 | `git log -p` 搜索 |

## 7. pages.json 与路由

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 7.1 | 无高风险页面注册 | 不含 wallet/coupon/points/distribution/hospital 等子包 | 检查 `pages.json` |
| 7.2 | 仅注册一期允许的插件子包 | brand/express/delivery | 检查 `pages.json` |
| 7.3 | 路由守卫正常 | 直接访问 `/pages/plugins/wallet/` 被拦截 | 真机测试 |

## 8. 内容合规

| # | 检查项 | 通过标准 | 检查方式 |
|---|--------|---------|---------|
| 8.1 | 无医疗导向功能 | 不出现"诊断/治疗/处方/问诊"等导向性功能 | 全局搜索 |
| 8.2 | 商品分类合规 | 无医疗器械/药品/服务类商品上架 | 后台检查 |
| 8.3 | 内容敏感词扫描通过 | 文章/活动内容无高风险敏感词命中 | 后台内容合规扫描 |

## 9. 自动化脚本

运行自检脚本确认：

```bash
# Node.js 脚本（检查 pages.json / manifest / .env / 高风险关键词）
node scripts/check-phase1-release.js

# Bash 脚本（检查 AppID / 隐私 / 域名 / 安全配置）
bash scripts/preflight/check-wechat-submit-readiness.sh .
```

两个脚本均通过（0 BLOCKER）方可提审。

## 10. 人工最终确认

- [ ] 真机测试：未登录状态不报错
- [ ] 真机测试：登录后用户中心不显示高风险功能
- [ ] 真机测试：直接访问高风险路径被阻断
- [ ] 真机测试：购物车页面正常、支付入口提示"暂未开放"
- [ ] 真机测试：文章/活动详情页免责声明可见
- [ ] 微信公众平台：服务类目、隐私保护指引、服务器域名已配置
