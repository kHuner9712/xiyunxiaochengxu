# 正式上线前人工配置清单

> 适用阶段：体验版前 / 提审前 / 正式发布前（三阶段统一参考）  
> 执行人：开发+运营  
> 输入物：各阶段所需配置值  
> 输出物：配置完整的后端+前端+微信后台  
> 前提：已有服务器+宝塔+Nginx+PHP 8.1+MySQL 5.7.44  
> 注意：体验版详细步骤见 [experience-deploy-runbook.md](experience-deploy-runbook.md)，提审切换见 [submit-switch-runbook.md](submit-switch-runbook.md)
> **RC 封板版本**：v0.1.0-rc1 | 封板报告：[rc-gate-report.md](rc-gate-report.md)
> 最后更新：2026-04-25

---

> **自动化检查脚本对应关系**  
> - 阶段 A → `check-release-placeholders.sh --mode=experience` + `check-runtime-config.sh --env`  
> - 阶段 B → `check-release-placeholders.sh --mode=submit` + `check-wechat-submit-readiness.sh`  
> - 阶段 C → `run-rc-gate.sh --mode=submit --env`  
> 每个阶段完成后应运行对应脚本验证

---

## 阶段 A：必须在体验版前完成

> **执行人**：开发+运营  
> **输入物**：服务器信息、测试号 AppID、客服电话、首批内容  
> **输出物**：可扫码体验的体验版  
> **失败回退**：修改对应配置项重新编译  
> **限定条件**：体验版可用测试号 AppID + 服务器 IP/测试域名 + 未启用正式支付，不需要备案域名和正式 AppID

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 |
|------|--------|----------|--------|----------|
| A.1 | 后端数据库连接 | `shopxo-backend/.env` | 模板占位符 | 填入 MySQL 地址/库名/用户/密码 |
| A.2 | APP_DEBUG | `shopxo-backend/.env` | 未设置 | 体验版可设 true，提审前必须改 false |
| A.3 | 后台管理员密码 | 后台首次登录 | 默认 | 登录后立即修改默认密码 |
| A.4 | 后台菜单注册 | 数据库 | 未执行 | 执行 `docs/muying-admin-power-migration.sql` |
| A.5 | 客服电话 | 后台 → 手机端配置 | 空 | 填入客服电话，否则"联系客服"入口不显示 |
| A.6 | 隐私弹窗文案 | 后台 → 小程序配置 | 空/默认 | 填入清晰收集说明（SQL 已提供模板） |
| A.7 | 功能开关 | 后台 → 功能开关 | 需确认 | 确认 activity/invite/feedback/content 已开启 |
| A.8 | 首单奖励积分 | 后台 → 邀请配置 | 默认 0 | 建议设 50-100 |
| A.9 | 首批内容 | 后台 → 活动/商品/文章 | 空 | 至少 1 活动 + 2 商品 + 1 文章 |
| A.10 | 测试号 AppID | `manifest.json` → `mp-weixin.appid` | `""` 空 | 填入测试号 AppID（如 wxda7779770f53e901） |
| A.11 | 测试号 AppID | `project.config.json` → `appid` | `""` 空 | 与 A.10 相同 |
| A.12 | 后端地址 | `shopxo-uniapp/.env.production` | 模板占位符 | 填入 `http://服务器IP:端口/` |
| A.13 | AppSecret | 后台 → 小程序配置 | 空 | 填入测试号 AppSecret |
| A.14 | 后端 API 可达性 | 开发者工具 → 网络 | 未验证 | 确认小程序可正常请求后端接口 |
| A.15 | 小程序版本号 | `manifest.json` → `versionName` | 默认 | 设置初始版本号（如 1.0.0） |

### ✅ 阶段 A 验证脚本
```bash
bash scripts/preflight/check-release-placeholders.sh --mode=experience .
bash scripts/preflight/check-runtime-config.sh --env /path/to/.env
```

---

## 阶段 B：必须在提审前完成

