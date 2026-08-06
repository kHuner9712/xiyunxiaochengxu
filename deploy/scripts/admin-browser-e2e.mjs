import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, isAbsolute, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const distDir = resolve(root, 'apps/admin-web/dist')
const indexFile = resolve(distDir, 'index.html')
const browserTimeoutMs = Number(process.env.ADMIN_BROWSER_E2E_TIMEOUT_MS || 30_000)

const persistedConfig = {
  siteName: '禧孕优选',
  siteLogo: '',
  servicePhone: '400-000-0000',
  serviceWechat: 'xiyun-service',
  autoCancelMinutes: 30,
  autoConfirmDays: 15,
  aftersaleDays: 7,
  defaultFreight: 1200,
  freeShippingAmount: 9900,
  pointsDiscountRate: 0.01,
  pointsDiscountLimit: 30,
  userAgreement: '浏览器验收用户协议',
  privacyPolicy: '浏览器验收隐私政策',
}

const observed = {
  loginBody: null,
  updateBody: null,
  authenticatedRequests: 0,
}

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function requireAuth(req, res) {
  if (req.headers.authorization !== 'Bearer browser-access-token') {
    json(res, 200, { code: 40103, message: 'Token 无效', data: null })
    return false
  }
  observed.authenticatedRequests += 1
  return true
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/admin/auth/captcha') {
    json(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        captchaId: 'browser-captcha-id',
        captchaSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#fff"/><text x="12" y="27" font-size="22">E2E8</text></svg>',
      },
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/auth/login') {
    observed.loginBody = await readJsonBody(req)
    if (
      observed.loginBody.username !== 'browser_admin' ||
      observed.loginBody.password !== 'BrowserPass123!' ||
      observed.loginBody.captchaCode !== 'E2E8' ||
      observed.loginBody.captchaId !== 'browser-captcha-id'
    ) {
      json(res, 200, { code: 40001, message: '浏览器验收登录参数不匹配', data: null })
      return
    }
    json(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        accessToken: 'browser-access-token',
        refreshToken: 'browser-refresh-token',
      },
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/auth/info') {
    if (!requireAuth(req, res)) return
    json(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        id: '9007199254740993',
        username: 'browser_admin',
        nickname: '浏览器验收管理员',
        roles: ['super_admin'],
        permissions: [],
        mustChangePassword: false,
      },
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/system-config/list') {
    if (!requireAuth(req, res)) return
    json(res, 200, { code: 0, message: 'ok', data: persistedConfig })
    return
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/system-config/update') {
    if (!requireAuth(req, res)) return
    observed.updateBody = await readJsonBody(req)
    Object.assign(persistedConfig, observed.updateBody)
    json(res, 200, { code: 0, message: 'ok', data: persistedConfig })
    return
  }

  if (!requireAuth(req, res)) return

  if (url.pathname.includes('/dashboard/overview')) {
    json(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        todaySales: 0,
        salesGrowth: 0,
        todayOrders: 0,
        orderGrowth: 0,
        todayUsers: 0,
        userGrowth: 0,
        totalProducts: 0,
        onSaleProducts: 0,
      },
    })
    return
  }

  json(res, 200, { code: 0, message: 'ok', data: [] })
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function serveStatic(req, res, url) {
  const decodedPath = decodeURIComponent(url.pathname)
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
  const normalizedPath = normalize(relativePath)
  if (normalizedPath.startsWith('..') || isAbsolute(normalizedPath)) {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }

  let target = resolve(distDir, normalizedPath)
  try {
    const fileStat = await stat(target)
    if (fileStat.isDirectory()) target = join(target, 'index.html')
  } catch {
    target = indexFile
  }

  if (!target.startsWith(distDir)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'content-type': mimeTypes[extname(target)] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch (error) {
    res.writeHead(500)
    res.end(`Failed to serve admin asset: ${error.message}`)
  }
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url)
        return
      }
      await serveStatic(req, res, url)
    } catch (error) {
      json(res, 500, { code: 50001, message: error.message, data: null })
    }
  })

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolvePromise(server))
  })
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (isAbsolute(candidate) && existsSync(candidate)) return candidate
    const command = process.platform === 'win32' ? 'where' : 'which'
    const result = spawnSync(command, [candidate], { encoding: 'utf8' })
    if (result.status === 0) {
      const located = result.stdout.split(/\r?\n/).find(Boolean)
      if (located) return located.trim()
    }
  }
  throw new Error('未找到 Chrome/Chromium；浏览器级 E2E 不能降级为静态测试')
}

