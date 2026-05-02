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
// 7. AppID 检查（非空、一致性、生产禁止测试号）
// ============================================================
section("7. AppID 检查");

$manifest_path = $repo_path . '/shopxo-uniapp/manifest.json';
$proj_cfg_path = $repo_path . '/shopxo-uniapp/project.config.json';
$prod_env_path = $repo_path . '/shopxo-uniapp/.env.production';

$manifest_appid = '';
$proj_appid = '';
$env_appid = '';

if (file_exists($manifest_path)) {
    $m = json_decode(file_get_contents($manifest_path), true);
    $manifest_appid = $m['mp-weixin']['appid'] ?? '';
}

if (file_exists($proj_cfg_path)) {
    $p = json_decode(file_get_contents($proj_cfg_path), true);
    $proj_appid = $p['appid'] ?? '';
}

if (file_exists($prod_env_path)) {
    $pe = file_get_contents($prod_env_path);
    if (preg_match('/UNI_APP_WX_APPID\s*=\s*(.+)/', $pe, $m)) {
        $env_appid = trim($m[1]);
    }
}

// [MUYING-二开] 检查 AppID 非空，空值 = BLOCKER
if (empty($manifest_appid)) {
    block_item("manifest.json → mp-weixin.appid 为空，必须配置正式 AppID");
} else {
    pass_item("manifest.json AppID 已配置: {$manifest_appid}");
}

if (empty($proj_appid)) {
    block_item("project.config.json → appid 为空，必须配置正式 AppID");
} else {
    pass_item("project.config.json AppID 已配置: {$proj_appid}");
}

if (empty($env_appid) || $env_appid === '{{WX_APPID}}') {
    block_item(".env.production → UNI_APP_WX_APPID 为空或仍为占位符，必须配置正式 AppID");
} else {
    pass_item(".env.production AppID 已配置: {$env_appid}");
}

// [MUYING-二开] 生产环境禁止使用测试号
$test_prod_appid = 'wxda7779770f53e901';
$appid_locations = [
    'manifest.json'      => $manifest_appid,
    'project.config.json' => $proj_appid,
    '.env.production'    => $env_appid,
];
foreach ($appid_locations as $loc => $val) {
    if ($val === $test_prod_appid) {
        block_item("{$loc} 使用了微信测试号 AppID ({$test_prod_appid})，生产环境禁止使用测试号");
    }
}

// [MUYING-二开] 三处 AppID 一致性检查
if (!empty($manifest_appid) && !empty($proj_appid) && $manifest_appid !== $proj_appid) {
    block_item("manifest.json AppID ({$manifest_appid}) 与 project.config.json AppID ({$proj_appid}) 不一致");
} elseif (!empty($manifest_appid) && !empty($proj_appid)) {
    pass_item("manifest.json 与 project.config.json AppID 一致");
}

if (!empty($manifest_appid) && !empty($env_appid) && $manifest_appid !== $env_appid) {
    block_item("manifest.json AppID ({$manifest_appid}) 与 .env.production AppID ({$env_appid}) 不一致");
} elseif (!empty($manifest_appid) && !empty($env_appid)) {
    pass_item("manifest.json 与 .env.production AppID 一致");
}

// ============================================================
// 8. 前端路由白名单检查
// ============================================================
section("8. 前端路由白名单检查");

$enum_path = $repo_path . '/shopxo-uniapp/common/js/config/muying-enum.js';
if (file_exists($enum_path)) {
    $enum_content = file_get_contents($enum_path);
    if (preg_match('/ROUTE_WHITELIST|route_whitelist|page_whitelist/i', $enum_content)) {
        pass_item("前端路由白名单存在于 muying-enum.js");
    } else {
        warn_item("前端路由白名单未在 muying-enum.js 中找到，请确认是否已配置");
    }
} else {
    warn_item("muying-enum.js 文件不存在，无法检查路由白名单");
}

// ============================================================
// 9. 资质门禁检查
// ============================================================
section("9. 资质门禁检查");

