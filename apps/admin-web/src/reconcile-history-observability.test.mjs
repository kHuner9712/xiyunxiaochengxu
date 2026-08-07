import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, 'views/order/reconcile-center.vue'), 'utf8')

test('payment reconciliation surfaces historical cancelled-payment audit counters', () => {
  for (const marker of [
    '历史取消支付核验',
    '历史资金任务',
    'cancelledCreatedChecked',
    'cancelledCreatedSuccess',
    'cancelledCreatedClosed',
    'cancelledCreatedPending',
    'cancelledCreatedMismatch',
    'cancelledCreatedFailed',
    'historicalTasksChecked',
    'historicalTasksResolved',
    'historicalTasksRefreshed',
    'historicalTasksFailed',
    'cancelledPaidDetected',
    'cancelledPaidSeeded',
  ]) {
    assert.ok(source.includes(marker), `missing historical payment reconciliation marker: ${marker}`)
  }
})

test('payment reconciliation immediately refreshes compensation tasks', () => {
  const assignment = source.indexOf('paymentResult.value = res.data')
  const refresh = source.indexOf('await fetchCompensationTasks()', assignment)
  assert.ok(assignment >= 0, 'payment reconciliation result assignment missing')
  assert.ok(refresh > assignment, 'compensation task refresh must run after payment reconciliation')
})

test('historical financial anomalies produce an operator-facing warning', () => {
  assert.ok(source.includes('cancelledPaidSeeded'))
  assert.ok(source.includes('cancelledCreatedMismatch'))
  assert.ok(source.includes('需关注的历史资金异常'))
  assert.ok(source.includes('请查看下方补偿任务'))
})
