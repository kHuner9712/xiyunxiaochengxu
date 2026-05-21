# 禧孕母婴用品私域商城小程序 - 部署指南

## 1. 文档概述

本文档为"禧孕母婴用品私域商城小程序"的完整部署指南，由禧孕文化传媒有限公司运营的甲方自营商城项目。

技术栈：Node.js + NestJS + MySQL + Redis + Docker Compose + Nginx + HTTPS

本文档涵盖从服务器环境准备、Docker 安装、各服务配置、微信小程序及支付配置，到上线检查、备份策略、常见问题排查的完整流程，适用于运维人员和开发人员参考。

---

## 2. 服务器环境要求

### 2.1 操作系统

- **推荐**：Ubuntu 20.04 / 22.04 LTS
- **备选**：CentOS 7 / 8

### 2.2 硬件配置

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 硬盘 | 50 GB SSD | 100 GB SSD |
| 带宽 | 5 Mbps | 10 Mbps |

### 2.3 前置条件

- 已备案域名（如 `api.xiyun.com`、`admin.xiyun.com`）
- 已申请 SSL 证书（可用 Let's Encrypt 免费证书或商业证书）
- 服务器安全组已开放以下端口：
  - `22`：SSH
  - `80`：HTTP
  - `443`：HTTPS
  - `3306`：MySQL（仅内网访问，不对外暴露）
  - `6379`：Redis（仅内网访问，不对外暴露）

### 2.4 服务器初始化

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim unzip net-tools

# 设置时区
sudo timedatectl set-timezone Asia/Shanghai

# 创建项目目录
sudo mkdir -p /opt/baby-mall
sudo chown -R $USER:$USER /opt/baby-mall
```

---

## 3. Docker 安装

### 3.1 Docker 安装（Ubuntu）

```bash
# 卸载旧版本
sudo apt remove -y docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 启动 Docker 并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 重新登录使组权限生效，或执行：
newgrp docker

# 验证安装
docker --version
docker run --rm hello-world
```

### 3.2 Docker 安装（CentOS）

```bash
# 卸载旧版本
sudo yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine

# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动 Docker 并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户加入 docker 组
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker run --rm hello-world
```

### 3.3 Docker Compose 安装

```bash
# 下载 Docker Compose（请根据实际最新版本号替换版本号）
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 创建软链接
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# 验证安装
docker-compose --version
```

> 如果使用 Docker Compose V2 插件方式，可执行：
> ```bash
> sudo apt install -y docker-compose-plugin
> docker compose version
> ```

### 3.4 Docker 镜像加速配置

国内服务器建议配置镜像加速，提升拉取速度：

```bash
sudo mkdir -p /etc/docker

sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://registry.docker-cn.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# 重载配置并重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 3.5 Docker 常用命令

```bash
# 查看运行中的容器
docker ps

# 查看所有容器（含已停止）
docker ps -a

# 查看容器日志
docker logs <container_name>
docker logs -f <container_name>          # 实时跟踪
docker logs --tail 100 <container_name>   # 最近100行

# 进入容器
docker exec -it <container_name> /bin/sh
docker exec -it <container_name> /bin/bash

# 重启容器
docker restart <container_name>

# 停止所有容器
docker stop $(docker ps -q)

# 删除已停止的容器
docker container prune

# 查看镜像
docker images

# 删除未使用的镜像
docker image prune

# 查看 Docker 磁盘使用
docker system df

# 清理所有未使用资源
docker system prune -a

# 查看数据卷
docker volume ls

# 查看网络
docker network ls
```

---

## 4. Docker Compose 配置

### 4.1 目录结构

```
/opt/baby-mall/
├── docker-compose.yml
├── .env
├── nginx/
│   ├── conf.d/
│   │   └── default.conf
│   ├── ssl/
│   │   ├── fullchain.pem
│   │   └── privkey.pem
│   └── nginx.conf
├── mysql/
│   ├── init/
│   │   └── init.sql
│   └── conf/
│       └── my.cnf
├── redis/
│   └── conf/
│       └── redis.conf
├── api/
│   ├── Dockerfile
│   └── src/
├── admin/
│   └── dist/
├── uploads/
├── logs/
│   ├── app/
│   ├── nginx/
│   └── backup/
└── scripts/
    ├── backup.sh
    └── restore.sh
```

### 4.2 docker-compose.yml 完整配置

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: baby-mall-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      TZ: Asia/Shanghai
    ports:
      - "127.0.0.1:3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/conf/my.cnf:/etc/mysql/conf.d/my.cnf
      - ./mysql/init:/docker-entrypoint-initdb.d
      - ./logs/backup:/backup
    command: --default-authentication-plugin=mysql_native_password
    networks:
      - baby-mall-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: baby-mall-redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
      - ./redis/conf/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - baby-mall-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: baby-mall-api
    restart: always
    env_file:
      - .env
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./uploads:/app/uploads
      - ./logs/app:/app/logs
      - ./ssl/wechat:/app/cert:ro
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - baby-mall-network

  nginx:
    image: nginx:1.24-alpine
    container_name: baby-mall-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./admin/dist:/usr/share/nginx/admin:ro
      - ./uploads:/usr/share/nginx/uploads:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - api
    networks:
      - baby-mall-network

networks:
  baby-mall-network:
    driver: bridge

volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local
```

### 4.3 后端 Dockerfile

在 `/opt/baby-mall/api/Dockerfile` 中：

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/uploads /app/logs

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 4.4 网络配置说明

- 所有服务均在 `baby-mall-network` 桥接网络中
- 服务间通过容器名互相访问（如 `mysql:3306`、`redis:6379`）
- MySQL 和 Redis 仅绑定 `127.0.0.1`，不对外暴露
- Nginx 绑定 `0.0.0.0` 的 80 和 443 端口，对外提供服务

### 4.5 数据卷说明

| 数据卷 | 宿主机路径 | 容器路径 | 用途 |
|--------|-----------|----------|------|
| mysql_data | Docker Volume | /var/lib/mysql | MySQL 数据持久化 |
| redis_data | Docker Volume | /data | Redis 数据持久化 |
| - | ./uploads | /app/uploads | 用户上传文件 |
| - | ./logs/app | /app/logs | 应用日志 |
| - | ./logs/nginx | /var/log/nginx | Nginx 日志 |
| - | ./admin/dist | /usr/share/nginx/admin | 管理后台静态文件 |
| - | ./nginx/ssl | /etc/nginx/ssl | SSL 证书 |

### 4.6 环境变量配置

环境变量通过项目根目录的 `.env` 文件统一管理，详见第 9 节。

---

## 5. Nginx 配置

### 5.1 主配置文件 nginx.conf

在 `/opt/baby-mall/nginx/nginx.conf` 中：

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20m;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/rss+xml
        application/atom+xml
        image/svg+xml
        font/opentype
        font/ttf
        font/woff
        font/woff2;

    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
}
```

### 5.2 站点配置 default.conf

在 `/opt/baby-mall/nginx/conf.d/default.conf` 中：

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name api.xiyun.com admin.xiyun.com;

    # Let's Encrypt 验证
    location ^~ /.well-known/acme-challenge/ {
        root /usr/share/nginx/certbot;
    }

    # 其余请求重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# API 服务