async function waitForDevToolsPort(userDataDir, chromeProcess) {
  const activePortFile = join(userDataDir, 'DevToolsActivePort')
  const deadline = Date.now() + browserTimeoutMs
  while (Date.now() < deadline) {
    if (chromeProcess.exitCode !== null) {
      throw new Error(`Chrome 提前退出，exitCode=${chromeProcess.exitCode}`)
    }
    if (existsSync(activePortFile)) {
      const [port] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/)
      if (port) return Number(port)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error('等待 Chrome DevTools 端口超时')
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    if (typeof WebSocket !== 'function') {
      throw new Error('当前 Node.js 不提供 WebSocket；要求 Node.js 22+')
    }
    this.socket = new WebSocket(this.webSocketUrl)
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error('连接 Chrome DevTools 超时')), 10_000)
      this.socket.addEventListener('open', () => {
        clearTimeout(timer)
        resolvePromise()
      })
      this.socket.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('连接 Chrome DevTools 失败'))
      })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }
      const callbacks = this.listeners.get(message.method) || []
      for (const callback of callbacks) callback(message.params)
    })
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) || []
    callbacks.push(callback)
    this.listeners.set(method, callbacks)
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Chrome DevTools 命令超时: ${method}`))
      }, browserTimeoutMs)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolvePromise(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket?.close()
  }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (response.exceptionDetails) {
    const details = response.exceptionDetails.exception?.description || response.exceptionDetails.text
    throw new Error(`浏览器脚本异常: ${details}`)
  }
  return response.result?.value
}

async function waitFor(client, expression, description, timeoutMs = browserTimeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, expression)) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`等待超时: ${description}${lastError ? `；${lastError.message}` : ''}`)
}

function textClickExpression(selector, text) {
  return `(() => {
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((node) => (node.textContent || '').replace(/\\s+/g, '') === ${JSON.stringify(text.replace(/\s+/g, ''))});
    if (!target) return false;
    target.click();
    return true;
  })()`
}

function fillPlaceholderExpression(placeholder, value) {
  return `(() => {
    const input = [...document.querySelectorAll('input')]
      .find((node) => node.getAttribute('placeholder') === ${JSON.stringify(placeholder)});
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value === ${JSON.stringify(value)};
  })()`
}

async function createTarget(devToolsPort, url) {
  const response = await fetch(
    `http://127.0.0.1:${devToolsPort}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  )
  if (!response.ok) {
    throw new Error(`创建 Chrome 页面失败: HTTP ${response.status}`)
  }
  return response.json()
}

