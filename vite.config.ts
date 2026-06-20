import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/telemedmuk/',
  plugins: [react(), tailwindcss()],
  publicDir: 'public',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/xlsx')) return 'xlsx'
        },
      },
    },
  },
})
