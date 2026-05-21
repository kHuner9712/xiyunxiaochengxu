import { get } from '@/utils/request'

export function getMemberInfo() {
  return get<MemberInfo>('/weapp/member/info')
}

export function getMemberRights() {
  return get<MemberRight[]>('/weapp/member/benefits')
}

export interface MemberInfo {
  level: number
  levelName: string
  growthValue: number
  nextLevelGrowth: number
  currentLevelGrowth: number
  rights: string[]
}

export interface MemberRight {
  id: number
  name: string
  icon: string
  description: string
  level: number
}

export interface GrowthRule {
  action: string
  growthValue: number
  dailyLimit: number
}
