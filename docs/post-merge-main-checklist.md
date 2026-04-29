# Post-Merge Main 校验清单

> 本清单在 PR `review-remediation-phase1 → main` 合并后执行。
> 目标：确认 main 分支合并后代码完整、构建通过、核心链路可用、高风险功能被正确拦截。

---

## 1. 代码同步

### 1.1 切换到 main 并拉取

```bash
git checkout main
git pull origin main
```

### 1.2 确认 main 包含 review-remediation-phase1 的关键文件

```bash
# 后端关键文件
ls -la shopxo-backend/app/service/MuyingComplianceService.php
ls -la shopxo-backend/app/service/MuyingContentComplianceService.php
ls -la shopxo-backend/app/service/ActivityService.php
ls -la shopxo-backend/app/api/controller/Common.php
ls -la shopxo-backend/app/api/controller/Buy.php

# 前端关键文件
ls -la shopxo-uniapp/common/js/config/phase-one-scope.js
ls -la shopxo-uniapp/common/js/config/compliance-scope.js
ls -la shopxo-uniapp/common/js/config/runtime-config.js
ls -la shopxo-uniapp/common/js/config/muying-constants.js

# 脚本
ls -la scripts/check-phase1-release.js
ls -la scripts/check-php-syntax.sh

# 确认 install.php 已删除
ls shopxo-backend/public/install.php
# 预期：No such file or directory
```

| 检查项 | 通过标准 |
|--------|----------|
| 关键文件存在 | 全部 `ls` 输出文件路径 |
| install.php 已删除 | `No such file or directory` |

---

## 2. 自检脚本

### 2.1 前端合规自检

```bash
node scripts/check-phase1-release.js
```

| 检查项 | 通过标准 |
|--------|----------|
| BLOCKER 数量 | **0** |
| PASS 数量 | ≥ 19 |
| WARN 数量 | ≤ 3（均为已知低风险） |

### 2.2 后端 PHP 语法检查

```bash
bash scripts/check-php-syntax.sh
```

| 检查项 | 通过标准 |
|--------|----------|
| PHP CLI 可用 | 命令不报 `command not found` |
| 语法检查结果 | **17/17 PASS**，0 FAIL |
| 退出码 | **0** |

---

## 3. 前端构建

### 3.1 配置环境变量

```bash
cd shopxo-uniapp
cp .env.production.example .env.production
# 编辑 .env.production，填入测试号 AppID 和测试 API 地址
```

### 3.2 HBuilderX 构建

- HBuilderX → 发行 → 小程序-微信
- 等待编译完成

| 检查项 | 通过标准 |
|--------|----------|
| 编译结果 | **无报错** |
| 产物目录 | `unpackage/dist/build/mp-weixin/` 存在 |
| app.json | 产物目录中包含 `app.json` |

### 3.3 AppID 注入检查

```bash
grep '"appid"' shopxo-uniapp/unpackage/dist/build/mp-weixin/project.config.json
grep '"appid"' shopxo-uniapp/unpackage/dist/build/mp-weixin/manifest.json
```

| 检查项 | 通过标准 |
|--------|----------|
| project.config.json appid | 非空、非测试号 |
| manifest.json appid | 非空、非测试号 |

---

## 4. 微信开发者工具验证

### 4.1 导入项目

- 微信开发者工具 → 导入项目
- 目录：`shopxo-uniapp/unpackage/dist/build/mp-weixin/`
- AppID：使用测试号

### 4.2 编译预览

- 取消「不校验合法域名」（开启域名校验）
- 等待编译完成

| 检查项 | 通过标准 |
|--------|----------|
| 编译结果 | **无报错** |
| 控制台 | 无红色错误 |
| 首页渲染 | DIY 组件正常显示 |

### 4.3 核心链路真机验证

