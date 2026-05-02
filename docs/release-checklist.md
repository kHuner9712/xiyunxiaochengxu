# 禧孕 V1.0 一期上线发布检查清单

发布前逐项确认，全部 ✅ 后方可进入体验版测试。

---

## 1. 后端部署

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1.1 | PHP 版本 8.1 | ☐ | 不要使用 7.x 或 8.2+ |
| 1.2 | MySQL 版本 5.7 | ☐ | 不要使用 8.0 |
| 1.3 | Nginx 运行目录指向 /public | ☐ | 不是项目根目录 |
| 1.4 | 伪静态选择 thinkphp | ☐ | 或手动添加 rewrite 规则 |
| 1.5 | SSL 证书已配置 | ☐ | 必须开启 HTTPS |
| 1.6 | .env 已创建且 APP_DEBUG=false | ☐ | 从 .env.production.example 复制并替换占位符 |
| 1.7 | 数据库迁移已执行 | ☐ | 执行 muying-final-migration.sql + muying-v1-post-migration.sql |
| 1.8 | MUYING_PRIVACY_KEY 已配置 | ☐ | AES-256-CBC 密钥，≥16字符 |
| 1.8a | 敏感数据迁移 dry-run 已执行 | ☐ | php scripts/migrate-encrypt-sensitive.php --dry-run，确认扫描/加密数量 |
| 1.8b | 敏感数据迁移正式执行已完成 | ☐ | php scripts/migrate-encrypt-sensitive.php --force，确认无失败记录 |
| 1.9 | 后台入口文件名已混淆 | ☐ | adminwlmqhs.php，不要改回 admin.php |
| 1.10 | install.php 已删除或禁用 | ☐ | 部署后删除 public/install.php |
| 1.11 | runtime 目录不可公网访问 | ☐ | Nginx 规则禁止访问 runtime/ |
| 1.12 | .env 文件不可公网访问 | ☐ | Nginx 规则禁止访问 .env |
| 1.13 | phpMyAdmin 不公网开放 | ☐ | 如需使用，限制 IP 白名单 |
| 1.14 | MySQL 3306 不开放公网 | ☐ | 仅允许 127.0.0.1 连接 |
| 1.15 | PHP 危险函数已禁用 | ☐ | exec/shell_exec/system/passthru/popen |
| 1.16 | 上传文件大小限制 ≥20MB | ☐ | php.ini post_max_size / upload_max_filesize |
| 1.17 | config/database.php 已创建 | ☐ | 从 .env 读取数据库配置 |
| 1.18 | config/domain.php 已配置 | ☐ | 绑定实际域名 |
| 1.19 | check-baota-runtime.php 通过 | ☐ | php scripts/preflight/check-baota-runtime.php，0 BLOCKER |
| 1.20 | check-db-schema.php 通过 | ☐ | php scripts/preflight/check-db-schema.php，0 BLOCKER |
| 1.21 | preflight-production-check.php 通过 | ☐ | php scripts/preflight/preflight-production-check.php，0 BLOCKER |

## 2. 后端功能开关

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 2.1 | feature_activity_enabled = 1 | ☐ | 活动功能开启 |
| 2.2 | feature_invite_enabled = 1 | ☐ | 邀请功能开启 |
| 2.3 | feature_content_enabled = 1 | ☐ | 内容功能开启 |
| 2.4 | feature_feedback_enabled = 1 | ☐ | 反馈功能开启 |
| 2.5 | feature_shop_enabled = 0 | ☐ | 多商户关闭 |
| 2.6 | feature_realstore_enabled = 0 | ☐ | 门店关闭 |
| 2.7 | feature_distribution_enabled = 0 | ☐ | 分销关闭 |
| 2.8 | feature_wallet_enabled = 0 | ☐ | 钱包关闭 |
| 2.9 | feature_coin_enabled = 0 | ☐ | 虚拟币关闭 |
| 2.10 | feature_hospital_enabled = 0 | ☐ | 互联网医院关闭 |
| 2.11 | feature_live_enabled = 0 | ☐ | 直播关闭 |
| 2.12 | 所有高风险功能开关 = 0 | ☐ | 在后台合规中心确认 |