async function main() {
  if (!existsSync(indexFile)) {
    throw new Error('缺少 apps/admin-web/dist/index.html；请先执行 pnpm build:admin')
  }

  const server = await startServer()
  const address = server.address()
  const origin = `http://127.0.0.1:${address.port}`
  const userDataDir = mkdtempSync(join(tmpdir(), 'xiyun-admin-browser-e2e-'))
  let chromeProcess
  let client

  try {
    const chrome = findChrome()
    chromeProcess = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--remote-debugging-port=0',
        '--remote-allow-origins=*',
        `--user-data-dir=${userDataDir}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )

    chromeProcess.stderr.on('data', () => {})

    const devToolsPort = await waitForDevToolsPort(userDataDir, chromeProcess)
    const target = await createTarget(devToolsPort, `${origin}/login`)
    client = new CdpClient(target.webSocketDebuggerUrl)
    await client.connect()

    const pageExceptions = []
    client.on('Runtime.exceptionThrown', (params) => {
      pageExceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'unknown')
    })

    await client.send('Page.enable')
    await client.send('Runtime.enable')

    await waitFor(
      client,
      `document.querySelector('input[placeholder="请输入用户名"]') && document.querySelector('img[alt="验证码"]')`,
      '登录页与验证码加载',
    )

    for (const [placeholder, value] of [
      ['请输入用户名', 'browser_admin'],
      ['请输入密码', 'BrowserPass123!'],
      ['请输入验证码', 'E2E8'],
    ]) {
      const filled = await evaluate(client, fillPlaceholderExpression(placeholder, value))
      if (!filled) throw new Error(`无法填写登录字段: ${placeholder}`)
    }

    if (!(await evaluate(client, textClickExpression('button', '登录')))) {
      throw new Error('找不到登录按钮')
    }

    await waitFor(client, `location.pathname === '/dashboard'`, '登录后进入工作台')
    await waitFor(client, `document.body.innerText.includes('系统管理')`, '权限菜单渲染')

    if (!(await evaluate(client, textClickExpression('.el-sub-menu__title', '系统管理')))) {
      throw new Error('找不到系统管理菜单')
    }
    await waitFor(client, `document.body.innerText.includes('系统配置')`, '系统配置子菜单展开')
    if (!(await evaluate(client, textClickExpression('.el-menu-item', '系统配置')))) {
      throw new Error('找不到系统配置菜单')
    }

    await waitFor(client, `location.pathname === '/system/config'`, '进入系统配置页面')
    await waitFor(
      client,
      `document.querySelector('input[placeholder="请输入商城名称"]')?.value === '禧孕优选'`,
      '系统配置初始值回显',
    )

    const savedSiteName = `禧孕优选浏览器验收-${Date.now()}`
    if (!(await evaluate(client, fillPlaceholderExpression('请输入商城名称', savedSiteName)))) {
      throw new Error('无法修改商城名称')
    }
    if (!(await evaluate(client, textClickExpression('button', '保存配置')))) {
      throw new Error('找不到保存配置按钮')
    }

    await waitFor(
      client,
      `document.body.innerText.includes('保存成功')`,
      '保存成功提示',
    )

    if (!observed.updateBody) throw new Error('浏览器未向配置更新接口提交请求')
    if (observed.updateBody.siteName !== savedSiteName) {
      throw new Error('配置更新请求未携带修改后的商城名称')
    }
    if (observed.updateBody.defaultFreight !== 1200 || observed.updateBody.freeShippingAmount !== 9900) {
      throw new Error('配置更新请求金额单位换算错误')
    }

    await client.send('Page.reload', { ignoreCache: true })
    await waitFor(client, `location.pathname === '/system/config'`, '刷新后保持系统配置路由')
    await waitFor(
      client,
      `document.querySelector('input[placeholder="请输入商城名称"]')?.value === ${JSON.stringify(savedSiteName)}`,
      '刷新后回查持久化配置',
    )

    if (!observed.loginBody) throw new Error('登录请求未到达模拟 API')
    if (observed.authenticatedRequests < 3) {
      throw new Error(`带鉴权请求数量不足: ${observed.authenticatedRequests}`)
    }
    if (pageExceptions.length > 0) {
      throw new Error(`页面存在未处理异常: ${pageExceptions.join(' | ')}`)
    }

    console.log('[admin-browser-e2e] PASS login → permission menu → config save → reload persistence')
  } catch (error) {
    if (client) {
      try {
        const pageText = await evaluate(client, `document.body?.innerText?.slice(0, 2000) || ''`)
        console.error(`[admin-browser-e2e] page snapshot:\n${pageText}`)
      } catch {}
    }
    if (chromeProcess && chromeProcess.exitCode !== null) {
      console.error(`[admin-browser-e2e] Chrome exit code: ${chromeProcess.exitCode}`)
    }
    throw error
  } finally {
    client?.close()
    if (chromeProcess && chromeProcess.exitCode === null) chromeProcess.kill('SIGTERM')
    await new Promise((resolvePromise) => server.close(resolvePromise))
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`[admin-browser-e2e] FAIL ${error.stack || error.message}`)
  process.exit(1)
})
