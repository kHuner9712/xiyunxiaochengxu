#!/usr/bin/env php
<?php
/**
 * [MUYING-二开] 敏感数据加密迁移脚本
 *
 * 用途：将数据库中的明文敏感数据加密存储，并补齐 hash 字段
 * 用法：php scripts/migrate-encrypt-sensitive.php [--dry-run] [--batch=100] [--table=all] [--force]
 *
 * 参数：
 *   --dry-run        只输出统计，不写数据库
 *   --batch=100      每批处理记录数
 *   --table=all      指定表：all|activity_signup|feedback|user
 *   --force          实际执行时必须带此参数，避免误操作
 *
 * 前置条件：
 *   1. MUYING_PRIVACY_KEY 已配置（.env 或数据库配置）
 *   2. 数据库连接正常
 *   3. 目标表和字段存在
 *
 * 兼容：PHP 8.1+ / MySQL 5.7+
 */

$backendRoot = realpath(__DIR__ . '/../shopxo-backend');
if (!$backendRoot || !file_exists($backendRoot . '/public/core.php')) {
    fwrite(STDERR, "[BLOCKER] 无法定位 shopxo-backend 目录，请从项目根目录运行\n");
    exit(1);
}

require $backendRoot . '/public/core.php';
require $backendRoot . '/vendor/autoload.php';

try {
    $app = new \think\App($backendRoot);
    $app->initialize();
} catch (\Throwable $e) {
    fwrite(STDERR, "[BLOCKER] ThinkPHP 引导失败: " . $e->getMessage() . "\n");
    fwrite(STDERR, "  请确认 shopxo-backend/.env 和 config/database.php 已正确配置\n");
    exit(1);
}

use think\facade\Db;
use app\service\MuyingPrivacyService;

$opts = getopt('', ['dry-run', 'batch:', 'table:', 'force']);
$isDryRun = isset($opts['dry-run']);
$batchSize = isset($opts['batch']) ? max(1, intval($opts['batch'])) : 100;
$tableFilter = isset($opts['table']) ? $opts['table'] : 'all';
$isForce = isset($opts['force']);

$logDir = $backendRoot . '/runtime/log';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/muying_encrypt_migration_' . date('Ymd_His') . '.log';

function writeLog(string $msg): void {
    global $logFile;
    @file_put_contents($logFile, date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND);
}

function maskValue(string $value): string {
    if ($value === '') return '(空)';
    $len = mb_strlen($value);
    if ($len <= 2) return str_repeat('*', $len);
    return mb_substr($value, 0, 1) . '***' . mb_substr($value, -1);
}

echo "\n孕禧 V1.0 — 敏感数据加密迁移脚本\n";
echo str_repeat('=', 50) . "\n\n";

// ============================================================
// 预检查
// ============================================================

$privacyKey = env('MUYING_PRIVACY_KEY', '');
if (empty($privacyKey) && function_exists('MyC')) {
    $privacyKey = MyC('muying_privacy_key', '');
}
if (empty($privacyKey)) {
    fwrite(STDERR, "[BLOCKER] MUYING_PRIVACY_KEY 未配置，无法执行加密迁移\n");
    fwrite(STDERR, "  生成方式: php -r \"echo bin2hex(openssl_random_pseudo_bytes(32));\"\n");
    fwrite(STDERR, "  配置位置: shopxo-backend/.env → MUYING_PRIVACY_KEY = <生成的64位hex密钥>\n");
    exit(1);
}
echo "[OK] MUYING_PRIVACY_KEY 已配置（长度: " . strlen($privacyKey) . "）\n";

$appDebug = env('APP_DEBUG', false);
if ($appDebug) {
    echo "[WARN] APP_DEBUG = true，当前为调试环境，请确认是否为预期环境\n";
} else {
    echo "[OK] APP_DEBUG = false\n";
}

try {
    Db::query('SELECT 1');
    echo "[OK] 数据库连接正常\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "[BLOCKER] 数据库连接失败: " . $e->getMessage() . "\n");
    exit(1);
}

if (!$isDryRun && !$isForce) {
    fwrite(STDERR, "[BLOCKER] 实际执行迁移必须使用 --force 参数\n");
    fwrite(STDERR, "  测试模式: php scripts/migrate-encrypt-sensitive.php --dry-run\n");
    fwrite(STDERR, "  正式执行: php scripts/migrate-encrypt-sensitive.php --force\n");
    exit(1);
}

// ============================================================
// 定义迁移范围
// ============================================================

