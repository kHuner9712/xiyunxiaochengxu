<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { parseShareParams, handleShareVisit, handleShareBindOnLogin, savePendingInvite } from '@/utils/share'

onLaunch((options: any) => {
  const userStore = useUserStore()
  userStore.checkLogin()

  if (options?.query) {
    const params = parseShareParams(options.query)
    if (params.inviter || params.shareRecordId || params.sceneCode) {
      handleShareVisit(params)
      savePendingInvite(params)
    }
  }
})

onShow(() => {
  const userStore = useUserStore()
  if (userStore.isLoggedIn) {
    handleShareBindOnLogin().catch((err) => {
      console.warn('[baby-mall] bind invite on show failed:', err)
    })
  }
})
</script>

<style lang="scss">
@import '@/styles/common.scss';
</style>