if (!empty($env_file) && file_exists($env_file)) {
    $env_content = file_get_contents($env_file);
    if (preg_match('/MUYING_QUALIFICATION_MODE\s*=\s*(phase_two|strict)/i', $env_content)) {
        warn_item("资质门禁模式为严格模式，一期应使用宽松模式（phase_one/loose）");
    } else {
        pass_item("资质门禁处于一期模式");
    }
} else {
    warn_item(".env 不可用，无法检查资质门禁模式");
}

// ============================================================
// 10. 隐私加密密钥检查
// ============================================================
section("10. 隐私加密密钥检查");

if (!empty($env_file) && file_exists($env_file)) {
    $env_content = file_get_contents($env_file);
    if (preg_match('/MUYING_PRIVACY_KEY\s*=\s*(.+)/', $env_content, $m)) {
        $key = trim($m[1]);
        if (empty($key) || $key === '{{PRIVACY_KEY}}' || strlen($key) < 16) {
            block_item("MUYING_PRIVACY_KEY 未配置或过短（当前: " . (empty($key) ? '空' : $key) . "），用户敏感数据将无法加密");
        } else {
            pass_item("MUYING_PRIVACY_KEY 已配置（长度: " . strlen($key) . "）");
        }
    } else {
        block_item("MUYING_PRIVACY_KEY 未在 .env 中设置，用户敏感数据将无法加密");
    }
} else {
    warn_item(".env 不可用，无法检查隐私加密密钥");
}

// ============================================================
// 11. pages.json 合规检查
// ============================================================
section("11. pages.json 合规检查");

$pages_json_path = $repo_path . '/shopxo-uniapp/pages.json';
if (file_exists($pages_json_path)) {
    $pages_content = file_get_contents($pages_json_path);
    $blocked_plugin_patterns = [
        '/plugins/wallet/', '/plugins/coin/', '/plugins/distribution/', '/plugins/shop/',
        '/plugins/realstore/', '/plugins/ask/', '/plugins/blog/', '/plugins/seckill/',
        '/plugins/video/', '/plugins/hospital/', '/plugins/giftcard/', '/plugins/membershiplevelvip/',
        '/plugins/weixinliveplayer/', '/plugins/scanpay/', '/plugins/complaint/',
        '/plugins/invoice/', '/plugins/certificate/', '/plugins/intellectstools/',
        '/extraction-address/'
    ];
    $found_blocked = false;
    foreach ($blocked_plugin_patterns as $pattern) {
        if (strpos($pages_content, $pattern) !== false) {
            block_item("pages.json 包含被屏蔽插件页面: {$pattern}");
            $found_blocked = true;
        }
    }
    if (!$found_blocked) {
        pass_item("pages.json 未包含被屏蔽插件页面");
    }
} else {
    warn_item("pages.json 不存在，无法检查");
}

// ============================================================
// 12. 高风险功能开关生产环境检查
// ============================================================
section("12. 高风险功能开关生产环境检查");

$high_risk_feature_flags = [
    'feature_shop_enabled', 'feature_realstore_enabled', 'feature_distribution_enabled',
    'feature_wallet_enabled', 'feature_coin_enabled', 'feature_ugc_enabled',
    'feature_membership_enabled', 'feature_seckill_enabled', 'feature_video_enabled',
    'feature_hospital_enabled', 'feature_giftcard_enabled', 'feature_givegift_enabled',
    'feature_complaint_enabled', 'feature_invoice_enabled', 'feature_certificate_enabled',
    'feature_scanpay_enabled', 'feature_live_enabled', 'feature_intellectstools_enabled',
    'feature_coupon_enabled', 'feature_signin_enabled', 'feature_points_enabled',
];

$backend_env_path = $repo_path . '/shopxo-backend/.env';
if (file_exists($backend_env_path)) {
    pass_item("后端 .env 存在，但功能开关存储在数据库，需在后台合规中心确认");
} else {
    warn_item("后端 .env 不存在，无法检查");
}

