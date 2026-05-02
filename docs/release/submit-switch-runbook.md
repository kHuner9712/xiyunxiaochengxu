# 提审切换 Runbook

> 适用阶段：从体验版切换到提审版  
> 执行人：开发+运营  
> 输入物：正式 AppID、备案域名、SSL 证书  
> 输出物：可提交微信审核的正式版  
> 前提：体验版已验收通过，正式 AppID + 备案域名已就绪  
> 最后更新：2026-04-25

---

> ⚠ 本文档只包含从体验版切到提审版的动作，不包含体验版部署步骤

---

> **当前环境状态**（2026-04-25）
> - 域名备案：管局审核中，预计 7-20 天
> - 正式 AppID：尚未申请
> - 当前使用：微信小程序测试号
> - 服务器：宝塔面板 + Nginx 1.28.1 + MySQL 5.7.44 + PHP 8.1.32
>
> **前置条件**：
> 1. 正式 AppID 已申请 → [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册
> 2. 域名备案已通过 → 管局审核通过后生效
> 3. SSL 证书已部署 → 宝塔可一键申请 Let's Encrypt
> 4. 以上 3 项全部就绪后才能执行本文档

---

## 第 1 步：替换正式 AppID（2 分钟）

```bash
# 编辑 shopxo-uniapp/manifest.json
# mp-weixin.appid: "" → "你的正式AppID"

# 编辑 shopxo-uniapp/project.config.json
# appid: "" → "你的正式AppID"
```

验证：两个文件的 AppID 必须一致。

---

## 第 2 步：替换正式 HTTPS 域名（2 分钟）

```bash
# 编辑 shopxo-uniapp/.env.production
UNI_APP_REQUEST_URL=https://你的备案域名/
UNI_APP_STATIC_URL=https://你的备案域名/
UNI_APP_WX_APPID=你的正式AppID
```

验证：域名必须以 `https://` 开头，不能是 IP 地址。

---

## 第 3 步：后端安全加固（3 分钟）

```bash
# 3.1 APP_DEBUG 改为 false
# 编辑 /www/wwwroot/xiyun-api/.env
# APP_DEBUG = false

# 3.2 删除 install.php
rm -f /www/wwwroot/xiyun-api/public/install.php

# 3.3 重命名后台入口
mv /www/wwwroot/xiyun-api/public/admin.php /www/wwwroot/xiyun-api/public/你的随机名.php

# 3.4 清除缓存
rm -rf /www/wwwroot/xiyun-api/runtime/cache/*
rm -rf /www/wwwroot/xiyun-api/runtime/temp/*
```

---

## 第 4 步：配置 SSL 证书（5 分钟）

```bash
# 宝塔面板 → 网站 → 设置 → SSL
# 选择 Let's Encrypt 免费证书 或 上传自有证书
# 开启强制 HTTPS
```

---

## 第 5 步：微信公众平台后台配置（10 分钟）

### 5.1 服务器域名
- 登录 mp.weixin.qq.com
- 开发管理 → 开发设置 → 服务器域名
- request 合法域名：`https://你的备案域名`
- uploadFile 合法域名：`https://你的备案域名`
- downloadFile 合法域名：`https://你的备案域名`

### 5.2 隐私保护指引
- 设置 → 服务内容声明 → 用户隐私保护指引
- 添加"位置信息"：用途="活动签到、收货地址选择"
- 添加"相册/摄像头"：用途="更换头像、上传反馈图片"
- 添加"手机号"：用途="登录和身份验证"

### 5.3 基本信息
- 设置 → 基本设置 → 服务类目：选择"母婴用品"
- 设置 → 基本设置 → 小程序名称/简介/图标

---

## 第 6 步：重新编译上传（5 分钟）

```bash
# HBuilderX → 发行 → 小程序-微信
# 微信开发者工具打开
# 确认编译无报错
# 点击"上传"，填写版本号和备注
```

---

## 第 7 步：运行提审就绪检查（2 分钟）

```bash
bash scripts/preflight/check-wechat-submit-readiness.sh .

bash scripts/preflight/run-rc-gate.sh --mode=submit --env /www/wwwroot/xiyun-api/.env .
```

确认：**0 BLOCKER**（WARN 项需人工确认）

---

## 第 8 步：提交审核

- 微信公众平台 → 版本管理 → 开发版本 → 提交审核
- 填写版本描述（参照 `docs/release/version-note-template.md`）
- 填写测试账号和演示路径（参照 `docs/release/submission-materials-checklist.md`）

---

## 回退到体验版

如果提审被拒需要回退：

```bash
# 1. 恢复 .env
# APP_DEBUG = true

# 2. 恢复 install.php（如需要）
# git checkout public/install.php

# 3. 恢复后台入口名
# mv public/你的随机名.php public/admin.php

# 4. 恢复前端配置
# manifest.json → 改回体验版配置（如测试号 wxda7779770f53e901 或留空）
# .env.production → IP 地址

# 5. 重新编译上传
```

---

## 提审切换 Checklist

- [ ] manifest.json AppID 已替换为正式号
- [ ] project.config.json AppID 已替换为正式号
- [ ] .env.production 域名已替换为 HTTPS
- [ ] 后端 .env APP_DEBUG = false
- [ ] install.php 已删除
- [ ] 后台入口已重命名
- [ ] SSL 证书已配置
- [ ] 微信后台服务器域名已配置
- [ ] 微信后台隐私保护指引已填写
- [ ] 微信后台服务类目已选择
- [ ] check-wechat-submit-readiness.sh 无 BLOCKER
- [ ] run-rc-gate.sh --mode=submit 无 BLOCKER
- [ ] 已提交审核
