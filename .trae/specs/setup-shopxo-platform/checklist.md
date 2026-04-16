# Checklist

- [x] 工作区根目录下 `shopxo-backend`、`shopxo-uniapp`、`docs` 三个目录已创建
- [x] ShopXO 后端代码已克隆到 `shopxo-backend` 目录，关键目录（app/、config/、public/）存在
- [x] 后端 Composer 依赖已安装，`vendor/` 目录存在且无报错
- [x] ShopXO uni-app 前端代码已克隆到 `shopxo-uniapp` 目录，关键文件（manifest.json、pages.json）存在
- [x] 前端 npm 依赖已安装，`node_modules/` 目录存在且无报错
- [x] 本地 PHP 环境满足要求（Docker PHP 8.1-FPM，必要扩展已启用）
- [x] MySQL 数据库 `shopxo` 已创建（字符集 utf8mb4）
- [x] 后端数据库连接配置已正确填写（config/database.php 已生成）
- [x] 后端可通过 Docker Nginx 访问，`http://localhost:8080` 返回 200
- [x] ShopXO 安装向导已完成，82 张数据表已初始化
- [x] 管理后台可正常访问（adminwlmqhs.php 返回 200）
- [x] uni-app 前端 API 地址已配置指向本地后端（App.vue request_url/static_url）
- [x] uni-app 前端需通过 HBuilderX 编译运行（项目为 HBuilderX 项目，urlCheck 已关闭）
- [x] `/docs/01-项目结构说明.md` 已生成且内容完整
- [x] `/docs/02-本地启动说明.md` 已生成且内容完整
- [x] `/docs/03-已完成事项与阻塞项.md` 已生成且内容完整
