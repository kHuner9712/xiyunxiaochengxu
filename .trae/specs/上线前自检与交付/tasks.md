# Tasks

- [x] Task 1: 修复前端硬编码URL
  - [x] SubTask 1.1: App.vue 中 request_url 和 static_url 从 localhost 改为空字符串
  - [x] SubTask 1.2: ShopXO 前端配置获取机制确认（通过 get_config_data 接口）

- [x] Task 2: 清理前端mock数据
  - [x] SubTask 2.1: 移除 activity.vue 中的 use_mock_data_fallback 和 get_mock_data 方法
  - [x] SubTask 2.2: goods-detail.vue 母婴标签和卖点改为从后端数据读取

- [x] Task 3: 后端安全配置加固
  - [x] SubTask 3.1: config/app.php 的 show_error_msg 改为 false
  - [x] SubTask 3.2: config/app.php 的 deny_app_list 添加 install
  - [x] SubTask 3.3: 创建 .env.example 文件

- [x] Task 4: 生成交付文档
  - [x] SubTask 4.1: 生成 /docs/30-部署与发布说明.md
  - [x] SubTask 4.2: 生成 /docs/31-项目现状总览.md
  - [x] SubTask 4.3: 生成 /docs/32-已知问题清单.md
  - [x] SubTask 4.4: 生成 /docs/33-后续迭代建议.md

# Task Dependencies
- Task 1-3 无依赖，已并行完成
- Task 4 依赖 Task 1-3，已完成