server {
    listen 443 ssl http2;
    server_name api.xiyun.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # API 代理
    location / {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;

        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 上传文件访问
    location /uploads/ {
        alias /usr/share/nginx/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 健康检查
    location /health {
        proxy_pass http://api:3000/health;
        access_log off;
    }
}

# 管理后台
server {
    listen 443 ssl http2;
    server_name admin.xiyun.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 管理后台静态文件
    location / {
        root /usr/share/nginx/admin;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 1h;
    }

    # 管理后台 API 代理
    location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;
    }

    # 上传文件访问
    location /uploads/ {
        alias /usr/share/nginx/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

### 5.3 配置说明

| 配置项 | 说明 |
|--------|------|
| `client_max_body_size 20m` | 文件上传最大 20MB |
| `gzip on` | 开启 Gzip 压缩 |
| `gzip_min_length 1024` | 超过 1KB 才压缩 |
| `gzip_comp_level 6` | 压缩级别（1-9，6 为推荐值） |
| `proxy_read_timeout 120s` | 代理读取超时 120 秒（适配支付回调等长请求） |
| `X-Frame-Options` | 防止点击劫持 |
| `X-Content-Type-Options` | 防止 MIME 类型嗅探 |
| `X-XSS-Protection` | XSS 防护 |
| `try_files $uri $uri/ /index.html` | SPA 路由支持 |

---

## 6. HTTPS 配置

### 6.1 Let's Encrypt 免费证书申请

```bash
# 安装 Certbot
sudo apt install -y certbot

# 申请证书（先确保域名已解析到服务器，且 80 端口可访问）
sudo certbot certonly --webroot \
  -w /usr/share/nginx/certbot \
  -d api.xiyun.com \
  -d admin.xiyun.com \
  --email admin@xiyun.com \
  --agree-tos \
  --no-eff-email

# 证书文件位置
# 证书：/etc/letsencrypt/live/api.xiyun.com/fullchain.pem
# 私钥：/etc/letsencrypt/live/api.xiyun.com/privkey.pem
```

### 6.2 商业证书部署

如果使用商业 SSL 证书（如阿里云、腾讯云免费证书）：

```bash
# 创建 SSL 目录
mkdir -p /opt/baby-mall/nginx/ssl

# 将证书文件复制到 SSL 目录
cp fullchain.pem /opt/baby-mall/nginx/ssl/
cp privkey.pem /opt/baby-mall/nginx/ssl/

# 设置权限
chmod 644 /opt/baby-mall/nginx/ssl/fullchain.pem
chmod 600 /opt/baby-mall/nginx/ssl/privkey.pem
```

### 6.3 Let's Encrypt 证书自动续期

```bash
# 测试续期命令
sudo certbot renew --dry-run

# 添加定时任务自动续期
sudo crontab -e

# 添加以下内容（每天凌晨 2:30 检查续期）
30 2 * * * certbot renew --quiet --deploy-hook "docker restart baby-mall-nginx"
```

或者使用 systemd timer：

```bash
# 创建 /etc/systemd/system/certbot-renew.timer
sudo tee /etc/systemd/system/certbot-renew.timer <<'EOF'
[Unit]
Description=Certbot renew timer

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 创建 /etc/systemd/system/certbot-renew.service
sudo tee /etc/systemd/system/certbot-renew.service <<'EOF'
[Unit]
Description=Certbot renew service

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "docker restart baby-mall-nginx"
EOF

# 启用定时器
sudo systemctl daemon-reload
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
```

### 6.4 HTTP 重定向 HTTPS

已在 Nginx 配置中实现，所有 80 端口请求自动 301 重定向到 HTTPS：

```nginx
server {
    listen 80;
    server_name api.xiyun.com admin.xiyun.com;
    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

## 7. MySQL 初始化

### 7.1 MySQL 配置文件

在 `/opt/baby-mall/mysql/conf/my.cnf` 中：

```ini
[mysqld]
# 字符集
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# 时区
default-time-zone='+08:00'

# 连接配置
max_connections=500
max_connect_errors=1000

# 缓冲配置
innodb_buffer_pool_size=512M
innodb_log_buffer_size=16M
innodb_log_file_size=128M

# 日志配置
slow_query_log=1
slow_query_log_file=/var/lib/mysql/slow.log
long_query_time=2

# 其他
sql_mode=STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
lower_case_table_names=1

[client]
default-character-set=utf8mb4

[mysql]
default-character-set=utf8mb4
```

### 7.2 数据库初始化脚本

在 `/opt/baby-mall/mysql/init/init.sql` 中：

```sql
-- 确保字符集
ALTER DATABASE baby_mall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建应用数据库（如果 docker-compose 中 MYSQL_DATABASE 未自动创建）
CREATE DATABASE IF NOT EXISTS baby_mall DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE baby_mall;

-- 时区设置
SET time_zone = '+08:00';

-- 授权（如果使用非 root 用户）
-- GRANT ALL PRIVILEGES ON baby_mall.* TO 'baby_mall_user'@'%';
-- FLUSH PRIVILEGES;

-- 注意：数据表由 NestJS TypeORM 自动同步或迁移脚本创建
-- 如需手动导入初始数据，可在此添加 INSERT 语句
```

### 7.3 数据库备份脚本

在 `/opt/baby-mall/scripts/backup.sh` 中：

```bash
#!/bin/bash

BACKUP_DIR="/opt/baby-mall/logs/backup"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="baby_mall"
DB_USER="root"
DB_PASS="${DB_ROOT_PASSWORD}"
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# 执行备份
docker exec baby-mall-mysql mysqldump \
  -u$DB_USER \
  -p$DB_PASS \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  $DB_NAME > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql"

# 压缩备份
gzip "$BACKUP_DIR/${DB_NAME}_${DATE}.sql"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成: ${DB_NAME}_${DATE}.sql.gz"

# 删除超过保留天数的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已清理 ${RETENTION_DAYS} 天前的备份"
```

```bash
# 设置执行权限
chmod +x /opt/baby-mall/scripts/backup.sh
```

### 7.4 数据库恢复脚本

在 `/opt/baby-mall/scripts/restore.sh` 中：

```bash
#!/bin/bash

if [ -z "$1" ]; then
    echo "用法: ./restore.sh <备份文件路径>"
    echo "示例: ./restore.sh /opt/baby-mall/logs/backup/baby_mall_20260520_020000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
DB_NAME="baby_mall"
DB_USER="root"
DB_PASS="${DB_ROOT_PASSWORD}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 文件不存在 $BACKUP_FILE"
    exit 1
fi

echo "警告: 此操作将覆盖数据库 $DB_NAME 的所有数据！"
read -p "确认继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

# 解压并恢复
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i baby-mall-mysql mysql -u$DB_USER -p$DB_PASS $DB_NAME
else
    docker exec -i baby-mall-mysql mysql -u$DB_USER -p$DB_PASS $DB_NAME < "$BACKUP_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 恢复完成"
```

```bash
chmod +x /opt/baby-mall/scripts/restore.sh
```

---

## 8. Redis 配置

### 8.1 Redis 配置文件

在 `/opt/baby-mall/redis/conf/redis.conf` 中：

```conf
# 绑定地址（容器内）
bind 0.0.0.0

# 端口
port 6379

# 密码（请替换为实际密码，与 .env 中 REDIS_PASSWORD 一致）
requirepass your_redis_password_here

# 内存限制
maxmemory 256mb

# 内存淘汰策略
maxmemory-policy allkeys-lru

# 持久化 - RDB
save 900 1
save 300 10
save 60 10000

# RDB 文件名
dbfilename dump.rdb

# RDB 文件目录
dir /data

# 持久化 - AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# 日志级别
loglevel notice

# 客户端连接数
maxclients 10000

# 超时设置
timeout 300

# TCP keepalive
tcp-keepalive 60
```

### 8.2 Redis 常用命令

```bash
# 进入 Redis CLI
docker exec -it baby-mall-redis redis-cli -a your_redis_password_here

# 查看内存使用
INFO memory

# 查看连接数
INFO clients

# 查看所有键
KEYS *

# 查看键数量
DBSIZE

# 清空当前数据库
FLUSHDB

# 清空所有数据库
FLUSHALL

# 查看 Redis 配置
CONFIG GET *

# 实时监控命令
docker exec -it baby-mall-redis redis-cli -a your_redis_password_here MONITOR
```

### 8.3 Redis 密码配置

生产环境**必须**设置 Redis 密码，否则任何能访问 Redis 端口的进程都可以读写数据，造成严重安全隐患。

**密码设置方式**：Redis 通过 `--requirepass` 命令行参数设置密码，而非 redis.conf 文件。在 `docker-compose.yml` 中，Redis 服务的启动命令已包含该参数：

```yaml
redis:
  image: redis:7-alpine
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD:-}
  command: redis-server /etc/redis/redis.conf --requirepass ${REDIS_PASSWORD:-}
```

**API 连接密码**：后端通过 `REDIS_PASSWORD` 环境变量读取密码并连接 Redis。在 `.env` 文件中配置：

```env
REDIS_PASSWORD=your_redis_password_here
```

**配置要点**：

| 项目 | 说明 |
|------|------|
| 密码设置方式 | `--requirepass` 命令行参数（docker-compose.yml 中已配置） |
| API 连接方式 | `REDIS_PASSWORD` 环境变量 |
| 生产环境 | **必须设置**强密码 |
| 开发环境 | 可留空（`REDIS_PASSWORD=`），但 Redis 不应暴露到公网 |
| 密码一致性 | `.env` 中的 `REDIS_PASSWORD` 必须与 `docker-compose.yml` 中 `REDIS_PASSWORD` 一致 |

> **注意**：`deploy/redis/redis.conf` 中**不需要**配置 `requirepass`，密码通过命令行参数传入。如果 redis.conf 中也配置了 `requirepass`，两者必须保持一致，否则 Redis 将使用命令行参数的值。

---

## 9. 后端环境变量

### 9.1 .env 文件完整配置

在 `/opt/baby-mall/.env` 中：

```env
# ================================
# 应用基础配置
# ================================
NODE_ENV=production
PORT=3000
APP_NAME=baby-mall

# ================================
# 数据库配置
# ================================
DB_TYPE=mysql
DB_HOST=mysql
DB_PORT=3306
DB_NAME=baby_mall
DB_USER=baby_mall_user
DB_PASSWORD=your_db_password_here
DB_ROOT_PASSWORD=your_db_root_password_here
DB_SYNCHRONIZE=false
DB_LOGGING=false

# ================================
# Redis 配置
# ================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
REDIS_DB=0

# ================================
# JWT 配置
# ================================
JWT_SECRET=your_jwt_secret_key_here_please_change_this
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ================================
# 微信小程序配置
# ================================
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret

# ================================
# 微信支付配置
# ================================
WECHAT_MCH_ID=your_mch_id
WECHAT_API_KEY=your_api_key_here
WECHAT_API_V3_KEY=your_api_v3_key_here
WECHAT_CERT_PATH=/app/cert/apiclient_cert.p12
WECHAT_CERT_KEY_PATH=/app/cert/apiclient_key.pem
WECHAT_NOTIFY_URL=https://api.xiyun.com/api/payment/wechat/notify

# ================================
# 文件上传配置
# ================================
UPLOAD_DIR=/app/uploads
UPLOAD_MAX_SIZE=20971520

# ================================
# 腾讯云 COS 配置（预留）
# ================================
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=

# ================================
# 阿里云 OSS 配置（预留）
# ================================
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_REGION=

# ================================
# 订单配置
# ================================
ORDER_AUTO_CLOSE_MINUTES=30
ORDER_AUTO_COMPLETE_DAYS=7
ORDER_AUTO_COMMENT_DAYS=7

# ================================
# 日志配置
# ================================
LOG_DIR=/app/logs
LOG_LEVEL=info

# ================================
# CORS 配置
# ================================
CORS_ENABLED=true
CORS_ORIGIN=https://admin.xiyun.com

# ================================
# 限流配置
# ================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### 9.2 环境变量说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口 | `3000` |
| `DB_HOST` | 数据库主机（容器名） | `mysql` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_NAME` | 数据库名 | `baby_mall` |
| `DB_USER` | 数据库用户 | `baby_mall_user` |
| `DB_PASSWORD` | 数据库密码 | 强密码 |
| `DB_ROOT_PASSWORD` | 数据库 root 密码 | 强密码 |
| `DB_SYNCHRONIZE` | 是否自动同步表结构 | `false`（生产环境务必关闭） |
| `REDIS_HOST` | Redis 主机（容器名） | `redis` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码 | 强密码 |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |
| `JWT_EXPIRES_IN` | JWT 过期时间 | `7d` |
| `WECHAT_APP_ID` | 微信小程序 AppID | `wx1234567890` |
| `WECHAT_APP_SECRET` | 微信小程序 AppSecret | 密钥字符串 |
| `WECHAT_MCH_ID` | 微信支付商户号 | `1234567890` |
| `WECHAT_API_KEY` | 微信支付 API 密钥 | 密钥字符串 |
| `WECHAT_NOTIFY_URL` | 支付回调地址 | `https://api.xiyun.com/api/payment/wechat/notify` |
| `UPLOAD_DIR` | 上传文件目录 | `/app/uploads` |
| `UPLOAD_MAX_SIZE` | 上传文件最大字节数 | `20971520`（20MB） |
| `COS_SECRET_ID` | 腾讯云 COS SecretId | 预留 |
| `COS_SECRET_KEY` | 腾讯云 COS SecretKey | 预留 |
| `COS_BUCKET` | 腾讯云 COS 存储桶名 | 预留 |
| `COS_REGION` | 腾讯云 COS 地域 | 预留 |
| `OSS_ACCESS_KEY_ID` | 阿里云 OSS AccessKeyId | 预留 |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 OSS AccessKeySecret | 预留 |
| `OSS_BUCKET` | 阿里云 OSS 存储桶名 | 预留 |
| `OSS_REGION` | 阿里云 OSS 地域 | 预留 |
| `ORDER_AUTO_CLOSE_MINUTES` | 订单自动关闭时间（分钟） | `30` |
| `ORDER_AUTO_COMPLETE_DAYS` | 订单自动完成时间（天） | `7` |
| `ORDER_AUTO_COMMENT_DAYS` | 订单自动评价时间（天） | `7` |

> **安全提醒**：`.env` 文件包含敏感信息，务必设置正确的文件权限：
> ```bash
> chmod 600 /opt/baby-mall/.env
> ```
> 且 `.env` 文件不应纳入版本控制，确保 `.gitignore` 中已包含 `.env`。

---

## 10. 管理后台构建

### 10.1 依赖安装

```bash
cd /opt/baby-mall/admin

# 安装依赖
npm install
```

### 10.2 环境变量配置

在 `/opt/baby-mall/admin/.env.production` 中：

```env
VITE_API_BASE_URL=https://api.xiyun.com/api
VITE_UPLOAD_URL=https://api.xiyun.com/api/upload
VITE_STATIC_URL=https://api.xiyun.com
```

### 10.3 构建命令

```bash
cd /opt/baby-mall/admin

# 构建生产版本
npm run build
```

构建产物默认输出到 `dist/` 目录。

### 10.4 部署到 Nginx 静态目录

```bash
# 构建产物已通过 Docker Volume 映射
# admin/dist → /usr/share/nginx/admin

# 如果需要手动复制
cp -r /opt/baby-mall/admin/dist/* /opt/baby-mall/admin/dist/

# 重启 Nginx 容器使配置生效
docker restart baby-mall-nginx
```

### 10.5 更新部署流程

```bash
# 1. 拉取最新代码
cd /opt/baby-mall/admin
git pull origin main

# 2. 安装依赖（如有变更）
npm install

# 3. 构建
npm run build

# 4. 重启 Nginx
docker restart baby-mall-nginx

# 5. 验证
curl -I https://admin.xiyun.com
```

---

## 11. 小程序构建

### 11.1 依赖安装

```bash
cd /opt/baby-mall/miniapp

# 安装依赖
npm install
```

### 11.2 环境配置

在小程序项目配置文件中设置 API 域名：

```javascript
// config/production.js
const config = {
  apiBaseUrl: 'https://api.xiyun.com/api',
  uploadUrl: 'https://api.xiyun.com/api/upload',
  staticUrl: 'https://api.xiyun.com',
};

module.exports = config;
```

### 11.3 构建命令

```bash
# 如果使用 uni-app
npm run build:mp-weixin

# 如果使用 Taro
npm run build:weapp

# 如果使用原生小程序
# 无需构建，直接用微信开发者工具打开项目目录
```

构建产物输出到 `dist/` 目录。

### 11.4 微信开发者工具导入

1. 下载并安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具，选择"导入项目"
3. 目录选择构建产物目录（如 `dist/build/mp-weixin`）
4. 填入 AppID
5. 点击"确定"导入

### 11.5 上传代码

1. 在微信开发者工具中，点击右上角"上传"按钮
2. 填写版本号和项目备注
3. 点击"上传"

### 11.6 提交审核

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 进入"版本管理"
3. 在"开发版本"中找到刚上传的版本
4. 点击"提交审核"
5. 填写审核信息（功能页面、类目等）
6. 等待审核通过（通常 1-7 个工作日）
7. 审核通过后，点击"发布"上线

---

## 12. 微信小程序后台配置

### 12.1 登录微信公众平台

访问 [mp.weixin.qq.com](https://mp.weixin.qq.com) 并使用管理员微信扫码登录。

### 12.2 服务器域名配置

路径：**开发管理 → 开发设置 → 服务器域名**

| 域名类型 | 配置内容 | 说明 |
|----------|----------|------|
| request 合法域名 | `https://api.xiyun.com` | API 请求域名 |
| uploadFile 合法域名 | `https://api.xiyun.com` | 文件上传域名 |
| downloadFile 合法域名 | `https://api.xiyun.com` | 文件下载域名 |

> **注意**：
> - 域名必须为 HTTPS
> - 域名必须已备案
> - 不能使用 IP 地址
> - 不能使用端口号
> - 每月只能修改 5 次

### 12.3 业务域名配置

路径：**开发管理 → 开发设置 → 业务域名**

如需在小程序中使用 WebView，需配置业务域名：

1. 下载校验文件
2. 将校验文件放置到域名根目录
3. 在小程序后台添加域名

### 12.4 AppID 和 AppSecret 获取

路径：**开发管理 → 开发设置**

- **AppID（小程序ID）**：直接可见，复制后填入 `.env` 的 `WECHAT_APP_ID`
- **AppSecret（小程序密钥）**：点击"重置"生成，仅显示一次，请妥善保存，填入 `.env` 的 `WECHAT_APP_SECRET`

> **重要**：AppSecret 仅在生成时显示一次，务必立即保存。如遗忘需重置，重置后旧 Secret 立即失效。

### 12.5 微信支付关联

路径：**功能 → 微信支付**

1. 点击"开通"
2. 选择已申请的商户号进行关联
3. 或直接申请新的商户号

---

## 13. 微信支付配置

### 13.1 商户号申请

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 进入"功能 → 微信支付"
3. 点击"开通"，按指引提交资料
4. 等待审核通过（通常 1-5 个工作日）
5. 审核通过后获得商户号（mch_id）

### 13.2 API 密钥设置

1. 登录 [微信支付商户平台](https://pay.weixin.qq.com)
2. 进入"账户中心 → API安全"
3. 设置 API 密钥（32 位字符串）
4. 将密钥填入 `.env` 的 `WECHAT_API_KEY`

> **APIv3 密钥**：如使用微信支付 APIv3，需单独设置 APIv3 密钥。

### 13.3 API 证书下载

1. 登录微信支付商户平台
2. 进入"账户中心 → API安全"
3. 点击"申请API证书"
4. 按指引完成证书申请
5. 下载证书文件：
   - `apiclient_cert.p12`（PKCS12 格式，包含私钥）
   - `apiclient_cert.pem`（证书文件）
   - `apiclient_key.pem`（私钥文件）

```bash
# 将证书文件部署到服务器
mkdir -p /opt/baby-mall/ssl/wechat
cp apiclient_cert.p12 /opt/baby-mall/ssl/wechat/
cp apiclient_cert.pem /opt/baby-mall/ssl/wechat/
cp apiclient_key.pem /opt/baby-mall/ssl/wechat/

# 设置权限
chmod 600 /opt/baby-mall/ssl/wechat/*
```

### 13.4 回调地址配置

- 回调地址必须为 HTTPS
- 回调地址示例：`https://api.xiyun.com/api/payment/wechat/notify`
- 确保回调地址可从外网访问
- 在 `.env` 中配置 `WECHAT_NOTIFY_URL`

### 13.5 支付产品开通

1. 登录微信支付商户平台
2. 进入"产品中心 → 我的产品"
3. 确认已开通 **JSAPI支付**（小程序支付必须）
4. 如未开通，点击"申请开通"

### 13.6 商户平台配置检查清单

| 配置项 | 状态 |
|--------|------|
| 商户号（mch_id）已获取 | ☐ |
| API 密钥已设置 | ☐ |
| API 证书已下载并部署 | ☐ |
| JSAPI 支付已开通 | ☐ |
| 回调地址已配置 | ☐ |
| 小程序与商户号已关联 | ☐ |

---

## 14. 域名配置

### 14.1 DNS 解析配置

登录域名服务商控制台（如阿里云、腾讯云、Cloudflare），添加 DNS 解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL | 说明 |
|----------|----------|--------|-----|------|
| A | api | 服务器公网 IP | 600 | API 域名 |
| A | admin | 服务器公网 IP | 600 | 管理后台域名 |

### 14.2 CNAME 配置（如使用 CDN）

如使用 CDN 加速静态资源：

| 记录类型 | 主机记录 | 记录值 | TTL | 说明 |
|----------|----------|--------|-----|------|
| CNAME | static | CDN 提供的 CNAME 地址 | 600 | 静态资源 CDN |

### 14.3 域名备案确认

- 确认域名已完成 ICP 备案
- 确认备案信息与实际使用一致
- 如使用腾讯云/阿里云服务器，确认备案接入正确
- 备案号需在小程序中展示

### 14.4 DNS 解析验证

```bash
# 验证 A 记录
dig api.xiyun.com
nslookup api.xiyun.com

# 验证 CNAME 记录
dig static.xiyun.com
```

---

## 15. API 域名配置

### 15.1 域名规划

| 用途 | 域名 | 说明 |
|------|------|------|
| 后端 API | `https://api.xiyun.com` | 后端服务接口 |
| 管理后台 | `https://admin.xiyun.com` | 管理后台前端 |
| 文件访问 | `https://api.xiyun.com/uploads/` | 上传文件访问 |
| 小程序 request | `https://api.xiyun.com` | 小程序请求域名 |

### 15.2 小程序中 API 域名配置

在小程序代码中统一配置 API 基础地址：

```javascript
const API_BASE_URL = 'https://api.xiyun.com/api';
const UPLOAD_URL = 'https://api.xiyun.com/api/upload';
const STATIC_URL = 'https://api.xiyun.com';
```

### 15.3 管理后台 API 域名配置

在管理后台环境变量中配置：

```env
VITE_API_BASE_URL=https://api.xiyun.com/api
VITE_UPLOAD_URL=https://api.xiyun.com/api/upload
VITE_STATIC_URL=https://api.xiyun.com
```

---

## 16. 文件上传目录配置

### 16.1 本地存储目录

```bash
# 创建上传目录
mkdir -p /opt/baby-mall/uploads

# 设置权限（容器内 node 用户 uid 通常为 1000）
chown -R 1000:1000 /opt/baby-mall/uploads
chmod -R 755 /opt/baby-mall/uploads
```

### 16.2 目录结构

```
/opt/baby-mall/uploads/
├── products/       # 商品图片
├── avatars/        # 用户头像
├── banners/        # 轮播图
├── categories/     # 分类图标
├── articles/       # 文章图片
└── temp/           # 临时文件
```

### 16.3 Nginx 静态文件服务

已在 Nginx 配置中设置：

```nginx
location /uploads/ {
    alias /usr/share/nginx/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

访问示例：`https://api.xiyun.com/uploads/products/image.jpg`

### 16.4 预留云存储配置

项目预留了腾讯云 COS 和阿里云 OSS 的配置项，后续如需迁移到云存储：

1. 在 `.env` 中填写对应的云存储配置
2. 修改后端上传服务，将文件上传到云存储
3. 修改文件访问域名为 CDN 域名

---

## 17. 日志目录配置

### 17.1 日志目录结构

```
/opt/baby-mall/logs/
├── app/            # 应用日志
│   ├── app.log
│   ├── error.log
│   └── access.log
├── nginx/          # Nginx 日志
│   ├── access.log
│   └── error.log
└── backup/         # 数据库备份
    └── baby_mall_20260520_020000.sql.gz
```

```bash
# 创建日志目录
mkdir -p /opt/baby-mall/logs/{app,nginx,backup}
```

### 17.2 应用日志

NestJS 应用日志通过 Volume 映射到 `/opt/baby-mall/logs/app/`，包含：

- `app.log`：应用运行日志
- `error.log`：错误日志
- `access.log`：接口访问日志

### 17.3 Nginx 日志

- 访问日志：`/opt/baby-mall/logs/nginx/access.log`
- 错误日志：`/opt/baby-mall/logs/nginx/error.log`

```bash
# 实时查看 Nginx 访问日志
tail -f /opt/baby-mall/logs/nginx/access.log

# 实时查看 Nginx 错误日志
tail -f /opt/baby-mall/logs/nginx/error.log

# 查看 API 请求统计
cat /opt/baby-mall/logs/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -20
```

### 17.4 日志轮转配置

创建日志轮转配置文件：

```bash
sudo tee /etc/logrotate.d/baby-mall <<'EOF'
/opt/baby-mall/logs/app/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
    dateformat -%Y%m%d
}

/opt/baby-mall/logs/nginx/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
    dateformat -%Y%m%d
}
EOF
```

### 17.5 日志清理策略

| 日志类型 | 轮转周期 | 保留天数 | 压缩 |
|----------|----------|----------|------|
| 应用日志 | 每日 | 30 天 | 是 |
| Nginx 日志 | 每日 | 30 天 | 是 |
| 数据库备份 | 每日 | 7 天 | 是 |

---

## 18. 备份策略

### 18.1 数据库备份

- **频率**：每日凌晨 2:00 自动备份
- **方式**：`mysqldump` 全量备份
- **存储**：本地 `/opt/baby-mall/logs/backup/`
- **保留**：7 天

### 18.2 定时任务配置

```bash
# 编辑 crontab
crontab -e

# 添加每日备份任务（凌晨 2:00 执行）
0 2 * * * /opt/baby-mall/scripts/backup.sh >> /opt/baby-mall/logs/backup/backup.log 2>&1
```

### 18.3 文件备份

```bash
# 手动备份上传文件
tar -czf /opt/baby-mall/logs/backup/uploads_$(date +%Y%m%d).tar.gz /opt/baby-mall/uploads/

# 添加到定时任务（每周日凌晨 3:00）
0 3 * * 0 tar -czf /opt/baby-mall/logs/backup/uploads_$(date +\%Y\%m\%d).tar.gz /opt/baby-mall/uploads/
```

### 18.4 备份保留策略

| 备份类型 | 保留天数 | 压缩 |
|----------|----------|------|
| 数据库备份 | 7 天 | gzip |
| 文件备份 | 30 天 | tar.gz |

### 18.5 备份恢复流程

1. 确认需要恢复的备份文件
2. 停止 API 服务：`docker stop baby-mall-api`
3. 执行恢复脚本：`./scripts/restore.sh /opt/baby-mall/logs/backup/baby_mall_20260520_020000.sql.gz`
4. 验证数据完整性
5. 重启 API 服务：`docker start baby-mall-api`
6. 检查服务是否正常

### 18.6 异地备份（可选）

建议将备份文件同步到其他存储，防止单点故障：

```bash
# 使用 rsync 同步到远程服务器
rsync -avz /opt/baby-mall/logs/backup/ user@backup-server:/backup/baby-mall/

# 或使用 ossutil 同步到阿里云 OSS
ossutil cp /opt/baby-mall/logs/backup/ oss://backup-bucket/baby-mall/ -r
```

---

## 19. 上线检查清单

### 19.1 环境配置

| 检查项 | 状态 |
|--------|------|
| 服务器环境满足最低要求 | ☐ |
| Docker 和 Docker Compose 已安装 | ☐ |
| `.env` 环境变量配置完成 | ☐ |
| 敏感信息已修改默认值（密码、密钥等） | ☐ |
| `.env` 文件权限设置为 600 | ☐ |

### 19.2 数据与存储

| 检查项 | 状态 |
|--------|------|
| MySQL 容器正常运行 | ☐ |
| 数据库初始化完成 | ☐ |
| 数据库字符集为 utf8mb4 | ☐ |
| Redis 容器正常运行 | ☐ |
| Redis 密码已设置 | ☐ |
| 文件上传目录已创建并设置权限 | ☐ |

### 19.3 网络与安全

| 检查项 | 状态 |
|--------|------|
| SSL 证书已部署 | ☐ |
| Nginx 配置正确并已重启 | ☐ |
| HTTP 正确重定向到 HTTPS | ☐ |
| 安全组仅开放必要端口 | ☐ |
| MySQL 和 Redis 不对外暴露 | ☐ |

### 19.4 微信配置

| 检查项 | 状态 |
|--------|------|
| 微信小程序服务器域名配置完成 | ☐ |
| 微信支付商户号已关联 | ☐ |
| 微信支付 API 密钥已设置 | ☐ |
| 微信支付 API 证书已部署 | ☐ |
| JSAPI 支付已开通 | ☐ |
| 支付回调地址已配置 | ☐ |

### 19.5 功能验证

| 检查项 | 状态 |
|--------|------|
| 管理后台可正常访问（https://admin.xiyun.com） | ☐ |
| 管理后台可正常登录 | ☐ |
| API 接口可正常访问（https://api.xiyun.com/health） | ☐ |
| 小程序可正常登录 | ☐ |
| 商品列表可正常加载 | ☐ |
| 文件上传功能正常 | ☐ |
| 支付功能正常（小额测试） | ☐ |
| 订单流程完整 | ☐ |

### 19.6 运维保障

| 检查项 | 状态 |
|--------|------|
| 日志记录正常 | ☐ |
| 日志轮转配置完成 | ☐ |
| 数据库备份任务正常 | ☐ |
| 证书自动续期配置完成 | ☐ |
| 监控告警配置完成（如有） | ☐ |

---

## 20. 常见问题排查

### 20.1 容器启动失败

**症状**：`docker ps` 中看不到容器或容器状态为 `Exited`

**排查步骤**：

```bash
# 查看容器状态
docker ps -a

# 查看容器日志
docker logs baby-mall-api
docker logs baby-mall-mysql
docker logs baby-mall-redis
docker logs baby-mall-nginx

# 查看容器退出码
docker inspect baby-mall-api --format='{{.State.ExitCode}}'

# 常见退出码含义
# 0: 正常退出
# 1: 应用错误
# 137: OOM 被杀
# 139: 段错误
```

**常见原因**：
- 端口被占用：`netstat -tlnp | grep <port>`
- 权限问题：检查文件和目录权限
- 环境变量错误：检查 `.env` 文件
- 内存不足：`free -h` 查看内存使用

### 20.2 数据库连接失败

**症状**：API 日志中出现 `ECONNREFUSED` 或 `Access denied`

**排查步骤**：

```bash
# 检查 MySQL 容器是否运行
docker ps | grep mysql

# 检查 MySQL 是否就绪
docker exec baby-mall-mysql mysqladmin ping -h localhost -u root -p

# 检查数据库是否存在
docker exec baby-mall-mysql mysql -u root -p -e "SHOW DATABASES;"

# 检查用户权限
docker exec baby-mall-mysql mysql -u root -p -e "SELECT user, host FROM mysql.user;"

# 检查网络连通性
docker exec baby-mall-api ping mysql

# 检查环境变量
docker exec baby-mall-api env | grep DB_
```

**常见原因**：
- MySQL 未完全启动（等待 healthcheck 通过）
- 密码不匹配（检查 `.env` 中的 `DB_PASSWORD`）
- 数据库未创建
- Docker 网络问题

### 20.3 Redis 连接失败

**症状**：API 日志中出现 `ECONNREFUSED` 或 `NOAUTH`

**排查步骤**：

```bash
# 检查 Redis 容器是否运行
docker ps | grep redis

# 测试 Redis 连接
docker exec baby-mall-redis redis-cli -a your_password ping

# 检查网络连通性
docker exec baby-mall-api ping redis

# 检查环境变量
docker exec baby-mall-api env | grep REDIS_
```

**常见原因**：
- Redis 密码不匹配
- Redis 未启动完成
- Docker 网络问题

### 20.4 Nginx 502 错误

**症状**：浏览器或小程序请求返回 502 Bad Gateway

**排查步骤**：

```bash
# 检查 API 容器是否运行
docker ps | grep api

# 检查 API 日志
docker logs baby-mall-api --tail 100

# 检查 Nginx 错误日志
cat /opt/baby-mall/logs/nginx/error.log | tail -20

# 检查 Nginx 到 API 的连通性
docker exec baby-mall-nginx wget -qO- http://api:3000/health || echo "连接失败"

# 检查 Nginx 配置语法
docker exec baby-mall-nginx nginx -t
```

**常见原因**：
- API 容器未启动或已崩溃
- API 正在重启中
- Nginx 配置中 `proxy_pass` 地址错误
- API 端口不匹配

### 20.5 微信支付回调失败

**症状**：支付成功但订单状态未更新

**排查步骤**：

```bash
# 检查回调地址是否可访问
curl -v https://api.xiyun.com/api/payment/wechat/notify

# 检查 API 日志中的回调记录
docker logs baby-mall-api | grep -i "notify\|payment\|callback"

# 检查 Nginx 访问日志
cat /opt/baby-mall/logs/nginx/access.log | grep "notify"

# 检查 SSL 证书是否有效
openssl s_client -connect api.xiyun.com:443 -servername api.xiyun.com
```

**常见原因**：
- 回调地址不可达（防火墙、安全组）
- SSL 证书问题
- 回调地址配置错误
- API 证书路径错误
- 签名验证失败

### 20.6 文件上传失败

**症状**：上传接口返回错误或文件无法访问

**排查步骤**：

```bash
# 检查上传目录权限
ls -la /opt/baby-mall/uploads/

# 检查磁盘空间
df -h

# 检查 Nginx 上传大小限制
docker exec baby-mall-nginx nginx -T | grep client_max_body_size

# 检查 API 日志
docker logs baby-mall-api | grep -i "upload\|multer"

# 测试上传
curl -X POST https://api.xiyun.com/api/upload \
  -F "file=@test.jpg" \
  -H "Authorization: Bearer <token>"
```

**常见原因**：
- 目录权限不足
- 磁盘空间不足
- 文件超过大小限制
- Nginx `client_max_body_size` 配置过小
- API 中 `UPLOAD_MAX_SIZE` 配置过小

### 20.7 SSL 证书问题

**症状**：浏览器提示证书不安全或小程序请求失败

**排查步骤**：

```bash
# 检查证书有效期
openssl x509 -in /opt/baby-mall/nginx/ssl/fullchain.pem -noout -dates

# 检查证书域名
openssl x509 -in /opt/baby-mall/nginx/ssl/fullchain.pem -noout -text | grep -A1 "Subject Alternative Name"

# 检查证书链完整性
openssl verify /opt/baby-mall/nginx/ssl/fullchain.pem

# 在线检测（使用 ssllabs.com）
# https://www.ssllabs.com/ssltest/analyze.html?d=api.xiyun.com
```

**常见原因**：
- 证书过期
- 证书域名不匹配
- 证书链不完整（缺少中间证书）
- 证书文件路径错误

---

## 21. 更新部署流程

### 21.1 完整更新流程

```bash
# 1. 进入项目目录
cd /opt/baby-mall

# 2. 拉取最新代码
git pull origin main

# 3. 更新后端
cd /opt/baby-mall/api

# 3.1 重新构建 API 镜像
docker-compose build api

# 3.2 重启 API 容器
docker-compose up -d api

# 3.3 查看启动日志
docker-compose logs -f api
```

### 21.2 管理后台更新

```bash
# 1. 进入管理后台目录
cd /opt/baby-mall/admin

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如有变更）
npm install

# 4. 构建
npm run build

# 5. 重启 Nginx
docker restart baby-mall-nginx

# 6. 验证
curl -I https://admin.xiyun.com
```

### 21.3 数据库迁移

如果本次更新涉及数据库结构变更：

```bash
# 方式一：使用 NestJS TypeORM 迁移
docker exec baby-mall-api npm run migration:run

# 方式二：手动执行 SQL
docker exec -i baby-mall-mysql mysql -u root -p<password> baby_mall < migration.sql

# 注意：执行迁移前务必备份数据库
/opt/baby-mall/scripts/backup.sh
```

### 21.4 重启所有服务

```bash
cd /opt/baby-mall

# 停止所有服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build

# 查看所有服务状态
docker-compose ps

# 查看所有服务日志
docker-compose logs -f
```

### 21.5 回滚流程

如果更新后出现问题，需要回滚：

```bash
# 1. 回滚代码
cd /opt/baby-mall
git log --oneline -5          # 查看最近5次提交
git checkout <commit_hash>    # 回滚到指定版本

# 2. 重新构建并启动
docker-compose up -d --build

# 3. 如需回滚数据库
./scripts/restore.sh /opt/baby-mall/logs/backup/baby_mall_<timestamp>.sql.gz

# 4. 验证服务正常
curl https://api.xiyun.com/health
```

### 21.6 更新检查清单

| 步骤 | 说明 | 状态 |
|------|------|------|
| 备份数据库 | 执行备份脚本 | ☐ |
| 拉取最新代码 | `git pull` | ☐ |
| 检查变更内容 | 查看更新日志 | ☐ |
| 执行数据库迁移 | 如有结构变更 | ☐ |
| 构建后端镜像 | `docker-compose build api` | ☐ |
| 重启后端服务 | `docker-compose up -d api` | ☐ |
| 构建管理后台 | `npm run build` | ☐ |
| 重启 Nginx | `docker restart baby-mall-nginx` | ☐ |
| 验证 API 正常 | 健康检查接口 | ☐ |
| 验证管理后台正常 | 浏览器访问 | ☐ |
| 验证小程序正常 | 真机测试 | ☐ |
| 观察日志 | 检查有无异常 | ☐ |

---

## 22. 生产部署快速命令

### 22.1 首次部署

```bash
# 1. 进入项目部署目录
cd /opt/baby-mall

# 2. 克隆代码（如尚未克隆）
git clone <repository-url> .

# 3. 复制并编辑环境变量
cp .env.example .env
vim .env
# 必须修改以下变量：
# - DB_PASSWORD（数据库密码）
# - JWT_SECRET（JWT 密钥）
# - WECHAT_APP_ID（微信小程序 AppID）
# - WECHAT_APP_SECRET（微信小程序 AppSecret）
# - WECHAT_MCH_ID（微信支付商户号）
# - WECHAT_MCH_SERIAL_NO（微信支付证书序列号）
# - WECHAT_API_V3_KEY（微信支付 APIv3 密钥）
# - WECHAT_PRIVATE_KEY_PATH（微信支付私钥路径，容器内默认 /app/certs/apiclient_key.pem）
# - WECHAT_NOTIFY_URL（微信支付回调地址）
# - ADMIN_DEFAULT_USERNAME（生产环境管理员用户名，必填）
# - ADMIN_DEFAULT_PASSWORD（生产环境管理员密码，必填，至少12位含大小写字母+数字+特殊字符）

# 4. 设置 .env 文件权限
chmod 600 .env

# 5. 上传微信支付证书到 certs 目录
mkdir -p /opt/baby-mall/certs
cp apiclient_key.pem /opt/baby-mall/certs/
chmod 600 /opt/baby-mall/certs/*

# 6. 构建并启动所有服务
cd deploy
docker-compose up -d --build

# 7. 查看启动日志
docker-compose logs -f api

# 8. 等待 API 启动完成后，执行数据库迁移和种子数据
docker exec baby-mall-api npx prisma migrate deploy
docker exec baby-mall-api npx prisma db seed

# 9. 验证服务状态
docker-compose ps
curl http://localhost:3000/api/health
```

### 22.2 日常更新部署

```bash
cd /opt/baby-mall

# 1. 拉取最新代码
git pull origin main

# 2. 重新构建并启动 API
cd deploy
docker-compose up -d --build api

# 3. 查看启动日志（entrypoint 会自动执行 prisma migrate deploy）
docker-compose logs -f api

# 4. 验证
curl http://localhost:3000/api/health
```

### 22.3 数据库迁移

API 容器启动时会自动执行 `prisma migrate deploy`（通过 entrypoint.sh）。

如需手动执行迁移：

```bash
docker exec baby-mall-api npx prisma migrate deploy
```

### 22.4 环境变量说明（Docker 部署专用）

| 变量名 | 说明 | Docker 默认值 |
|--------|------|--------------|
| `DATABASE_URL` | Prisma 数据库连接字符串 | `mysql://root:${DB_PASSWORD}@mysql:3306/${DB_NAME}` |
| `WECHAT_PRIVATE_KEY_PATH` | 微信支付私钥路径 | `/app/certs/apiclient_key.pem` |
| `WECHAT_MCH_SERIAL_NO` | 微信支付证书序列号 | 空（必须填写） |

### 22.5 微信支付证书挂载

微信支付私钥文件通过 Docker Volume 挂载到容器内：

```bash
# 将证书放到宿主机 certs 目录
mkdir -p /opt/baby-mall/certs
cp apiclient_key.pem /opt/baby-mall/certs/
chmod 600 /opt/baby-mall/certs/*

# docker-compose.yml 中已配置 bind mount
# 容器内路径：/app/certs/apiclient_key.pem
# 环境变量：WECHAT_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem
```

### 22.6 常用运维命令

```bash
# 查看所有服务状态
docker-compose ps

# 查看 API 日志
docker-compose logs -f api

# 重启 API 服务
docker-compose restart api

# 进入 API 容器
docker exec -it baby-mall-api /bin/sh

# 执行数据库备份
/opt/baby-mall/deploy/scripts/backup.sh

# 完全重建所有服务
docker-compose down
docker-compose up -d --build
```

---

## 23. 微信支付证书配置

微信支付 APIv3 使用非对称加密，需要配置商户私钥和微信支付平台证书。

### 23.1 证书文件说明

| 文件 | 宿主机路径 | 容器内路径 | 用途 |
|------|-----------|-----------|------|
| 商户私钥 | `deploy/certs/apiclient_key.pem` | `/app/certs/apiclient_key.pem` | 请求签名 |
| 平台证书 | `deploy/certs/wechatpay_platform.pem` | `/app/certs/wechatpay_platform.pem` | 验证回调签名 |

Docker 部署时，两个证书文件通过 bind mount 挂载到容器内 `/app/certs/` 目录：

```yaml
volumes:
  - ./certs:/app/certs:ro
```

> **重要**：使用 bind mount（`./certs`）而非命名卷（`wechat_certs`），确保障书文件从宿主机 `deploy/certs/` 目录直接映射到容器内。

### 23.2 证书部署步骤

```bash
mkdir -p deploy/certs
cp apiclient_key.pem deploy/certs/
cp wechatpay_platform.pem deploy/certs/
chmod 600 deploy/certs/*
```

### 23.3 相关环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `WECHAT_PRIVATE_KEY_PATH` | 商户私钥路径（容器内） | `/app/certs/apiclient_key.pem` |
| `WECHAT_PLATFORM_CERT_PATH` | 平台证书路径（容器内） | `/app/certs/wechatpay_platform.pem` |
| `WECHAT_PLATFORM_CERT_SERIAL_NO` | 平台证书序列号 | 微信商户平台查看 |
| `WECHAT_API_V3_KEY` | APIv3 密钥 | 在微信商户平台「API安全」中设置 |
| `WECHAT_SKIP_VERIFY` | 跳过验签 | `false`（生产环境） |

### 23.4 API V3 Key 配置

API V3 Key 在微信商户平台「账户中心 → API安全」中设置，设置后填入 `.env` 的 `WECHAT_API_V3_KEY`。该密钥用于解密支付回调通知中的加密数据。

### 23.5 平台证书序列号

`WECHAT_PLATFORM_CERT_SERIAL_NO` 是微信支付平台证书的序列号，可在微信商户平台「账户中心 → API安全 → 平台证书」中查看。该序列号用于回调验签时匹配正确的平台证书。

### 23.6 回调地址配置

回调地址必须为：`https://域名/api/weapp/pay/callback`

```env
WECHAT_NOTIFY_URL=https://api.xiyun.com/api/weapp/pay/callback
```

确保：
- 域名已备案且配置了 HTTPS
- 回调地址可从微信服务器访问（防火墙/安全组放行 443 端口）
- 回调路径与代码中路由一致

### 23.7 生产环境强制配置

当 `NODE_ENV=production` 时，`WECHAT_PLATFORM_CERT_PATH` **必须配置**，否则支付模块无法启动。这是生产环境的安全保障，确保回调验签正常工作。

### 23.8 开发环境跳过验签

非生产环境可设置 `WECHAT_SKIP_VERIFY=true` 跳过微信支付回调验签，方便本地开发调试：

```env
NODE_ENV=development
WECHAT_SKIP_VERIFY=true
```

> **警告**：`WECHAT_SKIP_VERIFY=true` 仅用于开发测试环境，**绝对不能**在生产环境使用，否则存在伪造支付通知的安全风险。

---

## 24. 生产环境数据库迁移

### 24.1 迁移命令说明

生产环境使用 `prisma migrate deploy` 执行数据库迁移，**不是** `prisma db push`：

| 命令 | 适用场景 | 说明 |
|------|---------|------|
| `prisma migrate deploy` | 生产环境 | 应用所有未执行的迁移，可追踪、可回滚 |
| `prisma db push` | 开发环境 | 直接推送 schema 变更，不生成迁移记录 |

API 容器的 `entrypoint.sh` 已根据 `NODE_ENV` 自动选择迁移方式：

- `NODE_ENV=production` → 执行 `prisma migrate deploy`
- 其他环境 → 执行 `prisma db push`

### 24.2 种子数据执行

种子数据（seed）仅在 `RUN_SEED=true` 时执行。生产环境中 `RUN_SEED` 默认为 `false`，避免重复插入数据。

### 24.3 首次部署流程

```bash
cd /opt/baby-mall/deploy

docker compose up -d

RUN_SEED=true docker compose up -d
```

首次部署时需要执行两步：
1. 先 `docker compose up -d` 启动所有服务，`prisma migrate deploy` 自动执行迁移
2. 再设置 `RUN_SEED=true` 重启 API 容器，执行种子数据初始化（创建管理员账号、基础配置等）

> **注意**：`RUN_SEED=true` 仅首次部署时使用，后续更新**不要**再设置，否则可能产生重复数据。

### 24.4 后续更新流程

```bash
cd /opt/baby-mall/deploy

docker compose up -d
```

后续版本更新只需执行 `docker compose up -d`，`prisma migrate deploy` 会自动检测并执行新的迁移文件，无需手动干预。

### 24.5 迁移排查

如果迁移失败，API 容器将无法启动。排查步骤：

```bash
docker logs baby-mall-api 2>&1 | grep -i "prisma\|migrate"

docker exec baby-mall-api npx prisma migrate status
```

---

## 25. 健康检查

### 25.1 健康检查接口

`GET /api/health` 返回服务健康状态，包含数据库和 Redis 的连接状态：

```json
{
  "status": "ok",
  "timestamp": "2026-05-22T10:30:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

当某个服务不可用时，`status` 变为 `degraded`，对应服务的值为 `error`：

```json
{
  "status": "degraded",
  "timestamp": "2026-05-22T10:30:00.000Z",
  "services": {
    "database": "ok",
    "redis": "error"
  }
}
```

### 25.2 Docker 健康检查

`docker-compose.yml` 中已为 API 容器配置 healthcheck：

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

查看容器健康状态：

```bash
docker inspect --format='{{.State.Health.Status}}' baby-mall-api
```

### 25.3 负载均衡器健康检查

可将 `GET /api/health` 配置为负载均衡器的健康检查端点：

- **检查路径**：`/api/health`
- **期望状态码**：`200`
- **建议检查间隔**：30 秒
- **建议超时时间**：10 秒
- **不健康阈值**：连续 3 次失败

---

## 26. 运行时冒烟测试

### 26.1 执行方式

部署完成后，可运行冒烟测试脚本验证服务基本功能：

```bash
bash scripts/runtime-smoke-test.sh http://your-domain/api
```

本地测试：

```bash
bash scripts/runtime-smoke-test.sh http://localhost:3000/api
```

### 26.2 检查项列表

| 序号 | 检查类别 | 检查内容 | 期望结果 |
|------|---------|---------|---------|
| 1 | 健康检查 | `GET /health` | HTTP 200，body 包含 `ok` |
| 2 | 公开接口 | `GET /weapp/home/data` | HTTP 200 |
| 2 | 公开接口 | `GET /weapp/category/tree` | HTTP 200 |
| 2 | 公开接口 | `GET /weapp/product/list` | HTTP 200 |
| 3 | 权限控制 | 未登录访问 `/weapp/cart/list` | HTTP 401 |
| 3 | 权限控制 | 未登录访问 `/weapp/order/list` | HTTP 401 |
| 3 | 权限控制 | 未登录访问 `/admin/order/list` | HTTP 401 |
| 4 | 管理员登录 | `POST /admin/auth/login` | 登录成功，获取 token |
| 5 | 管理员接口 | 携带 token 访问 `/admin/auth/info` | HTTP 200 |
| 6 | 权限隔离 | 用户 token 访问 `/admin/*` | HTTP 401 或 403 |
| 7 | 支付回调 | `POST /weapp/pay/callback` | 返回原始格式（不被统一包装） |

### 26.3 结果解读

脚本执行完毕后会输出汇总结果：

```
============================================
  测试结果: ✅ 10 通过  ❌ 0 失败
============================================
```

- **全部通过**：退出码为 0，服务功能正常
- **存在失败**：退出码为 1，需根据 `❌` 标记逐项排查

> **注意**：冒烟测试中的管理员登录使用默认账号密码，生产环境部署后请及时修改管理员密码。

---

## 27. 管理员密码安全

### 27.1 生产环境密码要求

生产环境（`NODE_ENV=production`）首次部署时，**必须**通过环境变量配置强管理员密码：

```env
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=<强密码>
```

**密码规则**：
- 长度不少于 12 位
- 必须包含大写字母、小写字母、数字和特殊字符
- 不允许使用弱密码：`admin123`、`password`、`123456`、`change_this_password`

**示例强密码**：`Xiyun@2026!Prod`

### 27.2 首次登录强制改密

生产环境 seed 创建的管理员账号，`mustChangePassword` 字段默认为 `true`。

- 管理员登录后，返回数据中包含 `mustChangePassword: true`
- 管理后台应检测此字段，强制跳转到修改密码页面
- 修改密码成功后，`mustChangePassword` 自动变为 `false`
- 非生产环境默认不强制改密

### 27.3 非生产环境

非生产环境如果未配置 `ADMIN_DEFAULT_USERNAME` 和 `ADMIN_DEFAULT_PASSWORD`，允许使用默认值 `admin/admin123`，但仅限开发测试。

---

## 28. 生产冒烟测试

### 28.1 使用 ADMIN_TOKEN

生产环境无法绕过验证码，需要通过外部传入 `ADMIN_TOKEN`：

```bash
ADMIN_TOKEN="eyJhbGci..." IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

### 28.2 无 ADMIN_TOKEN

如果没有 `ADMIN_TOKEN`，管理员登录项会被标记为 SKIP，不影响核心公开接口和鉴权拦截的测试：

```bash
IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

### 28.3 测试结果

脚本输出区分三种结果：
- **PASS**：测试通过
- **FAIL**：测试失败（核心接口失败会导致 exit 1）
- **SKIP**：跳过（管理员登录在生产环境无 ADMIN_TOKEN 时跳过，不影响最终结果）

---

> **文档版本**：v1.2
> **最后更新**：2026-05-22
> **维护团队**：禧孕文化传媒有限公司技术部
