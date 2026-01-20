import "./style.css";
import { createGameApp } from "./src/game/app.js"

// Game UI + simulation
const game = createGameApp()

let last = performance.now()
function loop(now) {
  const dt = Math.max(0, (now - last) / 1000)
  last = now
  game.tick(dt)
  window.requestAnimationFrame(loop)
}
window.requestAnimationFrame(loop)