> **执行人**：开发+运营  
> **输入物**：正式 AppID、备案域名、SSL 证书  
> **输出物**：可提交审核的正式版  
> **失败回退**：回退到体验版配置  
> **前提**：需要正式 AppID + 备案域名 + HTTPS

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 |
|------|--------|----------|--------|----------|
| B.1 | 正式 AppID | `manifest.json` → `mp-weixin.appid` | 测试号 | 替换为正式 AppID |
| B.2 | 正式 AppID | `project.config.json` → `appid` | 测试号 | 与 B.1 相同 |
| B.3 | 正式 AppSecret | 后台 → 小程序配置 | 测试号 | 替换为正式 AppSecret |
| B.4 | 正式域名 | `shopxo-uniapp/.env.production` → `UNI_APP_REQUEST_URL` | IP 地址 | 替换为 `https://备案域名/` |
| B.5 | 静态资源域名 | `shopxo-uniapp/.env.production` → `UNI_APP_STATIC_URL` | IP 地址 | 通常与 B.4 相同 |
| B.6 | APP_DEBUG | `shopxo-backend/.env` | true | **必须改为 false** |
| B.7 | install.php | `shopxo-backend/public/install.php` | 存在 | **必须删除** |
| B.8 | 后台入口重命名 | `shopxo-backend/public/admin.php` | 默认名 | **必须重命名** |
| B.9 | 服务器域名 | 微信公众平台 → 开发设置 | 未配置 | 添加备案域名到 request/upload/download 合法域名 |
| B.10 | 隐私保护指引 | 微信公众平台 → 服务内容声明 | 未配置 | 填写位置/相册/摄像头/手机号收集用途 |
| B.11 | 服务类目 | 微信公众平台 → 基本设置 | 未选择 | 选择"母婴用品"或"电商平台" |
| B.12 | 隐私政策内容 | 后台 → 协议管理 | 需确认 | 确认与微信后台隐私保护指引一致 |
| B.13 | 用户协议内容 | 后台 → 协议管理 | 需确认 | 确认内容完整 |
| B.14 | SSL 证书 | 服务器 Nginx | 未配置 | 配置 HTTPS 证书（宝塔可一键申请 Let's Encrypt） |
| B.15 | 支付回调域名 | 后台 → 支付配置 | 未配置 | 确认支付回调地址使用备案域名 |
| B.16 | 小程序体验版二维码 | 微信公众平台 | 未生成 | 生成体验版二维码供测试 |

### ✅ 阶段 B 验证脚本
```bash
bash scripts/preflight/check-release-placeholders.sh --mode=submit .
bash scripts/preflight/check-wechat-submit-readiness.sh .
```

---

## 阶段 C：必须在正式发布前完成

> **执行人**：开发+运营  
> **输入物**：微信支付商户配置  
> **输出物**：支付功能可用的正式版  
> **失败回退**：关闭支付入口，其他功能正常使用  
> **前提**：支付功能上线前必须完成

| 序号 | 配置项 | 所在文件 | 当前值 | 操作说明 |
|------|--------|----------|--------|----------|
| C.1 | 微信支付商户号 | 后台 → 支付配置 | 空 | 在 pay.weixin.qq.com 申请 |
| C.2 | 微信支付商户密钥 | 后台 → 支付配置 | 空 | 商户平台 API 密钥 |
| C.3 | 微信支付证书 | 服务器上传 | 空 | apiclient_cert.pem / apiclient_key.pem |
| C.4 | 每日奖励上限 | 后台 → 邀请配置 | 默认 0 | 建议设合理上限（如 10） |
| C.5 | 邀请口号 | 后台 → 邀请配置 | 空 | 填入邀请页标题文案 |
| C.6 | 定时任务 | 宝塔 → 计划任务 | 未配置 | 订单关闭/自动确认/数据备份 |
| C.7 | 支付回调通知 URL | 后台 → 支付配置 | 未配置 | 填入 `https://备案域名/支付回调路径` |
| C.8 | 订单超时关闭时间 | 后台 → 订单配置 | 默认 | 建议设 30 分钟 |

### ✅ 阶段 C 验证脚本
```bash
bash scripts/preflight/run-rc-gate.sh --mode=submit --env /path/to/.env .
```

---

## 外部条件真实阻塞项

| 阻塞项 | 阻塞阶段 | 预计耗时 | 说明 |
|--------|----------|----------|------|
| 正式微信小程序 AppID | 阶段 B | 1-3 天 | 注册微信公众平台获取 |
| ICP 域名备案 | 阶段 B | 7-20 天 | 域名未备案则微信审核不通过 |
| 微信支付商户号 | 阶段 C | 3-7 天 | 需申请微信支付 |
| 微信公众平台隐私保护指引 | 阶段 B | 30 分钟 | 需在微信后台填写 |
| 微信公众平台合法域名 | 阶段 B | 30 分钟 | 需备案域名后配置 |

> **注意**：服务器+宝塔+Nginx+PHP+MySQL 已具备，不列为阻塞项。
