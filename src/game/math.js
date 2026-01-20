export function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value))
}

export function xpForLevel(level) {
  // Smooth but not explosive: ~5k xp to reach lvl 10, ~100k to reach lvl 50
  return Math.floor(40 * level * level + 60 * level)
}

export function levelFromXp(xp, maxLevel = 99) {
  let level = 1
  for (let next = 2; next <= maxLevel; next++) {
    if (xp < xpForLevel(next)) return level
    level = next
  }
  return maxLevel
}

export function nextLevelProgress(xp, maxLevel = 99) {
  const level = levelFromXp(xp, maxLevel)
  if (level >= maxLevel) {
    return { level, xpIntoLevel: 0, xpForNext: 0, pct: 1 }
  }
  const xpThis = xpForLevel(level)
  const xpNext = xpForLevel(level + 1)
  const xpIntoLevel = Math.max(0, xp - xpThis)
  const xpForNext = xpNext - xpThis
  const pct = xpForNext > 0 ? xpIntoLevel / xpForNext : 0
  return { level, xpIntoLevel, xpForNext, pct }
}

export function scaleCost(base, scale, level) {
  const out = {}
  for (const [k, v] of Object.entries(base)) {
    out[k] = Math.ceil(v * Math.pow(scale, Math.max(0, level - 1)))
  }
  return out
}

export function canAfford(resources, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if ((resources[k] ?? 0) < v) return false
  }
  return true
}

export function payCost(resources, cost) {
  for (const [k, v] of Object.entries(cost)) {
    resources[k] = (resources[k] ?? 0) - v
  }
}