## 3. 小程序配置

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 3.1 | AppID 已配置 | ☐ | manifest.json 或环境变量 |
| 3.2 | request 合法域名已添加 | ☐ | 微信后台 → 开发管理 → 服务器域名 |
| 3.3 | uploadFile 合法域名已添加 | ☐ | 同上 |
| 3.4 | downloadFile 合法域名已添加 | ☐ | 同上 |
| 3.5 | 隐私协议已填写 | ☐ | 微信后台 → 设置 → 服务内容声明 |
| 3.6 | 用户信息/手机号权限已声明 | ☐ | privacy-api 接口声明 |
| 3.7 | 位置权限未滥用 | ☐ | 一期不强制定位，requiredPrivateInfos 为空，后续活动签到需定位时独立开启 |
| 3.8 | sitemap.json 已配置 | ☐ | 允许/禁止索引配置 |
| 3.9 | 小程序类目与实际功能匹配 | ☐ | 选择"工具→母婴"等正确类目 |

## 4. 合规检查

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 4.1 | 前端不出现"互联网医院"文案 | ☐ | 全局搜索确认 |
| 4.2 | 前端不出现"在线问诊"文案 | ☐ | 全局搜索确认 |
| 4.3 | 前端不出现"直播"入口 | ☐ | 直播插件已屏蔽 |
| 4.4 | 前端不出现"社区/问答"入口 | ☐ | ask/blog 插件已屏蔽 |
| 4.5 | 前端不出现"分销"入口 | ☐ | distribution 插件已屏蔽 |
| 4.6 | 前端不出现"钱包/余额"入口 | ☐ | wallet/coin 插件已屏蔽 |
| 4.7 | 前端不出现"商家入驻"入口 | ☐ | shop 插件已屏蔽 |
| 4.8 | 前端不出现"门店"入口 | ☐ | realstore 插件已屏蔽 |
| 4.9 | 商品内容无医疗化表述 | ☐ | 无"治疗/诊断/治愈"等词 |
| 4.10 | 后台合规中心显示正常 | ☐ | 资质/开关/拦截日志 |
| 4.11 | 尝试开启高风险功能被拦截 | ☐ | 返回 403 或资质不足提示 |

## 5. 核心功能验证

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 5.1 | 首页正常加载 | ☐ | 轮播/导航/推荐商品/推荐活动 |
| 5.2 | 商品分类页正常 | ☐ | 阶段筛选可用 |
| 5.3 | 商品搜索页正常 | ☐ | 阶段筛选可用 |
| 5.4 | 商品详情页正常 | ☐ | 母婴标签展示 |
| 5.5 | 活动列表页正常 | ☐ | 阶段筛选可用 |
| 5.6 | 活动详情页正常 | ☐ | 报名按钮可用 |
| 5.7 | 活动报名流程正常 | ☐ | 填写→提交→成功 |
| 5.8 | 登录流程正常 | ☐ | 微信授权/手机号 |
| 5.9 | 个人资料编辑正常 | ☐ | 阶段/预产期/宝宝生日 |
| 5.10 | 购物车正常 | ☐ | 自营商品购物车 |
| 5.11 | 下单流程正常 | ☐ | 地址→支付→待支付 |
| 5.12 | 订单列表正常 | ☐ | 查看/取消/售后 |
| 5.13 | 后端支付方式过滤 | ☐ | BuyPaymentList 不返回 WalletPay/ChargePayment/CoinPay/GiftCardPay/ScanPay |
| 5.14 | 抓包强传 wallet 支付被拒 | ☐ | OrderService::Pay 返回 -403 |
| 5.15 | 邀请有礼正常 | ☐ | 海报/邀请记录 |
| 5.16 | 意见反馈正常 | ☐ | 提交/查看 |
| 5.17 | 文章/孕育知识正常 | ☐ | 列表/详情 |
| 5.18 | 后台启用 WalletPay 被拒 | ☐ | PaymentSave/PaymentStatusUpdate 返回 -403 |
| 5.19 | 后台启用 CoinPay 被拒 | ☐ | PaymentStatusUpdate 返回 -403 |
| 5.20 | 后台启用 GiftCardPay 被拒 | ☐ | PaymentStatusUpdate 返回 -403 |
| 5.21 | 后台启用 ScanPay 被拒 | ☐ | PaymentStatusUpdate 返回 -403 |

