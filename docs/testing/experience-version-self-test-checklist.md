# 体验版代码自测清单

> [MUYING-二开] 体验版上线前，逐项勾选验证。部署人员与开发者共同执行。
> 最后更新：2026-05-01

---

## 一、前端自测（微信开发者工具 + 真机预览）

### 1.1 编译与配置
- [ ] HBuilderX 编译微信小程序无报错
- [ ] `manifest.json` → `mp-weixin.appid` 不为空
- [ ] `project.config.json` → `appid` 不为空
- [ ] `.env.production` → `UNI_APP_WX_APPID` 不为空
- [ ] 三处 AppID 一致（运行 `bash scripts/preflight/preflight-production-check.sh` 验证）
- [ ] 生产环境未使用测试号 `wxda7779770f53e901`

### 1.2 页面功能
- [ ] **首页**：正常加载，TabBar 切换正常
- [ ] **商品列表**：筛选、分页正常
- [ ] **商品详情**：图文、价格、参数正常展示
- [ ] **活动列表**：分类/阶段筛选正常，活动卡片信息正确
- [ ] **活动详情**：封面、时间、地址、内容、报名状态正确
- [ ] **登录**：微信授权正常，token 缓存到本地

### 1.3 活动报名（核心流程）
- [ ] 报名表单：姓名、手机号、阶段、预产期/宝宝生日/宝宝月龄正常输入
- [ ] **隐私协议勾选**：不勾选时按钮 disabled，提交按钮不可点击
- [ ] **画像同步勾选**：可选，默认不勾选
- [ ] 提交成功 toast"报名成功"
- [ ] 重复报名：返回"您已报名该活动"提示
- [ ] 报名截止/未开始/已满：返回对应提示
- [ ] 手机号格式错误：前端校验拦截

#### P1-2 修复验证
- [ ] **不同步画像**（不勾选"同步到个人资料"）：报名成功后，`current_stage` 本地不更新
- [ ] **同步画像**（勾选"同步到个人资料"）：报名成功后，`current_stage` 本地更新
- [ ] 进入个人资料页时，以**后端返回**为准（不以本地缓存为准）

### 1.4 其他功能
- [ ] **我的活动**：列表正常，状态、时间正确
- [ ] **邀请页**：邀请码展示正常，分享功能可用
- [ ] **反馈页**：提交反馈正常，内容审核提示正常
- [ ] **个人资料**：头像、昵称、孕育阶段正常展示
- [ ] **协议页面**：隐私协议、用户协议正常展示

### 1.5 Loading 验证
- [ ] 提交报名时按钮进入 loading 状态（显示"提交中..."）
- [ ] 请求完成后 loading 恢复 `false`
- [ ] **快速连点不重复提交**（loading=true 时按钮 disabled）

---

## 二、后端自测

### 2.1 环境配置
- [ ] `APP_DEBUG = false`（生产环境确认）
- [ ] `MUYING_PRIVACY_KEY` 已配置且长度 ≥ 16
- [ ] 数据库连接成功（可通过后台首页确认）
- [ ] SQL 迁移全部执行完成（参考 `docs/release/db-migration-order.md`）

### 2.2 后台功能
- [ ] 后台能登录
- [ ] 默认后台管理员密码已修改（非 `admin888`）
- [ ] 活动管理：新增/编辑/删除/上下架正常
- [ ] 报名管理：列表/详情/确认/取消/签到正常
- [ ] 反馈审核：通过/驳回功能正常
- [ ] 数据报表：访问量、报名统计正常

### 2.3 隐私加密验证
- [ ] `APP_DEBUG=false` + `MUYING_PRIVACY_KEY` 已配置时，报名正常
- [ ] `APP_DEBUG=false` + `MUYING_PRIVACY_KEY` 为空时，报名接口返回 -500 错误码
- [ ] 数据库 `sxo_activity_signup.name` 字段存储的是**加密后**的 base64（非明文）
- [ ] 数据库 `sxo_activity_signup.phone` 字段存储的是**加密后**的 base64（非明文）
- [ ] 数据库不会写入明文手机号/姓名

