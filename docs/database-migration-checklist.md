# 禧孕母婴数据库迁移检查清单

## 适用版本

- MySQL 5.7.44（宝塔默认）
- 主迁移文件：`docs/muying-final-migration.sql`
- 增量迁移文件：`docs/sql/muying-v1-post-migration.sql`
- 执行顺序：先主迁移，再增量迁移
- 详见 `docs/sql/README.md`

---

## 一、执行前备份

```sql
-- 在宝塔面板 → 数据库 → 备份，或手动执行：
mysqldump -u root -p --single-transaction --routines --triggers --set-gtid-purged=OFF sxo > sxo_backup_$(date +%Y%m%d%H%M%S).sql

-- 仅备份母婴相关表（更快）：
mysqldump -u root -p --single-transaction sxo \
  sxo_activity sxo_activity_signup sxo_invite_reward sxo_muying_feedback \
  sxo_muying_audit_log sxo_muying_compliance_log sxo_muying_stat_snapshot \
  sxo_muying_sensitive_log \
  sxo_user sxo_goods sxo_goods_favor sxo_config sxo_power sxo_role_power \
  > muying_tables_backup_$(date +%Y%m%d%H%M%S).sql
```

---

## 二、执行前检查

### 2.1 确认数据库版本

```sql
SELECT VERSION();
-- 预期：5.7.x，不支持 8.0 专属语法
```

### 2.2 确认当前表状态

```sql
-- 检查母婴专属表是否已存在
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
AND TABLE_NAME IN (
  'sxo_activity','sxo_activity_signup','sxo_invite_reward',
  'sxo_muying_feedback','sxo_muying_audit_log',
  'sxo_muying_compliance_log','sxo_muying_stat_snapshot',
  'sxo_muying_sensitive_log'
);
```

### 2.3 确认 ShopXO 原生表存在

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
AND TABLE_NAME IN ('sxo_user','sxo_goods','sxo_goods_favor','sxo_config','sxo_power','sxo_role_power');
-- 以上表必须存在，否则不是有效的 ShopXO 安装
```

### 2.4 检查是否有空邀请码用户

```sql
SELECT COUNT(*) FROM sxo_user WHERE invite_code='' OR invite_code IS NULL;
-- 如果 > 0，C1 存储过程会自动填充
```

---

## 三、执行迁移

### 3.1 全新部署

直接执行完整文件：

```bash
mysql -u root -p sxo < docs/muying-final-migration.sql
mysql -u root -p sxo < docs/sql/muying-v1-post-migration.sql
```

### 3.2 已有 ShopXO 部署升级

A 段 `CREATE TABLE IF NOT EXISTS` 会自动跳过已存在的表。  
B 段每条 ALTER 前都检查字段是否存在，可安全重复执行。  
C 段部分不可重复执行（已改为幂等版本）。  
D 段 `INSERT IGNORE` 和 `ON DUPLICATE KEY UPDATE` 确保幂等。

```bash
mysql -u root -p sxo < docs/muying-final-migration.sql
mysql -u root -p sxo < docs/sql/muying-v1-post-migration.sql
```

### 3.3 分段执行（推荐生产环境）

如果担心一次性执行风险，可分段执行：

```bash
# 第1步：A段 - 建表
# 手动提取 A 段内容执行

# 第2步：B段 - 补字段
# 手动提取 B 段内容执行

# 第3步：C段 - 索引/数据修复
# 手动提取 C 段内容执行

# 第4步：D段 - 审计/合规/配置
# 手动提取 D 段内容执行
```

---

## 四、执行后检查

### 4.1 表存在性验证

```sql
SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
AND TABLE_NAME IN (
  'sxo_activity','sxo_activity_signup','sxo_invite_reward',
  'sxo_muying_feedback','sxo_muying_audit_log',
  'sxo_muying_compliance_log','sxo_muying_stat_snapshot',
  'sxo_muying_sensitive_log',
  'sxo_muying_content_sensitive_word','sxo_muying_content_compliance_log'
);
-- 预期：10 行结果
```

### 4.2 关键字段验证

```sql
-- sxo_activity 关键字段
SHOW COLUMNS FROM sxo_activity WHERE Field IN (
  'activity_type','activity_status','waitlist_count','waitlist_signup_count',
  'allow_waitlist','signup_code_enabled','require_location_checkin',
  'latitude','longitude','suitable_crowd'
);

-- sxo_activity_signup 关键字段
SHOW COLUMNS FROM sxo_activity_signup WHERE Field IN (
  'phone_hash','privacy_version','privacy_agreed_time','is_waitlist',
  'waitlist_to_normal_time','signup_code','baby_birthday'
);

-- sxo_muying_feedback 关键字段
SHOW COLUMNS FROM sxo_muying_feedback WHERE Field IN ('contact','contact_hash');