| # | 验证项 | 操作 | 通过标准 |
|---|--------|------|----------|
| 1 | 首页 | 打开小程序 | DIY 组件渲染，无白屏 |
| 2 | 商品分类 | 点击分类 Tab | 分类列表正常 |
| 3 | 商品详情 | 点击任意商品 | 详情页正常展示 |
| 4 | 购物车 | 添加商品到购物车 | 购物车正常展示 |
| 5 | 下单页 | 点击结算 | 页面展示，提示"线上支付暂未开放" |
| 6 | 活动列表 | 进入活动页 | 活动列表正常 |
| 7 | 活动详情 | 点击活动 | 详情页正常 |
| 8 | 活动报名 | 点击报名 | 报名流程正常 |
| 9 | 个人资料 | 进入个人资料页 | 母婴画像字段正常 |
| 10 | 订单列表 | 查看历史订单 | 订单正常展示 |

### 4.4 高风险功能拦截验证

| # | 验证项 | 操作 | 通过标准 |
|---|--------|------|----------|
| 1 | 收银台拦截 | 尝试访问 cashier 页面 | 跳转错误页 / toast 提示 |
| 2 | 支付结果页拦截 | 尝试访问 paytips 页面 | 跳转错误页 / toast 提示 |
| 3 | DIY 页面拦截 | 尝试直达 /pages/diy/diy | 跳转错误页 / toast 提示 |
| 4 | 表单输入页拦截 | 尝试直达 /pages/form-input/form-input | 跳转错误页 / toast 提示 |
| 5 | 门店拦截 | 尝试访问门店相关页面 | 跳转错误页 / toast 提示 |
| 6 | 支付提交拦截 | 下单页金额>0时提交 | toast "线上支付暂未开放" |

---

## 5. 正式提审前提条件

> ⚠️ **不使用正式提审，直到以下条件全部满足：**

| # | 前提条件 | 状态 |
|---|----------|------|
| 1 | 正式 AppID 已申请并配置 | ☐ 待完成 |
| 2 | ICP 备案已完成 | ☐ 待完成 |
| 3 | EDI 许可证已获取（如需） | ☐ 待完成 |
| 4 | 服务器域名已在微信后台配置（request 合法域名） | ☐ 待完成 |
| 5 | HTTPS 证书已部署 | ☐ 待完成 |
| 6 | 医疗资质已获取（如涉及） | ☐ 待完成 |
| 7 | 隐私政策已更新并通过审核 | ☐ 待完成 |
| 8 | 用户协议已更新并通过审核 | ☐ 待完成 |
| 9 | HBuilderX 构建使用正式 AppID 成功 | ☐ 待完成 |
| 10 | 真机预览无报错 | ☐ 待完成 |

---

## 6. 通过标准总览

| 类别 | 通过标准 |
|------|----------|
| 自检脚本 BLOCKER | **0** |
| PHP 语法检查 | **17/17 PASS**，退出码 0 |
| HBuilderX 构建 | **编译成功，无报错** |
| 微信开发者工具编译 | **编译成功，无报错** |
| 核心链路真机 | **10/10 可跑通** |
| 高风险功能拦截 | **6/6 被正确拦截** |
| 正式提审前提 | **全部 ☑️ 后方可提审** |

**只有以上全部通过，才可进入正式提审流程。**

---

## 7. 如果校验失败

| 失败场景 | 处理方式 |
|----------|----------|
| 自检脚本有 BLOCKER | 在 main 分支直接修复，commit + push，重新执行本清单 |
| PHP 语法检查有 FAIL | 修复语法错误，commit + push，重新执行本清单 |
| HBuilderX 构建失败 | 检查控制台报错，修复代码，重新构建 |
| 微信开发者工具编译失败 | 检查控制台报错，修复代码，重新构建 |
| 核心链路跑不通 | 定位问题，修复代码，重新构建+验证 |
| 高风险功能未被拦截 | 检查 feature flag 配置和门控代码，修复后重新验证 |
| 合并冲突导致文件缺失 | `git log --oneline` 确认合并 commit，检查冲突解决是否遗漏文件 |