## 6. 后台功能验证

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 6.1 | 管理员登录正常 | ☐ | 混淆入口文件名 |
| 6.2 | Dashboard 正常 | ☐ | 运营数据/阶段分布 |
| 6.3 | 活动创建正常 | ☐ | 标题/阶段/时间/名额 |
| 6.4 | 报名管理正常 | ☐ | 查看/签到/核销 |
| 6.5 | 商品管理正常 | ☐ | 母婴标签编辑 |
| 6.6 | 用户管理正常 | ☐ | 阶段筛选/详情 |
| 6.7 | 反馈管理正常 | ☐ | 查看/回复 |
| 6.8 | 邀请管理正常 | ☐ | 查看记录 |
| 6.9 | 合规中心正常 | ☐ | 资质/开关/日志 |
| 6.10 | 隐私数据管理菜单可见 | ☐ | 禧孕运营 → 隐私数据管理 |
| 6.11 | 用户数据搜索正常 | ☐ | 按ID/手机号/openid搜索 |
| 6.12 | 无权限管理员看不到匿名化按钮 | ☐ | 非超管/无muyingprivacy/delete权限 |
| 6.13 | 有权限管理员可执行匿名化 | ☐ | 二次确认后执行 |
| 6.14 | 匿名化后敏感字段清空 | ☐ | 昵称/阶段/预产期/宝宝生日/报名信息/反馈联系方式 |
| 6.15 | 匿名化后订单保留 | ☐ | 订单记录不删除 |
| 6.16 | 审计日志记录操作 | ☐ | 不含明文手机号 |
| 6.17 | 已取消报名也被匿名化 | ☐ | status=2 报名姓名/手机号替换 |
| 6.18 | 无订单时 mobile 清空 | ☐ | mobile_action=cleared |
| 6.19 | 有进行中订单时 mobile 保留 | ☐ | mobile_action=retained + 日志记录原因 |
| 6.20 | 已完成订单地址脱敏 | ☐ | order_address name/tel/address 清空 |
| 6.21 | 进行中订单地址不清空 | ☐ | 保障履约 |
| 6.22 | 用户收货地址清空 | ☐ | user_address name/tel/address/alias 清空 |
| 6.23 | 匿名化返回统计字段 | ☐ | signups_updated/feedbacks_updated/mobile_action 等 |

## 7. 数据删除请求处理流程

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 7.1 | 反馈表type字段已迁移 | ☐ | 执行 muying-feedback-type-migration.sql |
| 7.2 | 隐私数据管理权限已注册 | ☐ | 执行 muying-privacy-power-migration.sql |
| 7.3 | 小程序反馈页可选"数据删除/隐私请求" | ☐ | 反馈类型选择器包含该选项 |
| 7.4 | 小程序隐私政策含数据删除说明 | ☐ | 第五章"您的权利"第4条 |
| 7.5 | 小程序关于我们页含数据删除申请入口 | ☐ | "数据删除申请说明"链接 |
| 7.6 | 后台反馈列表可按类型筛选 | ☐ | 隐私请求类型筛选 |
| 7.7 | 后台反馈详情显示反馈类型 | ☐ | type_text 字段 |
| 7.8 | 处理时效15个工作日 | ☐ | 隐私政策中已声明 |

