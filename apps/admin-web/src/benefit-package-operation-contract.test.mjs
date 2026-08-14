import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

test('benefit package admin create keeps one durable request identity across ambiguous failures', () => {
  const api = read('apps/admin-web/src/api/benefit-package.ts')
  const dto = read('apps/api/src/benefit-package/dto/benefit-package.dto.ts')

  assert.match(api, /PENDING_BENEFIT_PACKAGE_CREATE_KEY/)
  assert.match(api, /sessionStorage\.getItem\(PENDING_BENEFIT_PACKAGE_CREATE_KEY\)/)
  assert.match(api, /clientRequestId,\s*\n\s*\}\)/)
  assert.match(api, /status >= 400 && status < 500/)
  assert.match(dto, /clientRequestId\?: string/)
  assert.match(dto, /OmitType\(CreateBenefitPackageDto, \['clientRequestId'\] as const\)/)
})

test('benefit package update, status and delete share one browser mutation lock per package', () => {
  const api = read('apps/admin-web/src/api/benefit-package.ts')
  assert.match(api, /function mutationKey\(id: string\)/)
  assert.equal((api.match(/runSingleFlight\(mutationKey\(id\)/g) || []).length, 3)
})

test('runtime BenefitPackageService token resolves to the durable final provider', () => {
  const moduleSource = read('apps/api/src/benefit-package/benefit-package.module.ts')
  assert.match(moduleSource, /DurableAdminBenefitPackageService/)
  assert.match(moduleSource, /provide: BenefitPackageService,[\s\S]*useExisting: DurableAdminBenefitPackageService/)
  assert.doesNotMatch(moduleSource, /useClass: ValiditySafeSnapshotViewBenefitPackageService/)
})
