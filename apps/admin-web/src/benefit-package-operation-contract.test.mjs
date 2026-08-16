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

test('benefit package mutations reuse only the same operation and reject cross-operation promise aliasing', () => {
  const api = read('apps/admin-web/src/api/benefit-package.ts')
  assert.match(api, /activePackageMutations = new Map/)
  assert.match(api, /existing\.operation === operation/)
  assert.match(api, /return Promise\.reject\(new Error\('该权益包正在执行其他操作，请稍后重试'\)\)/)
  assert.match(api, /runSingleFlight\(`admin:benefit-package:\$\{operation\}:\$\{id\}`/)
  assert.equal((api.match(/runPackageMutation\(id, '(?:update|status|delete)'/g) || []).length, 3)
})

test('runtime BenefitPackageService token resolves to the id-safe durable final provider', () => {
  const moduleSource = read('apps/api/src/benefit-package/benefit-package.module.ts')
  assert.match(moduleSource, /IdSafeDurableAdminBenefitPackageService/)
  assert.match(moduleSource, /provide: BenefitPackageService,[\s\S]*useExisting: IdSafeDurableAdminBenefitPackageService/)
  assert.doesNotMatch(moduleSource, /useClass: ValiditySafeSnapshotViewBenefitPackageService/)
})
