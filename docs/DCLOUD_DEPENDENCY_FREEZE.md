# DCloud 依赖冻结说明

## 结论

小程序端继续锁定当前 `@dcloudio/*` 版本：

```text
3.0.0-alpha-1000920260519001
```

冻结期不升级到 npm `latest`。原因是当前项目是 Vue 3 / uni-app v3 小程序工程，而 npm registry 上 `@dcloudio/uni-app` 的 `latest` 指向 `2.0.2-5000720260410001`，属于 Vue 2 线；Vue 3 线仍通过 `vue3` / `alpha` dist-tag 发布。`@dcloudio/vite-plugin-uni` 的 `latest` 本身也是 alpha。直接切换会引入编译器链变化，风险高于冻结补强目标。

## 版本矩阵

| 项目 | 冻结值 |
| --- | --- |
| Node.js | `v24.15.0` |
| pnpm | `11.2.2` |
| `@dcloudio/*` | `3.0.0-alpha-1000920260519001` |
| 微信开发者工具 | 由发布负责人在上传体验版前填写 |
| 小程序构建命令 | `pnpm build:mini:prod` |
| 冻结门禁入口 | `pnpm release:check:prod` |

## 风险边界

- 允许：保持所有 `@dcloudio/*` 包同一个精确 alpha 版本，并通过 `pnpm build:mini:prod` 验证 mp-weixin 产物。
- 禁止：使用 `^`、`~`、`latest`、`vue3`、`alpha` 等范围或标签版本。
- 禁止：混用不同 `@dcloudio/*` 版本。
- 禁止：绕过 `apps/miniprogram/scripts/build-miniprogram.mjs`，直接使用占位 `manifest.json` 打生产包。

`deploy/scripts/check-miniprogram.mjs` 会在 release gate 中检查上述锁定规则。
