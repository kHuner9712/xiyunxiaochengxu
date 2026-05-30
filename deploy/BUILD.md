# 生产镜像构建说明

## 核心原则：Frozen Lockfile

生产/冻结镜像构建**必须**使用 frozen lockfile 模式：

```bash
pnpm install --frozen-lockfile
```

### 为什么必须使用 --frozen-lockfile

- **构建可复现性**：`--frozen-lockfile` 确保 `pnpm-lock.yaml` 中锁定的依赖版本被严格遵循，不会在安装时自动升级或解析新版本。
- **避免依赖版本漂移**：如果不加此标志，pnpm 可能会在 lockfile 与 `package.json` 不一致时静默更新依赖，导致不同时间构建出的镜像包含不同版本的依赖，从而引发线上问题。
- **尽早发现问题**：当 lockfile 与 `package.json` 不同步时，`--frozen-lockfile` 会直接报错终止构建，而非隐式更新，强制开发者先在本地执行 `pnpm install` 更新 lockfile 并提交到版本控制。

## pnpm 版本管理

pnpm 版本通过 `package.json` 中的 `packageManager` 字段固定：

```json
{
  "packageManager": "pnpm@11.2.2"
}
```

Docker 构建中通过 **corepack** 激活对应版本：

```dockerfile
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
```

> **注意**：应使用 corepack 而非 `npm install -g pnpm`，以确保 pnpm 版本与 `packageManager` 字段一致，避免版本不匹配导致的兼容性问题。

## NPM_REGISTRY 构建参数

Dockerfile 中定义了 `NPM_REGISTRY` 构建参数，默认值为 `https://registry.npmmirror.com`（国内镜像源）。

### 用法

使用默认镜像源构建：

```bash
docker compose build
```

指定自定义镜像源构建：

```bash
docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

使用官方源构建（海外环境）：

```bash
docker compose build --build-arg NPM_REGISTRY=https://registry.npmjs.org
```

## 禁止事项

### 禁止在 Docker 构建中使用 --no-frozen-lockfile

以下写法**严禁**出现在生产 Dockerfile 中：

```dockerfile
# ❌ 禁止
RUN pnpm install --no-frozen-lockfile
```

`--no-frozen-lockfile` 会在 lockfile 与 `package.json` 不一致时允许 pnpm 自动更新依赖，破坏构建的可复现性，可能导致：

- 不同构建批次产出行为不一致的镜像
- 线上因依赖版本变化而出现难以排查的 bug
- 构建结果无法回溯到确切的依赖树

如果构建因 `--frozen-lockfile` 报错，正确做法是：

1. 在本地执行 `pnpm install` 更新 `pnpm-lock.yaml`
2. 将更新后的 `pnpm-lock.yaml` 提交到版本控制
3. 重新触发 Docker 构建
