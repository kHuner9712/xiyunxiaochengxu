import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relativeUrl: string) => readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8')

const privacySource = read('../index.vue')
const uploadSource = read('../../../api/upload.ts')
const userSource = read('../../user/index.vue')
const profileSource = read('../../user/profile.vue')
const babySource = read('../../baby/edit.vue')

describe('隐私政策与实际个人信息能力契约', () => {
  it('声明微信手机号授权以及账户昵称和头像', () => {
    expect(userSource).toContain('open-type="getPhoneNumber"')
    expect(profileSource).toContain('open-type="chooseAvatar"')
    expect(profileSource).toContain('type="nickname"')

    expect(privacySource).toContain('手机号码：')
    expect(privacySource).toContain('账户资料：')
    expect(privacySource).toContain('昵称以及您主动选择的头像')
  })

  it('声明宝宝头像以及用户主动从相册或相机选择的图片', () => {
    expect(babySource).toContain("chooseAndUploadImage(1, 'baby-avatar')")
    expect(uploadSource).toContain("sourceType: ['album', 'camera']")

    expect(privacySource).toContain('宝宝头像')
    expect(privacySource).toContain('从相册选择图片或使用相机拍摄')
    expect(privacySource).toContain('仅处理您主动选择或拍摄并确认上传的图片')
  })

  it('保留售后图片和账号注销的明确说明', () => {
    expect(privacySource).toContain('售后图片：')
    expect(privacySource).toContain('您有权注销账号')
    expect(privacySource).toContain('申请注销账号')
  })
})
