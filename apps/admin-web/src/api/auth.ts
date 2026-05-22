import request from '@/utils/request'

export const authApi = {
  login(data: { username: string; password: string; captchaCode: string; captchaId: string }) {
    return request.post('/admin/auth/login', data)
  },
  getCaptcha() {
    return request.get('/admin/auth/captcha')
  },
  getUserInfo() {
    return request.get('/admin/auth/info')
  },
  logout() {
    return request.post('/admin/auth/logout')
  },
  changePassword(data: { oldPassword: string; newPassword: string; confirmPassword: string }) {
    return request.put('/admin/auth/password', data)
  },
}