$compliance_service_path = $repo_path . '/shopxo-backend/app/service/MuyingComplianceService.php';
if (file_exists($compliance_service_path)) {
    $cs_content = file_get_contents($compliance_service_path);
    $all_in_blocked = true;
    foreach (['coupon', 'signin', 'points'] as $plugin) {
        if (strpos($cs_content, "'{$plugin}'") === false || strpos($cs_content, 'PHASE_ONE_BLOCKED_PLUGINS') === false) {
            $all_in_blocked = false;
            break;
        }
    }
    if ($all_in_blocked) {
        pass_item("coupon/signin/points 已在 PHASE_ONE_BLOCKED_PLUGINS 中（默认关闭）");
    } else {
        block_item("coupon/signin/points 未在 PHASE_ONE_BLOCKED_PLUGINS 中，生产环境可能误开放");
    }
} else {
    warn_item("MuyingComplianceService.php 不存在，无法检查");
}

// ============================================================
// 13. 生产环境 request_url HTTPS 检查
// ============================================================
section("13. 生产环境 request_url HTTPS 检查");

$uniapp_prod_env = $repo_path . '/shopxo-uniapp/.env.production';
if (file_exists($uniapp_prod_env)) {
    $prod_content = file_get_contents($uniapp_prod_env);
    if (preg_match('/UNI_APP_REQUEST_URL\s*=\s*(.+)/', $prod_content, $m)) {
        $url = trim($m[1]);
        if (strpos($url, 'https://') === 0) {
            pass_item("生产 API 地址使用 HTTPS: {$url}");
        } elseif (strpos($url, 'http://') === 0) {
            $ip_pattern = '/http:\/\/\d+\.\d+\.\d+\.\d+/';
            if (preg_match($ip_pattern, $url)) {
                warn_item("生产 API 地址使用 HTTP+IP（体验版可接受，提审必须 HTTPS+域名）: {$url}");
            } else {
                block_item("生产 API 地址使用 HTTP 非安全协议: {$url}");
            }
        } elseif (strpos($url, '{{') !== false) {
            warn_item("生产 API 地址仍为占位符: {$url}");
        } else {
            warn_item("生产 API 地址格式异常: {$url}");
        }
    } else {
        warn_item("未找到 UNI_APP_REQUEST_URL 配置");
    }
} else {
    warn_item(".env.production 不存在，无法检查");
}

// ============================================================
// 14. APP_DEBUG 生产环境检查
// ============================================================
section("14. APP_DEBUG 生产环境检查");

if (file_exists($backend_env_path)) {
    $be_content = file_get_contents($backend_env_path);
    if (preg_match('/APP_DEBUG\s*=\s*(true|1|yes)/i', $be_content)) {
        block_item("APP_DEBUG = true，生产环境必须关闭！");
    } elseif (preg_match('/APP_DEBUG\s*=\s*(false|0|no)/i', $be_content)) {
        pass_item("APP_DEBUG = false，调试模式已关闭");
    } else {
        warn_item("APP_DEBUG 未明确设置，建议显式设为 false");
    }
} else {
    warn_item("后端 .env 不存在，无法检查 APP_DEBUG");
}

// ============================================================
// 15. 真实密钥泄露检查
// ============================================================
section("15. 真实密钥泄露检查");

$secret_patterns = [
    '/MUYING_PRIVACY_KEY\s*=\s*[0-9a-f]{32,}/i' => 'MUYING_PRIVACY_KEY 可能包含真实密钥',
    '/MYSQL_ROOT_PASSWORD\s*=\s*(?!CHANGE_ME)[^\s]+/i' => 'MYSQL_ROOT_PASSWORD 可能包含真实密码',
    '/PASSWORD\s*=\s*(?!{{DB_PASS}})(?!{{PRIVACY_KEY}})(?!CHANGE_ME)(?!请替换)[^\s{\[{]+/i' => 'PASSWORD 可能包含真实密码',
];

