<?php
// +----------------------------------------------------------------------
// | ShopXO 国内领先企业级B2C免费开源电商系统
// +----------------------------------------------------------------------
// | Copyright (c) 2011~2099 http://shopxo.net All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( https://opensource.org/licenses/mit-license.php )
// +----------------------------------------------------------------------
// | Author: Devil
// +----------------------------------------------------------------------

// [MUYING-二开] 安全加固：三重防护防止生产环境误暴露安装入口
//
// 第一层：Nginx 配置 deny /install.php + /install/（见 deploy/nginx.production.example.conf）
// 第二层：代码级 install.lock 门禁（本文件）
// 第三层：public/install.php 已被 .gitignore 忽略，仓库中不包含安装核心文件
//
// 本项目使用 SQL 迁移脚本部署数据库，不再需要网页安装流程。
// 如需临时启用安装器，请在开发环境手动恢复 public/install.php 后使用，
// 完成后必须立即删除。

// 安装锁定检查
$lock_file = __DIR__ . '/install.lock';
if (file_exists($lock_file)) {
    header('HTTP/1.1 403 Forbidden');
    exit('系统已安装完成，安装入口已锁定。如需重新安装，请先删除 install.lock 文件后联系管理员。');
}

// [ 安装入口文件 ]
define('IS_ROOT_ACCESS', true);

// 引入公共入口文件
require './public/install.php';
?>