export function formatInt(n) {
  const x = Math.floor(Number(n) || 0)
  return x.toLocaleString()
}

export function formatNumber(n, digits = 2) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}

