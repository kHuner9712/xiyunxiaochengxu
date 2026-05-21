import { get } from '@/utils/request'

export function getCategoryTree() {
  return get<CategoryItem[]>('/weapp/category/tree')

}

export interface CategoryItem {
  id: number
  name: string
  icon: string
  children?: CategoryItem[]
}
