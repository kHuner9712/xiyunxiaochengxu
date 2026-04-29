# 人工验收任务板

> 代码整改已进入 RC 阶段，后续重点是人工验收和平台配置。
> 按阶段顺序执行，每个阶段全部完成后进入下一阶段。

---

## 阶段 A：GitHub 合并前

| # | 任务 | 负责人 | 状态 | 截图/证据位置 | 完成日期 |
|---|------|--------|------|--------------|----------|
| A1 | Draft PR 已创建（#1 review-remediation-phase1 → main） | | ☐ 待完成 | PR 链接：https://github.com/kHuner9712/xiyun/pull/1 | |
| A2 | 自检脚本 0 blocker：`node scripts/check-phase1-release.js` | | ☐ 待完成 | 终端输出截图 | |
| A3 | PHP 语法检查通过：`bash scripts/check-php-syntax.sh` | | ☐ 待完成 | 终端输出截图（17/17 PASS） | |
| A4 | HBuilderX 构建 mp-weixin 通过 | | ☐ 待完成 | HBuilderX 控制台截图（无报错） | |
| A5 | PR review 通过 | | ☐ 待完成 | PR 页面截图（Approved） | |

**阶段 A 通过标准**：A1-A5 全部 ☑️

---

## 阶段 B：测试服务器部署

| # | 任务 | 负责人 | 状态 | 截图/证据位置 | 完成日期 |
|---|------|--------|------|--------------|----------|
| B1 | 宝塔站点创建（PHP 8.1+、MySQL 5.7+） | | ☐ 待完成 | 宝塔面板站点列表截图 | |
| B2 | 代码部署：git pull origin main | | ☐ 待完成 | 终端输出截图 | |
| B3 | .env 配置：APP_DEBUG=false、MUYING_PRIVACY_KEY、feature flags | | ☐ 待完成 | .env 文件截图（脱敏） | |
| B4 | SQL 迁移：按 docs/sql/README-migration-order.md 顺序执行 | | ☐ 待完成 | 每个迁移执行结果截图 | |
| B5 | 表前缀确认（默认 sxo_，不同则替换） | | ☐ 待完成 | `SHOW TABLES LIKE '%_config'` 结果截图 | |
| B6 | Nginx 配置：运行目录 /public、安全规则 | | ☐ 待完成 | Nginx 配置文件截图 | |
| B7 | HTTPS 证书部署 | | ☐ 待完成 | `curl -I https://<DOMAIN>` 结果截图 | |
| B8 | 缓存清理：`php think clear` | | ☐ 待完成 | 终端输出截图 | |
| B9 | install.php 不存在确认 | | ☐ 待完成 | `ls` 输出截图 | |
| B10 | 后台登录验证 | | ☐ 待完成 | 后台首页截图 | |
| B11 | API 健康检查：`/api/common/init` | | ☐ 待完成 | JSON 响应截图 | |
| B12 | feature_payment_enabled=0 验证（收银台被拦截） | | ☐ 待完成 | 访问收银台截图（跳转错误页） | |
| B13 | feature_dynamic_page_enabled=0 验证（DIY 直达被拦截） | | ☐ 待完成 | 访问 DIY 页面截图（跳转错误页） | |

**阶段 B 通过标准**：B1-B13 全部 ☑️

---

## 阶段 C：微信开发者工具联调