## 8. 内容合规扫描

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 8.1 | 敏感词表和合规日志表已迁移 | ☐ | 执行 muying-content-compliance-migration.sql |
| 8.2 | 内容合规菜单权限已注册 | ☐ | 执行 muying-content-sensitive-word-power-migration.sql |
| 8.3 | 商品标题含"治愈"时不能保存 | ☐ | 高风险词阻止 |
| 8.4 | 商品详情含"诊断"时提示并阻止 | ☐ | 高风险词阻止 |
| 8.5 | 文章内容含"在线问诊"时阻止 | ☐ | 高风险词阻止 |
| 8.6 | 低风险词确认后可保存 | ☐ | 弹出确认框 + force_save |
| 8.7 | 正常商品/文章/活动保存不受影响 | ☐ | 无敏感词时不拦截 |
| 8.8 | 命中记录写入合规日志 | ☐ | content_type/content_id/word/admin_id/action/ip |
| 8.9 | 后台可管理自定义敏感词 | ☐ | 添加/删除 |
| 8.10 | 后台可查看合规拦截日志 | ☐ | 日志列表 |
| 8.11 | 低风险词确认后可保存 | ☐ | 弹出确认框 + force_save=1 重提交 |
| 8.12 | 高风险词不可被 force_save 绕过 | ☐ | force_save=1 + 高风险词仍返回 -1 |
| 8.13 | 三类内容（商品/文章/活动）均通过 | ☐ | 低风险确认 + 高风险阻止 |

---

## 发布决策

> **三个状态必须严格区分：**
> 1. ✅ 代码审查通过 — 基于本地代码审查 + 静态分析
> 2. ✅ 服务器 UAT 通过 — 需在宝塔服务器真实部署后执行
> 3. ✅ 微信体验版通过 — 需域名备案 + 正式 AppID 后提审
>
> 只有三个状态全部 ✅ 后方可正式发布。

| 决策项 | 结论 |
|--------|------|
| 代码审查是否通过 | ☐ 是 ☐ 否 |
| 服务器 UAT 是否通过 | ☐ 是 ☐ 否 |
| 微信体验版是否通过 | ☐ 是 ☐ 否 |
| 是否可进入体验版测试 | ☐ 是 ☐ 否 |
| 是否可等备案完成后准备正式提审 | ☐ 是 ☐ 否 |
| 阻塞问题清单 | （列出未通过的检查项） |

## 9. 文档一致性检查

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 9.1 | 运行 check-doc-consistency.php 通过 | ☐ | 默认模式，0 BLOCKER |
| 9.2 | 运行 check-doc-consistency.php --strict 通过 | ☐ | strict 模式，0 BLOCKER |
| 9.3 | UAT 报告版本号必须等于发布 commit | ☐ | docs/uat-report-current.md 代码版本 = git HEAD |
| 9.4 | 服务器实测不得为待执行 | ☐ | UAT 报告中无 ⏳ 待执行项 |
| 9.5 | 三个状态（代码审查/服务器UAT/微信体验版）已区分 | ☐ | 不可混用 |

## 10. 发布冻结检查

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 10.1 | release-freeze-check.php 通过 | ☐ | php scripts/preflight/release-freeze-check.php |
| 10.2 | 已创建 release/* 分支 | ☐ | 从 main 创建 release/v1.0.0-rcN |
| 10.3 | 已打 tag | ☐ | v1.0.0-rcN 或 v1.0.0 |
| 10.4 | 提审包对应 tag | ☐ | 严禁从非 tag 构建 |
| 10.5 | release-notes-v1.0.0.md 已填写 | ☐ | 功能范围/开启功能/关闭功能/已知限制 |
| 10.6 | release-freeze-checklist.md 已签署 | ☐ | 开发/测试/产品签字 |
