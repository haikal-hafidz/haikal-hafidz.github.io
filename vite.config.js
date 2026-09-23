import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Root user site: https://haikal-hafidz.github.io/
  base: '/',
  build: {
    rolldownOptions: {
      output: {
        // Pisahkan library besar dan area aplikasi yang jarang berubah. Selain
        // menghilangkan chunk tunggal >500 kB, browser bisa menyimpan vendor,
        // data, halaman, dan CMS di cache secara terpisah.
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 40,
            },
            {
              name: 'document-vendor',
              test: /node_modules[\\/](mammoth|jszip|fflate|sax|xmlbuilder)[\\/]/,
              priority: 40,
            },
            {
              name: 'portfolio-data',
              test: /src[\\/]cms[\\/]CmsData\.js$/,
              priority: 30,
            },
            {
              name: (id) => {
                const match = id.match(/src[\\/]pages[\\/]([^\\/]+)\.jsx$/)
                return match ? `page-${match[1].toLowerCase()}` : null
              },
              test: /src[\\/]pages[\\/].+\.jsx$/,
              priority: 20,
            },
            {
              name: 'public-components',
              test: /src[\\/]components[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