| # | 任务 | 负责人 | 状态 | 截图/证据位置 | 完成日期 |
|---|------|--------|------|--------------|----------|
| C1 | 微信后台配置 request 合法域名 | | ☐ 待完成 | 微信后台域名配置截图 | |
| C2 | 微信后台配置 uploadFile 合法域名 | | ☐ 待完成 | 微信后台域名配置截图 | |
| C3 | 微信后台配置 downloadFile 合法域名 | | ☐ 待完成 | 微信后台域名配置截图 | |
| C4 | 测试号编译：微信开发者工具导入 mp-weixin 产物 | | ☐ 待完成 | 编译成功截图 | |
| C5 | 开启合法域名校验（取消"不校验"勾选） | | ☐ 待完成 | 详情页设置截图 | |
| C6 | 真机预览：首页 DIY 正常渲染 | | ☐ 待完成 | 真机截图 | |
| C7 | 真机预览：商品详情正常 | | ☐ 待完成 | 真机截图 | |
| C8 | 真机预览：购物车正常 | | ☐ 待完成 | 真机截图 | |
| C9 | 真机预览：下单页提示"线上支付暂未开放" | | ☐ 待完成 | 真机截图 | |
| C10 | 真机预览：活动列表/详情/报名正常 | | ☐ 待完成 | 真机截图 | |
| C11 | 真机预览：个人资料/母婴画像正常 | | ☐ 待完成 | 真机截图 | |
| C12 | 真机预览：收银台/支付结果页被拦截 | | ☐ 待完成 | 真机截图 | |
| C13 | 真机预览：DIY/表单直达被拦截 | | ☐ 待完成 | 真机截图 | |

**阶段 C 通过标准**：C1-C13 全部 ☑️

---

## 阶段 D：正式提审前

| # | 任务 | 负责人 | 状态 | 截图/证据位置 | 完成日期 |
|---|------|--------|------|--------------|----------|
| D1 | 正式 AppID 已申请 | | ☐ 待完成 | 微信后台 AppID 截图 | |
| D2 | 小程序认证已完成（企业主体） | | ☐ 待完成 | 认证状态截图 | |
| D3 | 域名 ICP 备案已完成 | | ☐ 待完成 | 备案信息截图 | |
| D4 | 小程序备案已完成 | | ☐ 待完成 | 小程序后台备案状态截图 | |
| D5 | 隐私保护指引已填写（微信后台） | | ☐ 待完成 | 隐私指引页面截图 | |
| D6 | 用户协议页面已部署 | | ☐ 待完成 | 小程序内协议页面截图 | |
| D7 | 隐私政策页面已部署 | | ☐ 待完成 | 小程序内隐私政策截图 | |
| D8 | 服务类目已选择（母婴/电商） | | ☐ 待完成 | 类目配置截图 | |
| D9 | 医疗资质已上传（如涉及母婴健康类目） | | ☐ 待完成 | 资质上传截图 | |
| D10 | 审核备注已准备（说明一期关闭功能列表） | | ☐ 待完成 | 备注文本 | |
| D11 | 测试账号已准备（供审核员使用） | | ☐ 待完成 | 账号信息（脱敏） | |
| D12 | HBuilderX 使用正式 AppID 重新构建 | | ☐ 待完成 | 构建成功截图 | |
| D13 | 正式 AppID 真机预览无报错 | | ☐ 待完成 | 真机截图 | |
| D14 | 提交审核 | | ☐ 待完成 | 提交成功截图 | |

**阶段 D 通过标准**：D1-D14 全部 ☑️

---

## 阶段依赖关系

```
阶段 A（GitHub 合并前）
  │
  ▼ 全部通过后合并 PR
阶段 B（测试服务器部署）
  │
  ▼ 全部通过后
阶段 C（微信开发者工具联调）
  │
  ▼ 全部通过后
阶段 D（正式提审前）
  │
  ▼ 全部通过后提交审核
```

**不可跳阶段、不可并行**。每个阶段的通过标准必须全部满足后才进入下一阶段。

---

## 参考文档

| 文档 | 用途 |
|------|------|
| [docs/release-candidate-check.md](release-candidate-check.md) | RC 检查报告 |
| [docs/build-verification.md](build-verification.md) | 构建验收指南 |
| [docs/pr-risk-review.md](pr-risk-review.md) | 合规门禁风险审查 |
| [docs/staging-deployment-plan.md](staging-deployment-plan.md) | 测试服务器部署计划 |
| [docs/sql/README-migration-order.md](sql/README-migration-order.md) | SQL 迁移执行顺序 |
| [docs/post-merge-main-checklist.md](post-merge-main-checklist.md) | 合并后校验清单 |
| [docs/wechat-submit-human-tasks.md](wechat-submit-human-tasks.md) | 微信提审人工任务 |
| [docs/uat-server-checklist.md](uat-server-checklist.md) | 服务器验收清单 |
