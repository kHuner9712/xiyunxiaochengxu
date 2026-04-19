# preflight 脚本 fixture 自测

## 一条命令跑全部测试

```bash
bash scripts/preflight/tests/run-tests.sh
```

退出码 0 = 全部通过，1 = 存在失败。

## 目录结构

```
tests/
├── run-tests.sh              主测试运行器
├── README.md                 本文件
├── fixtures/
│   ├── ph-clean/             无占位符的干净代码
│   ├── ph-code-placeholder/  含代码占位符 {{APP_ID}} 等
│   ├── ph-sql-placeholder/   仅含 SQL 占位符
│   ├── ph-docs-placeholder/  仅含文档占位符
│   ├── ph-mixed/             代码+SQL+文档混合占位符
│   ├── env/
│   │   ├── env.ini-style     ThinkPHP/INI 风格 .env
│   │   └── env.flat-style    扁平变量风格 .env
│   └── backend-minimal/      最小后端目录结构
```

## 测试分组与覆盖场景

### A. lib-env.sh 解析测试（14 项）

| 场景 | 验证内容 | 失败影响 |
|------|---------|---------|
| A1 | INI 风格 `[DATABASE]` 段解析为 DB_HOST 等 6 个变量 | **门禁形同虚设** — .env 读不到数据库参数 |
| A2 | 扁平变量 `DB_HOST=` 风格解析 | 同上 |
| A3 | 不存在的文件返回错误 | 静默吞错导致用默认值连接 |
| A4 | 空路径不报错 | 脚本启动即崩溃 |

### B. check-placeholders.sh 测试（12 项）

| 场景 | 验证内容 | 失败影响 |
|------|---------|---------|
| B1 | 空目录 → 退出码 0 | 误报阻断发布 |
| B2 | 代码占位符 → 退出码 1 | **占位符漏检 = 生产事故** |
| B3 | 仅 SQL 占位符 → 默认退出码 0 | 误报阻断发布 |
| B4 | SQL 占位符 + --strict → 退出码 1 | strict 模式失效 |
| B5 | 仅 docs 占位符 → 退出码 0 | 误报阻断发布 |
| B6 | docs + --docs-also → 退出码 0 | docs 扫描误阻断 |
| B7 | 混合占位符 → 退出码 1 | **占位符漏检** |
| B8 | --help → 退出码 0 | 基本可用性 |
| B9 | 选项组合不报错 | 参数解析回归 |
| B10 | 未知选项 → 退出码 1 | 参数解析回归 |

### C. check-server.sh 测试（11 项）

| 场景 | 验证内容 | 失败影响 |
|------|---------|---------|
| C1 | --help → 退出码 0 | 基本可用性 |
| C2 | --env 缺参数 → 退出码 1 | 参数校验回归 |
| C3 | --env 文件不存在 → 退出码 1 | **静默吞错 = 用默认值连接** |
| C4 | --env INI 风格无解析错误 | **门禁形同虚设** |
| C5 | --env 扁平风格无解析错误 | 同上 |
| C6 | --no-color 无 ANSI 转义 | CI/CD 日志乱码 |
| C7 | --quiet 无 PASS 行 | 输出模式回归 |
| C8 | 未知选项 → 退出码 1 | 参数解析回归 |
| C9 | FAIL 计数器与退出码一致 | **计数器 bug = 误放行** |

### D. release-gate.sh 测试（13 项）

| 场景 | 验证内容 | 失败影响 |
|------|---------|---------|
| D1 | --help → 退出码 0 | 基本可用性 |
| D2 | 子脚本 FAIL → 总退出码 1 | **门禁误放行** |
| D3 | 全部跳过 → 退出码 0 | 误报阻断 |
| D4 | 只有 WARN → 退出码 0 | 逻辑回归 |
| D5 | --strict + SQL 占位符 → 退出码 1 | strict 模式失效 |
| D6-D8 | --skip-* 行为正确 | 跳过逻辑回归 |
| D9-D10 | --env 透传无解析错误 | **env 透传失败 = 门禁形同虚设** |
| D11 | 未知选项 → 退出码 1 | 参数解析回归 |

### E. 跨脚本一致性测试（2 项）

| 场景 | 验证内容 | 失败影响 |
|------|---------|---------|
| E1 | 同一 INI .env 两个脚本都无解析错误 | **解析口径分裂** |
| E2 | 同一扁平 .env 两个脚本都无解析错误 | 同上 |

## 回归测试清单

以下失败意味着**不能再信任发布门禁脚本**：

1. **A1/A2** — lib-env.sh 解析错误 → 所有 --env 功能失效
2. **B2/B7** — 占位符漏检 → 生产事故（密钥/域名泄露）
3. **C3/C4/C5** — --env 读不到 → 数据库连接参数用默认值
4. **D2** — 子脚本 FAIL 但总退出码 0 → 门禁误放行
5. **D9/D10** — --env 透传失败 → release-gate 的 DB 预检失效
6. **E1/E2** — 两个脚本解析结果不一致 → 口径分裂

## 已修复的历史 bug

| bug | 发现方式 | 修复 |
|-----|---------|------|
| check-placeholders.sh `scan_pattern` 引号 bug | fixture 测试 B2 失败 | 将 file_types 字符串参数改为数组参数 |
| check-server.sh DB 连接失败不显示参数 | fixture 测试 C4 无法验证 | fail 消息增加 `${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}` |
| release-gate.sh `grep DATABASE.HOSTNAME` 点号写法 | 上一轮任务发现 | 改用 lib-env.sh 统一解析 |
| check-server.sh 只认 DB_HOST 扁平变量 | 上一轮任务发现 | 改用 lib-env.sh 统一解析 |
