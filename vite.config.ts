import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /mindmap/ sub-path (repo = DavidProf/mindmap).
  // HashRouter keeps SPA routing without a 404.html fallback; BrowserRouter would need
  // public/404.html. This trade-off is documented for feature 7 (Deploy & polish) to revisit.
  base: process.env.NODE_ENV === "production" ? "/mindmap/" : "/",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