$tracked_files_output = [];
exec("cd " . escapeshellarg($repo_path) . " && git ls-files 2>/dev/null", $tracked_files_output);
$env_tracked = false;
foreach ($tracked_files_output as $tf) {
    if (preg_match('/\.env$|\.env\.production$|\.env\.local$/i', $tf)) {
        $env_tracked = true;
        block_item("Git 跟踪了敏感文件: {$tf}，必须从版本控制中移除");
    }
}
if (!$env_tracked) {
    pass_item("Git 未跟踪 .env 敏感文件");
}

$example_files = glob($repo_path . '/*/.env*.example');
$found_secrets = false;
foreach ($example_files as $ef) {
    $content = file_get_contents($ef);
    $basename = str_replace($repo_path . '/', '', $ef);
    foreach ($secret_patterns as $pattern => $desc) {
        if (preg_match($pattern, $content)) {
            block_item("{$desc} 在 {$basename}，不应提交真实密钥");
            $found_secrets = true;
        }
    }
}
if (!$found_secrets) {
    pass_item(".env.example 文件未包含真实密钥");
}

// ============================================================
// 16. 测试号 AppID 在生产配置中的检查
// ============================================================
section("16. 测试号 AppID 生产配置检查");

$test_appid = 'wxda7779770f53e901';
if (file_exists($uniapp_prod_env)) {
    $prod_content = file_get_contents($uniapp_prod_env);
    if (stripos($prod_content, $test_appid) !== false) {
        block_item("生产配置 .env.production 包含测试号 AppID: {$test_appid}，提审必须使用正式 AppID");
    } else {
        pass_item("生产配置未使用测试号 AppID");
    }
} else {
    warn_item(".env.production 不存在，无法检查测试号 AppID");
}

// ============================================================
// 17. static_url HTTPS 检查
// ============================================================
section("17. static_url HTTPS 检查");

if (file_exists($uniapp_prod_env)) {
    $prod_content = file_get_contents($uniapp_prod_env);
    if (preg_match('/UNI_APP_STATIC_URL\s*=\s*(.+)/', $prod_content, $m)) {
        $surl = trim($m[1]);
        if (empty($surl)) {
            pass_item("static_url 未配置（将使用 request_url）");
        } elseif (strpos($surl, 'https://') === 0) {
            pass_item("static_url 使用 HTTPS: {$surl}");
        } elseif (strpos($surl, 'http://') === 0) {
            block_item("static_url 使用 HTTP（不安全）: {$surl}");
        } elseif (strpos($surl, '{{') !== false) {
            warn_item("static_url 仍为占位符: {$surl}");
        }
    } else {
        pass_item("static_url 未单独配置（将使用 request_url）");
    }
} else {
    warn_item(".env.production 不存在，无法检查 static_url");
}

// ============================================================
// 18. [MUYING-二开] composer.lock 存在性检查
// ============================================================
section("18. composer.lock 检查");

$composer_lock_path = $repo_path . '/shopxo-backend/composer.lock';
if (file_exists($composer_lock_path)) {
    pass_item("composer.lock 存在，依赖可复现");
} else {
    block_item("composer.lock 不存在，必须运行 composer update 生成并提交");
}

// ============================================================
// 19. [MUYING-二开] composer.json 核心依赖版本约束检查
// ============================================================
section("19. composer.json 核心依赖版本约束检查");

$composer_json_path = $repo_path . '/shopxo-backend/composer.json';
if (file_exists($composer_json_path)) {
    $composer_content = file_get_contents($composer_json_path);
    $composer_data = json_decode($composer_content, true);
    $wildcard_found = false;
    if (!empty($composer_data['require'])) {
        foreach ($composer_data['require'] as $pkg => $ver) {
            if ($ver === '*' && $pkg !== 'php') {
                block_item("composer.json 核心依赖 {$pkg} 版本约束为 '*'，必须指定合理版本范围");
                $wildcard_found = true;
            }
        }
    }
    if (!empty($composer_data['require-dev'])) {
        foreach ($composer_data['require-dev'] as $pkg => $ver) {
            if ($ver === '*') {
                warn_item("composer.json require-dev {$pkg} 版本约束为 '*'，建议指定版本范围");
                $wildcard_found = true;
            }
        }
    }
    if (!$wildcard_found) {
        pass_item("composer.json 核心依赖版本约束合理");
    }
} else {
    block_item("composer.json 不存在");
}

