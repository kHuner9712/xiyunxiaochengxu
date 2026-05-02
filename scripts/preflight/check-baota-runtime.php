#!/usr/bin/env php
<?php
/**
 * [MUYING-二开] 宝塔运行环境检查脚本
 *
 * 用途：检查宝塔服务器 PHP 运行环境是否满足禧孕小程序部署要求
 * 用法：php scripts/preflight/check-baota-runtime.php [--root=/path/to/shopxo-backend]
 *
 * 检查项：
 *   1. PHP 版本 8.1.x
 *   2. PHP 必需扩展（openssl/pdo_mysql/fileinfo/mbstring/curl/gd/json/simplexml/xml/zip）
 *   3. runtime 目录可写
 *   4. public 为网站根目录
 *   5. .env 不可公网访问
 *   6. APP_DEBUG = false
 *   7. MUYING_PRIVACY_KEY 存在
 *   8. 数据库连接正常
 *   9. 关键表存在
 *
 * 输出等级：PASS / WARN / BLOCKER
 * 退出码：0=无 BLOCKER，1=存在 BLOCKER
 */

$pass_count = 0;
$warn_count = 0;
$block_count = 0;
$blocker_items = [];
$warn_items = [];

function pass_item($msg) {
    global $pass_count;
    $pass_count++;
    echo "[PASS] {$msg}\n";
}

function warn_item($msg) {
    global $warn_count, $warn_items;
    $warn_count++;
    $warn_items[] = $msg;
    echo "[WARN] {$msg}\n";
}

function block_item($msg) {
    global $block_count, $blocker_items;
    $block_count++;
    $blocker_items[] = $msg;
    echo "[BLOCKER] {$msg}\n";
}

function section($title) {
    echo "\n==========================================\n";
    echo " {$title}\n";
    echo "==========================================\n";
}

$backendRoot = '';
for ($i = 1; $i < $argc; $i++) {
    if (strpos($argv[$i], '--root=') === 0) {
        $backendRoot = substr($argv[$i], 7);
    }
}

if (empty($backendRoot)) {
    $backendRoot = realpath(__DIR__ . '/../../shopxo-backend');
}

echo "\n禧孕小程序 — 宝塔运行环境检查\n";
echo "后端目录: " . ($backendRoot ?: '未指定') . "\n";
echo "PHP 版本: " . PHP_VERSION . "\n";

// ============================================================
// 1. PHP 版本检查
// ============================================================
section("1. PHP 版本检查");

if (version_compare(PHP_VERSION, '8.1.0', '>=')) {
    if (version_compare(PHP_VERSION, '8.2.0', '<')) {
        pass_item("PHP 版本 " . PHP_VERSION . "（8.1.x，推荐）");
    } else {
        warn_item("PHP 版本 " . PHP_VERSION . "（≥8.2，未经测试，建议使用 8.1.x）");
    }
} elseif (version_compare(PHP_VERSION, '8.0.2', '>=')) {
    warn_item("PHP 版本 " . PHP_VERSION . "（8.0.x 可运行，建议升级到 8.1.x）");
} else {
    block_item("PHP 版本 " . PHP_VERSION . "（<8.0.2，不满足 ShopXO 6.x 要求）");
}

// ============================================================
// 2. PHP 扩展检查
// ============================================================
section("2. PHP 扩展检查");

$required_extensions = [
    'openssl'    => 'AES-256-CBC 隐私加密、支付签名、微信对接',
    'pdo_mysql'  => 'MySQL 数据库连接驱动',
    'pdo'        => 'PDO 抽象层',
    'fileinfo'   => 'phpspreadsheet Excel 导入导出',
    'mbstring'   => '多字节字符串处理（中文必备）',
    'curl'       => 'HTTP 请求、支付对接、微信 API',
    'gd'         => '图片处理（验证码/缩略图/水印）',
    'json'       => 'JSON 编解码',
    'simplexml'  => 'XML 解析（支付回调）',
    'xml'        => 'XML 解析',
    'zip'        => '压缩/解压（数据导出）',
];

$optional_extensions = [
    'redis' => '缓存加速（不装则回退文件缓存）',
];

foreach ($required_extensions as $ext => $desc) {
    if (extension_loaded($ext)) {
        pass_item("扩展 {$ext} 已加载（{$desc}）");
    } else {
        block_item("扩展 {$ext} 未加载（{$desc}）— 宝塔面板 → PHP 管理 → 安装扩展");
    }
}

foreach ($optional_extensions as $ext => $desc) {
    if (extension_loaded($ext)) {
        pass_item("可选扩展 {$ext} 已加载（{$desc}）");
    } else {
        warn_item("可选扩展 {$ext} 未加载（{$desc}）— 建议安装以提升性能");
    }
}

// ============================================================
// 3. 目录权限检查
// ============================================================
section("3. 目录权限检查");

