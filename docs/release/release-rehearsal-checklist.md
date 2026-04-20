# 孕禧小程序 — 发版彩排执行清单 (Release Rehearsal Checklist)

> **用途**：照着这份清单从头到尾走一遍，验证你是否真的准备好了上线。
> 不是"文档准备好了"，而是"我亲手跑通了全流程"。
> 彩排环境应尽量接近生产：真实后端服务器、真实数据库、体验版小程序。

---

## 彩排前准备

| # | 项目 | 状态 |
|---|------|------|
| 1 | 已确定彩排日期和参与人员 | ☐ |
| 2 | 已打印/打开本清单和 `release-rehearsal-log-template.md` | ☐ |
| 3 | 已确认彩排用的后端服务器地址 | ☐ |
| 4 | 已确认彩排用的数据库（可以是预发库，但结构要和生产一致） | ☐ |
| 5 | 已确认微信小程序体验版可用（扫码能打开） | ☐ |
| 6 | 已确认所有参与人能访问服务器（SSH/数据库/微信后台） | ☐ |

---

## R01 — 填写真实参数

### 前置条件
- 仓库已 clone 到本地
- 已拿到所有参数（AppID、AppSecret、域名、数据库连接、客服电话等）

### 执行动作

| # | 动作 | 参考文档 | 完成标志 |
|---|------|---------|---------|
| 1 | 复制 `docs/release/release-values-template.md` 为 `release-values-filled.md` | `docs/release/release-values-template.md` | 文件已创建 |
| 2 | 填写 §1 微信小程序配置（AppID、AppSecret） | `docs/release/release-values-checklist.md` 第一阶段 | 实际值已填 |
| 3 | 填写 §2 域名与部署路径 | 同上 | 实际值已填 |
| 4 | 填写 §3 数据库连接 | 同上 | 实际值已填 |
| 5 | 填写 §5 品牌信息（客服电话、站点名称） | 同上 | 实际值已填 |
| 6 | 填写 §6 协议 URL | 同上 | 实际值已填 |

### 成功标准
- `release-values-filled.md` 中所有"实际值"列已填写，无空项

### 失败时处理
- 缺少参数 → 找对应负责人获取，不填假值
- AppSecret 需管理员扫码 → 提前预约管理员

### 是否阻断彩排
**✅ 是** — 参数不填，后续步骤无法执行

---

## R02 — 替换占位符

### 前置条件
- R01 已完成
- 已确认每个占位符对应的真实值

### 执行动作

| # | 动作 | 涉及文件 | 完成标志 |
|---|------|---------|---------|
| 1 | 替换 `manifest.json` 中的 AppID（空字符串 → 真实 AppID） | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` | `grep '"appid"' manifest.json` 显示真实值 |
| 2 | 替换前端环境变量中的 `API_DOMAIN` | `shopxo-uniapp/.env.production` 或 HBuilderX 配置 | 构建产物中搜索域名确认 |
| 3 | 替换 SQL 中 `{{CONTACT_PHONE}}` | `docs/sql/yunxi-init-activity-demo.sql`（6 处） | `grep CONTACT_PHONE docs/sql/yunxi-init-activity-demo.sql` → 无命中 |
| 4 | 替换 SQL 中其他占位符（如有） | `docs/sql/yunxi-init-config.sql` | 同上 |
| 5 | 替换 Nginx 配置中 `localhost` → 实际域名 | `deploy/nginx.production.example.conf` | `nginx -t` 通过 |
| 6 | 确认后端 `.env` 中数据库配置已填入真实值 | `shopxo-backend/.env`（从 `.env.production.example` 复制） | `mysql -u USER -p -h HOST DB_NAME -e "SELECT 1"` 成功 |

### 成功标准
- 所有占位符已被真实值替换
- `grep -r '{{' shopxo-uniapp/ shopxo-backend/ docs/sql/ --include='*.php' --include='*.sql' --include='*.json' --include='*.env'` → 无命中（排除 .example 文件和 node_modules）

### 失败时处理
- 漏替换 → 逐一对照 `release-values-checklist.md` 参数替换验证总表
- 替换错误 → git checkout 恢复后重新替换

### 是否阻断彩排
**✅ 是** — 占位符残留 = 生产事故

---

## R03 — 跑 check-placeholders.sh

### 前置条件
- R02 已完成（占位符已替换）
- bash 环境可用

### 执行动作

```bash
# 标准检查（SQL 占位符不阻断）
bash scripts/preflight/check-placeholders.sh --no-color shopxo-backend/ shopxo-uniapp/