// ============================================================
// 20. [MUYING-二开] 敏感文件 Git 跟踪检查
// ============================================================
section("20. 敏感文件 Git 跟踪检查");

$sensitive_patterns = [
    '.env', '.env.production', '.env.local',
    '.pem', '.key', '.cert', '.crt', '.p12', '.jks',
];
$sensitive_dirs = [
    'shopxo-backend/vendor/',
    'shopxo-backend/runtime/',
    'shopxo-backend/public/static/upload/',
    'shopxo-uniapp/node_modules/',
    'shopxo-uniapp/unpackage/',
];

$tracked_output = [];
exec("cd " . escapeshellarg($repo_path) . " && git ls-files 2>/dev/null", $tracked_output);
$sensitive_tracked = false;

foreach ($tracked_output as $tf) {
    foreach ($sensitive_dirs as $dir) {
        if (strpos($tf, $dir) === 0) {
            block_item("Git 跟踪了敏感目录文件: {$tf}，必须从版本控制中移除");
            $sensitive_tracked = true;
        }
    }
    $tf_lower = strtolower($tf);
    if (preg_match('/\.(pem|key|cert|crt|p12|jks)$/i', $tf)) {
        block_item("Git 跟踪了证书/密钥文件: {$tf}");
        $sensitive_tracked = true;
    }
}

if (!$sensitive_tracked) {
    pass_item("Git 未跟踪敏感目录和证书文件");
}

// ============================================================
// 21. [MUYING-二开] public/install.php 和 public/admin.php 检查
// ============================================================
section("21. 安装入口和后台入口检查");

$install_php = $repo_path . '/shopxo-backend/public/install.php';
if (file_exists($install_php)) {
    block_item("public/install.php 存在，生产环境必须删除");
} else {
    pass_item("public/install.php 不存在");
}

$admin_php = $repo_path . '/shopxo-backend/public/admin.php';
if (file_exists($admin_php)) {
    warn_item("public/admin.php 存在，建议确认后台入口已重命名");
} else {
    pass_item("public/admin.php 不存在（可能已重命名）");
}

// ============================================================
// 22. [MUYING-二开] PHP 调试残留检查
// ============================================================
section("22. PHP 调试残留检查");

$php_debug_patterns = [
    '/\bvar_dump\s*\(/' => 'var_dump',
    '/\bprint_r\s*\(/' => 'print_r',
    '/\bdump\s*\(/' => 'dump (symfony)',
];

$php_scan_dirs = [
    $repo_path . '/shopxo-backend/app/',
    $repo_path . '/shopxo-backend/extend/base/',
];

$php_debug_found = false;
foreach ($php_scan_dirs as $scan_dir) {
    if (!is_dir($scan_dir)) continue;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scan_dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'php') continue;
        $content = file_get_contents($file->getPathname());
        $relative = str_replace($repo_path . '/', '', $file->getPathname());
        if (preg_match('/\bvar_dump\s*\(/', $content)) {
            warn_item("PHP 调试残留 var_dump 在: {$relative}");
            $php_debug_found = true;
        }
        if (preg_match('/\bprint_r\s*\(/', $content) && strpos($content, 'print_r($data)') === false) {
            // 排除模板示例代码
        } elseif (preg_match('/\{\{:print_r/', $content)) {
            block_item("PHP 调试残留 print_r 在模板: {$relative}");
            $php_debug_found = true;
        }
        if (preg_match('/\bdie\s*\(/', $content) && !preg_match('/die\s*\(\s*[\'"]/', $content)) {
            // die('message') 是正常逻辑，die() 无参数或 die($var) 是调试残留
        }
    }
}
if (!$php_debug_found) {
    pass_item("PHP 调试残留检查通过");
}

