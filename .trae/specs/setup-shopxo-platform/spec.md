# ShopXO 微信商城小程序底座搭建 Spec

## Why

需要在本地搭建一个基于 ShopXO 官方开源项目的可运行微信商城小程序底座，作为后续业务二开的基础。当前工作区为空，需要从零完成环境搭建、代码拉取、配置对接、本地运行。

## What Changes

- 创建 `/shopxo-backend`、`/shopxo-uniapp`、`/docs` 三级目录结构
- 从 GitHub 拉取 ShopXO 后端仓库（`gongfuxiang/shopxo`）和 uni-app 手机端仓库（`gongfuxiang/shopxo-uniapp`）
- 配置后端 PHP 运行环境（依赖 Composer、PHP 8.0+、MySQL 5.7+）
- 配置数据库并完成 ShopXO 安装向导
- 配置 uni-app 前端 API 地址指向本地后端
- 生成项目结构说明、本地启动说明、已完成事项与阻塞项三份文档

## Impact

- Affected code: 全新项目，无既有代码影响
- Affected systems: 本地 PHP 运行环境、MySQL 数据库、Node.js/npm 环境
- Dependencies: Git、PHP 8.0+、Composer、MySQL 5.7+、Node.js 14+、微信开发者工具（可选）

## ADDED Requirements

### Requirement: 目录结构创建

系统 SHALL 在工作区根目录下创建 `shopxo-backend`、`shopxo-uniapp`、`docs` 三个目录。

#### Scenario: 目录创建成功

- **WHEN** 执行目录创建操作
- **THEN** 三个目录均存在且为空

### Requirement: 后端代码拉取与依赖安装

系统 SHALL 从 `https://github.com/gongfuxiang/shopxo` 拉取稳定分支代码到 `shopxo-backend` 目录，并执行 `composer install` 安装 PHP 依赖。

#### Scenario: 代码拉取成功

- **WHEN** 执行 git clone
- **THEN** `shopxo-backend` 目录包含完整的 ShopXO 后端代码，包括 `app/`、`config/`、`public/`、`vendor/` 等目录

#### Scenario: Composer 依赖安装成功

- **WHEN** 在 `shopxo-backend` 目录执行 `composer install`
- **THEN** `vendor/` 目录生成且无报错

### Requirement: uni-app 前端代码拉取与依赖安装

系统 SHALL 从 `https://github.com/gongfuxiang/shopxo-uniapp` 拉取稳定分支代码到 `shopxo-uniapp` 目录，并执行 `npm install` 安装前端依赖。

#### Scenario: 代码拉取成功

- **WHEN** 执行 git clone
- **THEN** `shopxo-uniapp` 目录包含完整的 uni-app 项目代码

#### Scenario: npm 依赖安装成功

- **WHEN** 在 `shopxo-uniapp` 目录执行 `npm install`
- **THEN** `node_modules/` 目录生成且无报错

### Requirement: 后端本地可运行

系统 SHALL 配置 PHP 内置服务器或等效方式使后端可本地访问，管理后台可通过浏览器打开。

#### Scenario: 后端启动成功

- **WHEN** 启动 PHP 内置服务器指向 `public/` 目录
- **THEN** 浏览器访问 `http://localhost:8080` 可看到 ShopXO 首页或安装向导

#### Scenario: 安装向导可访问

- **WHEN** 浏览器访问 `http://localhost:8080/install.php`
- **THEN** 显示 ShopXO 安装向导页面

### Requirement: 数据库可初始化

系统 SHALL 创建 MySQL 数据库 `shopxo`（字符集 utf8mb4），并通过安装向导完成数据表初始化。

#### Scenario: 数据库创建成功

- **WHEN** 执行 CREATE DATABASE 语句
- **THEN** `shopxo` 数据库存在且字符集为 utf8mb4

#### Scenario: 安装向导完成

- **WHEN** 通过安装向导填写数据库信息并提交
- **THEN** 所有数据表创建成功，管理员账号可用

### Requirement: uni-app 前端对接后端

系统 SHALL 在 uni-app 项目中配置 API 地址，使前端请求可到达本地后端。

#### Scenario: API 地址配置完成

- **WHEN** 修改 uni-app 配置文件中的 request_url / static_url
- **THEN** 前端发起的 HTTP 请求指向 `http://localhost:8080/api.php`

#### Scenario: 前端可编译运行

- **WHEN** 执行 `npm run dev:h5` 或 `npm run dev:mp-weixin`
- **THEN** 前端项目可正常编译并运行

### Requirement: 项目文档生成

系统 SHALL 在 `/docs` 目录下生成三份文档：项目结构说明、本地启动说明、已完成事项与阻塞项。

#### Scenario: 文档生成完成

- **WHEN** 所有搭建步骤执行完毕
- **THEN** `/docs/01-项目结构说明.md`、`/docs/02-本地启动说明.md`、`/docs/03-已完成事项与阻塞项.md` 三份文件存在且内容完整

## MODIFIED Requirements

无（全新项目）

## REMOVED Requirements

无（全新项目）