# 严格检查（SQL 占位符也阻断）
bash scripts/preflight/check-placeholders.sh --no-color --strict shopxo-backend/ shopxo-uniapp/
```

### 成功标准
- 退出码 = 0
- 输出中无 `[FAIL]` 项
- 输出中 `[WARN]` 项已确认可接受（如 docs 中的占位符）

### 失败时处理
- 有 `[FAIL]` → 检查输出中列出的文件，回到 R02 补替换
- 有 `[SQL]` → 检查 SQL 文件中是否还有 `{{xxx}}` 未替换
- 脚本本身报错 → 先跑 `bash scripts/preflight/tests/run-tests.sh` 确认脚本正常

### 是否阻断彩排
**✅ 是** — 占位符漏检 = 生产事故

---

## R04 — 跑 check-server.sh

### 前置条件
- 后端服务器已部署，PHP/Nginx/MySQL 已启动
- `shopxo-backend/.env` 已配置真实数据库连接

### 执行动作

```bash
# 在服务器上运行（或本地 SSH）
bash scripts/preflight/check-server.sh \
  --env shopxo-backend/.env \
  --no-color \
  shopxo-backend/
```

### 成功标准
- 退出码 = 0
- 所有检查项 `[PASS]` 或仅 `[WARN]`
- 数据库连接检查 `[PASS]`（说明 .env 解析正确、MySQL 可连）

### 失败时处理
- 数据库连接失败 → 检查 `.env` 中 `[DATABASE]` 段的 HOSTNAME/DATABASE/USERNAME/PASSWORD
- PHP 版本不满足 → 升级 PHP 或调整部署
- Nginx 配置错误 → `nginx -t` 检查
- `mysql CLI 不可用` → 安装 mysql-client：`apt install mysql-client`
- `.env 文件不存在` → 确认已从 `.env.production.example` 复制创建

### 是否阻断彩排
**✅ 是** — 服务器不健康 = 上线必崩

---

## R05 — 跑 release-gate.sh

### 前置条件
- R03 和 R04 已通过
- 所有门禁子脚本可用

### 执行动作

```bash
bash scripts/preflight/release-gate.sh \
  --env shopxo-backend/.env \
  --no-color \
  --repo . \
  --backend shopxo-backend/
```

### 成功标准
- 退出码 = 0
- 输出末尾显示"✅ 建议发布"或类似通过信息
- 无 `[FAIL]` / `阻断` 项

### 失败时处理
- 占位符扫描 FAIL → 回到 R03
- 服务器检查 FAIL → 回到 R04
- 数据库预检 FAIL → 检查 `.env` 数据库参数 + `check-db.sql` 执行结果
- `--env` 解析错误 → 先跑 `bash scripts/preflight/tests/run-tests.sh` 确认 lib-env.sh 正常

### 是否阻断彩排
**✅ 是** — 门禁不通过 = 不允许发布

---

## R06 — 执行最终 SQL（迁移）

### 前置条件
- 数据库已备份：`mysqldump -u USER -p DB_NAME > backup-pre-rehearsal.sql`
- 已确认备份文件大小 > 0

### 执行动作

按顺序执行迁移 SQL：

> **唯一入口**：`docs/muying-final-migration.sql`（A→B→C 段，按段内顺序执行）。
> 旧文件（muying-migration.sql、muying-mvp-migration.sql 等）已废弃，不要单独执行。

```bash
# 执行最终迁移（唯一入口）
mysql -u USER -p -h HOST DB_NAME < docs/muying-final-migration.sql
```

### 成功标准
- 每个 SQL 执行无报错
- `SHOW TABLES LIKE 'sxo_%'` 显示所有预期表
- 关键表存在：`sxo_user`, `sxo_activity`, `sxo_activity_signup`, `sxo_invite_reward`, `sxo_goods`

### 失败时处理
- 外键约束错误 → 确认执行顺序是否正确
- 表已存在 → 确认是否重复执行，检查数据完整性
- 字符集错误 → 确认数据库 charset = utf8mb4

### 是否阻断彩排
**✅ 是** — 数据库结构不对 = 功能全部异常

---

## R07 — 执行初始化 SQL（配置数据）

### 前置条件
- R06 已完成
- SQL 中 `{{CONTACT_PHONE}}` 已替换为真实值（R02）

### 执行动作

```bash
# 1. 配置初始化
mysql -u USER -p -h HOST DB_NAME < docs/sql/yunxi-init-config.sql

