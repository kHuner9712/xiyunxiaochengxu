const args = new Set(process.argv.slice(2))
const requireBoth = args.has('--require-both')
const appIdPattern = /^wx[a-zA-Z0-9]{16}$/
const placeholderValues = new Set([
  'wx0000000000000000',
  'REPLACE_WITH_REAL_WX_APP_ID',
  'REPLACE_WITH_REAL_WX_APPID',
])

const miniAppId = String(process.env.VITE_WX_APPID || '').trim()
const apiAppId = String(process.env.WECHAT_APP_ID || '').trim()

function fail(message) {
  console.error(`[verify-wechat-appid-consistency] FAIL ${message}`)
  process.exit(1)
}

function isValidRealAppId(value) {
  return appIdPattern.test(value) && !placeholderValues.has(value)
}

if (!miniAppId && !apiAppId) {
  if (requireBoth) fail('正式生产门禁必须同时提供 VITE_WX_APPID 与 WECHAT_APP_ID')
  console.log('[verify-wechat-appid-consistency] SKIP 未提供前后端 AppID，公开代码门禁仅执行一致性逻辑测试')
  process.exit(0)
}

if (!miniAppId || !apiAppId) {
  if (requireBoth) fail('正式生产门禁禁止只配置一侧 AppID；VITE_WX_APPID 与 WECHAT_APP_ID 必须同时提供')
  console.log('[verify-wechat-appid-consistency] SKIP 当前仅提供一侧 AppID；正式生产门禁会拒绝该配置')
  process.exit(0)
}

if (!isValidRealAppId(miniAppId)) {
  fail('VITE_WX_APPID 格式非法或仍为占位值')
}
if (!isValidRealAppId(apiAppId)) {
  fail('WECHAT_APP_ID 格式非法或仍为占位值')
}
if (miniAppId !== apiAppId) {
  fail('小程序构建 AppID 与后端微信 AppID 不一致；该配置会导致登录/手机号/支付链路使用不同微信应用')
}

console.log('[verify-wechat-appid-consistency] PASS VITE_WX_APPID 与 WECHAT_APP_ID 完全一致')
