<?php
// ============================================================
// 孕禧小程序 — 上线前生产环境检查脚本 (PHP 版)
// ============================================================
//
// [MUYING-二开] 一期上线前检查脚本
//
// 【用途】检查生产环境配置是否安全、合规
// 【用法】php scripts/preflight/preflight-production-check.php [--env=/path/to/.env] [--repo=/path/to/repo]
// 【检查项】
//   1. APP_DEBUG 是否关闭
//   2. .env 是否存在但未提交到 Git
//   3. 生产 request_url 是否 https
//   4. 高风险 feature flag 是否关闭
//   5. 是否存在测试 AppID
//   6. 是否存在 localhost/127.0.0.1/明文密码等生产风险配置
//
// 【输出等级】PASS / WARN / BLOCKER
// 【退出码】0=无 BLOCKER，1=存在 BLOCKER
// ============================================================

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

$repo_path = dirname(__DIR__, 2);
$env_file = '';

for ($i = 1; $i < $argc; $i++) {
    if (strpos($argv[$i], '--env=') === 0) {
        $env_file = substr($argv[$i], 6);
    } elseif (strpos($argv[$i], '--repo=') === 0) {
        $repo_path = substr($argv[$i], 7);
    }
}

if (empty($env_file) && file_exists($repo_path . '/shopxo-backend/.env')) {
    $env_file = $repo_path . '/shopxo-backend/.env';
}

echo "\n孕禧小程序 — 上线前生产环境检查\n";
echo "仓库路径: {$repo_path}\n";
echo ".env 文件: " . ($env_file ?: '未指定') . "\n";

// ============================================================
// 1. APP_DEBUG 检查
// ============================================================
section("1. APP_DEBUG 检查");

if (!empty($env_file) && file_exists($env_file)) {
    $env_content = file_get_contents($env_file);
    if (preg_match('/APP_DEBUG\s*=\s*true/i', $env_content)) {
        block_item("APP_DEBUG = true，生产环境必须关闭");
    } elseif (preg_match('/APP_DEBUG\s*=\s*false/i', $env_content)) {
        pass_item("APP_DEBUG = false，已关闭");
    } else {
        warn_item("APP_DEBUG 未在 .env 中显式设置，请确认默认值为 false");
    }
} else {
    warn_item(".env 文件不存在或未指定，无法检查 APP_DEBUG");
}

// ============================================================
// 2. .env 是否提交到 Git
// ============================================================
section("2. .env Git 提交检查");

$gitignore_path = $repo_path . '/.gitignore';
if (file_exists($gitignore_path)) {
    $gitignore = file_get_contents($gitignore_path);
    if (preg_match('/\.env\b/', $gitignore)) {
        pass_item(".gitignore 包含 .env 规则");
    } else {
        block_item(".gitignore 未包含 .env 规则，.env 可能被提交到 Git");
    }
} else {
    warn_item(".gitignore 文件不存在");
}

$backend_gitignore = $repo_path . '/shopxo-backend/.gitignore';
if (file_exists($backend_gitignore)) {
    $bi_content = file_get_contents($backend_gitignore);
    if (preg_match('/\.env\b/', $bi_content)) {
        pass_item("shopxo-backend/.gitignore 包含 .env 规则");
    } else {
        block_item("shopxo-backend/.gitignore 未包含 .env 规则");
    }
}

if (!empty($env_file) && file_exists($env_file)) {
    $env_relative = str_replace($repo_path . '/', '', $env_file);
    $output = [];
    exec("cd " . escapeshellarg($repo_path) . " && git ls-files --error-unmatch " . escapeshellarg($env_relative) . " 2>&1", $output, $return_var);
    if ($return_var === 0) {
        block_item(".env 文件已被 Git 跟踪: {$env_relative}，必须从版本控制中移除");
    } else {
        pass_item(".env 文件未被 Git 跟踪");
    }
}

// ============================================================
// 3. 生产 request_url 是否 https
// ============================================================
section("3. 生产 request_url HTTPS 检查");

$prod_env_path = $repo_path . '/shopxo-uniapp/.env.production';
if (file_exists($prod_env_path)) {
    $prod_env = file_get_contents($prod_env_path);
    if (preg_match('/UNI_APP_REQUEST_URL\s*=\s*(.+)/', $prod_env, $m)) {
        $url = trim($m[1]);
        if (strpos($url, 'https://') === 0) {
            pass_item("生产 request_url 使用 HTTPS: {$url}");
        } elseif (strpos($url, 'http://') === 0) {
            block_item("生产 request_url 使用 HTTP（不安全）: {$url}");
        } elseif (strpos($url, '你的') !== false || strpos($url, '{{') !== false) {
            block_item("生产 request_url 仍为占位符: {$url}");
        } else {
            warn_item("生产 request_url 格式异常: {$url}");
        }
    } else {
        warn_item("生产 .env.production 中未找到 UNI_APP_REQUEST_URL");
    }
} else {
    $prod_example = $repo_path . '/shopxo-uniapp/.env.production.example';
    if (file_exists($prod_example)) {
        warn_item(".env.production 不存在（仅有 .example），请确认已创建正式配置");
    }
}

// ============================================================
// 4. 高风险 feature flag 检查
// ============================================================
section("4. 高风险功能开关检查");

