import { BARS, ITEMS, ORES, maxDurabilityForItem } from "./items.js"

const ORE_PRICES = {
  1: 0.1,
  2: 0.2,
  3: 0.3,
  4: 0.4,
  5: 0.6,
  6: 0.8,
  7: 1.0,
  8: 1.3,
  9: 1.6,
  10: 2.0,
}

const BAR_PRICES = {
  1: 0.3,
  2: 0.5,
  3: 0.7,
  4: 1.0,
  5: 1.4,
  6: 1.9,
  7: 2.5,
  8: 3.2,
  9: 4.0,
  10: 5.0,
}

const SMALL_ITEM_PRICES = {
  1: 0.5,
  2: 0.8,
  3: 1.1,
  4: 1.3,
  5: 1.5,
  6: 2.0,
  7: 2.5,
  8: 3.0,
  9: 3.5,
  10: 4.0,
}

const MEDIUM_ITEM_PRICES = {
  1: 0.8,
  2: 1.2,
  3: 1.6,
  4: 2.0,
  5: 2.5,
  6: 3.2,
  7: 4.0,
  8: 5.0,
  9: 6.0,
  10: 7.0,
}

const LARGE_ITEM_PRICES = {
  1: 1.2,
  2: 1.8,
  3: 2.5,
  4: 3.2,
  5: 4.0,
  6: 5.2,
  7: 6.5,
  8: 8.0,
  9: 9.0,
  10: 10.0,
}

const SMALL_ITEM_TYPES = new Set(["dagger", "boots", "axe", "pickaxe"])
const MEDIUM_ITEM_TYPES = new Set(["sword", "scimitar", "helmet", "shield"])
const LARGE_ITEM_TYPES = new Set(["legguards", "chestplate"])

function itemSizePrices(itemType) {
  if (SMALL_ITEM_TYPES.has(itemType)) return SMALL_ITEM_PRICES
  if (MEDIUM_ITEM_TYPES.has(itemType)) return MEDIUM_ITEM_PRICES
  if (LARGE_ITEM_TYPES.has(itemType)) return LARGE_ITEM_PRICES
  return null
}

export function sellPriceForResource(resourceId) {
  const ore = ORES[resourceId]
  if (ore) return ORE_PRICES[ore.tier] ?? 0
  const bar = BARS[resourceId]
  if (bar) return BAR_PRICES[bar.tier] ?? 0
  const item = ITEMS[resourceId]
  if (item) {
    const table = itemSizePrices(item.type)
    return table?.[item.tier] ?? 0
  }
  return 0
}

export function sellPriceForEquipped(itemId, durability) {
  const base = sellPriceForResource(itemId)
  const maxDurability = maxDurabilityForItem(itemId)
  if (!maxDurability) return base
  const pct = maxDurability > 0 ? durability / maxDurability : 1
  if (pct < 0.2) return 0
  if (durability <= 0) return base * 0.2
  return base
}
