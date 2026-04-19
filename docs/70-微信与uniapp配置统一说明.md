# WeChat + uni-app Config Alignment

## 1. Purpose

This doc defines one consistent config flow for:

- local development
- HBuilderX build/publish
- WeChat DevTools preview
- production package release

## 2. Source of truth

| Item | Primary file | Rule |
|---|---|---|
| Mini Program AppID | `shopxo-uniapp/manifest.json` -> `mp-weixin.appid` | Primary source for uni-app |
| WeChat DevTools AppID | `shopxo-uniapp/project.config.json` -> `appid` | Must match manifest appid |
| Local private WeChat settings | `shopxo-uniapp/project.private.config.json` | Local only, do not commit |
| API base URL | `UNI_APP_REQUEST_URL` | Inject by `.env.*` or publish env vars |
| Static base URL | `UNI_APP_STATIC_URL` | Optional |

## 3. Environment rules

Runtime config is resolved by:

- `shopxo-uniapp/common/js/config/runtime-config.js`
- `shopxo-uniapp/common/js/config/dev.js`
- `shopxo-uniapp/common/js/config/prod.js`

Rules:

1. Development
- read `UNI_APP_REQUEST_URL`
- fallback: `http://localhost:8080/`
- `UNI_APP_STATIC_URL` optional

2. Staging / pre-release
- `UNI_APP_REQUEST_URL` is required
- `UNI_APP_STATIC_URL` optional

3. Production
- `UNI_APP_REQUEST_URL` is required
- `UNI_APP_STATIC_URL` optional
- `prod.js` prints a clear error if missing `UNI_APP_REQUEST_URL`

All base URLs are normalized with trailing `/`.

## 4. Example templates

- `shopxo-uniapp/.env.development.example`
- `shopxo-uniapp/.env.staging.example`
- `shopxo-uniapp/.env.production.example`
- `shopxo-uniapp/.env.release.example` (legacy compatibility)

Recommended local files:

- `.env.development`
- `.env.staging`
- `.env.production`

## 5. AppID consistency helper

Optional scripts:

- `node shopxo-uniapp/scripts/manifest-merge.js`
- `node shopxo-uniapp/scripts/manifest-restore.js`

`manifest-merge.js` now also syncs `project.config.json` appid from `manifest.json`.

## 6. Pre-release checklist

1. Do not commit local private files:
- `shopxo-uniapp/project.private.config.json`
- `shopxo-uniapp/manifest.local.json`
- real `.env*` files (except `*.example`)

2. Confirm AppID consistency:
- `manifest.json` -> `mp-weixin.appid`
- `project.config.json` -> `appid`

3. Confirm env values:
- `UNI_APP_REQUEST_URL` points to reachable backend
- legal request domain configured in WeChat platform
- if CDN is used, set `UNI_APP_STATIC_URL`
