#!/usr/bin/env php
<?php
/**
 * [MUYING-二开] 文档一致性检查脚本
 *
 * 用途：检查文档和脚本中的表名、占位符、版本号是否与代码一致
 * 用法：php scripts/preflight/check-doc-consistency.php [--root=/path/to/project]
 *
 * 检查项：
 *   1. 文档中不应出现错误的表名 sxo_users（应为 sxo_user）
 *   2. 文档中不应出现占位符"待提交"
 *   3. UAT 报告中的代码版本应为最新 commit hash
 *
 * 输出等级：PASS / WARN / BLOCKER
 * 退出码：0=无 BLOCKER，1=存在 BLOCKER
 */

$pass_count = 0;
$warn_count = 0;
$block_count = 0;

function pass_item($msg) {
    global $pass_count;
    $pass_count++;
    echo "[PASS] {$msg}\n";
}

function warn_item($msg) {
    global $warn_count;
    $warn_count++;
    echo "[WARN] {$msg}\n";
}

function block_item($msg) {
    global $block_count;
    $block_count++;
    echo "[BLOCKER] {$msg}\n";
}

function section($title) {
    echo "\n==========================================\n";
    echo " {$title}\n";
    echo "==========================================\n";
}

$projectRoot = '';
for ($i = 1; $i < $argc; $i++) {
    if (strpos($argv[$i], '--root=') === 0) {
        $projectRoot = substr($argv[$i], 7);
    }
}

if (empty($projectRoot)) {
    $projectRoot = realpath(__DIR__ . '/../..');
}

echo "\n孕禧小程序 — 文档一致性检查\n";
echo "项目目录: {$projectRoot}\n";

// ============================================================
// 1. 检查错误的表名 sxo_users
// ============================================================
section("1. 检查错误的表名 sxo_users");

$wrongPatterns = [
    'sxo_users' => '应为 sxo_user（ShopXO 用户表无 s 后缀）',
];

$docDirs = [
    $projectRoot . '/docs',
    $projectRoot . '/scripts',
];

$extensions = ['md', 'php', 'sql', 'txt', 'html', 'js', 'vue'];

foreach ($wrongPatterns as $pattern => $desc) {
    $found = false;
    foreach ($docDirs as $dir) {
        if (!is_dir($dir)) continue;
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $file) {
            if ($file->isDir()) continue;
            $ext = $file->getExtension();
            if (!in_array($ext, $extensions)) continue;
            $content = file_get_contents($file->getPathname());
            if (strpos($content, $pattern) !== false) {
                $relPath = str_replace($projectRoot . '/', '', $file->getPathname());
                $lines = explode("\n", $content);
                foreach ($lines as $num => $line) {
                    if (strpos($line, $pattern) !== false) {
                        block_item("{$relPath}:" . ($num + 1) . " 包含 '{$pattern}'（{$desc}）");
                        $found = true;
                    }
                }
            }
        }
    }
    if (!$found) {
        pass_item("未发现错误的表名 '{$pattern}'");
    }
}

// ============================================================
// 2. 检查占位符
// ============================================================
section("2. 检查占位符");

$placeholderPatterns = [
    '待提交' => 'commit hash 占位符未替换',
    '（待提交）' => 'commit hash 占位符未替换',
    'commit: （' => 'commit hash 占位符未替换',
    '{{PRIVACY_KEY}}' => '隐私密钥占位符未替换（仅 .env.example 允许）',
];

foreach ($placeholderPatterns as $pattern => $desc) {
    $found = false;
    foreach ($docDirs as $dir) {
        if (!is_dir($dir)) continue;
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $file) {
            if ($file->isDir()) continue;
            $ext = $file->getExtension();
            if (!in_array($ext, $extensions)) continue;
            $content = file_get_contents($file->getPathname());
            if (strpos($content, $pattern) !== false) {
                $relPath = str_replace($projectRoot . '/', '', $file->getPathname());
                if ($pattern === '{{PRIVACY_KEY}}' && strpos($relPath, '.example') !== false) {
                    continue;
                }
                block_item("{$relPath} 包含占位符 '{$pattern}'（{$desc}）");
                $found = true;
            }
        }
    }
    if (!$found) {
        pass_item("未发现占位符 '{$pattern}'");
    }
}

// ============================================================
// 3. 检查 UAT 报告版本号
// ============================================================
section("3. 检查 UAT 报告版本号");

$uatReport = $projectRoot . '/docs/uat-report-current.md';
if (file_exists($uatReport)) {
    $content = file_get_contents($uatReport);
    if (preg_match('/代码版本\s*\|\s*([a-f0-9]{7,})/', $content, $m)) {
        $docVersion = $m[1];
        $gitHead = trim(shell_exec('cd ' . escapeshellarg($projectRoot) . ' && git rev-parse --short HEAD 2>/dev/null') ?? '');
        if (!empty($gitHead)) {
            if ($docVersion === $gitHead) {
                pass_item("UAT 报告代码版本 {$docVersion} 与最新 commit {$gitHead} 一致");
            } else {
                warn_item("UAT 报告代码版本 {$docVersion} 与最新 commit {$gitHead} 不一致");
            }
        } else {
            warn_item("无法获取 git HEAD，跳过版本一致性检查");
        }
    } else {
        warn_item("UAT 报告中未找到代码版本字段");
    }
} else {
    warn_item("UAT 报告文件不存在（{$uatReport}）");
}

// ============================================================
// 4. 检查 release checklist 编号重复
// ============================================================
section("4. 检查 release checklist 编号重复");

$checklist = $projectRoot . '/docs/release-checklist.md';
if (file_exists($checklist)) {
    $content = file_get_contents($checklist);
    $seen = [];
    $duplicateFound = false;
    if (preg_match_all('/\|\s*(\d+\.\d+[a-z]?)\s*\|/', $content, $matches)) {
        foreach ($matches[1] as $num) {
            if (isset($seen[$num])) {
                block_item("release-checklist.md 编号重复: {$num}");
                $duplicateFound = true;
            }
            $seen[$num] = true;
        }
    }
    if (!$duplicateFound) {
        pass_item("release-checklist.md 编号无重复");
    }
} else {
    warn_item("release-checklist.md 不存在");
}

// ============================================================
// 汇总
// ============================================================
section("检查汇总");

$total = $pass_count + $warn_count + $block_count;
echo "  PASS: {$pass_count}  WARN: {$warn_count}  BLOCKER: {$block_count}  总计: {$total}\n\n";

if ($block_count > 0) {
    echo "存在 {$block_count} 个 BLOCKER → 文档与代码不一致\n";
    echo "退出码: 1\n";
    exit(1);
} else {
    echo "文档一致性检查通过\n";
    echo "退出码: 0\n";
    exit(0);
}
