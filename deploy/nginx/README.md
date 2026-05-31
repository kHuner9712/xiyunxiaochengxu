## DNS 配置

部署前请确认以下 DNS 记录已配置：

| 域名 | 类型 | 值 | 说明 |
|------|------|------|------|
| api.yunxixiaochengxu.com.cn | A | 62.234.69.19 | API 服务 |
| admin.yunxixiaochengxu.com.cn | A | 62.234.69.19 | 管理后台 |

验证命令：
```bash
dig api.yunxixiaochengxu.com.cn
dig admin.yunxixiaochengxu.com.cn
```

或：
```bash
nslookup api.yunxixiaochengxu.com.cn
nslookup admin.yunxixiaochengxu.com.cn
```

## Nginx 配置模板（可选）

当前可直接使用 `conf.d/default.conf`。  
`nginx.conf` 与 `conf.d/default.conf` 中的 `client_max_body_size` 必须大于或等于 API 环境变量 `UPLOAD_MAX_SIZE`（默认 10485760 bytes / 10MB）。当前示例配置为 20m，`pnpm release:check:freeze` 与 `pnpm release:check:prod` 会做静态校验。

若希望按环境变量生成配置，请使用 `conf.d/default.conf.template`：

```bash
export API_DOMAIN=api.yourdomain.com
export ADMIN_DOMAIN=admin.yourdomain.com
export UPLOAD_PUBLIC_URL=https://api.yourdomain.com/uploads
envsubst '${API_DOMAIN} ${ADMIN_DOMAIN} ${UPLOAD_PUBLIC_URL}' \
  < deploy/nginx/conf.d/default.conf.template \
  > deploy/nginx/conf.d/default.conf
```

生成后请执行：

```bash
docker compose -f deploy/docker-compose.yml config
docker compose -f deploy/docker-compose.yml restart nginx
```