if (!empty($backendRoot) && is_dir($backendRoot)) {
    $runtimePath = $backendRoot . '/runtime';
    if (is_dir($runtimePath)) {
        if (is_writable($runtimePath)) {
            pass_item("runtime 目录可写（{$runtimePath}）");
        } else {
            block_item("runtime 目录不可写（{$runtimePath}）— chmod -R 755 runtime && chown www:www runtime");
        }
    } else {
        warn_item("runtime 目录不存在（{$runtimePath}）— 首次访问会自动创建，确保父目录可写");
    }

    $publicPath = $backendRoot . '/public';
    if (is_dir($publicPath)) {
        pass_item("public 目录存在（{$publicPath}）");
    } else {
        block_item("public 目录不存在（{$publicPath}）— 项目结构异常");
    }

    $uploadPath = $backendRoot . '/public/upload';
    if (is_dir($uploadPath)) {
        if (is_writable($uploadPath)) {
            pass_item("public/upload 目录可写");
        } else {
            block_item("public/upload 目录不可写 — 图片上传将失败");
        }
    } else {
        warn_item("public/upload 目录不存在 — 需手动创建并设置权限");
    }
} else {
    block_item("后端目录不存在或不可访问（{$backendRoot}）");
}

// ============================================================
// 4. Nginx 配置检查
// ============================================================
section("4. Nginx / 公网访问检查");

if (!empty($backendRoot) && is_dir($backendRoot . '/public')) {
    $indexPath = $backendRoot . '/public/index.php';
    if (file_exists($indexPath)) {
        pass_item("public/index.php 入口文件存在");
    } else {
        block_item("public/index.php 入口文件不存在");
    }

    $envPath = $backendRoot . '/.env';
    if (file_exists($envPath)) {
        $envContent = file_get_contents($envPath);

        if (preg_match('/APP_DEBUG\s*=\s*(true|1|yes)/i', $envContent)) {
            block_item("APP_DEBUG = true，生产环境必须关闭");
        } elseif (preg_match('/APP_DEBUG\s*=\s*(false|0|no)/i', $envContent)) {
            pass_item("APP_DEBUG = false");
        } else {
            warn_item("APP_DEBUG 未显式设置，请确认默认值为 false");
        }

        if (preg_match('/MUYING_PRIVACY_KEY\s*=\s*(.+)/', $envContent, $m)) {
            $key = trim($m[1]);
            if (empty($key) || $key === '{{PRIVACY_KEY}}' || strlen($key) < 16) {
                block_item("MUYING_PRIVACY_KEY 未配置或过短（当前长度: " . strlen($key) . "）");
            } else {
                pass_item("MUYING_PRIVACY_KEY 已配置（长度: " . strlen($key) . "）");
            }
        } else {
            block_item("MUYING_PRIVACY_KEY 未在 .env 中设置");
        }

        if (preg_match('/DATABASE\s*\].*?HOSTNAME\s*=\s*(.+)/is', $envContent, $m)) {
            $dbHost = trim($m[1]);
            if ($dbHost === '127.0.0.1' || $dbHost === 'localhost') {
                pass_item("数据库连接使用本地地址（{$dbHost}）");
            } else {
                warn_item("数据库连接使用远程地址（{$dbHost}），请确认 MySQL 3306 不开放公网");
            }
        }
    } else {
        warn_item(".env 文件不存在，请从 .env.production.example 复制并配置");
    }
}

echo "\n[INFO] 以下项需在浏览器中手动验证:\n";
echo "  - Nginx 网站根目录指向 public/（不是项目根目录）\n";
echo "  - 访问 https://域名/.env 返回 403/404（不返回文件内容）\n";
echo "  - 访问 https://域名/runtime/ 返回 403/404\n";
echo "  - 伪静态选择 thinkphp（宝塔 → 网站 → 伪静态）\n";

// ============================================================
// 5. 数据库连接检查
// ============================================================
section("5. 数据库连接检查");

