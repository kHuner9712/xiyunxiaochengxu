# 禧孕 V1.0 发布分支规则

---

## 一、分支策略

| 分支 | 用途 | 保护 |
|------|------|------|
| `main` | 日常开发，持续集成 | 合并需 review |
| `release/v1.0.0-rcN` | 发布候选分支，UAT 测试用 | 冻结后只允许修 BLOCKER |
| `tag: v1.0.0-rcN` | 体验版提审包对应的版本标记 | 不可变 |
| `tag: v1.0.0` | 正式发布版本标记 | 不可变 |

## 二、发布流程

```
main ──→ release/v1.0.0-rc1 ──→ UAT 测试
              │                      │
              │   发现 BLOCKER       │ 通过 UAT
              │   ←──────────        │
              │   修复+rc2           │ 打 tag: v1.0.0-rc1
              │   → UAT 测试         │ 提审体验版
              │                      │
              │   体验版通过          │
              │   ←──────────        │
              │                      │ 打 tag: v1.0.0
              │                      │ 正式发布
```

### 2.1 创建 RC 分支

```bash
git checkout main
git pull origin main
git checkout -b release/v1.0.0-rc1
git push origin release/v1.0.0-rc1
```

### 2.2 UAT 期间修复 BLOCKER

```bash
git checkout release/v1.0.0-rc1
# 修复 BLOCKER
git add . && git commit -m "fix: ..."
git push origin release/v1.0.0-rc1
# 更新 RC 版本号
# 合并回 main
git checkout main
git merge release/v1.0.0-rc1
git push origin main
```

### 2.3 通过 UAT 后打 tag

```bash
git checkout release/v1.0.0-rc1
git tag v1.0.0-rc1
git push origin v1.0.0-rc1
```

### 2.4 正式发布

```bash
git checkout main
git tag v1.0.0
git push origin v1.0.0
```

## 三、冻结规则

| 规则 | 说明 |
|------|------|
| RC 分支创建后冻结 | 不允许从 main 合入新需求 |
| 只允许修 BLOCKER | UAT 期间只修阻塞性问题 |
| 每次修复更新 RC 版本号 | rc1 → rc2 → rc3 |
| 不允许新增需求 | 即使是小功能也不允许 |
| 不允许重构 | 代码优化等延后到下个版本 |

## 四、提审包对应关系

| 提审包 | 必须对应 | 说明 |
|--------|----------|------|
| 体验版提审 | `v1.0.0-rcN` tag | 体验版测试通过后才能正式提审 |
| 正式提审 | `v1.0.0` tag | 正式提审包必须对应正式 tag |

**严禁**从非 tag commit 构建提审包。

## 五、版本号规则

| 版本 | 格式 | 示例 | 说明 |
|------|------|------|------|
| RC 版本 | v1.0.0-rcN | v1.0.0-rc1 | N 从 1 递增 |
| 正式版本 | v1.0.0 | v1.0.0 | 去掉 -rcN 后缀 |
| 热修复 | v1.0.1 | v1.0.1 | 第三位递增 |

## 六、回滚策略

| 场景 | 回滚方式 |
|------|----------|
| RC 测试失败 | 回到 main 修复，创建新 RC |
| 体验版被拒 | 回到 release 分支修复，创建新 RC |
| 正式版发现问题 | 从 tag checkout 修复，打 v1.0.1 |
