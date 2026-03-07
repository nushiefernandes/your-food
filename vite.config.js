import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/e2e/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
})
