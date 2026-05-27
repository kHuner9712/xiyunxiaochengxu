# 禧孕优选 预生产执行清单（PREPROD_EXECUTION_STEPS）

默认约定：以下命令**默认在仓库根目录执行**（即包含 `package.json` 的目录）。

## 1. 服务器准备

1. 操作系统：Ubuntu（建议 22.04 LTS）。
2. 安装 Docker 与 Docker Compose。
3. 安装 Git。
4. 安全组/防火墙开放 80 与 443 端口。

## 2. 拉取代码

```bash
# 首次部署
git clone https://github.com/kHuner9712/xiyunxiaochengxu.git
cd xiyunxiaochengxu
test -f package.json || { echo "未找到 package.json，请确认仓库目录"; exit 1; }

# 已部署机器更新
git pull --ff-only
```

## 3. 创建私有环境文件

```bash
cp .env.production.example .env.production
```

1. 在 `.env.production` 中填写真实值（仅服务器本地保留）。
2. 不得保留默认占位值。
3. `.env.production` 严禁提交到 Git。

## 4. 放置证书

按以下路径放置真实证书文件：

1. `deploy/certs/apiclient_key.pem`
2. `deploy/certs/wechatpay_platform.pem`
3. `deploy/nginx/ssl/fullchain.pem`
4. `deploy/nginx/ssl/privkey.pem`

路径说明：
1. 上述为宿主机路径（运维上传位置）。
2. API 容器内读取路径固定为：
- `/app/apps/api/certs/apiclient_key.pem`
- `/app/apps/api/certs/wechatpay_platform.pem`
3. `.env.production` 中 `WECHAT_PRIVATE_KEY_PATH` / `WECHAT_PLATFORM_CERT_PATH` 必须填写容器内路径，不要写宿主机路径。

## 5. DNS 检查

1. `api.yunxixiaochengxu.com.cn -> 62.234.69.19`
2. `admin.yunxixiaochengxu.com.cn -> 62.234.69.19`

建议在服务器执行：

```bash
nslookup api.yunxixiaochengxu.com.cn
nslookup admin.yunxixiaochengxu.com.cn
```

## 6. 执行部署前检查

```bash
ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh
```

若失败，先修复变量/证书/域名问题，不要强行上线。

## 7. 启动与健康检查

```bash
(cd deploy && docker compose --env-file ../.env.production up -d --build)
(cd deploy && docker compose --env-file ../.env.production ps)
```

健康检查最少覆盖：

1. API：`https://api.yunxixiaochengxu.com.cn/api/health`
2. Admin：首页可访问 `https://admin.yunxixiaochengxu.com.cn`
3. Uploads：`https://api.yunxixiaochengxu.com.cn/uploads/` 可返回静态资源响应

## 8. 小程序体验版构建

在本地（或 CI）使用真实 AppID 构建：

```bash
VITE_WX_APPID=真实AppID pnpm build:mini:prod
```

随后使用微信开发者工具导入并上传体验版目录：

1. `dist/build/mp-weixin`

## 9. 真机验收清单

1. 登录
2. 商品详情
3. 购物车
4. 下单
5. 支付成功
6. 支付取消
7. 后台发货
8. 售后申请
9. 退款
10. 自提核销
11. 食品/保健食品/奶粉合规展示

## 10. 回滚策略

1. 回滚代码：`git checkout <上一稳定tag>`
2. 重启容器：`(cd deploy && docker compose --env-file ../.env.production down && docker compose --env-file ../.env.production up -d --build)`
3. 数据库先备份，**不要随意回滚 migration**，需按变更评审制定数据回退方案。
