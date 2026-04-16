# 上线前自检与交付整理 Spec

## Why
MVP 闭环开发已完成，但项目存在硬编码URL、mock数据回退、配置安全隐患、功能未完成标记等问题，需要系统性自检、修复易修问题、归档剩余问题，并输出交付文档，使非专业用户也能接手。

## What Changes
- 修复 App.vue 硬编码 localhost URL（改为环境感知配置）
- 移除 activity.vue 的 mock 数据回退逻辑
- 修复 config/app.php 安全配置（show_error_msg、deny_app_list）
- 创建 .env.example 文件
- 修复 goods-detail.vue mock 标记
- 生成4份交付文档

## Impact
- Affected code: App.vue, activity.vue, goods-detail.vue, config/app.php
- Affected docs: 新增4份交付文档

## ADDED Requirements

### Requirement: 环境配置安全
系统 SHALL 不在代码中硬编码敏感配置，使用环境变量或配置接口管理。

#### Scenario: 前端API地址配置
- **WHEN** 小程序启动时
- **THEN** request_url 和 static_url 通过配置接口获取，而非硬编码 localhost

### Requirement: Mock数据清理
系统 SHALL 不在生产代码中保留 mock 数据回退逻辑。

#### Scenario: 活动列表API失败
- **WHEN** 活动列表API请求失败
- **THEN** 显示空数据提示，而非使用 mock 数据填充

### Requirement: 安全配置加固
系统 SHALL 在生产环境中隐藏错误详情、禁止直接访问安装程序。

#### Scenario: 生产环境错误
- **WHEN** 后端发生异常
- **THEN** 不向用户展示内部错误详情

### Requirement: 交付文档
系统 SHALL 提供完整的部署说明、项目现状、已知问题和迭代建议文档。

## MODIFIED Requirements
无

## REMOVED Requirements
无
