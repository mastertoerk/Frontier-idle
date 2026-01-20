
# Frontier Idle (Town + Expeditions)

Stripped-down browser idle RPG: gather → build town → craft → expeditions → prestige. No 3D/WebGL code remaining; pure DOM + Vite.

## Run locally
```bash
npm install
npm run dev   # do NOT run here if your platform auto-runs the dev server
```

## Build for hosting
```bash
npm run build
```
Upload the `dist/` folder to any static host (Netlify, Vercel, CF Pages, S3/CloudFront, GitHub Pages, etc.).

## Open in VS Code / Claude
- The app is plain JS/DOM; entry is `main.js`, game logic in `src/game/`.
- No extra build steps beyond Vite.

## Project layout
- `index.html` — mounts the HUD (`#hud`).
- `main.js` — boot loop + game tick.
- `src/game/` — state, simulation, expeditions, town/buildings, UI rendering.
- `style.css` — HUD styling (mobile-friendly scrolling).

## Notes
- No Three.js or shader assets remain.
- If you cloned earlier, delete `node_modules/` and reinstall to drop unused deps.
