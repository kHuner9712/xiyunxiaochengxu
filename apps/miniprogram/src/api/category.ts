import { get } from '@/utils/request'

export function getCategoryTree() {
  return get<CategoryItem[]>('/weapp/category/tree')

}

export interface CategoryItem {
  id: string
  name: string
  icon: string
  children?: CategoryItem[]
}
