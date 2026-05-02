#!/usr/bin/env php
<?php
/**
 * [MUYING-二开] 发布冻结检查脚本
 *
 * 用途：在创建 release 分支前检查是否满足冻结条件
 * 用法：php scripts/preflight/release-freeze-check.php [--root=/path/to/project]
 *
 * 检查项：
 *   1. 当前 git branch 是否 release/*
 *   2. 工作区是否干净
 *   3. UAT 报告版本是否等于 HEAD
 *   4. 文档是否仍有待执行项
 *   5. 是否存在 .env 被跟踪
 *   6. 是否存在待提交占位符
 *   7. 是否存在高风险页面路径
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
    echo "\n--- {$title} ---\n";
}

function run_git($cmd, $root) {
    $output = [];
    $ret = 0;
    chdir($root);
    exec("git " . $cmd . " 2>&1", $output, $ret);
    return [implode("\n", $output), $ret];
}

// 解析参数
$projectRoot = '';
for ($i = 1; $i < $argc; $i++) {
    if (strpos($argv[$i], '--root=') === 0) {
        $projectRoot = substr($argv[$i], 7);
    }
}

if (empty($projectRoot)) {
    $projectRoot = realpath(__DIR__ . '/../../');
}

echo "\n禧孕小程序 — 发布冻结检查\n";
echo "项目目录: {$projectRoot}\n";

// ============================================================
// 1. Git 分支检查
// ============================================================
section("1. Git 分支检查");

list($branch, $ret) = run_git("rev-parse --abbrev-ref HEAD", $projectRoot);
$branch = trim($branch);

if (strpos($branch, 'release/') === 0) {
    pass_item("当前分支: {$branch}（release 分支）");
} else {
    warn_item("当前分支: {$branch}（非 release 分支，创建 RC 前需切换到 release/* 分支）");
}

// ============================================================
// 2. 工作区干净检查
// ============================================================
section("2. 工作区干净检查");

list($status, $ret) = run_git("status --porcelain", $projectRoot);
if (empty(trim($status))) {
    pass_item("工作区干净，无未提交变更");
} else {
    $lines = array_filter(explode("\n", trim($status)));
    $count = count($lines);
    block_item("工作区有 {$count} 个未提交变更，冻结前必须提交或暂存");
}

// ============================================================
// 3. UAT 报告版本检查
// ============================================================
section("3. UAT 报告版本检查");

list($headHash, $ret) = run_git("rev-parse --short HEAD", $projectRoot);
$headHash = trim($headHash);

$uatReport = $projectRoot . '/docs/uat-report-current.md';
if (file_exists($uatReport)) {
    $content = file_get_contents($uatReport);
    if (preg_match('/代码版本.*?(\w{7,})/', $content, $m)) {
        $docVersion = $m[1];
        if ($docVersion === $headHash) {
            pass_item("UAT 报告代码版本 {$docVersion} 与 HEAD {$headHash} 一致");
        } else {
            block_item("UAT 报告代码版本 {$docVersion} 与 HEAD {$headHash} 不一致");
        }
    } else {
        warn_item("UAT 报告中未找到代码版本字段");
    }

    // 检查待执行项
    $pending_count = 0;
    $lines = explode("\n", $content);
    foreach ($lines as $line) {
        if (strpos($line, '⏳') !== false && (strpos($line, '待执行') !== false || strpos($line, '待确认') !== false || strpos($line, '待回填') !== false)) {
            $pending_count++;
        }
    }
    if ($pending_count > 0) {
        block_item("UAT 报告中仍有 {$pending_count} 处待执行项，真实 UAT 未完成");
    } else {
        pass_item("UAT 报告中无待执行项");
    }
} else {
    block_item("UAT 报告文件不存在");
}

// ============================================================
// 4. .env 跟踪检查
// ============================================================
section("4. .env 跟踪检查");

list($envTracked, $ret) = run_git("ls-files .env", $projectRoot);
if (empty(trim($envTracked))) {
    pass_item(".env 未被 git 跟踪");
} else {
    block_item(".env 已被 git 跟踪，必须从版本控制中移除");
}

list($envExample, $ret) = run_git("ls-files .env.example", $projectRoot);
if (!empty(trim($envExample))) {
    pass_item(".env.example 存在");
} else {
    warn_item(".env.example 不存在，建议添加模板文件");
}

// ============================================================
// 5. 待提交占位符检查
// ============================================================
section("5. 待提交占位符检查");

$docsDir = $projectRoot . '/docs';
if (is_dir($docsDir)) {
    $found_placeholder = false;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($docsDir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'md') {
            $content = file_get_contents($file->getPathname());
            if (strpos($content, '待提交') !== false) {
                $relPath = str_replace($projectRoot . '/', '', $file->getPathname());
                block_item("{$relPath} 包含占位符'待提交'");
                $found_placeholder = true;
            }
        }
    }
    if (!$found_placeholder) {
        pass_item("文档中无'待提交'占位符");
    }
}

// ============================================================
// 6. 高风险页面路径检查
// ============================================================
section("6. 高风险页面路径检查");

$highRiskPaths = [
    '/pages/shop/'           => '多商户页面（一期不可用）',
    '/pages/distribution/'   => '分销页面（一期不可用）',
    '/pages/wallet/'         => '钱包页面（一期不可用）',
    '/pages/hospital/'       => '互联网医院页面（一期不可用）',
    '/pages/liveplayer/'     => '直播页面（一期不可用）',
];

$uniappDir = $projectRoot . '/shopxo-uniapp';
$found_risk = false;
if (is_dir($uniappDir)) {
    foreach ($highRiskPaths as $path => $desc) {
        $fullPath = $uniappDir . $path;
        if (is_dir($fullPath)) {
            warn_item("高风险页面目录存在: {$path}（{$desc}）");
            $found_risk = true;
        }
    }
}
if (!$found_risk) {
    pass_item("未发现高风险页面目录");
}

// ============================================================
// 7. 关键文件存在检查
// ============================================================
section("7. 关键文件存在检查");

$requiredFiles = [
    'docs/release-branch-process.md'    => '发布分支规则',
    'docs/release-notes-v1.0.0.md'      => '版本记录',
    'docs/release-freeze-checklist.md'  => '发布冻结检查清单',
    'docs/uat-report-current.md'        => 'UAT 报告',
    'docs/privacy-data-deletion.md'     => '数据删除流程',
    'docs/content-compliance-rules.md'  => '内容合规规则',
    'docs/sql/muying-v1-post-migration.sql' => '增量迁移 SQL',
];

foreach ($requiredFiles as $file => $desc) {
    if (file_exists($projectRoot . '/' . $file)) {
        pass_item("{$desc}: {$file}");
    } else {
        block_item("{$desc} 缺失: {$file}");
    }
}

// ============================================================
// 汇总
// ============================================================
echo "\n=== 检查结果 ===\n";
echo "PASS: {$pass_count}\n";
echo "WARN: {$warn_count}\n";
echo "BLOCKER: {$block_count}\n";

if ($block_count > 0) {
    echo "\n❌ 存在 BLOCKER，不可创建 release 分支\n";
    echo "修复 BLOCKER 后重新运行本脚本\n";
    exit(1);
} else {
    if ($warn_count > 0) {
        echo "\n⚠️ 无 BLOCKER，但有 {$warn_count} 个 WARN，请确认后继续\n";
    } else {
        echo "\n✅ 所有检查通过，可以创建 release 分支\n";
    }
    exit(0);
}
