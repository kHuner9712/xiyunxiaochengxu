import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => [
            'button',
            'checkbox',
            'checkbox-group',
            'image',
            'input',
            'picker',
            'scroll-view',
            'switch',
            'text',
            'textarea',
            'view',
          ].includes(tag),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/tokens.scss";',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
