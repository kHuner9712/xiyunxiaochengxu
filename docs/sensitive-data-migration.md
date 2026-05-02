# 禧孕 V1.0 敏感数据加密迁移指南

本文档说明如何使用 `scripts/migrate-encrypt-sensitive.php` 将数据库中的明文敏感数据加密存储。

---

## 一、背景

母婴业务涉及以下敏感数据字段：

| 表 | 字段 | 说明 |
|---|------|------|
| sxo_activity_signup | name | 报名姓名 |
| sxo_activity_signup | phone | 联系电话 |
| sxo_activity_signup | phone_hash | 手机号哈希（用于去重搜索） |
| sxo_muying_feedback | contact | 联系方式 |
| sxo_muying_feedback | contact_hash | 联系方式哈希（用于去重） |

新写入的数据已通过 `MuyingPrivacyService::EncryptSensitive` 自动加密，但历史存量数据仍为明文，必须通过本脚本迁移。

**用户表（sxo_user）说明**：
- `mobile` 字段为 ShopXO 登录手机号，**不加密**（避免破坏登录逻辑）
- `current_stage`/`due_date`/`baby_birthday`/`baby_month_age` 为阶段标识和时间戳，非 PII，无需加密

---

## 二、前置条件

1. **MUYING_PRIVACY_KEY 已配置**
   - 位置：`shopxo-backend/.env` → `MUYING_PRIVACY_KEY = <64位hex>`
   - 生成方式：`php -r "echo bin2hex(openssl_random_pseudo_bytes(32));"`
   - 如果未配置，脚本会拒绝执行

2. **数据库迁移已执行**
   - 确保 `docs/muying-final-migration.sql` 已执行
   - 目标表和字段（phone_hash/contact_hash/privacy_version）必须存在

3. **数据库连接正常**
   - `shopxo-backend/.env` 中数据库配置正确
   - `config/database.php` 已创建

4. **已备份数据库**
   - 迁移会修改数据，**必须先备份**

---

## 三、执行步骤

### 3.1 DRY-RUN（测试模式，不写数据库）

```bash
cd /path/to/project
php scripts/migrate-encrypt-sensitive.php --dry-run
```

输出示例：
```
禧孕 V1.0 — 敏感数据加密迁移脚本
==================================================

[OK] MUYING_PRIVACY_KEY 已配置（长度: 64）
[OK] APP_DEBUG = false
[OK] 数据库连接正常

▶ 处理表: sxo_activity_signup
  完成: scanned=150 encrypted=120 hash_filled=130 skipped=30 failed=0

▶ 处理表: sxo_muying_feedback
  完成: scanned=45 encrypted=40 hash_filled=42 skipped=5 failed=0

==================================================
  迁移统计
==================================================
  扫描:     195
  加密:     160
  Hash补填: 172
  跳过:     35
  失败:     0
  模式:     DRY-RUN
==================================================

提示: 以上为 DRY-RUN 统计，未实际写入数据库。
正式执行: php scripts/migrate-encrypt-sensitive.php --force
```

### 3.2 正式执行

```bash
php scripts/migrate-encrypt-sensitive.php --force
```

脚本会：
1. 检查 MUYING_PRIVACY_KEY、数据库连接、表结构
2. 自动扩展字段宽度（如 char(30) → varchar(255)）
3. 显示 5 秒倒计时（期间可 Ctrl+C 终止）
4. 逐批处理数据
5. 输出统计和日志

### 3.3 指定表和批量大小

```bash
# 只迁移活动报名表
php scripts/migrate-encrypt-sensitive.php --dry-run --table=activity_signup

# 只迁移反馈表
php scripts/migrate-encrypt-sensitive.php --force --table=feedback

# 自定义批量大小
php scripts/migrate-encrypt-sensitive.php --force --batch=50
```

---

## 四、参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --dry-run | 只输出统计，不写数据库 | 否 |
| --batch=N | 每批处理记录数 | 100 |
| --table=all\|activity_signup\|feedback\|user | 指定迁移表 | all |
| --force | 实际执行时必须带此参数 | 否 |