$migrationTables = [
    'activity_signup' => [
        'table' => 'sxo_activity_signup',
        'primary_key' => 'id',
        'fields' => [
            ['name' => 'name', 'hash_field' => null, 'min_encrypt_size' => 44],
            ['name' => 'phone', 'hash_field' => 'phone_hash', 'min_encrypt_size' => 44],
        ],
        'version_field' => 'privacy_version',
    ],
    'feedback' => [
        'table' => 'sxo_muying_feedback',
        'primary_key' => 'id',
        'fields' => [
            ['name' => 'contact', 'hash_field' => 'contact_hash', 'min_encrypt_size' => 44],
        ],
        'version_field' => null,
    ],
];

if ($tableFilter !== 'all') {
    if ($tableFilter === 'user') {
        echo "\n[INFO] --table=user: 用户表不执行加密迁移（见下方说明）\n";
    } elseif (!isset($migrationTables[$tableFilter])) {
        fwrite(STDERR, "[ERROR] 未知表标识: {$tableFilter}\n");
        fwrite(STDERR, "  可选: all, activity_signup, feedback, user\n");
        exit(1);
    } else {
        $migrationTables = [$tableFilter => $migrationTables[$tableFilter]];
    }
}

if ($tableFilter === 'user') {
    $migrationTables = [];
}

// ============================================================
// 检查表和字段存在性 + 字段宽度
// ============================================================

$widenNeeded = [];

foreach ($migrationTables as $key => $config) {
    try {
        $columns = Db::query("SHOW FULL COLUMNS FROM `{$config['table']}`");
    } catch (\Throwable $e) {
        fwrite(STDERR, "[ERROR] 表 {$config['table']} 不存在或无法访问: " . $e->getMessage() . "\n");
        unset($migrationTables[$key]);
        continue;
    }

    $colMap = [];
    foreach ($columns as $col) {
        $colMap[$col['Field']] = $col;
    }

    $missing = [];
    foreach ($config['fields'] as $field) {
        if (!isset($colMap[$field['name']])) {
            $missing[] = $field['name'];
        }
        if (!empty($field['hash_field']) && !isset($colMap[$field['hash_field']])) {
            $missing[] = $field['hash_field'];
        }
    }
    if (!empty($config['version_field']) && !isset($colMap[$config['version_field']])) {
        $missing[] = $config['version_field'];
    }

    if (!empty($missing)) {
        fwrite(STDERR, "[ERROR] 表 {$config['table']} 缺少字段: " . implode(', ', $missing) . "\n");
        fwrite(STDERR, "  请先执行数据库迁移: docs/muying-final-migration.sql\n");
        unset($migrationTables[$key]);
        continue;
    }

    $migrationTables[$key]['col_map'] = $colMap;

    foreach ($config['fields'] as $field) {
        $colInfo = $colMap[$field['name']] ?? null;
        if ($colInfo && preg_match('/^(char|varchar)\((\d+)\)/i', $colInfo['Type'], $m)) {
            $currentSize = intval($m[2]);
            if ($currentSize < $field['min_encrypt_size']) {
                $widenNeeded[] = [
                    'table' => $config['table'],
                    'field' => $field['name'],
                    'current_type' => $m[1] . '(' . $m[2] . ')',
                    'current_size' => $currentSize,
                    'min_size' => $field['min_encrypt_size'],
                    'comment' => $colInfo['Comment'] ?? $field['name'],
                    'nullable' => ($colInfo['Null'] ?? 'NO') === 'YES',
                    'default' => $colInfo['Default'] ?? '',
                ];
            }
        }
    }
}

if (empty($migrationTables) && $tableFilter !== 'user') {
    fwrite(STDERR, "[ERROR] 没有可迁移的表\n");
    exit(1);
}

if (!empty($widenNeeded)) {
    echo "\n[WARN] 以下字段宽度不足以存储加密数据（AES-256-CBC + Base64 编码后至少需要 44 字符）:\n";
    foreach ($widenNeeded as $item) {
        echo "  - {$item['table']}.{$item['field']}: 当前 {$item['current_type']}，加密后至少需要 {$item['min_size']} 字符\n";
    }

    if (!$isDryRun) {
        echo "\n正在自动扩展字段宽度为 VARCHAR(255)...\n";
        writeLog("开始字段宽度扩展");
        foreach ($widenNeeded as $item) {
            $nullClause = $item['nullable'] ? '' : ' NOT NULL';
            $defaultClause = " DEFAULT ''";
            $comment = addslashes($item['comment']);
            $sql = "ALTER TABLE `{$item['table']}` MODIFY `{$item['field']}` VARCHAR(255){$nullClause}{$defaultClause} COMMENT '{$comment}'";
            try {
                Db::execute($sql);
                echo "  [OK] {$item['table']}.{$item['field']} → VARCHAR(255)\n";
                writeLog("字段扩展: {$item['table']}.{$item['field']} → VARCHAR(255)");
            } catch (\Throwable $e) {
                fwrite(STDERR, "  [FAIL] {$item['table']}.{$item['field']} 扩展失败: " . $e->getMessage() . "\n");
                writeLog("字段扩展失败: {$item['table']}.{$item['field']} - " . $e->getMessage());
            }
        }
    } else {
        echo "  (DRY-RUN 模式不执行字段扩展，正式执行时会自动扩展)\n";
    }
}

