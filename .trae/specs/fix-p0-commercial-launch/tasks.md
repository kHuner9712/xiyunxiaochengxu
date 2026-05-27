# Tasks

- [x] Task 1: 新增 manifest patch 脚本并修改构建流程
  - [x] 1.1: 创建 apps/miniprogram/scripts/patch-miniprogram-manifest.mjs，读取 VITE_WX_APPID 和 VITE_APP_NAME，修改 manifest.json 的 name/description/mp-weixin.appid；AppID 为空或占位值时生产构建失败
  - [x] 1.2: 修改 apps/miniprogram/package.json，build:mp-weixin 改为先执行 node scripts/patch-miniprogram-manifest.mjs 再 uni build -p mp-weixin
  - [x] 1.3: 修改 apps/miniprogram/src/pages.json，首页标题和 globalStyle navigationBarTitleText 改为"禧孕优选"
  - [x] 1.4: 修改 apps/miniprogram/src/manifest.json，name 改为"禧孕优选"，description 改为"禧孕优选商城小程序"

- [x] Task 2: 修复后台商品编辑页 DTO 白名单
  - [x] 2.1: 在 apps/admin-web/src/views/product/edit.vue 中，handleSubmit 显式构造与后端 DTO 对齐的白名单字段对象，不使用 ...form 展开
  - [x] 2.2: SKU 提交时将 name 映射为 specs: { name: s.name }，移除直接 name 字段
  - [x] 2.3: 合规信息只放入 attributes.compliance，不作为顶层字段提交
  - [x] 2.4: 确认 build:admin 通过（vue-tsc 类型检查）

- [x] Task 3: 增加高合规商品上架校验
  - [x] 3.1: 在 apps/api/src/product/product.service.ts 中新增 validateProductComplianceBeforePublish 方法
  - [x] 3.2: 在 updateStatus 方法中，当 status=1 时调用校验方法
  - [x] 3.3: isFood=true 校验 productionLicenseNo/foodBusinessCertNo/manufacturer/shelfLife/storageCondition
  - [x] 3.4: isHealthSupplement=true 校验 healthSupplementApprovalNo/suitableFor/notSuitableFor/precautions/certImages>=1
  - [x] 3.5: isInfantFormula=true 校验 infantFormulaRegNo/manufacturer/shelfLife/storageCondition/certImages>=1
  - [x] 3.6: 校验不通过 throw BadRequestException 并提示缺失字段
  - [x] 3.7: 添加单元测试覆盖食品/保健食品/奶粉校验场景

- [x] Task 4: release-check 增加协议页面 TODO 检测
  - [x] 4.1: 修改 deploy/scripts/release-check.sh，新增检查项：扫描 privacy/index.vue、agreement/index.vue、food-safety/index.vue 是否包含 TODO/暂定/2026年__月__日
  - [x] 4.2: 包含则输出 FAIL（这是正确的上线阻断）

- [x] Task 5: 修正 GO_LIVE.md 结论矛盾
  - [x] 5.1: 将"当前结论"P0/P1 已清零"改为"代码层核心安全项已补强，但 P0 未清零"
  - [x] 5.2: commit hash 使用 TODO 或本次提交后更新

- [x] Task 6: 上传 magic number 补强
  - [x] 6.1: 修改 apps/api/src/upload/upload.service.ts，webp 校验改为 RIFF+WEBP（offset 0: RIFF, offset 8: WEBP）
  - [x] 6.2: 增加 image/bmp magic number（BM）
  - [x] 6.3: 从 ALLOWED_MIME_TYPES 和 ALLOWED_EXTENSIONS 移除 video/webm 和 .webm
  - [x] 6.4: 更新 upload.service.spec.ts 中相关测试

- [x] Task 7: 运行验收命令并推送到 GitHub
  - [x] 7.1: 运行 prisma:validate、test:ci、build:api、build:admin、build:mini、release:check
  - [x] 7.2: 如实报告 release-check 结果（协议 TODO/AppID 占位导致 FAIL 是预期的）
  - [x] 7.3: git commit 并 push 到 origin main

# Task Dependencies
- Task 2 依赖 Task 3（DTO 白名单需与后端校验逻辑对齐）
- Task 7 依赖 Task 1-6 全部完成
- Task 1/2/3/4/5/6 可并行执行