# 2. 活动演示数据
mysql -u USER -p -h HOST DB_NAME < docs/sql/yunxi-init-activity-demo.sql

# 3. 反馈演示数据
mysql -u USER -p -h HOST DB_NAME < docs/sql/yunxi-init-feedback-demo.sql
```

### 成功标准
- 每个 SQL 执行无报错
- `SELECT * FROM sxo_config WHERE only_tag='contact_phone'` 显示真实电话号码（非占位符）
- 活动表有演示数据

### 失败时处理
- 数据已存在（Duplicate entry）→ 确认是否重复插入，必要时先清空再导入
- `{{CONTACT_PHONE}}` 仍然出现在数据库中 → 回到 R02 检查 SQL 文件替换

### 是否阻断彩排
**✅ 是** — 配置数据缺失 = 功能异常

---

## R08 — 导入体验版

### 前置条件
- R01~R07 已完成
- 微信开发者工具已安装
- HBuilderX 已安装

### 执行动作

| # | 动作 | 完成标志 |
|---|------|---------|
| 1 | 确认 `manifest.json` 中 `mp-weixin.appid` 为真实 AppID | `grep '"appid"' shopxo-uniapp/manifest.json` 非空 |
| 2 | 确认 `UNI_APP_REQUEST_URL` 指向彩排后端 | 构建产物中搜索域名确认 |
| 3 | HBuilderX → 发行 → 小程序-微信 | 构建成功无报错 |
| 4 | 微信开发者工具打开构建产物 | 项目加载正常 |
| 5 | 点击"上传"，版本号填 `1.0.0-rc1` | 版本管理中出现开发版 |
| 6 | 微信后台 → 版本管理 → 设为体验版 | 体验版二维码可扫码 |
| 7 | 真机扫码打开体验版 | 小程序可正常打开 |

### 成功标准
- 真机扫码可打开体验版
- 首页内容正常加载（非白屏）
- 微信登录可用

### 失败时处理
- 构建报错 → 检查 HBuilderX 版本、依赖安装
- 上传失败 → 检查 AppID 是否正确、是否已关联微信开发者
- 白屏 → 检查 Network 面板，确认 API_DOMAIN 可达
- 登录失败 → 检查 AppID/AppSecret 配置

### 是否阻断彩排
**✅ 是** — 体验版不可用 = 无法 UAT

---

## R09 — 真机跑 UAT

### 前置条件
- R08 已完成（体验版可用）
- 至少一台安卓真机 + 一台 iPhone

### 执行动作

按 `docs/release/uat-final-checklist.md` 逐项执行，重点覆盖：

| 优先级 | 测试项 | 验证内容 |
|--------|-------|---------|
| P0 | L01 微信登录 | 新用户/老用户登录 |
| P0 | L02 手机号绑定 | 一键获取手机号 |
| P0 | L03 首页加载 | 已登录/未登录 |
| P0 | L06 活动详情 | 详情页加载、客服电话非占位符 |
| P0 | L07 活动报名 | 完整报名流程 + 重复报名拦截 |
| P0 | L09 邀请码 | 邀请码显示与复制 |
| P0 | L13 品牌检查 | 名称=孕禧、无 ShopXO 残留、Logo 正确 |

### 成功标准
- 所有 P0 项通过
- 无阻断上线的 Bug
- Bug 已记录到 `docs/release/uat-bug-log-template.md`

### 失败时处理
- P0 Bug → 修复后重新构建体验版，重新测试
- P1 Bug → 记录，评估是否阻断
- 环境问题 → 检查后端日志、数据库连接

### 是否阻断彩排
**✅ 是** — P0 功能不可用 = 不允许上线

---

## R10 — 提审前自查

### 前置条件
- R09 已完成（UAT P0 全通过）

### 执行动作

| # | 动作 | 参考文档 | 完成标志 |
|---|------|---------|---------|
| 1 | 确认微信后台服务器域名已配置 | `release-values-checklist.md` 第三阶段 | request/uploadFile/downloadFile 域名已填 |
| 2 | 确认隐私保护指引已提交 | 同上 | 每个接口用途已填写 |
| 3 | 确认服务类目已审核通过 | 同上 | 显示"审核通过" |
| 4 | 确认功能页面路径列表 | `docs/release/wechat-review-package.md` §3 | 路径与 pages.json 一致 |
| 5 | 确认版本描述文案 | `docs/release/version-note-template.md` | 无"测试""demo"字眼 |
| 6 | 确认测试账号信息 | `docs/release/wechat-review-package.md` §6 | "无需测试账号" |
| 7 | 最终跑一次 `release-gate.sh --strict` | 本清单 R05 | 退出码 0 |

### 成功标准
- 所有自查项 ✅
- `release-gate.sh --strict` 退出码 0

### 失败时处理
- 服务类目未通过 → 等待审核或调整类目
- 隐私指引未提交 → 立即提交
- 门禁不通过 → 回到对应步骤修复

### 是否阻断彩排
**✅ 是** — 提审材料不齐 = 无法提交审核

---

## R11 — 记录问题

### 执行动作

| # | 动作 | 记录到 |
|---|------|-------|
| 1 | 记录彩排中发现的所有问题 | `release-rehearsal-log-template.md` 遗留问题区 |
| 2 | 每个问题标注优先级（P0/P1/P2） | 同上 |
| 3 | 每个问题标注责任人 | 同上 |
| 4 | 每个问题标注是否阻断正式发布 | 同上 |

### 成功标准
- 所有问题已记录，无遗漏
- P0 问题有明确修复计划

### 是否阻断彩排
❌ 否 — 但阻断正式发布

---

## R12 — 二次复测

### 前置条件
- R11 中记录的 P0 问题已修复

### 执行动作

| # | 动作 | 完成标志 |
|---|------|---------|
| 1 | 重新构建体验版（含修复） | 新版本上传成功 |
| 2 | 重新跑 R03 check-placeholders.sh | 退出码 0 |
| 3 | 重新跑 R04 check-server.sh | 退出码 0 |
| 4 | 重新跑 R05 release-gate.sh | 退出码 0 |
| 5 | 只测 R11 中记录的 P0 问题对应功能 | 全部通过 |
| 6 | 抽测核心链路（登录→首页→活动报名→邀请码） | 全部通过 |

### 成功标准
- 门禁脚本全部通过
- P0 修复项验证通过
- 核心链路无回归

### 失败时处理
- 修复引入新问题 → 回退修复，重新评估
- 门禁不通过 → 回到对应步骤

### 是否阻断彩排
**✅ 是** — 复测不通过 = 不允许进入正式发布

---

## 彩排结论

| 项目 | 值 |
|------|-----|
| 彩排日期 | |
| 彩排是否完整走完 | ☐ 是 ☐ 否（停在第 R____步） |
| 门禁脚本全部通过 | ☐ 是 ☐ 否 |
| UAT P0 全部通过 | ☐ 是 ☐ 否 |
| 遗留 P0 问题数 | |
| 遗留 P1 问题数 | |
| **是否允许进入正式发布** | ☐ 是 ☐ 否 |

### 允许进入正式发布的条件

1. R01~R12 全部走完
2. 门禁脚本（R03/R04/R05）全部退出码 0
3. UAT P0 项全部通过
4. 无遗留 P0 问题
5. 彩排结论签字确认

### 签字

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 发布指挥 | | | |
| 后端运维 | | | |
| 前端开发 | | | |
| 测试 | | | |
| 产品 | | | |
