import { createStore } from "./store.js"
import { createUI } from "./ui.js"
import { runOfflineProgress, tickSimulation } from "./sim.js"
import { pushLog } from "./log.js"

const STORAGE_KEY = "frontier-idle.save.v1"

export function createGameApp() {
  const hudRoot = document.getElementById("hud")
  if (!hudRoot) throw new Error("Missing #hud element")

  const store = createStore({ storageKey: STORAGE_KEY })
  store.load()

  // Offline progress
  store.update((state) => {
    const now = Date.now()
    const last = state.meta?.lastTickAt ?? now
    const elapsedSec = Math.max(0, (now - last) / 1000)
    const simulated = runOfflineProgress(state, elapsedSec)
    if (simulated >= 10) pushLog(state, `Offline progress: simulated ${Math.floor(simulated)}s.`)
    state.meta.lastTickAt = now
  })

  const ui = createUI({ root: hudRoot, store })

  const saveTimer = setInterval(() => store.save(), 5000)
  window.addEventListener("beforeunload", () => store.save())

  let acc = 0
  const step = 0.1
  function tick(dtSec) {
    const dt = Math.max(0, Math.min(0.5, dtSec))
    acc += dt
    if (acc < step) return
    const steps = Math.min(20, Math.floor(acc / step))
    acc -= steps * step
    store.update((state) => {
      for (let i = 0; i < steps; i++) tickSimulation(state, step)
      state.meta.lastTickAt = Date.now()
    })
  }

  return {
    store,
    tick,
    destroy() {
      clearInterval(saveTimer)
      ui.destroy()
      store.save()
    },
  }
}
