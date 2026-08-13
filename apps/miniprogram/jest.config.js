const remote = String(process.env.WECHAT_E2E_REMOTE || '').toLowerCase() === 'true'
const port = Number(process.env.WECHAT_DEVTOOLS_PORT || 9420)

module.exports = {
  globalTeardown: '@dcloudio/uni-automator/dist/teardown.js',
  testEnvironment: '@dcloudio/uni-automator/dist/environment.js',
  testEnvironmentOptions: {
    compile: true,
    'mp-weixin': {
      port: Number.isSafeInteger(port) && port > 0 ? port : 9420,
      account: String(process.env.WECHAT_E2E_ACCOUNT || ''),
      args: String(process.env.WECHAT_DEVTOOLS_ARGS || ''),
      cwd: String(process.env.WECHAT_DEVTOOLS_CWD || ''),
      launch: true,
      teardown: 'disconnect',
      remote,
      executablePath: String(process.env.WECHAT_DEVTOOLS_CLI || ''),
    },
  },
  testTimeout: 30000,
  maxWorkers: 1,
  reporters: ['default'],
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
  moduleFileExtensions: ['js', 'json'],
  rootDir: __dirname,
  testMatch: ['<rootDir>/src/full-function-acceptance.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
}