-- sxo_user 扩展字段
SHOW COLUMNS FROM sxo_user WHERE Field IN ('current_stage','due_date','baby_birthday','invite_code');

-- sxo_goods 扩展字段
SHOW COLUMNS FROM sxo_goods WHERE Field IN ('stage','selling_point','approval_number');

-- sxo_goods_favor 扩展字段
SHOW COLUMNS FROM sxo_goods_favor WHERE Field IN ('type');
```

### 4.3 索引验证

```sql
SHOW INDEX FROM sxo_user WHERE Key_name='uk_invite_code';
SHOW INDEX FROM sxo_invite_reward WHERE Key_name='uk_inviter_invitee_event';
SHOW INDEX FROM sxo_activity_signup WHERE Key_name='idx_phone_hash';
SHOW INDEX FROM sxo_activity_signup WHERE Key_name='idx_signup_code';
SHOW INDEX FROM sxo_muying_feedback WHERE Key_name='idx_contact_hash';
SHOW INDEX FROM sxo_muying_stat_snapshot WHERE Key_name='uk_date_metric';
```

### 4.4 配置项验证

```sql
SELECT only_tag, value, name FROM sxo_config
WHERE only_tag LIKE 'feature_%_enabled'
ORDER BY only_tag;

SELECT only_tag, value, name FROM sxo_config
WHERE only_tag LIKE 'qualification_%'
ORDER BY only_tag;

SELECT only_tag, value, name FROM sxo_config
WHERE only_tag IN ('muying_invite_register_reward','muying_invite_first_order_reward','muying_privacy_key_configured');
```

### 4.5 权限验证

```sql
SELECT p.id, p.name, p.control, p.action
FROM sxo_power p
WHERE p.id BETWEEN 770 AND 796
ORDER BY p.id;

SELECT rp.role_id, rp.power_id, p.name
FROM sxo_role_power rp
JOIN sxo_power p ON p.id = rp.power_id
WHERE rp.power_id BETWEEN 770 AND 796
ORDER BY rp.role_id, rp.power_id;
```

---

## 五、常见失败处理

### 5.1 执行报错 "Duplicate column name"

**原因**：字段已存在，但 B 段的 information_schema 判断未生效。  
**处理**：确认 `SET @dbname = DATABASE();` 是否正确执行。手动检查：

```sql
SET @dbname = DATABASE();
SELECT @dbname;
-- 如果为 NULL，手动设置：
SET @dbname = '你的数据库名';
```

### 5.2 执行报错 "Duplicate entry for key 'uk_invite_code'"

**原因**：存在空邀请码或重复邀请码的用户。  
**处理**：

```sql
-- 查看重复情况
SELECT invite_code, COUNT(*) FROM sxo_user GROUP BY invite_code HAVING COUNT(*) > 1;

-- 重新执行 C1 存储过程填充邀请码
-- 然后重新执行 C2
```

### 5.3 执行报错 "Duplicate entry for key 'uk_inviter_invitee_event'"

**原因**：邀请奖励表有重复记录。  
**处理**：

```sql
-- 查看重复记录
SELECT inviter_id, invitee_id, trigger_event, COUNT(*) AS cnt
FROM sxo_invite_reward
GROUP BY inviter_id, invitee_id, trigger_event
HAVING cnt > 1;

-- 手动删除重复记录（保留 id 最小的）
DELETE r1 FROM sxo_invite_reward r1
INNER JOIN sxo_invite_reward r2
ON r1.inviter_id = r2.inviter_id
   AND r1.invitee_id = r2.invitee_id
   AND r1.trigger_event = r2.trigger_event
   AND r1.id > r2.id;
```

### 5.4 存储过程执行失败

**原因**：DELIMITER 在某些客户端中不支持。  
**处理**：使用 mysql 命令行客户端执行，或在宝塔 phpMyAdmin 中选择"SQL"模式执行。

### 5.5 权限插入失败

**原因**：sxo_power 表的 id 770-796 已被占用。  
**处理**：

```sql
SELECT id, name FROM sxo_power WHERE id BETWEEN 770 AND 796;
-- 如果已被占用，需要调整 D2/D7 中的 id 范围
```

---

## 六、重要警告

1. **不要执行 ShopXO 原始 SQL**：`shopxo-backend/sql/` 下的 SQL 是 ShopXO 官方安装脚本，会清空数据库。
2. **不要在生产环境执行回滚语句**：回滚语句仅在注释中提供参考。
3. **执行前必须备份**：即使迁移脚本设计为可重复执行，也无法保证所有边界情况。
4. **C1 存储过程会修改数据**：为空邀请码用户生成邀请码，不可逆。
5. **C3 去重会删除记录**：保留 id 最小的记录，删除重复记录。
6. **C4 枚举修复会修改数据**：将旧枚举值更新为新枚举值。
