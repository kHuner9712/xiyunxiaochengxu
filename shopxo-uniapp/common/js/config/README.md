# config/ - 前端配置与枚举

## 文件说明

| 文件 | 类型 | 职责 |
|------|------|------|
| `runtime-config.js` | ShopXO 原始 | 运行时环境读取 + 基础 URL 规范化 |
| `dev.js` | ShopXO 原始 | 开发环境配置 |
| `prod.js` | ShopXO 原始 | 生产环境配置 |
| `muying-enum.js` | **二开新增** | 母婴阶段枚举（前端唯一权威定义） |
| `phase-one-scope.js` | **二开新增** | 一期范围过滤（控制哪些插件入口可见） |

## 环境变量

- `UNI_APP_REQUEST_URL`: 后端 API 基础 URL
- `UNI_APP_STATIC_URL`: 静态资源基础 URL（可选）

所有基础 URL 末尾统一带 `/`，避免拼接错误。

## muying-enum.js 使用规范

- **阶段值**：`prepare`(备孕) / `pregnancy`(孕期) / `postpartum`(产后) / `all`(通用，仅筛选用)
- **后端对应**：`shopxo-backend/app/extend/muying/MuyingStage.php`
- **修改阶段枚举时，前后端必须同步修改**
- **使用方式**：`import { MuyingStage } from '@/common/js/config/muying-enum'`
  - `MuyingStage.getName(value)` → 中文展示名
  - `MuyingStage.getList()` → 完整列表 [{name, value}]
  - `MuyingStage.getFilterTabs()` → 筛选 Tab 列表（含"全部"）

## phase-one-scope.js 使用规范

- **作用**：过滤用户中心导航、首页插件等入口，隐藏一期不需要的插件
- **当前隐藏的插件**：distribution(分销) / wallet(钱包) / coin(钱包币) / shop(多商户) / realstore(多门店) / ask(问答) / blog(博客) / membershiplevelvip(会员等级)
- **使用方式**：`import { filter_phase_one_navigation } from '@/common/js/config/phase-one-scope.js'`
- **新增隐藏项**：修改 `PHASE_ONE_DISABLED_PLUGIN_NAMES` 数组即可
