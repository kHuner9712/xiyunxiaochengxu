# muying/ - 母婴二开核心扩展

本目录存放母婴商城二开的核心枚举和工具类，与 ShopXO 原始代码完全隔离。

## 文件说明

| 文件 | 职责 |
|------|------|
| `MuyingStage.php` | 孕育阶段枚举（唯一权威定义） |

## MuyingStage 使用规范

- **阶段值**：`prepare`(备孕) / `pregnancy`(孕期) / `postpartum`(产后) / `all`(通用，仅筛选用)
- **前端对应**：`shopxo-uniapp/common/js/config/muying-enum.js`
- **修改阶段枚举时，前后端必须同步修改**

## 新增文件约定

本目录下新增文件应：
1. 以 `Muying` 为前缀命名
2. 只包含母婴业务逻辑，不混入 ShopXO 通用逻辑
3. 通过 `use app\extend\muying\MuyingXxx` 在 Service 层引用
