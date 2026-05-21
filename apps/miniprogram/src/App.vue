<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

onLaunch(() => {
  const userStore = useUserStore()
  userStore.checkLogin()
})
</script>

<style lang="scss">
@import '@/styles/common.scss';
</style>
