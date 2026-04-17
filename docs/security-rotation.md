# 密钥轮换步骤

## 已移除的敏感项

以下密钥已从 `shopxo-uniapp/manifest.json` 中移除，替换为空字符串：

| 配置项 | 原值 | 风险等级 |
|--------|------|----------|
| 微信OAuth appsecret | 已从代码和git历史中清除 | P0-必须轮换 |
| 微信 appid (App支付/分享/OAuth) | `wx3bac19ff90c0a976` | P1-建议轮换 |
| QQ appid | `102076195` | P1-建议轮换 |
| Google OAuth clientid | `510187709509-fq3t5grcfh81t4ub491tiadrtfjbaes1...` | P2-低风险 |
| 高德地图 appkey_ios | `f55e9099897821681f5c74051e4527bd` | P1-建议轮换 |
| 高德地图 appkey_android | `ebe9f1d84f8ceb8b3c4ba6ead2bfa78b` | P1-建议轮换 |
| 腾讯地图 key | `56SBZ-PCC3G-US2QM-IXYFE-4DE5H-GRBDK` | P1-建议轮换 |
| 微信小程序 appid | `wxda7779770f53e901` | P1-建议轮换 |
| 支付宝 appid | `2021001173639600` | P2-低风险 |
| 头条 appid | `ttfb628ddf6458b04f` | P2-低风险 |
| QQ小程序 appid | `1110736292` | P2-低风险 |
| 快手 appid | `ks669910446353970565` | P2-低风险 |

## 必须立即轮换的密钥

### 1. 微信OAuth appsecret（最高优先级）

1. 登录 [微信开放平台](https://open.weixin.qq.com/)
2. 管理中心 → 应用详情 → 开发信息
3. 点击「重置AppSecret」
4. 记录新密钥，写入本地 `manifest.local.json`
5. 同步更新后端微信登录相关配置

### 2. 高德地图 Key

1. 登录 [高德开放平台](https://console.amap.com/)
2. 应用管理 → 删除旧Key → 创建新Key
3. 新Key写入 `manifest.local.json`

### 3. 腾讯地图 Key

1. 登录 [腾讯位置服务](https://lbs.qq.com/)
2. Key管理 → 删除旧Key → 创建新Key
3. 新Key写入 `manifest.local.json`

## 配置承载方式

- `manifest.json`：仓库中只保留空字符串占位，不含任何真实密钥
- `manifest.local.json`：本地开发用，包含真实密钥，已加入 `.gitignore`
- `manifest.local.json.example`：模板文件，说明各字段含义
- CI/CD：构建时通过环境变量或密钥管理服务注入

## 本地开发配置步骤

```bash
cd shopxo-uniapp
cp manifest.local.json.example manifest.local.json
# 编辑 manifest.local.json，填入真实值
```

构建脚本需在编译前将 `manifest.local.json` 中的值合并到 `manifest.json`，或使用 uni-app 的条件编译机制读取。

## 构建注入机制

项目提供了 `shopxo-uniapp/scripts/manifest-merge.js` 脚本，在构建前自动合并本地配置：

```bash
# 1. 创建本地配置
cd shopxo-uniapp
cp manifest.local.json.example manifest.local.json
# 编辑 manifest.local.json，填入真实值

# 2. 构建前合并
node scripts/manifest-merge.js
# 输出: [manifest-merge] 合并完成（原文件已备份为 manifest.json.bak）

# 3. 执行 HBuilderX 构建

# 4. 构建后恢复（避免提交密钥）
node scripts/manifest-restore.js
# 输出: [manifest-restore] manifest.json 已从备份恢复
```

CI/CD 流水线示例：
```yaml
- run: cp manifest.local.json.example manifest.local.json
- run: sed -i 's/在此填入微信OAuth appid/$WX_APPID/' manifest.local.json
- run: node scripts/manifest-merge.js
- run: # 执行构建命令
- run: node scripts/manifest-restore.js
```

## Git 历史清理

已使用 `git filter-repo` 将微信 OAuth appsecret 从 git 历史中替换为 `REDACTED_APPSECRET`，并 force push 到远程仓库。

**注意**：任何之前 clone 过该仓库的开发者，需要重新 clone 仓库，旧本地仓库中的历史仍包含明文密钥。

## 注意事项

- 微信小程序 appid 在微信开发者工具中配置，不在代码仓库中
- 后端数据库中的支付/短信等密钥也需要独立轮换，不在本文档范围
- 每次轮换后，需确认所有环境（开发/测试/生产）都已更新