// ============================================================
// 用户表检查说明
// ============================================================

echo "\n[INFO] 用户表敏感字段检查:\n";
try {
    $userCols = Db::query("SHOW COLUMNS FROM `sxo_user`");
    $userColNames = array_column($userCols, 'Field');

    if (in_array('mobile', $userColNames)) {
        echo "  sxo_user.mobile — ShopXO 登录手机号，【不加密】（避免破坏登录逻辑）\n";
    }
    $muyingUserFields = [
        'current_stage' => '孕育阶段标识（非PII）',
        'due_date' => '预产期时间戳（非PII）',
        'baby_birthday' => '宝宝生日时间戳（非PII）',
        'baby_month_age' => '宝宝月龄数值（非PII）',
    ];
    foreach ($muyingUserFields as $uf => $desc) {
        if (in_array($uf, $userColNames)) {
            echo "  sxo_user.{$uf} — {$desc}，无需加密\n";
        }
    }
    echo "  结论: 用户表无需执行加密迁移\n";
} catch (\Throwable $e) {
    echo "  [WARN] 无法检查用户表: " . $e->getMessage() . "\n";
}

if (empty($migrationTables)) {
    echo "\n[INFO] 无需迁移的表，脚本结束\n";
    writeLog("无需迁移的表，脚本结束");
    exit(0);
}

// ============================================================
// 备份警告 & 开始确认
// ============================================================

$tableNames = array_map(function ($k) use ($migrationTables) {
    return $migrationTables[$k]['table'];
}, array_keys($migrationTables));

echo "\n" . str_repeat('=', 50) . "\n";
echo "  模式: " . ($isDryRun ? "DRY-RUN（不写库）" : "正式执行（--force）") . "\n";
echo "  批量: {$batchSize}\n";
echo "  目标: " . implode(', ', $tableNames) . "\n";
echo str_repeat('=', 50) . "\n";

if (!$isDryRun) {
    echo "\n";
    echo "⚠️  正式执行将修改数据库数据！\n";
    echo "⚠️  执行前必须已备份数据库！\n";
    echo "⚠️  如未备份，请 Ctrl+C 终止！\n";
    echo "\n5秒后开始...\n";
    sleep(5);
}

writeLog("迁移开始 模式=" . ($isDryRun ? "DRY-RUN" : "正式执行") . " 批量={$batchSize} 表=" . implode(',', array_keys($migrationTables)));

// ============================================================
// 执行迁移
// ============================================================

$stats = ['scanned' => 0, 'encrypted' => 0, 'hash_filled' => 0, 'skipped' => 0, 'failed' => 0];

