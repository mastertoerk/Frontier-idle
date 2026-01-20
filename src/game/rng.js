// Deterministic RNG (mulberry32) so expeditions are replayable from a seed.
export function mulberry32(seed) {
  let t = seed >>> 0
  return function rand() {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(rand, minInclusive, maxExclusive) {
  return Math.floor(rand() * (maxExclusive - minInclusive)) + minInclusive
}

