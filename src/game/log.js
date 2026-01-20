export function pushLog(state, message) {
  const ts = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  state.ui.log.unshift(`[${ts}] ${message}`)
  state.ui.log.length = Math.min(state.ui.log.length, 80)
}

