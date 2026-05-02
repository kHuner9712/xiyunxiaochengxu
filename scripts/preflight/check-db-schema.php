#!/usr/bin/env php
<?php
/**
 * [MUYING-二开] 数据库 Schema 完整性检查脚本
 *
 * 用途：检查数据库中母婴业务所需的表和字段是否完整
 * 用法：php scripts/preflight/check-db-schema.php [--root=/path/to/shopxo-backend]
 *
 * 检查项：
 *   1. 母婴专属表是否存在
 *   2. sxo_user 扩展字段是否存在
 *   3. sxo_goods 扩展字段是否存在
 *   4. sxo_goods_favor.type 字段
 *   5. 关键索引是否存在
 *   6. 关键配置项是否存在
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

echo "\n禧孕小程序 — 数据库 Schema 完整性检查\n";

$envPath = $backendRoot . '/.env';
if (!file_exists($envPath)) {
    fwrite(STDERR, "[BLOCKER] .env 文件不存在（{$envPath}），无法连接数据库\n");
    exit(1);
}

$envContent = file_get_contents($envPath);

$dbConfig = [];
if (preg_match('/HOSTNAME\s*=\s*(.+)/i', $envContent, $m)) $dbConfig['host'] = trim($m[1]);
if (preg_match('/DATABASE\s*=\s*(.+)/i', $envContent, $m)) $dbConfig['dbname'] = trim($m[1]);
if (preg_match('/USERNAME\s*=\s*(.+)/i', $envContent, $m)) $dbConfig['user'] = trim($m[1]);
if (preg_match('/PASSWORD\s*=\s*(.+)/i', $envContent, $m)) $dbConfig['pass'] = trim($m[1]);
if (preg_match('/PORT\s*=\s*(\d+)/i', $envContent, $m)) $dbConfig['port'] = intval($m[1]);

if (empty($dbConfig['host']) || empty($dbConfig['dbname'])) {
    fwrite(STDERR, "[BLOCKER] .env 中数据库配置不完整\n");
    exit(1);
}

$port = $dbConfig['port'] ?? 3306;
$dsn = "mysql:host={$dbConfig['host']};port={$port};dbname={$dbConfig['dbname']};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $dbConfig['user'] ?? 'root', $dbConfig['pass'] ?? '', [PDO::ATTR_TIMEOUT => 5]);
    echo "数据库连接成功: {$dbConfig['dbname']}\n";
} catch (PDOException $e) {
    fwrite(STDERR, "[BLOCKER] 数据库连接失败: " . $e->getMessage() . "\n");
    exit(1);
}

function getTableColumns(PDO $pdo, string $table): array {
    try {
        $stmt = $pdo->query("SHOW FULL COLUMNS FROM `{$table}`");
        if (!$stmt) return [];
        $cols = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $cols[$row['Field']] = $row;
        }
        return $cols;
    } catch (PDOException $e) {
        return [];
    }
}

function getTableIndexes(PDO $pdo, string $table): array {
    try {
        $stmt = $pdo->query("SHOW INDEX FROM `{$table}`");
        if (!$stmt) return [];
        $indexes = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $name = $row['Key_name'];
            if (!isset($indexes[$name])) {
                $indexes[$name] = ['columns' => [], 'unique' => !$row['Non_unique']];
            }
            $indexes[$name]['columns'][] = $row['Column_name'];
        }
        return $indexes;
    } catch (PDOException $e) {
        return [];
    }
}

// ============================================================
// 1. 母婴专属表检查
// ============================================================
section("1. 母婴专属表检查");

$required_tables = [
    'sxo_activity'                      => '活动表（A1）',
    'sxo_activity_signup'               => '活动报名表（A2）',
    'sxo_invite_reward'                 => '邀请奖励表（A3）',
    'sxo_muying_feedback'               => '用户反馈表（A4）',
    'sxo_muying_audit_log'              => '审计日志表（D1）',
    'sxo_muying_compliance_log'         => '合规拦截日志表（D5）',
    'sxo_muying_stat_snapshot'          => '统计快照表（D6）',
    'sxo_muying_sensitive_log'          => '敏感词拦截日志表（D10）',
    'sxo_muying_content_sensitive_word' => '内容合规敏感词表（P3）',
    'sxo_muying_content_compliance_log' => '内容合规日志表（P3）',
];

$tables_ok = true;
foreach ($required_tables as $table => $desc) {
    $cols = getTableColumns($pdo, $table);
    if (empty($cols)) {
        block_item("表 {$table} 不存在（{$desc}）— 请执行 muying-final-migration.sql");
        $tables_ok = false;
    } else {
        pass_item("表 {$table} 存在（" . count($cols) . " 个字段）");
    }
}

// ============================================================
// 2. sxo_activity 关键字段检查
// ============================================================
section("2. sxo_activity 关键字段检查");

$activityFields = [
    'category', 'activity_type', 'activity_status', 'stage', 'suitable_crowd',
    'waitlist_count', 'waitlist_signup_count', 'allow_waitlist',
    'signup_code_enabled', 'require_location_checkin', 'latitude', 'longitude',
];

$cols = getTableColumns($pdo, 'sxo_activity');
if (!empty($cols)) {
    foreach ($activityFields as $field) {
        if (isset($cols[$field])) {
            pass_item("sxo_activity.{$field} 存在（{$cols[$field]['Type']}）");
        } else {
            block_item("sxo_activity.{$field} 不存在 — 请执行 muying-final-migration.sql B8 段");
        }
    }
}

// ============================================================
// 3. sxo_activity_signup 关键字段检查
// ============================================================
section("3. sxo_activity_signup 关键字段检查");

$signupFields = [
    'phone_hash', 'privacy_version', 'privacy_agreed_time',
    'is_waitlist', 'waitlist_to_normal_time', 'signup_code',
    'checkin_status', 'checkin_time',
];

$cols = getTableColumns($pdo, 'sxo_activity_signup');
if (!empty($cols)) {
    foreach ($signupFields as $field) {
        if (isset($cols[$field])) {
            pass_item("sxo_activity_signup.{$field} 存在（{$cols[$field]['Type']}）");
        } else {
            block_item("sxo_activity_signup.{$field} 不存在 — 请执行 muying-final-migration.sql B5b/B5c/B9 段");
        }
    }
}

// ============================================================
// 4. sxo_muying_feedback 关键字段检查
// ============================================================
section("4. sxo_muying_feedback 关键字段检查");

$feedbackFields = [
    'type', 'contact_hash', 'review_status', 'review_remark', 'review_admin_id', 'review_time',
];

$cols = getTableColumns($pdo, 'sxo_muying_feedback');
if (!empty($cols)) {
    foreach ($feedbackFields as $field) {
        if (isset($cols[$field])) {
            pass_item("sxo_muying_feedback.{$field} 存在（{$cols[$field]['Type']}）");
        } else {
            block_item("sxo_muying_feedback.{$field} 不存在 — 请执行 muying-final-migration.sql B7b 段");
        }
    }
}

// ============================================================
// 5. sxo_user 扩展字段检查
// ============================================================
section("5. sxo_user 扩展字段检查");

$userFields = [
    'current_stage' => '孕育阶段（B1）',
    'due_date'      => '预产期（B1）',
    'baby_birthday' => '宝宝生日（B1）',
    'invite_code'   => '邀请码（B2）',
];

$cols = getTableColumns($pdo, 'sxo_user');
if (!empty($cols)) {
    foreach ($userFields as $field => $desc) {
        if (isset($cols[$field])) {
            pass_item("sxo_user.{$field} 存在（{$desc}，{$cols[$field]['Type']}）");
        } else {
            block_item("sxo_user.{$field} 不存在（{$desc}）— 请执行 muying-final-migration.sql B1/B2 段");
        }
    }
} else {
    block_item("sxo_user 表不存在");
}

// ============================================================
// 6. sxo_goods 扩展字段检查
// ============================================================
section("6. sxo_goods 扩展字段检查");

$goodsFields = [
    'stage', 'selling_point', 'approval_number',
    'min_baby_month_age', 'max_baby_month_age', 'focus_areas',
    'risk_category', 'qualification_status', 'qualification_remark',
    'is_muying_recommend', 'muying_sort_level',
];

$cols = getTableColumns($pdo, 'sxo_goods');
if (!empty($cols)) {
    foreach ($goodsFields as $field) {
        if (isset($cols[$field])) {
            pass_item("sxo_goods.{$field} 存在（{$cols[$field]['Type']}）");
        } else {
            warn_item("sxo_goods.{$field} 不存在 — 商品母婴标签功能不可用");
        }
    }
} else {
    block_item("sxo_goods 表不存在");
}

// ============================================================
// 7. sxo_goods_favor.type 字段检查
// ============================================================
section("7. sxo_goods_favor 扩展字段检查");

$cols = getTableColumns($pdo, 'sxo_goods_favor');
if (!empty($cols)) {
    if (isset($cols['type'])) {
        pass_item("sxo_goods_favor.type 存在（{$cols['type']['Type']}）");
    } else {
        block_item("sxo_goods_favor.type 不存在 — 活动收藏功能不可用");
    }
} else {
    block_item("sxo_goods_favor 表不存在");
}

// ============================================================
// 8. 关键索引检查
// ============================================================
section("8. 关键索引检查");

$indexChecks = [
    'sxo_user' => ['uk_invite_code' => '邀请码唯一索引（C2）'],
    'sxo_invite_reward' => ['uk_inviter_invitee_event' => '邀请奖励去重索引（C3）'],
    'sxo_activity_signup' => ['idx_phone_hash' => '手机号哈希索引'],
    'sxo_muying_feedback' => ['idx_contact_hash' => '联系方式哈希索引', 'idx_type' => '反馈类型索引'],
    'sxo_muying_stat_snapshot' => ['uk_date_metric' => '快照日期+指标唯一索引'],
];

foreach ($indexChecks as $table => $indexes) {
    $tableIndexes = getTableIndexes($pdo, $table);
    foreach ($indexes as $idxName => $desc) {
        if (isset($tableIndexes[$idxName])) {
            pass_item("索引 {$table}.{$idxName} 存在（{$desc}）");
        } else {
            block_item("索引 {$table}.{$idxName} 不存在（{$desc}）— 请执行 muying-final-migration.sql C 段");
        }
    }
}

// ============================================================
// 9. 关键配置项检查
// ============================================================
section("9. 关键配置项检查");

$configChecks = [
    'muying_invite_register_reward'  => '邀请注册奖励积分数',
    'muying_invite_first_order_reward' => '邀请首单奖励积分数',
    'home_site_name'                 => '站点名称',
    'feature_activity_enabled'       => '活动功能开关',
    'feature_invite_enabled'         => '邀请功能开关',
    'feature_feedback_enabled'       => '反馈功能开关',
    'feature_wallet_enabled'         => '钱包功能开关（应为0）',
    'feature_shop_enabled'           => '多商户功能开关（应为0）',
    'feature_distribution_enabled'   => '分销功能开关（应为0）',
];

foreach ($configChecks as $tag => $desc) {
    try {
        $stmt = $pdo->prepare("SELECT `value` FROM `sxo_config` WHERE `only_tag` = ? LIMIT 1");
        $stmt->execute([$tag]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $val = $row['value'];
            if ($val === '') {
                warn_item("配置 {$tag} 存在但值为空（{$desc}）");
            } else {
                pass_item("配置 {$tag} = {$val}（{$desc}）");
            }
        } else {
            block_item("配置 {$tag} 不存在（{$desc}）— 请执行 muying-final-migration.sql D8 段");
        }
    } catch (PDOException $e) {
        warn_item("无法检查配置 {$tag}: " . $e->getMessage());
    }
}

// ============================================================
// 10. 数据完整性快速检查
// ============================================================
section("10. 数据完整性快速检查");

try {
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `sxo_user` WHERE `invite_code` = '' AND `is_delete_time` = 0");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $emptyCodes = intval($row['cnt']);
    if ($emptyCodes > 0) {
        warn_item("有 {$emptyCodes} 个用户邀请码为空 — 请执行 muying-final-migration.sql C1 段补填邀请码");
    } else {
        pass_item("所有用户邀请码已填充");
    }
} catch (PDOException $e) {
    warn_item("无法检查用户邀请码: " . $e->getMessage());
}

try {
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `sxo_invite_reward` WHERE `trigger_event` = 'register' AND `reward_value` > 0 AND `status` = 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $oldRewards = intval($row['cnt']);
    if ($oldRewards > 0) {
        warn_item("有 {$oldRewards} 条旧注册奖励记录（reward_value>0），建议执行 muying-invite-reward-unify-migration.sql 统一处理");
    } else {
        pass_item("邀请奖励数据已统一");
    }
} catch (PDOException $e) {
    warn_item("无法检查邀请奖励: " . $e->getMessage());
}

// ============================================================
// 11. 后台权限菜单检查
// ============================================================
section("11. 后台权限菜单检查");

$requiredPowers = [
    ['control' => 'Muyingprivacy', 'action' => 'Index', 'name' => '隐私数据管理'],
    ['control' => 'Muyingprivacy', 'action' => 'Search', 'name' => '用户数据查询'],
    ['control' => 'Muyingprivacy', 'action' => 'Anonymize', 'name' => '数据匿名化'],
    ['control' => 'Contentsensitiveword', 'action' => 'Index', 'name' => '内容合规'],
    ['control' => 'Contentsensitiveword', 'action' => 'Save', 'name' => '添加敏感词'],
    ['control' => 'Contentsensitiveword', 'action' => 'Delete', 'name' => '删除敏感词'],
    ['control' => 'Contentsensitiveword', 'action' => 'LogList', 'name' => '查看合规日志'],
];

foreach ($requiredPowers as $pw) {
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM `sxo_power` WHERE `control` = ? AND `action` = ? LIMIT 1");
        $stmt->execute([$pw['control'], $pw['action']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            pass_item("权限 {$pw['control']}/{$pw['action']} 存在（id={$row['id']}, {$row['name']}）");
        } else {
            block_item("权限 {$pw['control']}/{$pw['action']}（{$pw['name']}）不存在 — 请执行 muying-v1-post-migration.sql");
        }
    } catch (PDOException $e) {
        warn_item("无法检查权限 {$pw['control']}/{$pw['action']}: " . $e->getMessage());
    }
}

// ============================================================
// 汇总
// ============================================================
section("检查汇总");

$total = $pass_count + $warn_count + $block_count;
echo "  PASS: {$pass_count}  WARN: {$warn_count}  BLOCKER: {$block_count}  总计: {$total}\n\n";

if ($block_count > 0) {
    echo "存在 {$block_count} 个 BLOCKER → 数据库 Schema 不完整，部分功能不可用\n\n";
    foreach ($blocker_items as $item) {
        echo "  ✗ {$item}\n";
    }
    echo "\n修复方式:\n";
    echo "  mysql -u root -p {$dbConfig['dbname']} < docs/muying-final-migration.sql\n";
    echo "  mysql -u root -p {$dbConfig['dbname']} < docs/sql/muying-v1-post-migration.sql\n\n";
    echo "退出码: 1\n";
    exit(1);
} elseif ($warn_count > 0) {
    echo "存在 {$warn_count} 个 WARN → 核心功能可用，部分功能可能异常\n\n";
    foreach ($warn_items as $item) {
        echo "  ⚠ {$item}\n";
    }
    echo "\n退出码: 0\n";
    exit(0);
} else {
    echo "全部通过 → 数据库 Schema 完整\n\n";
    echo "退出码: 0\n";
    exit(0);
}