### 2.4 API 安全验证
- [ ] Personal API 不返回完整手机号（仅返回脱敏后 `user_name_view`）
- [ ] Personal API 不返回完整邮箱（仅返回脱敏后）
- [ ] 活动导出 API：无敏感数据权限的管理员只能导出脱敏数据
- [ ] 敏感数据查看需要 `muyingsensitive/view` 权限

### 2.5 功能开关验证
- [ ] 功能开关符合一期范围（参考 `docs/compliance/phase-one-scope.md`）
- [ ] 禁用的插件接口被拦截（如 wallet/coin/distribution）
- [ ] 被屏蔽的插件页面不可访问

### 2.6 原有脱敏展示验证
- [ ] 活动报名列表：手机号显示 `138****5678`
- [ ] 反馈列表：联系方式脱敏（如含联系方式）
- [ ] 后台用户管理：不完整展示用户敏感信息

---

## 三、部署环境自测

### 3.1 Nginx
- [ ] root 指向 `shopxo-backend/public`
- [ ] 宝塔"运行目录"设置为 `/public`
- [ ] ThinkPHP 伪静态生效（无 404 错误）
- [ ] HTTPS 可用（生产环境强制）
- [ ] `.env` 文件不可公网访问（返回 403）
- [ ] `runtime/` 目录不可公网访问（返回 403）
- [ ] `vendor/` 目录不可公网访问（返回 403）
- [ ] `config/` 目录不可公网访问（返回 403）
- [ ] `composer.json` / `composer.lock` 不可公网访问（返回 403）

### 3.2 数据库
- [ ] phpMyAdmin 不公网裸奔（若使用，限制 IP 白名单）
- [ ] MySQL 3306 端口不开放公网
- [ ] 数据库专用用户密码非弱密码（长度 ≥ 16，含大小写+数字+特殊字符）

### 3.3 PHP
- [ ] PHP 版本 8.1（非 8.2+）
- [ ] 禁用危险函数：`exec`, `shell_exec`, `system`, `passthru`, `popen`
- [ ] 不保留 `putenv`, `proc_open` 的禁用（ThinkPHP 队列/命令需要）
- [ ] `upload_max_filesize` ≥ 20M
- [ ] `post_max_size` ≥ 20M
- [ ] `public/install.php` 已删除

### 3.4 Composer
- [ ] `composer install --no-dev --optimize-autoloader` 已执行
- [ ] `composer.lock` 版本与生产一致

---

## 四、Preflight 脚本验证

```bash
# Shell 版
bash scripts/preflight/preflight-production-check.sh

# PHP 版（无需 Python3）
php scripts/preflight/preflight-production-check.php --env=shopxo-backend/.env
```

预期结果：**0 个 BLOCKER**
以下检查项必须 PASS：
- APP_DEBUG = false
- .env 未提交到 Git
- 生产 request_url HTTPS
- 高风险功能开关关闭
- AppID 不为空 + 三处一致 + 非测试号
- composer.lock 存在
- MUYING_PRIVACY_KEY 已配置
- `public/install.php` 不存在
- PHP/前端无调试残留

---

## 五、回归验证表

| 场景 | 验证点 | 结果 |
|------|--------|------|
| 正常报名 | 加密存储 | ☐ |
| 密钥缺失 | 报名被阻断（返回 -500） | ☐ |
| 未勾选同步 | current_stage 不更新 | ☐ |
| 勾选同步 | current_stage 更新 + 后端画像更新 | ☐ |
| 连点提交 | loading=true 阻止重复 | ☐ |
| 登录失效 | 自动跳转登录页 | ☐ |
| 功能开关关闭 | 接口/页面被拦截 | ☐ |
| 插件屏蔽 | 被屏蔽接口返回合规提示 | ☐ |
| Nginx 安全 | .env/.git/runtime/vendor/config 403 | ☐ |
