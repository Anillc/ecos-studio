/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'electron-vite'

const packageRoot = fileURLToPath(new URL('.', import.meta.url))
const guiRoot = resolve(packageRoot, '../..')
const rendererRoot = resolve(packageRoot, '../renderer')
const workspaceRoot = resolve(guiRoot, '..')

export default defineConfig(({ command, mode }) => {
  const isProd = command === 'build' && mode !== 'development'

  return {
    main: {
      build: {
        outDir: resolve(packageRoot, 'dist/main'),
        emptyOutDir: true,
        lib: {
          entry: resolve(packageRoot, 'electron/main/index.ts'),
          formats: ['es'],
        },
        rollupOptions: {
          external: ['electron', /^node:.*/],
        },
      },
    },
    preload: {
      build: {
        outDir: resolve(packageRoot, 'dist/preload'),
        emptyOutDir: false,
        lib: {
          entry: resolve(packageRoot, 'electron/preload/index.ts'),
          formats: ['es'],
        },
        rollupOptions: {
          external: ['electron', /^node:.*/],
        },
      },
    },
    renderer: {
      root: rendererRoot,
      base: './',
      clearScreen: false,
      resolve: {
        alias: {
          '@': resolve(rendererRoot, 'src'),
        },
      },
      plugins: [
        vue({
          template: {
            compilerOptions: {
              hoistStatic: true,
              cacheHandlers: true,
            },
          },
        }),
        tailwindcss(),
      ],
      server: {
        port: 1420,
        strictPort: true,
        watch: {
          ignored: ['**/src-tauri/**'],
        },
        fs: {
          allow: [workspaceRoot],
        },
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
        pure: isProd ? ['console.log', 'console.info', 'console.debug', 'console.trace'] : [],
        legalComments: 'none',
      },
      build: {
        outDir: resolve(packageRoot, 'dist/renderer'),
        emptyOutDir: false,
        target: 'esnext',
        minify: 'esbuild',
        rollupOptions: {
          input: resolve(rendererRoot, 'index.html'),
          output: {
            manualChunks: {
              'vue-vendor': ['vue', 'vue-router'],
              'primevue-vendor': ['primevue'],
            },
          },
        },
        chunkSizeWarningLimit: 1000,
        assetsInlineLimit: 4096,
      },
      optimizeDeps: {
        include: ['vue', 'vue-router', 'primevue'],
      },
    },
  }
})
