import type { App, Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/user'

const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const userStore = useUserStore()
    const value = binding.value

    if (!value) return

    let hasPermission = false
    if (Array.isArray(value)) {
      hasPermission = userStore.hasAnyPermission(value)
    } else {
      hasPermission = userStore.hasPermission(value)
    }

    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  },
}

export function setupPermissionDirective(app: App) {
  app.directive('permission', permissionDirective)
}
