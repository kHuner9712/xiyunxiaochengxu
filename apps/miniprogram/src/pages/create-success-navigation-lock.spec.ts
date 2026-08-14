import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const pageRoot = path.resolve(__dirname)

function read(relativePath: string) {
  return fs.readFileSync(path.join(pageRoot, relativePath), 'utf8')
}

describe('create page success navigation lock', () => {
  it('does not reopen the address submit window after a successful create/update', () => {
    const source = read('address/edit.vue')

    expect(source).toContain("uni.showToast({ title: '保存成功', icon: 'success' })\n    uni.navigateBack()")
    expect(source).not.toContain('setTimeout(() => uni.navigateBack()')
  })

  it('does not reopen the baby profile submit window after a successful create/update', () => {
    const source = read('baby/edit.vue')

    expect(source).toContain("uni.showToast({ title: '保存成功', icon: 'success' })\n    uni.navigateBack()")
    expect(source).not.toContain('setTimeout(() => uni.navigateBack()')
  })
})
