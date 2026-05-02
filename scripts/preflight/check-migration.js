#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MIGRATION_FILE = path.resolve(__dirname, '../../docs/muying-final-migration.sql');
const SQL_DIR = path.resolve(__dirname, '../../docs/sql');

const REQUIRED_TABLES = [
  'sxo_activity',
  'sxo_activity_signup',
  'sxo_invite_reward',
  'sxo_muying_feedback',
  'sxo_muying_audit_log',
  'sxo_muying_compliance_log',
  'sxo_muying_stat_snapshot',
  'sxo_muying_sensitive_log',
  'sxo_muying_content_sensitive_word',
  'sxo_muying_content_compliance_log',
];

const REQUIRED_FIELDS = {
  'sxo_activity': [
    'id', 'title', 'cover', 'images', 'category', 'activity_type', 'activity_status',
    'stage', 'description', 'content', 'suitable_crowd', 'address',
    'start_time', 'end_time', 'signup_start_time', 'signup_end_time',
    'max_count', 'signup_count', 'waitlist_count', 'waitlist_signup_count',
    'allow_waitlist', 'signup_code_enabled', 'require_location_checkin',
    'latitude', 'longitude', 'is_free', 'price', 'contact_name', 'contact_phone',
    'access_count', 'sort_level', 'is_enable', 'is_delete_time', 'add_time', 'upd_time',
  ],
  'sxo_activity_signup': [
    'id', 'activity_id', 'user_id', 'name', 'phone', 'phone_hash', 'privacy_version',
    'stage', 'due_date', 'baby_month_age', 'baby_birthday', 'remark',
    'privacy_agreed_time', 'status', 'is_waitlist', 'waitlist_to_normal_time',
    'signup_code', 'checkin_status', 'checkin_time', 'is_delete_time', 'add_time', 'upd_time',
  ],
  'sxo_invite_reward': [
    'id', 'inviter_id', 'invitee_id', 'reward_type', 'reward_value',
    'trigger_event', 'status', 'add_time', 'upd_time',
  ],
  'sxo_muying_feedback': [
    'id', 'user_id', 'nickname', 'avatar', 'content', 'stage',
    'contact', 'contact_hash', 'review_status', 'review_remark',
    'review_admin_id', 'review_time', 'sort_level', 'is_enable',
    'is_delete_time', 'add_time', 'upd_time',
  ],
  'sxo_muying_audit_log': [
    'id', 'admin_id', 'admin_username', 'scene', 'target_id', 'conditions',
    'export_count', 'type', 'action', 'user_id', 'detail', 'status',
    'ip', 'remark', 'add_time',
  ],
  'sxo_muying_compliance_log': [
    'id', 'admin_id', 'admin_username', 'feature_key', 'action', 'reason',
    'controller', 'api_action', 'user_id', 'ip', 'add_time',
  ],
  'sxo_muying_stat_snapshot': [
    'id', 'stat_date', 'metric_key', 'metric_value', 'add_time',
  ],
  'sxo_muying_sensitive_log': [
    'id', 'content_type', 'content_id', 'word', 'ip', 'add_time',
  ],
  'sxo_muying_content_sensitive_word': [
    'id', 'word', 'risk', 'is_enable', 'add_time', 'upd_time',
  ],
  'sxo_muying_content_compliance_log': [
    'id', 'content_type', 'content_id', 'word', 'risk', 'field',
    'admin_id', 'action', 'ip', 'add_time',
  ],
};

const REQUIRED_INDEXES = {
  'sxo_activity_signup': ['idx_phone_hash', 'idx_signup_code'],
  'sxo_muying_feedback': ['idx_contact_hash', 'idx_type'],
  'sxo_muying_stat_snapshot': ['uk_date_metric'],
  'sxo_user': ['uk_invite_code'],
  'sxo_invite_reward': ['uk_inviter_invitee_event'],
  'sxo_muying_content_sensitive_word': ['uk_word'],
};

const REQUIRED_CONFIGS = [
  'feature_activity_enabled',
  'feature_invite_enabled',
  'feature_feedback_enabled',
  'feature_content_enabled',
  'qualification_icp_filing',
  'muying_invite_register_reward',
  'muying_invite_first_order_reward',
  'muying_privacy_key_configured',
];

