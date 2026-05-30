import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      uni(),
      {
        name: 'uni-manifest-appid',
        transform(code, id) {
          if (!id.includes('manifest.json')) return null
          const appid = process.env.VITE_WX_APPID || env.VITE_WX_APPID
          if (!appid) return null
          const manifest = JSON.parse(code)
          manifest.appid = appid
          if (manifest['mp-weixin']) {
            manifest['mp-weixin'].appid = appid
          }
          return {
            code: JSON.stringify(manifest, null, 2),
            map: null
          }
        }
      }
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/tokens.scss";`
        }
      }
    }
  }
})
