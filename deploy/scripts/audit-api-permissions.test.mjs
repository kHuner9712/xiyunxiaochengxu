import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const script = join(root, 'deploy/scripts/audit-api-permissions.mjs')

function runAudit(source) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'api-permission-audit-'))
  const srcDir = join(tempRoot, 'src')
  mkdirSync(srcDir, { recursive: true })
  writeFileSync(join(srcDir, 'fixture.controller.ts'), source)

  try {
    return spawnSync(process.execPath, [script, '--src-dir', srcDir], {
      cwd: root,
      encoding: 'utf8',
    })
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

test('同步 admin 方法缺少 @RequirePermission 必须 FAIL', () => {
  const result = runAudit(`
    import { Controller, Get } from '@nestjs/common'

    @Controller('admin/product')
    export class AdminProductController {
      @Get('list')
      list() {
        return {}
      }
    }
  `)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /admin route without @RequirePermission/)
})

test('同步 weapp 私有方法缺少 @CurrentUser 必须 FAIL', () => {
  const result = runAudit(`
    import { Controller, Get } from '@nestjs/common'

    @Controller('weapp/order')
    export class WeappOrderController {
      @Get('list')
      list() {
        return {}
      }
    }
  `)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /weapp private route without @CurrentUser\('id'\)/)
})

test('合规同步方法必须 PASS', () => {
  const result = runAudit(`
    import { Controller, Get } from '@nestjs/common'
    import { RequirePermission } from '../common/decorators/require-permission.decorator'
    import { CurrentUser } from '../common/decorators/current-user.decorator'
    import { Public } from '../common/decorators/public.decorator'

    @Controller('admin/product')
    export class AdminProductController {
      @Get('list')
      @RequirePermission('product:list')
      list() {
        return {}
      }
    }

    @Controller('weapp/order')
    export class WeappOrderController {
      @Get('list')
      list(@CurrentUser('id') userId: string) {
        return { userId }
      }
    }

    @Controller('weapp/product')
    export class WeappProductController {
      @Public()
      @Get('list')
      list() {
        return {}
      }
    }
  `)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\[api-permission-audit\] PASS/)
})