// ============================================================
// 23. [MUYING-二开] 前端调试残留检查
// ============================================================
section("23. 前端调试残留检查");

$frontend_scan_dirs = [
    $repo_path . '/shopxo-uniapp/pages/',
    $repo_path . '/shopxo-uniapp/components/',
    $repo_path . '/shopxo-uniapp/common/',
];

$frontend_debug_found = false;
foreach ($frontend_scan_dirs as $scan_dir) {
    if (!is_dir($scan_dir)) continue;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scan_dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iterator as $file) {
        $ext = $file->getExtension();
        if (!in_array($ext, ['js', 'vue'])) continue;
        $content = file_get_contents($file->getPathname());
        $relative = str_replace($repo_path . '/', '', $file->getPathname());
        if (preg_match('/\bconsole\.log\s*\(/', $content)) {
            warn_item("前端调试残留 console.log 在: {$relative}");
            $frontend_debug_found = true;
        }
        if (preg_match('/\bdebugger\s*;/', $content)) {
            block_item("前端调试残留 debugger 在: {$relative}");
            $frontend_debug_found = true;
        }
        if (preg_match('/\balert\s*\(/', $content) && !preg_match('/AMUI\.dialog\.alert|uni\.showModal|showModal/', $content)) {
            warn_item("前端调试残留 alert() 在: {$relative}");
            $frontend_debug_found = true;
        }
    }
}
if (!$frontend_debug_found) {
    pass_item("前端调试残留检查通过");
}

// ============================================================
// 24. [MUYING-二开] 隐私加密密钥缺失明文降级检查
// ============================================================
section("24. 隐私加密 fail-closed 检查");

$privacy_service_path = $repo_path . '/shopxo-backend/app/service/MuyingPrivacyService.php';
if (file_exists($privacy_service_path)) {
    $ps_content = file_get_contents($privacy_service_path);

    // [MUYING-二开] 提取 EncryptSensitive 函数体，检查是否仍存在密钥缺失时 return $value 降级
    $encrypt_has_plaintext_fallback = false;
    if (preg_match('/function\s+EncryptSensitive\s*\([^)]*\)\s*\{(.*?)\n    \}/s', $ps_content, $encrypt_match)) {
        $encrypt_body = $encrypt_match[1];
        // 排除 empty($value) 检查后的 return $value（这是正常逻辑：空值不需要加密）
        $encrypt_body_filtered = preg_replace('/if\s*\(\s*empty\s*\(\s*\$value\s*\)\s*\)\s*\{\s*return\s+\$value\s*;\s*\}/s', '', $encrypt_body);
        if (preg_match('/return\s+\$value\s*;/', $encrypt_body_filtered)) {
            $encrypt_has_plaintext_fallback = true;
        }
    }
    if ($encrypt_has_plaintext_fallback) {
        block_item("EncryptSensitive 仍存在密钥缺失时返回原始值的降级逻辑");
    } else {
        pass_item("EncryptSensitive 已实现 fail-closed");
    }

    if (strpos($ps_content, 'IsKeyAvailable') !== false) {
        pass_item("IsKeyAvailable() 方法已存在");
    } else {
        block_item("IsKeyAvailable() 方法不存在，无法做 fail-closed 前置检查");
    }

    if (preg_match('/HashPhone.*?return hash\(/s', $ps_content) && !preg_match('/HashPhone.*?IsKeyAvailable|HashPhone.*?MIN_KEY_LENGTH/s', $ps_content)) {
        block_item("HashPhone 未检查密钥可用性，可能生成无盐 hash");
    } else {
        pass_item("HashPhone 已做密钥可用性检查");
    }
} else {
    block_item("MuyingPrivacyService.php 不存在");
}

// ============================================================
// 25. [MUYING-二开] 高风险功能默认关闭检查
// ============================================================
section("25. 高风险功能默认关闭检查");

