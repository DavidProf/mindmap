import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /mindmap/ sub-path (repo = DavidProf/mindmap).
  // Locked for feature 7: HashRouter keeps SPA routing without a 404.html
  // fallback, so no public/404.html is needed.
  base: process.env.NODE_ENV === "production" ? "/mindmap/" : "/",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
