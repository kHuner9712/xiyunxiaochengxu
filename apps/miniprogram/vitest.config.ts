import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

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
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 1,
    fileParallelism: false,
    exclude: [
      ...configDefaults.exclude,
      'src/full-function-acceptance.test.js',
    ],
  },
})