**安全约束**：
- 不带 `--force` 也不带 `--dry-run` 时，脚本拒绝执行
- `--table=user` 只做检查，不执行加密（用户表 mobile 不加密）

---

## 五、加密规则

1. **已加密数据不重复加密** — 使用 `MuyingPrivacyService::IsEncrypted` 判断
2. **明文手机号生成 hash** — 使用 `MuyingPrivacyService::HashPhone` 生成 SHA-256 哈希
3. **空值跳过** — 空字符串字段不处理
4. **单条异常不中断** — 单条记录加密失败记录错误，继续处理下一条
5. **日志不记录明文** — 日志中手机号/姓名以 `1***4` 格式脱敏
6. **privacy_version 更新** — 加密后设置 `privacy_version = 1`

---

## 六、日志

日志文件位于：`shopxo-backend/runtime/log/muying_encrypt_migration_YYYYMMDD_HHMMSS.log`

日志内容包括：
- 迁移开始/结束时间
- 每条记录的处理结果（脱敏后）
- 字段扩展操作
- 错误信息

**日志中不包含完整手机号或姓名。**

---

## 七、回滚策略

### 7.1 数据库备份恢复（推荐）

```bash
# 备份（执行迁移前）
mysqldump -u root -p database_name > backup_before_encrypt.sql

# 回滚
mysql -u root -p database_name < backup_before_encrypt.sql
```

### 7.2 部分回滚

如果只需要回滚特定记录：

```sql
-- 查看加密后的数据（确认可解密）
SELECT id, 
       MuyingPrivacyServiceDecrypt(phone) as plain_phone
FROM sxo_activity_signup 
WHERE id = <特定ID>;
```

> 注意：没有直接的"解密回明文"SQL 函数，回滚必须依赖数据库备份。

### 7.3 回滚注意事项

- 回滚会恢复到备份时的状态，备份后的新数据会丢失
- 建议在低峰期执行迁移，减少备份和迁移之间的数据差异
- 如果迁移后产生了新数据，回滚前需手动记录

---

## 八、验证清单

迁移完成后，请逐项验证：

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | 后台报名列表姓名/手机正常脱敏 | 后台 → 报名管理 → 查看列表 |
| 2 | 后台有敏感权限时能看到明文 | 后台 → 报名详情 → 姓名旁有"明文"标识 |
| 3 | phone_hash 搜索正常 | 后台 → 报名管理 → 搜索手机号 |
| 4 | 反馈列表联系方式正常脱敏 | 后台 → 反馈管理 → 查看列表 |
| 5 | 新报名数据正常加密 | 小程序提交报名 → 后台查看 |
| 6 | 新反馈联系方式正常加密 | 小程序提交反馈 → 后台查看 |
| 7 | 审计日志正常记录 | 后台 → 合规中心 → 审计日志 |

---

## 九、常见问题

### Q: 脚本报 "MUYING_PRIVACY_KEY 未配置"

A: 在 `shopxo-backend/.env` 中添加：
```ini
MUYING_PRIVACY_KEY = <64位hex密钥>
```

### Q: 脚本报 "数据库连接失败"

A: 检查：
1. `shopxo-backend/.env` 中数据库配置是否正确
2. `shopxo-backend/config/database.php` 是否已创建
3. MySQL 服务是否运行

### Q: 脚本报 "表 xxx 不存在"

A: 先执行数据库迁移：
```bash
mysql -u root -p database_name < docs/muying-final-migration.sql
```

### Q: 字段宽度不足怎么办？

A: 脚本会自动检测并扩展字段宽度（char(30) → varchar(255)），无需手动处理。

### Q: 迁移可以重复执行吗？

A: 可以。已加密的数据会被跳过，不会重复加密。

### Q: 迁移过程中新写入的数据怎么办？

A: 新数据通过 `MuyingPrivacyService::EncryptSensitive` 自动加密，不受迁移脚本影响。建议在低峰期执行迁移。