if (!empty($backendRoot) && file_exists($backendRoot . '/.env')) {
    $envContent = file_get_contents($backendRoot . '/.env');

    $dbConfig = [];
    if (preg_match('/DATABASE\s*\](.*?)\[/s', $envContent, $section)) {
        $sectionText = $section[1];
    } else {
        $sectionText = $envContent;
    }

    if (preg_match('/HOSTNAME\s*=\s*(.+)/i', $sectionText, $m)) $dbConfig['host'] = trim($m[1]);
    if (preg_match('/DATABASE\s*=\s*(.+)/i', $sectionText, $m)) $dbConfig['dbname'] = trim($m[1]);
    if (preg_match('/USERNAME\s*=\s*(.+)/i', $sectionText, $m)) $dbConfig['user'] = trim($m[1]);
    if (preg_match('/PORT\s*=\s*(\d+)/i', $sectionText, $m)) $dbConfig['port'] = intval($m[1]);

    if (!empty($dbConfig['host']) && !empty($dbConfig['dbname'])) {
        pass_item("数据库配置: host={$dbConfig['host']}, db={$dbConfig['dbname']}" . (isset($dbConfig['port']) ? ", port={$dbConfig['port']}" : ""));

        if (extension_loaded('pdo_mysql')) {
            try {
                $port = $dbConfig['port'] ?? 3306;
                $dsn = "mysql:host={$dbConfig['host']};port={$port};dbname={$dbConfig['dbname']};charset=utf8mb4";
                $password = '';
                if (preg_match('/PASSWORD\s*=\s*(.+)/i', $sectionText, $m)) $password = trim($m[1]);
                $pdo = new PDO($dsn, $dbConfig['user'] ?? 'root', $password, [PDO::ATTR_TIMEOUT => 5]);
                pass_item("数据库连接成功");

                $required_tables = [
                    'sxo_activity', 'sxo_activity_signup', 'sxo_invite_reward',
                    'sxo_muying_feedback', 'sxo_muying_audit_log', 'sxo_muying_compliance_log',
                    'sxo_muying_stat_snapshot', 'sxo_user', 'sxo_goods', 'sxo_goods_favor',
                    'sxo_config', 'sxo_order',
                ];

                foreach ($required_tables as $table) {
                    try {
                        $stmt = $pdo->query("SELECT 1 FROM `{$table}` LIMIT 1");
                        if ($stmt) {
                            pass_item("表 {$table} 存在");
                        }
                    } catch (PDOException $e) {
                        block_item("表 {$table} 不存在 — 请执行 docs/muying-final-migration.sql");
                    }
                }
            } catch (PDOException $e) {
                block_item("数据库连接失败: " . $e->getMessage());
            }
        } else {
            block_item("pdo_mysql 扩展未加载，无法测试数据库连接");
        }
    } else {
        warn_item(".env 中数据库配置不完整，无法测试连接");
    }
} else {
    warn_item(".env 文件不存在，跳过数据库连接检查");
}

// ============================================================
// 6. 关键配置文件检查
// ============================================================
section("6. 关键配置文件检查");

if (!empty($backendRoot)) {
    $configFiles = [
        'config/database.php' => '数据库配置（从 .env 读取）',
        'config/domain.php'   => '域名绑定配置',
        'config/app.php'      => '应用配置',
    ];

    foreach ($configFiles as $file => $desc) {
        $fullPath = $backendRoot . '/' . $file;
        if (file_exists($fullPath)) {
            pass_item("{$file} 存在（{$desc}）");
        } else {
            $warn_level = ($file === 'config/domain.php') ? 'warn' : 'block';
            if ($warn_level === 'warn') {
                warn_item("{$file} 不存在（{$desc}）— 非必须，按需创建");
            } else {
                block_item("{$file} 不存在（{$desc}）— 必须创建");
            }
        }
    }

    $adminEntry = '';
    $publicDir = $backendRoot . '/public';
    if (is_dir($publicDir)) {
        $entries = glob($publicDir . '/admin*.php');
        if (!empty($entries)) {
            $adminEntry = basename($entries[0]);
            if ($adminEntry === 'admin.php') {
                warn_item("后台入口为 admin.php（默认名称，建议混淆）— 宝塔面板重命名");
            } else {
                pass_item("后台入口已混淆（{$adminEntry}）");
            }
        } else {
            warn_item("未找到后台入口文件（admin*.php）");
        }
    }

    $installFile = $backendRoot . '/public/install.php';
    if (file_exists($installFile)) {
        block_item("install.php 仍存在 — 部署后必须删除或禁用");
    } else {
        pass_item("install.php 已删除");
    }
}

// ============================================================
// 汇总
// ============================================================
section("检查汇总");

$total = $pass_count + $warn_count + $block_count;
echo "  PASS: {$pass_count}  WARN: {$warn_count}  BLOCKER: {$block_count}  总计: {$total}\n\n";

if ($block_count > 0) {
    echo "存在 {$block_count} 个 BLOCKER → 环境不满足部署要求，不可上线\n\n";
    foreach ($blocker_items as $item) {
        echo "  ✗ {$item}\n";
    }
    echo "\n修复后重新运行:\n";
    echo "  php scripts/preflight/check-baota-runtime.php\n\n";
    echo "退出码: 1\n";
    exit(1);
} elseif ($warn_count > 0) {
    echo "存在 {$warn_count} 个 WARN → 可部署但建议修复\n\n";
    foreach ($warn_items as $item) {
        echo "  ⚠ {$item}\n";
    }
    echo "\n退出码: 0\n";
    exit(0);
} else {
    echo "全部通过 → 宝塔运行环境满足部署要求\n\n";
    echo "退出码: 0\n";
    exit(0);
}
