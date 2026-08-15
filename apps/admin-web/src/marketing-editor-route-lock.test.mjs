import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

const couponEdit = read('apps/admin-web/src/views/marketing/coupon-edit.vue')
const activityEdit = read('apps/admin-web/src/views/marketing/activity-edit.vue')
const productEdit = read('apps/admin-web/src/views/product/edit.vue')

function method(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing method start: ${start}`)
  assert.notEqual(endIndex, -1, `missing method end: ${end}`)
  return source.slice(startIndex, endIndex)
}

const couponFetch = method(couponEdit, 'async function fetchDetail(', 'function buildPayload()')
const couponSubmit = method(couponEdit, 'async function handleSubmit()', 'watch(')
const activitySelect = method(activityEdit, 'async function confirmProductSelect()', 'async function fetchDetail(')
const activityFetch = method(activityEdit, 'async function fetchDetail(', 'function validateBusinessRules()')
const activitySubmit = method(activityEdit, 'async function handleSubmit()', 'watch(')
const productUploads = method(productEdit, 'function beginUploadContext()', 'function handleRemoveCertImage(')
const productFetch = method(productEdit, 'async function fetchDetail(', 'async function handleSubmit()')
const productSubmit = method(productEdit, 'async function handleSubmit()', 'async function loadReferenceData()')

test('coupon editor ignores stale detail responses after route id changes', () => {
  assert.match(couponEdit, /let detailRequestVersion = 0/)
  assert.match(couponFetch, /const requestVersion = \+\+detailRequestVersion/)
  assert.match(couponFetch, /couponApi\.getDetail\(couponIdValue\)/)
  assert.match(couponFetch, /requestVersion !== detailRequestVersion \|\| !isCurrentRouteCoupon\(couponIdValue\)/)
  assert.match(couponFetch, /String\(d\?\.id \|\| ''\) !== couponIdValue/)
  assert.match(couponEdit, /watch\([\s\S]*currentRouteCouponId\(\)[\s\S]*resetForm\(\)[\s\S]*fetchDetail\(nextCouponId\)[\s\S]*immediate: true/)
})

test('coupon editor cannot save stale form data to a newly selected route id', () => {
  assert.match(couponSubmit, /const targetCouponId = currentRouteCouponId\(\)/)
  assert.match(couponSubmit, /const targetIsEdit = POSITIVE_ID\.test\(targetCouponId\)/)
  assert.match(couponSubmit, /formRef\.value\?\.validate[\s\S]*!isCurrentRouteCoupon\(targetCouponId\)/)
  assert.match(couponSubmit, /couponApi\.update\(targetCouponId, data\)/)
  assert.match(couponSubmit, /couponApi\.create\(data\)/)
  assert.doesNotMatch(couponSubmit, /couponApi\.update\(couponId\.value/)
  assert.match(couponEdit, /:disabled="submitting \|\| detailLoading \|\| invalidRoute"/)
})

test('activity editor drops stale activity and SKU detail work after route changes', () => {
  assert.match(activityEdit, /let detailRequestVersion = 0/)
  assert.match(activityEdit, /let editorGeneration = 0/)
  assert.match(activityFetch, /const requestVersion = \+\+detailRequestVersion/)
  assert.match(activityFetch, /activityApi\.getDetail\(activityIdValue\)/)
  assert.match(activityFetch, /requestVersion !== detailRequestVersion \|\| !isCurrentEditor\(generation, activityIdValue\)/)
  assert.match(activityFetch, /String\(d\.id \|\| ''\) !== activityIdValue/)
  assert.match(activityFetch, /await Promise\.all[\s\S]*loadSkuOptions\(productId\)[\s\S]*requestVersion !== detailRequestVersion \|\| !isCurrentEditor\(generation, activityIdValue\)/)
  assert.match(activityEdit, /watch\([\s\S]*editorGeneration \+= 1[\s\S]*resetForm\(\)[\s\S]*fetchDetail\(nextActivityId, editorGeneration\)[\s\S]*immediate: true/)
})

test('activity product selection cannot leak async SKU results into another route', () => {
  assert.match(activitySelect, /const operationGeneration = editorGeneration/)
  assert.match(activitySelect, /const targetActivityId = currentRouteActivityId\(\)/)
  assert.match(activitySelect, /await loadSkuOptions\(productId\)[\s\S]*!isCurrentEditor\(operationGeneration, targetActivityId\)/)
  assert.match(activitySelect, /if \(operationGeneration === editorGeneration\)[\s\S]*loadingSelectedProducts\.value = false/)
})

test('activity editor snapshots its write target before async validation', () => {
  assert.match(activitySubmit, /const targetActivityId = currentRouteActivityId\(\)/)
  assert.match(activitySubmit, /const targetIsEdit = POSITIVE_ID\.test\(targetActivityId\)/)
  assert.match(activitySubmit, /const operationGeneration = editorGeneration/)
  assert.match(activitySubmit, /formRef\.value\?\.validate[\s\S]*!isCurrentEditor\(operationGeneration, targetActivityId\)/)
  assert.match(activitySubmit, /activityApi\.update\(targetActivityId, payload\)/)
  assert.match(activitySubmit, /activityApi\.create\(payload\)/)
  assert.doesNotMatch(activitySubmit, /activityApi\.update\(activityId\.value/)
  assert.match(activityEdit, /:disabled="submitting \|\| detailLoading \|\| invalidRoute"/)
})

test('product editor drops stale detail and private certification previews after route changes', () => {
  assert.match(productEdit, /let detailRequestVersion = 0/)
  assert.match(productEdit, /let editorGeneration = 0/)
  assert.match(productFetch, /const requestVersion = \+\+detailRequestVersion/)
  assert.match(productFetch, /productApi\.getDetail\(productIdValue\)/)
  assert.match(productFetch, /requestVersion !== detailRequestVersion \|\| !isCurrentEditor\(generation, productIdValue\)/)
  assert.match(productFetch, /String\(d\.id \|\| ''\) !== productIdValue/)
  assert.match(productFetch, /resolvedCertUrls = await resolvePrivateFileUrls\(certImages\)[\s\S]*!isCurrentEditor\(generation, productIdValue\)[\s\S]*revokePrivateObjectUrls\(resolvedCertUrls\)/)
  assert.match(productEdit, /watch\([\s\S]*editorGeneration \+= 1[\s\S]*resetRouteBoundState\(\)[\s\S]*fetchDetail\(nextProductId, editorGeneration\)[\s\S]*immediate: true/)
})

test('product uploads cannot mutate another product after route changes', () => {
  assert.match(productUploads, /return \{ generation: editorGeneration, productIdValue: currentRouteProductId\(\) \}/)
  assert.ok((productUploads.match(/if \(!isCurrentEditor\(context\.generation, context\.productIdValue\)\) return/g) || []).length >= 5)
  assert.match(productUploads, /uploadVideo[\s\S]*if \(isCurrentEditor\(context\.generation, context\.productIdValue\)\)[\s\S]*videoUploadProgress\.value = percent/)
  assert.match(productUploads, /resolvedUrl = await resolvePrivateFileUrl\(uploadedUrl\)[\s\S]*!isCurrentEditor\(context\.generation, context\.productIdValue\)[\s\S]*revokePrivateObjectUrls/)
  assert.match(productUploads, /if \(context\.generation === editorGeneration\)[\s\S]*pendingUploads\.value = Math\.max/)
})

test('product editor snapshots its write target before validation and never writes form.id directly', () => {
  assert.match(productSubmit, /const targetProductId = currentRouteProductId\(\)/)
  assert.match(productSubmit, /const targetIsEdit = POSITIVE_ID\.test\(targetProductId\)/)
  assert.match(productSubmit, /const operationGeneration = editorGeneration/)
  assert.match(productSubmit, /String\(form\.id \|\| ''\) !== targetProductId/)
  assert.match(productSubmit, /formRef\.value\?\.validate[\s\S]*!isCurrentEditor\(operationGeneration, targetProductId\)/)
  assert.match(productSubmit, /productApi\.update\(targetProductId, payload\)/)
  assert.match(productSubmit, /productApi\.create\(payload\)/)
  assert.doesNotMatch(productSubmit, /productApi\.update\(form\.id, payload\)/)
  assert.match(productEdit, /:disabled="pendingUploads > 0 \|\| submitting \|\| editorLoading \|\| invalidRoute"/)
})
