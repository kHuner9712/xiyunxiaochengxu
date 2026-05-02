# 禧孕 V1.0 内容合规敏感词规则

---

## 一、概述

母婴行业小程序，商品和内容中不能出现医疗化、治疗化、诊断化宣传。本文档定义敏感词规则和扫描机制。

## 二、敏感词分类

### 2.1 高风险词（阻止发布）

命中时直接阻止保存，必须修改后才能发布。

| 敏感词 | 说明 |
|--------|------|
| 治疗 | 暗示医疗效果 |
| 诊断 | 暗示医疗行为 |
| 治愈 | 暗示医疗效果 |
| 疗效 | 暗示医疗效果 |
| 处方 | 涉及处方药 |
| 药到病除 | 夸大宣传 |
| 根治 | 夸大宣传 |
| 医生推荐 | 暗示医疗背书 |
| 医院专用 | 暗示医疗属性 |
| 孕检报告解读 | 涉及医疗行为 |
| 在线问诊 | 涉及医疗行为 |
| 医疗级 | 暗示医疗属性 |

### 2.2 低风险词（确认后可保存）

命中时弹出提示，管理员确认后可强制保存，但记录合规日志。

| 敏感词 | 说明 |
|--------|------|
| 100%安全 | 绝对化用语 |
| 无副作用 | 可能误导消费者 |
| 绝对安全 | 绝对化用语 |

## 三、扫描范围

| 内容类型 | 扫描字段 |
|----------|----------|
| 商品 | title（标题）、simple_desc（副标题）、content_web（详情）、selling_point（卖点）、stage（母婴标签） |
| 文章 | title（标题）、content（内容） |
| 活动 | title（标题）、content（详情） |

## 四、处理逻辑

1. **高风险词命中** → 返回 code=-1 + 错误提示，阻止保存，force_save 无法绕过
2. **低风险词命中** → 返回 code=-2 + 敏感词列表，前端弹出确认框
   - 确认框文案："内容包含低风险敏感词：xxx。确认业务表述合规并继续保存吗？"
   - 用户点击"确定" → 自动追加 `force_save=1` 重新提交同一接口
   - 用户点击"取消" → 返回修改，不保存
   - 二次提交成功后正常跳转/提示
3. **所有命中记录写入合规日志** — 包含 content_type/content_id/word/risk/field/admin_id/action/ip
4. **action 类型**：
   - `blocked` — 高风险词阻止或低风险词未确认
   - `confirmed` — 低风险词管理员确认后保存

### 安全保障

- 高风险词返回 code=-1，无论 force_save 是否为 1 都会被阻止
- 服务层先检查高风险词，再检查低风险词，高风险词优先拦截
- force_save=1 只对低风险词生效，不影响高风险词的阻止逻辑
- 防止重复追加 force_save 隐藏字段

## 五、后台管理

- 后台 → 禧孕运营 → 内容合规
- 可查看默认敏感词列表
- 可添加/删除自定义敏感词
- 可查看合规拦截日志

## 六、扩展敏感词

通过后台"内容合规"页面添加自定义敏感词，选择风险级别（高风险/低风险），保存后立即生效。

## 七、相关文件

| 文件 | 说明 |
|------|------|
| `shopxo-backend/app/service/MuyingContentComplianceService.php` | 核心服务 |
| `shopxo-backend/app/admin/controller/Contentsensitiveword.php` | 后台管理控制器 |
| `shopxo-backend/app/admin/view/default/contentsensitiveword/index.html` | 后台管理页面 |
| `docs/sql/muying-content-compliance-migration.sql` | 数据库迁移 |
| `docs/sql/muying-content-sensitive-word-power-migration.sql` | 菜单权限迁移 |
