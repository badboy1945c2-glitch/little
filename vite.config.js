import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// base: './'  يخلي الموقع يشتغل من أي رابط أو مجلد بعد الرفع
// input: صفحتان، الموقع الرئيسي + صفحة ميكانيك التربة (soil.html)
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        soil: fileURLToPath(new URL('./soil.html', import.meta.url)),
      },
    },
  },
})
