# 商用上线 P0 最小修复 Spec

## Why
当前仓库已完成两轮硬化，但仍存在 AppID 注入未生效、DTO 白名单不匹配导致生产 400、高合规商品上架无校验、协议页面含 TODO 未被 release-check 阻断、GO_LIVE 结论矛盾、上传 magic number 不完整等 P0 问题。需要在商用上线前做最小修复，不新增业务功能。

## What Changes
- **P0-1**: 新增 manifest patch 脚本，构建前注入 AppID 和名称，生产构建 AppID 为空则失败
- **P0-2**: 修复后台商品编辑页 DTO 白名单，显式构造提交字段，避免生产 forbidNonWhitelisted 400
- **P0-3**: 新增高合规商品上架校验，食品/保健食品/奶粉缺少必填合规字段时拒绝上架
- **P0-4**: release-check 增加协议页面 TODO 检测，含 TODO/暂定/空日期则 FAIL
- **P0-5**: 修正 GO_LIVE.md 结论矛盾，不再写 P0/P1 已清零
- **P0-6**: 上传 magic number 补强：webp RIFF+WEBP 校验、bmp magic、移除 webm

## Impact
- Affected code: miniprogram manifest/pages.json/package.json, admin-web edit.vue, api product.service.ts, upload.service.ts, release-check.sh, GO_LIVE.md
- Affected specs: 商品合规、上传安全、CI Release Gate

## ADDED Requirements

### Requirement: Manifest Patch 脚本
系统 SHALL 提供 scripts/patch-miniprogram-manifest.mjs 脚本，在构建前读取 VITE_WX_APPID 和 VITE_APP_NAME 环境变量，自动修改 manifest.json 的 name、description、mp-weixin.appid。

#### Scenario: 生产构建 AppID 为空则失败
- **WHEN** VITE_WX_APPID 为空或仍为 wx0000000000000000 且执行生产构建
- **THEN** 脚本以非零退出码失败，提示必须配置真实 AppID

#### Scenario: 正常注入 AppID
- **WHEN** VITE_WX_APPID 为有效值（非空且非占位值）
- **THEN** manifest.json 的 mp-weixin.appid 被替换为该值，name 替换为 VITE_APP_NAME 或默认"禧孕优选"

### Requirement: 后台商品 DTO 白名单对齐
系统 SHALL 在 admin-web 商品编辑页提交时显式构造与后端 CreateProductDto/UpdateProductDto 白名单对齐的字段对象，不使用 ...form 展开。

#### Scenario: 提交不含非白名单字段
- **WHEN** 后台商品编辑页提交创建或更新请求
- **THEN** 请求体仅包含后端 DTO 声明的字段，price/originalPrice/stock/sort/status/detailContent/compliance 等非白名单字段不直接提交

### Requirement: 高合规商品上架校验
系统 SHALL 在商品上架（status=1）前校验合规字段完整性，食品/保健食品/奶粉缺少必填合规字段时拒绝上架。

#### Scenario: 食品商品缺少生产许可证编号
- **WHEN** 商品 attributes.compliance.isFood=true 且 productionLicenseNo 为空，尝试上架
- **THEN** 抛出 BadRequestException，提示缺失字段

#### Scenario: 保健食品缺少批准文号
- **WHEN** 商品 attributes.compliance.isHealthSupplement=true 且 healthSupplementApprovalNo 为空，尝试上架
- **THEN** 抛出 BadRequestException，提示缺失字段

#### Scenario: 奶粉缺少配方注册号
- **WHEN** 商品 attributes.compliance.isInfantFormula=true 且 infantFormulaRegNo 为空，尝试上架
- **THEN** 抛出 BadRequestException，提示缺失字段

### Requirement: 协议页面 TODO 检测
系统 SHALL 在 release-check 中检测协议页面是否包含 TODO/暂定/空日期，包含则 FAIL。

#### Scenario: 协议页面含 TODO
- **WHEN** privacy/index.vue 或 agreement/index.vue 或 food-safety/index.vue 包含 TODO 或暂定
- **THEN** release-check 输出 FAIL

### Requirement: 上传 Magic Number 补强
系统 SHALL 对 image/webp 校验 RIFF+WEBP magic number，增加 image/bmp magic number 校验，移除 video/webm 支持。

#### Scenario: webp 文件 magic 校验
- **WHEN** 上传声明为 image/webp 的文件
- **THEN** 校验文件头包含 RIFF 和 WEBP 标识

#### Scenario: webm 不再支持
- **WHEN** 上传声明为 video/webm 的文件
- **THEN** 返回不支持的文件类型错误

## MODIFIED Requirements

### Requirement: GO_LIVE.md 结论
当前结论"P0/P1 已清零"改为"代码层核心安全项已补强，但 P0 未清零"，明确列出待完成项。

## REMOVED Requirements
无
