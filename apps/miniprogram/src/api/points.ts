import { get, post } from '@/utils/request'

export function getPointsBalance() {
  return get<{ balance: number; totalEarned: number; totalSpent: number }>('/weapp/points/balance')
}

export function getPointsDetail(params: { type?: number; page: number; pageSize: number }) {
  return get<{ list: PointsRecord[]; total: number }>('/weapp/points/records', params)
}

export function checkIn() {
  return post<{ points: number; continuous: number }>('/weapp/points/sign-in')
}

export function getCheckInStatus() {
  return get<{ checked: boolean; continuous: number; todayPoints: number }>('/weapp/points/sign-in/status')
}

export function getPointsRules() {
  return get<PointsRule[]>('/weapp/points/rules')
}

export interface PointsRecord {
  id: number
  type: number
  points: number
  description: string
  createTime: string
}

export interface PointsRule {
  action: string
  points: number
  dailyLimit: number
  description: string
}
