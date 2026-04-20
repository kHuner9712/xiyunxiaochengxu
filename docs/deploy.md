# 部署与开发环境说明

## 一、配置来源清单

| 配置项 | 文件位置 | 优先级 | 说明 |
|--------|---------|--------|------|
| Docker 环境变量 | `.env`（根目录） | 最高 | Docker Compose 读取 |
| 后端数据库连接 | `shopxo-backend/.env` | 高 | ThinkPHP 读取，覆盖 config/database.php |
| 后端数据库配置 | `shopxo-backend/config/database.php` | 中 | 被 .gitignore 忽略，本地生成 |
| 前端 API 地址 | `shopxo-uniapp/common/js/config/dev.js` | 高 | 开发环境 |
| 前端 API 地址 | `shopxo-uniapp/common/js/config/prod.js` | 高 | 生产环境 |
| 小程序 appid | `shopxo-uniapp/manifest.json` | 唯一来源 | uni-app 编译时读取 |
| 微信开发者工具 appid | `shopxo-uniapp/project.config.json` | 辅助 | 应与 manifest.json 保持一致 |

## 二、本地开发启动（非 Docker）

### 2.1 后端

1. 确保本地已安装 PHP 8.1+、MySQL 5.7+、Redis 7+
2. 创建数据库：`CREATE DATABASE shopxo DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;`
3. 复制配置：`cp shopxo-backend/.env.example shopxo-backend/.env`
4. 修改 `shopxo-backend/.env` 中的数据库连接信息：
   ```
   HOSTNAME = 127.0.0.1
   PASSWORD = 你的本地MySQL密码
   ```
5. 复制数据库配置：`cp shopxo-backend/config/database.php`（需手动创建或通过安装向导生成）
6. 导入数据库：`mysql -u root -p shopxo < docs/muying-final-migration.sql`
7. 导入演示数据（可选）：`mysql -u root -p shopxo < docs/muying-demo-data.sql`
8. 启动 PHP 内置服务器：`cd shopxo-backend && php think run`

### 2.2 前端

1. 确保已安装 Node.js 16+
2. 安装依赖：`cd shopxo-uniapp && npm install`
3. 修改 API 地址：编辑 `common/js/config/dev.js`，将 `request_url` 改为后端地址
4. 使用 HBuilderX 打开项目，运行到微信开发者工具

## 三、Docker 启动

### 3.1 一键启动

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 按需修改 .env（默认值可直接用于开发）
# MYSQL_ROOT_PASSWORD=shopxo_dev_123
# NGINX_HOST_PORT=8080

# 3. 启动所有服务
docker-compose up -d

# 4. 等待 MySQL 初始化完成（首次启动约 30 秒）
docker-compose logs -f mysql

# 5. 导入数据库
docker-compose exec mysql mysql -uroot -pshopxo_dev_123 shopxo < /path/to/docs/muying-final-migration.sql

# 6. 复制后端配置
cp shopxo-backend/.env.example shopxo-backend/.env
# Docker 环境下 HOSTNAME 保持 mysql 不变
```

### 3.2 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 API | http://localhost:8080 | Nginx 代理 |
| MySQL | localhost:3306（需设置 MYSQL_HOST_PORT） | 默认不暴露端口 |
| Redis | localhost:6379（需设置 REDIS_HOST_PORT） | 默认不暴露端口 |

### 3.3 常用命令

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重建 PHP 镜像（修改 Dockerfile 后）
docker-compose build php

# 查看日志
docker-compose logs -f php
docker-compose logs -f nginx

# 进入 PHP 容器
docker-compose exec php sh

# MySQL 客户端
docker-compose exec mysql mysql -uroot -pshopxo_dev_123 shopxo
```

## 四、前端 API 地址配置

### 4.1 开发环境

编辑 `shopxo-uniapp/common/js/config/dev.js`：

```javascript
export default {
    request_url: 'http://你的后端地址:端口/',
    static_url: '',
};
```

或通过环境变量（HBuilderX 运行配置）：
- 设置 `UNI_APP_REQUEST_URL` 环境变量

### 4.2 生产环境

编辑 `shopxo-uniapp/common/js/config/prod.js`：

```javascript
export default {
    request_url: 'https://你的生产域名/',
    static_url: 'https://你的CDN域名/',
};
```

## 五、小程序调试

### 5.1 appid 配置

**唯一来源**：`shopxo-uniapp/manifest.json`

微信小程序 appid 定义在 `manifest.json` → `mp-weixin.appid` 字段。

`project.config.json` 中的 appid 应与 `manifest.json` 保持一致，uni-app 编译时会自动同步。

### 5.2 微信开发者工具

1. 打开微信开发者工具，导入 `shopxo-uniapp/unpackage/dist/dev/mp-weixin` 目录
2. 确认 `project.config.json` 中 appid 正确
3. 如遇 appid 不匹配，检查 `manifest.json` → `mp-weixin.appid`

### 5.3 注意事项

- `manifest.json` 中包含微信 OAuth appsecret，**不要将此文件公开分享**
- 生产环境 appsecret 应通过后端配置管理，不应在前端代码中明文存储

## 六、数据库迁移脚本执行顺序

> **唯一入口**：所有迁移统一使用 `docs/muying-final-migration.sql`（A→B→C 段，按段内顺序执行）。
> 旧文件（muying-migration.sql、muying-mvp-migration.sql 等）已废弃，不要单独执行。

```bash
# 1. 执行最终迁移（唯一入口，包含建表+补丁+索引+菜单权限）
mysql -u root -p shopxo < docs/muying-final-migration.sql

# 2. 演示数据（可选）
mysql -u root -p shopxo < docs/muying-demo-data.sql
```

## 七、配置优先级规则

1. **环境变量** > **.env 文件** > **代码默认值**
2. Docker 环境下，后端 `HOSTNAME` 必须为 `mysql`（容器名），不能是 `127.0.0.1`
3. 前端 API 地址在 `dev.js`/`prod.js` 中配置，不硬编码在页面中
4. 小程序 appid 以 `manifest.json` 为唯一来源
5. `database.php` 和 `domain.php` 被 .gitignore 忽略，不纳入版本控制
