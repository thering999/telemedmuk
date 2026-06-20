import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/telemedmuk/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-snapshots',
      apply: 'build',
      writeBundle() {
        const srcDir = 'public/data/snapshots'
        const destDir = 'dist/data/snapshots'
        mkdirSync(destDir, { recursive: true })
        const copy = (src: string, dst: string) => {
          const files = readdirSync(src, { withFileTypes: true })
          for (const file of files) {
            const srcPath = join(src, file.name)
            const dstPath = join(dst, file.name)
            if (file.isDirectory()) {
              mkdirSync(dstPath, { recursive: true })
              copy(srcPath, dstPath)
            } else {
              copyFileSync(srcPath, dstPath)
            }
          }
        }
        copy(srcDir, destDir)
      },
    },
  ],
})
