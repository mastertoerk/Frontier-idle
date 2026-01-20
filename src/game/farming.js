export const FARMING_CROPS = [
  { id: "sunleaf", name: "Sunleaf", tier: 1, level: 1, growSec: 30 * 60, yieldMin: 3, yieldMax: 5 },
  { id: "moonsage", name: "Moonsage", tier: 2, level: 20, growSec: 90 * 60, yieldMin: 4, yieldMax: 6 },
  { id: "emberroot", name: "Emberroot", tier: 3, level: 40, growSec: 4 * 60 * 60, yieldMin: 5, yieldMax: 7 },
  { id: "frostcap", name: "Frostcap", tier: 4, level: 60, growSec: 8 * 60 * 60, yieldMin: 6, yieldMax: 8 },
  { id: "voidlotus", name: "Voidlotus", tier: 5, level: 80, growSec: 12 * 60 * 60, yieldMin: 8, yieldMax: 10 },
]

export function cropYield({ crop, farmingLevel }) {
  if (!crop) return 0
  const base =
    crop.yieldMin + Math.floor(Math.random() * (crop.yieldMax - crop.yieldMin + 1))
  const bonus = Math.max(0, Math.floor((farmingLevel - crop.level) / 20))
  const pureChance = Math.min(0.25, Math.max(0, (farmingLevel - crop.level) / 120))
  const pureBonus = Math.random() < pureChance ? 1 : 0
  return base + bonus + pureBonus
}