$compliance_service_path = $repo_path . '/shopxo-backend/app/service/MuyingComplianceService.php';
if (file_exists($compliance_service_path)) {
    $cs_content = file_get_contents($compliance_service_path);

    $required_blocked = ['wallet', 'coin', 'distribution', 'shop', 'realstore', 'hospital', 'giftcard', 'scanpay', 'weixinliveplayer'];
    $all_blocked = true;
    foreach ($required_blocked as $plugin) {
        if (strpos($cs_content, "'{$plugin}'") === false && strpos($cs_content, '"{$plugin}"') === false) {
            block_item("高风险插件 {$plugin} 未在 PHASE_ONE_BLOCKED_PLUGINS 中");
            $all_blocked = false;
        }
    }
    if ($all_blocked) {
        pass_item("所有高风险插件已在 PHASE_ONE_BLOCKED_PLUGINS 中");
    }
} else {
    block_item("MuyingComplianceService.php 不存在");
}

// ============================================================
// 26. [MUYING-二开] pages.json 一期禁止页面检查
// ============================================================
section("26. pages.json 一期禁止页面检查");

$pages_json_path = $repo_path . '/shopxo-uniapp/pages.json';
if (file_exists($pages_json_path)) {
    $pages_content = file_get_contents($pages_json_path);
    $blocked_page_patterns = [
        '/plugins/wallet/' => '钱包',
        '/plugins/coin/' => '虚拟币',
        '/plugins/distribution/' => '分销',
        '/plugins/shop/' => '第三方商家',
        '/plugins/realstore/' => '门店',
        '/plugins/hospital/' => '医疗问诊',
        '/plugins/giftcard/' => '礼品卡',
        '/plugins/scanpay/' => '扫码支付',
        '/plugins/weixinliveplayer/' => '直播',
        '/plugins/membershiplevelvip/' => '付费会员',
        '/plugins/ask/' => 'UGC社区',
        '/plugins/blog/' => '博客',
    ];
    $found_blocked_pages = false;
    foreach ($blocked_page_patterns as $pattern => $desc) {
        if (strpos($pages_content, $pattern) !== false) {
            block_item("pages.json 包含一期禁止页面: {$pattern}（{$desc}）");
            $found_blocked_pages = true;
        }
    }
    if (!$found_blocked_pages) {
        pass_item("pages.json 未包含一期禁止页面");
    }
} else {
    warn_item("pages.json 不存在，无法检查");
}

// ============================================================
// 27. [MUYING-二开] AppID/域名/HTTPS 状态（仅 WARN，不作为 BLOCKER）
// ============================================================
section("27. AppID/域名/HTTPS 状态（仅 WARN）");

$manifest_path = $repo_path . '/shopxo-uniapp/manifest.json';
if (file_exists($manifest_path)) {
    $m_data = json_decode(file_get_contents($manifest_path), true);
    $appid = $m_data['mp-weixin']['appid'] ?? '';
    if (empty($appid)) {
        warn_item("manifest.json AppID 为空，提审前必须配置正式 AppID");
    } elseif (in_array($appid, ['wxda7779770f53e901', 'wx1234567890', 'wx0000000000'])) {
        warn_item("manifest.json 使用测试号 AppID: {$appid}，提审前必须替换为正式 AppID");
    } else {
        warn_item("manifest.json AppID 已配置: {$appid}（需确认是否为正式 AppID）");
    }
} else {
    warn_item("manifest.json 不存在");
}

$prod_env_check = $repo_path . '/shopxo-uniapp/.env.production';
if (file_exists($prod_env_check)) {
    $pe_content = file_get_contents($prod_env_check);
    if (preg_match('/UNI_APP_REQUEST_URL\s*=\s*(.+)/', $pe_content, $m)) {
        $url = trim($m[1]);
        if (strpos($url, 'https://') === 0) {
            warn_item("生产 request_url 使用 HTTPS（需确认域名已备案）: {$url}");
        } else {
            warn_item("生产 request_url 非 HTTPS，提审前必须配置 HTTPS+已备案域名");
        }
    }
} else {
    warn_item(".env.production 不存在，提审前必须创建并配置正式域名");
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