const MYSQL8_PATTERNS = [
  { pattern: /^\s*ALTER\s+TABLE\s+.*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/im, name: 'ADD COLUMN IF NOT EXISTS' },
  { pattern: /^\s*CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/im, name: 'CREATE INDEX IF NOT EXISTS' },
  { pattern: /^\s*SELECT.*\bOVER\s*\(/im, name: '窗口函数 OVER()' },
  { pattern: /^\s*WITH\s+RECURSIVE\b/im, name: '递归 CTE' },
  { pattern: /^\s*SELECT.*\bJSON_TABLE\b/im, name: 'JSON_TABLE' },
  { pattern: /^\s*SELECT.*\bROW_NUMBER\s*\(/im, name: 'ROW_NUMBER()' },
  { pattern: /^\s*SELECT.*\bRANK\s*\(\s*\)\s+OVER/im, name: 'RANK() OVER' },
  { pattern: /^\s*SELECT.*\bLATERAL\b/im, name: 'LATERAL' },
];

let errors = 0;
let warnings = 0;

function error(msg) {
  console.log(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function extractCreateTableFields(sql, tableName) {
  const tableRegex = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+\`${tableName}\`\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE=`,
    'i'
  );
  const match = sql.match(tableRegex);
  if (!match) return [];

  const body = match[1];
  const fields = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const fieldMatch = trimmed.match(/^\`(\w+)\`\s+/);
    if (fieldMatch && !['PRIMARY', 'KEY', 'UNIQUE', 'INDEX', 'CONSTRAINT'].includes(fieldMatch[1])) {
      fields.push(fieldMatch[1]);
    }
  }
  return fields;
}

function extractAlterTableFields(sql, tableName) {
  const fields = [];
  const regex = new RegExp(
    `ALTER\\s+TABLE\\s+\`${tableName}\`\\s+ADD\\s+COLUMN\\s+\`(\\w+)\``,
    'gi'
  );
  let match;
  while ((match = regex.exec(sql)) !== null) {
    if (!fields.includes(match[1])) {
      fields.push(match[1]);
    }
  }
  return fields;
}

function extractIndexes(sql, tableName) {
  const indexes = [];
  const tableRegex = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+\`${tableName}\`\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE=`,
    'i'
  );
  const match = sql.match(tableRegex);
  if (match) {
    const body = match[1];
    const idxRegex = /(?:UNIQUE\s+)?KEY\s+\`(\w+)\`/gi;
    let idxMatch;
    while ((idxMatch = idxRegex.exec(body)) !== null) {
      if (!indexes.includes(idxMatch[1])) {
        indexes.push(idxMatch[1]);
      }
    }
  }

  const alterIdxRegex = new RegExp(
    `ALTER\\s+TABLE\\s+\`${tableName}\`[^;]*ADD\\s+(?:UNIQUE\\s+)?(?:INDEX|KEY)\\s+\`(\\w+)\``,
    'gi'
  );
  let altMatch;
  while ((altMatch = alterIdxRegex.exec(sql)) !== null) {
    if (!indexes.includes(altMatch[1])) {
      indexes.push(altMatch[1]);
    }
  }

  return indexes;
}

function extractConfigTags(sql) {
  const tags = [];
  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue;

    const valueMatches = trimmed.matchAll(/'([^']*_enabled|[^']*_reward|[^']*_configured|[^']*qualification_[^']*|[^']*_filing|[^']*_commercial|[^']*_edi|[^']*_medical|[^']*_live|[^']*_payment)'/gi);
    for (const m of valueMatches) {
      if (!tags.includes(m[1])) {
        tags.push(m[1]);
      }
    }

    const whereMatches = trimmed.matchAll(/only_tag['"`\s]*=\s*'([^']+)'/gi);
    for (const m of whereMatches) {
      if (!tags.includes(m[1])) {
        tags.push(m[1]);
      }
    }

    const inMatches = trimmed.matchAll(/only_tag['"`\s]*IN\s*\(([^)]+)\)/gi);
    for (const m of inMatches) {
      const innerTags = m[1].matchAll(/'([^']+)'/gi);
      for (const it of innerTags) {
        if (!tags.includes(it[1])) {
          tags.push(it[1]);
        }
      }
    }
  }
  return tags;
}

function main() {
  console.log('=== 禧孕数据库迁移安全检查 ===\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.log(`❌ 迁移文件不存在: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  const mainSql = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  // 读取增量迁移文件
  const postMigrationFile = path.join(SQL_DIR, 'muying-v1-post-migration.sql');
  let postSql = '';
  if (fs.existsSync(postMigrationFile)) {
    postSql = fs.readFileSync(postMigrationFile, 'utf-8');
  }

  const sql = mainSql + '\n' + postSql;

  // 1. 检查 DROP TABLE 高风险语句
  console.log('--- 1. DROP TABLE 高风险语句检查 ---');
  const dropTableMatches = sql.match(/^\s*DROP\s+TABLE\s+(?!IF\s+EXISTS)/gim);
  if (dropTableMatches) {
    error(`发现 ${dropTableMatches.length} 处无 IF EXISTS 保护的 DROP TABLE 语句`);
  } else {
    const commentedDrops = sql.match(/--\s*DROP\s+TABLE/gi);
    if (commentedDrops) {
      ok(`DROP TABLE 仅出现在注释中（${commentedDrops.length} 处，回滚用）`);
    } else {
      ok('未发现 DROP TABLE 语句');
    }
  }

  // 2. 检查 TRUNCATE 语句
  console.log('\n--- 2. TRUNCATE 语句检查 ---');
  const truncateMatches = sql.match(/^\s*TRUNCATE\s+/gim);
  if (truncateMatches) {
    error(`发现 ${truncateMatches.length} 处 TRUNCATE 语句`);
  } else {
    ok('未发现 TRUNCATE 语句');
  }

  // 3. MySQL 8 专属语法检查
  console.log('\n--- 3. MySQL 8 专属语法检查 ---');
  let mysql8Found = false;
  for (const { pattern, name } of MYSQL8_PATTERNS) {
    const matches = sql.match(pattern);
    if (matches) {
      error(`发现 MySQL 8 专属语法: ${name}`);
      mysql8Found = true;
    }
  }
  if (!mysql8Found) {
    ok('未发现 MySQL 8 专属语法');
  }

  // 4. 表完整性检查
  console.log('\n--- 4. 表完整性检查 ---');
  for (const table of REQUIRED_TABLES) {
    const createRegex = new RegExp(
      `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+\`${table}\``,
      'i'
    );
    if (createRegex.test(sql)) {
      ok(`表 ${table} 在 A/D 段建表语句中`);
    } else {
      error(`表 ${table} 缺少建表语句`);
    }
  }

  // 5. 字段完整性检查
  console.log('\n--- 5. 字段完整性检查 ---');
  for (const [table, fields] of Object.entries(REQUIRED_FIELDS)) {
    const createFields = extractCreateTableFields(sql, table);
    const alterFields = extractAlterTableFields(sql, table);
    const allFields = [...new Set([...createFields, ...alterFields])];

    const missing = fields.filter(f => !allFields.includes(f));
    if (missing.length === 0) {
      ok(`表 ${table} 字段完整（${fields.length} 个）`);
    } else {
      error(`表 ${table} 缺少字段: ${missing.join(', ')}`);
    }
  }

  // 6. 索引完整性检查
  console.log('\n--- 6. 索引完整性检查 ---');
  for (const [table, indexes] of Object.entries(REQUIRED_INDEXES)) {
    const foundIndexes = extractIndexes(sql, table);
    const missing = indexes.filter(idx => !foundIndexes.includes(idx));
    if (missing.length === 0) {
      ok(`表 ${table} 索引完整`);
    } else {
      error(`表 ${table} 缺少索引: ${missing.join(', ')}`);
    }
  }

  // 7. 配置项检查
  console.log('\n--- 7. 配置项检查 ---');
  const configTags = extractConfigTags(sql);
  for (const tag of REQUIRED_CONFIGS) {
    if (configTags.includes(tag)) {
      ok(`配置项 ${tag} 存在`);
    } else {
      warn(`配置项 ${tag} 未在迁移 SQL 中找到`);
    }
  }

  // 8. 幂等性检查
  console.log('\n--- 8. 幂等性检查 ---');
  const bareAlterIndex = sql.match(/^\s*ALTER\s+TABLE\s+\`\w+\`\s+ADD\s+(?:UNIQUE\s+)?(?:INDEX|KEY)\s+/gm);
  if (bareAlterIndex) {
    warn(`发现 ${bareAlterIndex.length} 处非幂等的 ADD INDEX 语句（未用 information_schema 保护）`);
  } else {
    ok('所有 ADD INDEX 语句都有幂等保护');
  }

  const bareAlterColumn = sql.match(/^\s*ALTER\s+TABLE\s+\`\w+\`\s+ADD\s+COLUMN\s+/gm);
  if (bareAlterColumn) {
    warn(`发现 ${bareAlterColumn.length} 处非幂等的 ADD COLUMN 语句（未用 information_schema 保护）`);
  } else {
    ok('所有 ADD COLUMN 语句都有幂等保护');
  }

  // 9. 权限 ID 冲突检查
  console.log('\n--- 9. 权限 ID 冲突检查 ---');
  const powerIds = [];
  const powerIdRegex = /INSERT\s+IGNORE\s+INTO\s+\`sxo_power\`\s+\([^)]*\)\s+VALUES\s*\((\d+)/gi;
  let pMatch;
  while ((pMatch = powerIdRegex.exec(sql)) !== null) {
    powerIds.push(parseInt(pMatch[1]));
  }
  const duplicateIds = powerIds.filter((id, i) => powerIds.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    error(`权限 ID 冲突: ${[...new Set(duplicateIds)].join(', ')}`);
  } else if (powerIds.length > 0) {
    ok(`权限 ID 无冲突（${powerIds.length} 个: ${powerIds.sort((a, b) => a - b).join(', ')}）`);
  }

  // 10. docs/sql/*.sql 独立扫描
  console.log('\n--- 10. docs/sql/*.sql 独立扫描 ---');
  if (fs.existsSync(SQL_DIR)) {
    const sqlFiles = fs.readdirSync(SQL_DIR).filter(f => f.endsWith('.sql'));
    for (const file of sqlFiles) {
      const filePath = path.join(SQL_DIR, file);
      const fileSql = fs.readFileSync(filePath, 'utf-8');

      // 10a. 非幂等 ALTER TABLE ADD COLUMN
      const bareAlterCol = fileSql.match(/^\s*ALTER\s+TABLE\s+\`\w+\`\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gm);
      if (bareAlterCol) {
        const hasInfoSchema = fileSql.includes('INFORMATION_SCHEMA.COLUMNS');
        if (!hasInfoSchema) {
          error(`${file}: 发现 ${bareAlterCol.length} 处非幂等 ADD COLUMN（无 information_schema 保护）`);
        } else {
          ok(`${file}: ADD COLUMN 有 information_schema 保护`);
        }
      }

      // 10b. 非幂等 ALTER TABLE ADD INDEX
      const bareAlterIdx = fileSql.match(/^\s*ALTER\s+TABLE\s+\`\w+\`\s+ADD\s+(?:UNIQUE\s+)?(?:INDEX|KEY)\s+(?!IF\s+NOT\s+EXISTS)/gm);
      if (bareAlterIdx) {
        const hasInfoSchema = fileSql.includes('INFORMATION_SCHEMA.STATISTICS');
        if (!hasInfoSchema) {
          warn(`${file}: 发现 ${bareAlterIdx.length} 处 ADD INDEX（无 information_schema 保护，重复执行会报错）`);
        } else {
          ok(`${file}: ADD INDEX 有 information_schema 保护`);
        }
      }

      // 10c. DROP/TRUNCATE 检查
      const dropMatches = fileSql.match(/^\s*DROP\s+TABLE\s+(?!IF\s+EXISTS)/gim);
      if (dropMatches) {
        error(`${file}: 发现 ${dropMatches.length} 处无 IF EXISTS 保护的 DROP TABLE`);
      }
      const truncateMatches = fileSql.match(/^\s*TRUNCATE\s+/gim);
      if (truncateMatches) {
        error(`${file}: 发现 ${truncateMatches.length} 处 TRUNCATE`);
      }

      // 10d. MySQL 8 语法检查
      for (const { pattern, name } of MYSQL8_PATTERNS) {
        if (pattern.test(fileSql)) {
          error(`${file}: 发现 MySQL 8 专属语法: ${name}`);
        }
      }

      // 10e. INSERT 无幂等保护检查
      const bareInsert = fileSql.match(/^\s*INSERT\s+INTO\s+/gm);
      const ignoreInsert = fileSql.match(/^\s*INSERT\s+IGNORE\s+INTO\s+/gm);
      const duplicateKeyInsert = fileSql.match(/ON\s+DUPLICATE\s+KEY\s+UPDATE/gi);
      const protectedCount = (ignoreInsert ? ignoreInsert.length : 0) + (duplicateKeyInsert ? duplicateKeyInsert.length : 0);
      if (bareInsert && protectedCount < bareInsert.length) {
        warn(`${file}: 发现 ${bareInsert.length - protectedCount} 处无 IGNORE/ON DUPLICATE KEY UPDATE 保护的 INSERT`);
      }
    }
  } else {
    warn('docs/sql/ 目录不存在');
  }

  // 汇总
  console.log('\n=== 检查结果汇总 ===');
  console.log(`  错误: ${errors}`);
  console.log(`  警告: ${warnings}`);

  if (errors > 0) {
    console.log('\n❌ 检查未通过，请修复上述错误后再执行迁移');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  检查通过但有警告，请确认警告项是否可接受');
    process.exit(0);
  } else {
    console.log('\n✅ 全部检查通过，可以安全执行迁移');
    process.exit(0);
  }
}

main();