foreach ($migrationTables as $key => $config) {
    echo "\n▶ 处理表: {$config['table']}\n";
    writeLog("开始处理表: {$config['table']}");

    $ts = ['scanned' => 0, 'encrypted' => 0, 'hash_filled' => 0, 'skipped' => 0, 'failed' => 0];
    $offset = 0;

    while (true) {
        try {
            $rows = Db::table($config['table'])
                ->order($config['primary_key'], 'asc')
                ->limit($offset, $batchSize)
                ->select()
                ->toArray();
        } catch (\Throwable $e) {
            echo "  [ERROR] 查询失败: " . $e->getMessage() . "\n";
            writeLog("查询失败: " . $e->getMessage());
            break;
        }

        if (empty($rows)) break;

        foreach ($rows as $row) {
            $ts['scanned']++;
            $pk = intval($row[$config['primary_key']]);
            $updateData = [];
            $anyEncrypted = false;

            foreach ($config['fields'] as $field) {
                $fieldName = $field['name'];
                $rawValue = $row[$fieldName] ?? '';
                $value = trim($rawValue);

                if ($value === '') continue;

                if (MuyingPrivacyService::IsEncrypted($value)) {
                    if (!empty($field['hash_field'])) {
                        $hashField = $field['hash_field'];
                        if (empty($row[$hashField])) {
                            try {
                                $plain = MuyingPrivacyService::DecryptSensitive($value);
                                if (!empty($plain)) {
                                    $updateData[$hashField] = MuyingPrivacyService::HashPhone($plain);
                                    $ts['hash_filled']++;
                                    writeLog("ID={$pk}: {$hashField} 补填（已加密数据的hash）");
                                }
                            } catch (\Throwable $e) {
                                $ts['failed']++;
                                writeLog("ID={$pk}: {$hashField} 补填失败 - " . $e->getMessage());
                            }
                        }
                    }
                    $ts['skipped']++;
                    continue;
                }

                try {
                    $encrypted = MuyingPrivacyService::EncryptSensitive($value);
                    if ($encrypted === $value) {
                        $ts['failed']++;
                        writeLog("ID={$pk}: {$fieldName} 加密返回原值（密钥可能无效）");
                        continue;
                    }
                    $updateData[$fieldName] = $encrypted;
                    $anyEncrypted = true;
                    $ts['encrypted']++;
                    writeLog("ID={$pk}: {$fieldName} 已加密 (" . maskValue($value) . ")");

                    if (!empty($field['hash_field'])) {
                        $hashField = $field['hash_field'];
                        if (empty($row[$hashField])) {
                            $updateData[$hashField] = MuyingPrivacyService::HashPhone($value);
                            $ts['hash_filled']++;
                            writeLog("ID={$pk}: {$hashField} 已生成");
                        }
                    }
                } catch (\Throwable $e) {
                    $ts['failed']++;
                    writeLog("ID={$pk}: {$fieldName} 加密失败 - " . $e->getMessage());
                    echo "  [FAIL] ID={$pk} {$fieldName}: " . $e->getMessage() . "\n";
                }
            }

            if ($anyEncrypted && !empty($config['version_field'])) {
                $updateData[$config['version_field']] = 1;
            }

            if (!empty($updateData) && !$isDryRun) {
                try {
                    Db::table($config['table'])
                        ->where($config['primary_key'], $pk)
                        ->update($updateData);
                } catch (\Throwable $e) {
                    $ts['failed']++;
                    writeLog("ID={$pk}: 更新失败 - " . $e->getMessage());
                    echo "  [FAIL] ID={$pk} 更新失败: " . $e->getMessage() . "\n";
                }
            }
        }

        $offset += $batchSize;
        echo "  进度: scanned={$ts['scanned']} encrypted={$ts['encrypted']} hash_filled={$ts['hash_filled']} skipped={$ts['skipped']} failed={$ts['failed']}\r";
    }

    echo "\n  完成: scanned={$ts['scanned']} encrypted={$ts['encrypted']} hash_filled={$ts['hash_filled']} skipped={$ts['skipped']} failed={$ts['failed']}\n";

    foreach ($ts as $k => $v) {
        $stats[$k] += $v;
    }

    writeLog("表{$config['table']}完成: " . json_encode($ts));
}

// ============================================================
// 汇总
// ============================================================

echo "\n" . str_repeat('=', 50) . "\n";
echo "  迁移统计\n";
echo str_repeat('=', 50) . "\n";
echo "  扫描:     {$stats['scanned']}\n";
echo "  加密:     {$stats['encrypted']}\n";
echo "  Hash补填: {$stats['hash_filled']}\n";
echo "  跳过:     {$stats['skipped']}\n";
echo "  失败:     {$stats['failed']}\n";
echo "  模式:     " . ($isDryRun ? "DRY-RUN" : "正式执行") . "\n";
echo "  日志:     {$logFile}\n";
echo str_repeat('=', 50) . "\n";

writeLog("迁移完成: " . json_encode($stats));

if ($isDryRun && $stats['encrypted'] > 0) {
    echo "\n提示: 以上为 DRY-RUN 统计，未实际写入数据库。\n";
    echo "正式执行: php scripts/migrate-encrypt-sensitive.php --force\n";
}

if (!$isDryRun && $stats['encrypted'] > 0) {
    echo "\n提示: 迁移已完成，建议执行以下验证:\n";
    echo "  1. 在后台查看报名/反馈数据是否正常脱敏显示\n";
    echo "  2. 使用 phone_hash 搜索手机号是否正常\n";
    echo "  3. 确认新报名数据仍正常加密存储\n";
}

exit($stats['failed'] > 0 ? 1 : 0);