$high_risk_flags = [
    'feature_distribution_enabled' => '分销/多级返佣',
    'feature_wallet_enabled'      => '钱包/余额/提现',
    'feature_coin_enabled'        => '虚拟币',
    'feature_shop_enabled'        => '第三方商家入驻',
    'feature_realstore_enabled'   => '门店/多门店',
    'feature_hospital_enabled'    => '医疗咨询/问诊',
    'feature_seckill_enabled'     => '秒杀',
    'feature_live_enabled'        => '直播',
    'feature_video_enabled'       => '视频',
];

if (!empty($env_file) && file_exists($env_file)) {
    $env_content = file_get_contents($env_file);
    foreach ($high_risk_flags as $flag => $desc) {
        if (preg_match('/' . preg_quote($flag, '/') . '\s*=\s*1/i', $env_content)) {
            block_item("高风险功能开关已启用: {$flag}（{$desc}），一期不应启用");
        } else {
            pass_item("高风险功能开关已关闭: {$flag}（{$desc}）");
        }
    }
} else {
    foreach ($high_risk_flags as $flag => $desc) {
        warn_item("无法检查功能开关: {$flag}（{$desc}），.env 不可用");
    }
}

// ============================================================
// 5. 测试 AppID 检查
// ============================================================
section("5. 测试 AppID 检查");

$test_appids = ['wx1234567890', 'wx0000000000', 'wxdemo', 'wxtest', 'touristappid'];
$files_to_check = [];

$uniapp_dir = $repo_path . '/shopxo-uniapp';
if (is_dir($uniapp_dir)) {
    $env_files = glob($uniapp_dir . '/.env*');
    $manifest_files = [$uniapp_dir . '/manifest.json', $uniapp_dir . '/manifest.local.json'];
    $project_config = $uniapp_dir . '/project.config.json';
    $files_to_check = array_merge($env_files, $manifest_files, [$project_config]);
}

foreach ($files_to_check as $file) {
    if (!file_exists($file)) {
        continue;
    }
    $content = file_get_contents($file);
    $basename = basename($file);
    foreach ($test_appids as $test_id) {
        if (stripos($content, $test_id) !== false) {
            block_item("发现测试 AppID '{$test_id}' 在文件: {$basename}");
        }
    }
}
pass_item("测试 AppID 检查完成");

// ============================================================
// 6. 生产风险配置检查
// ============================================================
section("6. 生产风险配置检查");

$risk_patterns = [
    'localhost'     => 'localhost 地址',
    '127.0.0.1'     => '127.0.0.1 本地地址',
    '0.0.0.0'       => '0.0.0.0 绑定地址',
    'password'      => '明文密码占位符',
    'root'          => 'root 默认用户名',
    'test'          => 'test 测试标识',
];

$check_dirs = [
    $repo_path . '/shopxo-backend/.env',
    $repo_path . '/shopxo-uniapp/.env.production',
];

$found_risks = false;
foreach ($check_dirs as $file) {
    if (!file_exists($file)) {
        continue;
    }
    $content = file_get_contents($file);
    $basename = str_replace($repo_path . '/', '', $file);

    if (preg_match('/UNI_APP_REQUEST_URL\s*=\s*.*(?:localhost|127\.0\.0\.1)/i', $content)) {
        block_item("生产配置包含本地地址: {$basename} → UNI_APP_REQUEST_URL");
        $found_risks = true;
    }

    if (preg_match('/DATABASE\s*\].*?USERNAME\s*=\s*root/is', $content)) {
        block_item("数据库使用 root 用户: {$basename}");
        $found_risks = true;
    }

    if (preg_match('/PASSWORD\s*=\s*(?:123456|password|root|admin|test)/i', $content)) {
        block_item("数据库密码为弱密码: {$basename}");
        $found_risks = true;
    }

    if (preg_match('/UNI_APP_WX_APPID\s*=\s*(?:你的|{{|wx\d{10}})/i', $content)) {
        block_item("微信 AppID 仍为占位符: {$basename}");
        $found_risks = true;
    }
}

if (!$found_risks) {
    pass_item("未发现生产风险配置");
}

// ============================================================
// 汇总
// ============================================================
section("检查汇总");

$total = $pass_count + $warn_count + $block_count;
echo "  PASS: {$pass_count}  WARN: {$warn_count}  BLOCKER: {$block_count}  总计: {$total}\n\n";

if ($block_count > 0) {
    echo "存在 {$block_count} 个 BLOCKER → 关键配置不安全，不可上线\n\n";
    foreach ($blocker_items as $item) {
        echo "  ✗ {$item}\n";
    }
    echo "\n修复后重新运行:\n";
    echo "  php scripts/preflight/preflight-production-check.php --env=/path/to/.env\n\n";
    echo "退出码: 1\n";
    exit(1);
} elseif ($warn_count > 0) {
    echo "存在 {$warn_count} 个 WARN → 可上线但建议修复\n\n";
    foreach ($warn_items as $item) {
        echo "  ⚠ {$item}\n";
    }
    echo "\n退出码: 0\n";
    exit(0);
} else {
    echo "全部通过 → 生产环境配置安全\n\n";
    echo "退出码: 0\n";
    exit(0);
}
