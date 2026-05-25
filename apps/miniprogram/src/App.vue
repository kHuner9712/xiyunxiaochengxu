<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { recordVisit, bindInvite } from '@/api/share'

onLaunch((options: any) => {
  const userStore = useUserStore()
  userStore.checkLogin()

  if (options?.query) {
    const { inviter, shareRecordId, campaignId, scene } = options.query
    if (inviter || shareRecordId || scene) {
      recordVisit({
        inviter: inviter || undefined,
        shareRecordId: shareRecordId || undefined,
        campaignId: campaignId || undefined,
        sceneCode: scene || undefined,
      }).catch(() => {})

      if (inviter) {
        uni.setStorageSync('pending_invite', JSON.stringify({ inviter, shareRecordId, campaignId }))
      }
    }
  }
})

onShow(() => {
  const userStore = useUserStore()
  if (userStore.isLoggedIn) {
    const pending = uni.getStorageSync('pending_invite')
    if (pending) {
      try {
        const data = JSON.parse(pending)
        bindInvite(data).catch(() => {})
        uni.removeStorageSync('pending_invite')
      } catch {}
    }
  }
})
</script>

<style lang="scss">
@import '@/styles/common.scss';
</style>
