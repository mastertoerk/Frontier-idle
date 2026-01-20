import { SAVE_VERSION, createDefaultState } from "./state.js"

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function migrateSave(raw) {
  if (!raw || typeof raw !== "object") return null
  if (raw.version === SAVE_VERSION) return raw
  return null
}

export function createStore({ storageKey }) {
  /** @type {ReturnType<typeof createDefaultState>} */
  let state = createDefaultState()
  const listeners = new Set()
  let dirty = false

  function notify() {
    for (const l of listeners) l(state)
  }

  function getState() {
    return state
  }

  function update(mutator) {
    mutator(state)
    state.meta.updatedAt = Date.now()
    dirty = true
    notify()
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function load() {
    const rawText = localStorage.getItem(storageKey)
    if (!rawText) return
    const raw = safeJsonParse(rawText)
    const migrated = migrateSave(raw)
    if (!migrated) return
    state = migrated
    dirty = false
    notify()
  }

  function replace(nextState) {
    const migrated = migrateSave(nextState)
    if (!migrated) return false
    state = migrated
    dirty = true
    notify()
    return true
  }

  function save() {
    if (!dirty) return
    localStorage.setItem(storageKey, JSON.stringify(state))
    dirty = false
  }

  function hardReset() {
    state = createDefaultState()
    dirty = true
    save()
    notify()
  }

  return { getState, update, subscribe, load, replace, save, hardReset }
}
