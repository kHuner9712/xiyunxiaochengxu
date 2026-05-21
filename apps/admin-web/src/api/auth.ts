import request from '@/utils/request'

export const authApi = {
  login(data: { username: string; password: string; captchaCode: string; captchaKey: string }) {
    return request.post('/admin/auth/login', data)
  },
  getCaptcha() {
    return request.get('/admin/auth/captcha')
  },
  getUserInfo() {
    return request.get('/admin/auth/user-info')
  },
  logout() {
    return request.post('/admin/auth/logout')
  },
}
