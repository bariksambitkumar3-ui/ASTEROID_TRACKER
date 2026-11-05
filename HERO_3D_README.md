# ASTRA – code-built 3D hero

The landing hero no longer uses a background picture. The whole scene is code:

| Layer (back -> front) | Where |
|---|---|
| Space gradient, nebula, stars, bright star, orbit rings | `src/components/AsteroidHero.jsx` + CSS block at the end of `src/index.css` |
| 3D asteroid + 3D Earth (Three.js canvas) | `src/components/Hero3D.jsx` |
| Title, tagline, "Explore Dashboard" button, Live Data badge | `src/components/AsteroidHero.jsx` |

## Run
```bash
npm install     # (re)install – if node_modules came from another OS
npm run dev
npm run build   # refreshes dist/
```

## Add this hero to another React + Vite project
1. `npm i three lucide-react`  (Tailwind is *not* required for the hero)
2. Copy `src/components/Hero3D.jsx` and `src/components/AsteroidHero.jsx` into the other project.
3. Copy the CSS from the three hero blocks at the end of `src/index.css`
   (`/* ---- 3D layer … */`, `/* ===== ASTRA hero … */`, and the `.asteroid-hero`, `.hero-live-*` rules).
4. Render it: `import AsteroidHero from './components/AsteroidHero.jsx'` -> `<AsteroidHero />`
   (the button scrolls to an element with `id="overview"` – change that id if needed).

## Tuning (top of `Hero3D.jsx`)
* `AST` – asteroid position / size in the 1148 x 768 stage
* `EARTH` – horizon position and curvature
* `SURF_SPEED`, `CLOUD_SPEED` – Earth rotation speed
* asteroid light colours / intensities – search for `DirectionalLight`

## If you still see the old picture / no 3D
1. **Sign in first.** The hero only appears after login/sign-up (the auth page comes first).
2. **Use the dev server, not an old build:** `npm install` then `npm run dev`, open the URL it prints (http://localhost:3000).
   The `dist/` folder in this zip is already rebuilt from the new code, but if you ran `npm run build` earlier
   elsewhere, rebuild: `npm run build`.
3. **Hard refresh** (Ctrl+Shift+R) – and if Vite behaves oddly delete `node_modules/.vite` and restart.
4. **Browser needs WebGL.** Check chrome://gpu (or about:support in Firefox) – turn on "Use hardware acceleration".
   Without WebGL the hero shows a simple CSS asteroid + Earth instead of the animated 3D ones.
5. Open the browser console (F12) and send me any red error line.
