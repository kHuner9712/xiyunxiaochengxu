import { get, post } from '@/utils/request'
import type { CompatibleTime } from '@/utils/time'

export function getPointsBalance() {
  return get<PointsBalance>('/weapp/points/balance')
}

export function getPointsDetail(params: { type?: number; page: number; pageSize: number }) {
  return get<{ list: PointsRecord[]; total: number }>('/weapp/points/records', params)
}

export function checkIn() {
  return post<{ points: number; continuous: number; consecutiveDays?: number; alreadySigned?: boolean }>('/weapp/points/sign-in')
}

export function getCheckInStatus() {
  return get<CheckInStatus>('/weapp/points/sign-in/status')
}

export function getPointsRules() {
  return get<PointsRule[]>('/weapp/points/rules')
}

export interface PointsBalance {
  balance: number
  totalEarned: number
  totalSpent: number
  availablePoints?: number
  totalPoints?: number
  frozenPoints?: number
}

export interface CheckInStatus {
  checked: boolean
  continuous: number
  todayPoints: number
  todaySigned?: boolean
  consecutiveDays?: number
  basePoints?: number
  nextBonus?: number
}

export interface PointsRecord {
  id: string
  userId?: string
  type: number
  points: number
  description: string
  sourceId?: string
  createTime?: CompatibleTime
  createdAt?: CompatibleTime
}

export interface PointsRule {
  action: string
  points: number
  dailyLimit: number
  description: string
}
