# 预生产部署脚本自测说明（PREPROD_SCRIPT_SELFTEST）

用途：在没有真实 `.env.production` 和证书文件时，先做 dry-run 级别自检，确认脚本和目录结构无明显问题。

## 1. 脚本语法检查

```bash
bash -n deploy/scripts/deploy-prod-check.sh
```

预期：无输出且退出码为 0。

## 2. 基础文件路径检查

```bash
test -f package.json
test -f .env.production.example
test -f deploy/docker-compose.yml
```

预期：三条命令均返回成功。

## 3. 关键说明

1. `deploy-prod-check.sh` 需要真实 `.env.production` 与真实证书文件；缺失时失败是正确行为。
2. 未提供真实 AppID 与最终协议联系方式前，`pnpm release:check:prod` 失败是正确阻断。
3. 不得为了“演示通过”创建 fake secret、fake cert 或伪造资质编号。
