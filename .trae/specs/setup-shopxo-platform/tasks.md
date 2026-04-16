# Tasks

- [x] Task 1: 创建目录结构
  - [x] SubTask 1.1: 在工作区根目录创建 `shopxo-backend`、`shopxo-uniapp`、`docs` 三个目录

- [x] Task 2: 拉取 ShopXO 后端代码
  - [x] SubTask 2.1: 从 `https://github.com/gongfuxiang/shopxo` 克隆代码到 `shopxo-backend` 目录
  - [x] SubTask 2.2: 检查后端项目结构，确认关键目录（app/、config/、public/）存在
  - [x] SubTask 2.3: 执行 `composer install` 安装 PHP 依赖

- [x] Task 3: 拉取 ShopXO uni-app 前端代码
  - [x] SubTask 3.1: 从 `https://github.com/gongfuxiang/shopxo-uniapp` 克隆代码到 `shopxo-uniapp` 目录
  - [x] SubTask 3.2: 检查前端项目结构，确认关键文件（manifest.json、pages.json、App.vue）存在
  - [x] SubTask 3.3: 执行 `npm install` 安装前端依赖

- [x] Task 4: 配置并启动后端
  - [x] SubTask 4.1: 检查本地 PHP 环境（使用 Docker 替代）
  - [x] SubTask 4.2: 创建 `shopxo` 数据库（utf8mb4），通过 Docker MySQL 容器
  - [x] SubTask 4.3: 配置后端数据库连接（通过安装向导自动生成 config/database.php）
  - [x] SubTask 4.4: 使用 Docker Nginx + PHP-FPM 启动后端（端口 8080）
  - [x] SubTask 4.5: 验证后端可访问（http://localhost:8080 返回 200）

- [x] Task 5: 完成后端安装向导
  - [x] SubTask 5.1: 通过 API 调用完成安装向导
  - [x] SubTask 5.2: 填写数据库信息和管理员账号，完成安装（82 张表创建成功）
  - [x] SubTask 5.3: 验证管理后台可访问（adminwlmqhs.php 返回 200）

- [x] Task 6: 配置 uni-app 前端对接后端
  - [x] SubTask 6.1: 找到 API 地址配置文件（App.vue 第 10-13 行）
  - [x] SubTask 6.2: 修改 request_url 和 static_url 指向本地后端 `http://localhost:8080/`
  - [x] SubTask 6.3: 确认 manifest.json 中微信小程序 urlCheck 已设为 false
  - [x] SubTask 6.4: 前端需通过 HBuilderX 编译运行（项目为 HBuilderX 项目）

- [x] Task 7: 生成项目文档
  - [x] SubTask 7.1: 生成 `/docs/01-项目结构说明.md`
  - [x] SubTask 7.2: 生成 `/docs/02-本地启动说明.md`
  - [x] SubTask 7.3: 生成 `/docs/03-已完成事项与阻塞项.md`

# Task Dependencies
- Task 2 依赖 Task 1（需要目录先存在）
- Task 3 依赖 Task 1（需要目录先存在）
- Task 2 和 Task 3 可并行执行
- Task 4 依赖 Task 2（需要后端代码和依赖就绪）
- Task 5 依赖 Task 4（需要后端可运行）
- Task 6 依赖 Task 3 和 Task 5（需要前端代码就绪且后端可响应）
- Task 7 依赖 Task 1-6 全部完成
