const ITEM_SPECS = [
  { key: "dagger", slot: "weapon", label: "Dagger", bars: 1 },
  { key: "sword", slot: "weapon", label: "Sword", bars: 1 },
  { key: "scimitar", slot: "weapon", label: "Scimitar", bars: 2 },
  { key: "pickaxe", slot: "pickaxe", label: "Pickaxe", bars: 2 },
  { key: "axe", slot: "axe", label: "Axe", bars: 2 },
  { key: "helmet", slot: "head", label: "Helmet", bars: 2 },
  { key: "boots", slot: "boots", label: "Boots", bars: 1 },
  { key: "shield", slot: "shield", label: "Shield", bars: 2 },
  { key: "legguards", slot: "legs", label: "Legguards", bars: 3 },
  { key: "chestplate", slot: "chest", label: "Chestplate", bars: 5 },
]

export const TIER_DATA = [
  {
    tier: 1,
    key: "dullflick",
    name: "Dullflick",
    tierXp: 5,
    durability: 2000,
    ores: [
      { id: "dullstoneOre", name: "Dullstone Ore", level: 1, xp: 5 },
      { id: "flickerOre", name: "Flicker Ore", level: 1, xp: 5 },
    ],
    bar: {
      id: "dullflickBar",
      name: "Dullflick Bar",
      level: 1,
      oreCost: { dullstoneOre: 1, flickerOre: 1 },
    },
    itemLevels: {
      dagger: 1,
      sword: 2,
      scimitar: 3,
      pickaxe: 3,
      axe: 3,
      helmet: 4,
      boots: 4,
      shield: 5,
      legguards: 6,
      chestplate: 7,
    },
  },
  {
    tier: 2,
    key: "graysteel",
    name: "Graysteel",
    tierXp: 10,
    durability: 3000,
    ores: [{ id: "grayveinOre", name: "Grayvein Ore", level: 10, xp: 10 }],
    bar: {
      id: "graysteelBar",
      name: "Graysteel Bar",
      level: 10,
      oreCost: { grayveinOre: 1 },
    },
    itemLevels: {
      dagger: 10,
      sword: 11,
      scimitar: 12,
      pickaxe: 13,
      axe: 13,
      helmet: 14,
      boots: 15,
      shield: 16,
      legguards: 17,
      chestplate: 18,
    },
  },
  {
    tier: 3,
    key: "embersteel",
    name: "Embersteel",
    tierXp: 15,
    durability: 4500,
    ores: [{ id: "emberOre", name: "Ember Ore", level: 20, xp: 15 }],
    bar: {
      id: "embersteelBar",
      name: "Embersteel Bar",
      level: 20,
      oreCost: { emberOre: 1 },
    },
    itemLevels: {
      dagger: 20,
      sword: 21,
      scimitar: 22,
      pickaxe: 23,
      axe: 23,
      helmet: 24,
      boots: 25,
      shield: 26,
      legguards: 27,
      chestplate: 28,
    },
  },
  {
    tier: 4,
    key: "palecrux",
    name: "Palecrux",
    tierXp: 20,
    durability: 6000,
    ores: [
      { id: "palecruxOre", name: "Palecrux Ore", level: 30, xp: 20 },
      { id: "carbonOre", name: "Carbon Ore", level: 30, xp: 20 },
    ],
    bar: {
      id: "palecruxAlloyBar",
      name: "Palecrux Alloy Bar",
      level: 30,
      oreCost: { palecruxOre: 1, carbonOre: 1 },
    },
    itemLevels: {
      dagger: 30,
      sword: 31,
      scimitar: 32,
      pickaxe: 33,
      axe: 33,
      helmet: 34,
      boots: 35,
      shield: 36,
      legguards: 37,
      chestplate: 38,
    },
  },
  {
    tier: 5,
    key: "darkiron",
    name: "Darkiron",
    tierXp: 25,
    durability: 8000,
    ores: [{ id: "darkironOre", name: "Darkiron Ore", level: 40, xp: 25 }],
    bar: {
      id: "darkironBar",
      name: "Darkiron Bar",
      level: 40,
      oreCost: { darkironOre: 1 },
    },
    itemLevels: {
      dagger: 40,
      sword: 41,
      scimitar: 42,
      pickaxe: 43,
      axe: 43,
      helmet: 44,
      boots: 45,
      shield: 46,
      legguards: 47,
      chestplate: 48,
    },
  },
  {
    tier: 6,
    key: "aurium",
    name: "Aurium",
    tierXp: 30,
    durability: 10000,
    ores: [{ id: "auricOre", name: "Auric Ore", level: 50, xp: 30 }],
    bar: {
      id: "auriumBar",
      name: "Aurium Bar",
      level: 50,
      oreCost: { auricOre: 1 },
    },
    itemLevels: {
      dagger: 50,
      sword: 51,
      scimitar: 52,
      pickaxe: 53,
      axe: 53,
      helmet: 54,
      boots: 55,
      shield: 56,
      legguards: 57,
      chestplate: 58,
    },
  },
  {
    tier: 7,
    key: "luminvoid",
    name: "Luminvoid",
    tierXp: 35,
    durability: 12500,
    ores: [
      { id: "luminiteOre", name: "Luminite Ore", level: 60, xp: 35 },
      { id: "voidshardOre", name: "Voidshard Ore", level: 62, xp: 40 },
    ],
    bar: {
      id: "luminvoidBar",
      name: "Luminvoid Bar",
      level: 60,
      oreCost: { luminiteOre: 1, voidshardOre: 1 },
    },
    itemLevels: {
      dagger: 60,
      sword: 61,
      scimitar: 62,
      pickaxe: 63,
      axe: 63,
      helmet: 64,
      boots: 65,
      shield: 66,
      legguards: 67,
      chestplate: 68,
    },
  },
  {
    tier: 8,
    key: "bloodrelic",
    name: "Bloodrelic",
    tierXp: 40,
    durability: 15000,
    ores: [
      { id: "relicOre", name: "Relic Ore", level: 70, xp: 40 },
      { id: "bloodstoneOre", name: "Bloodstone Ore", level: 72, xp: 45 },
    ],
    bar: {
      id: "bloodrelicBar",
      name: "Bloodrelic Bar",
      level: 70,
      oreCost: { relicOre: 1, bloodstoneOre: 1 },
    },
    itemLevels: {
      dagger: 70,
      sword: 71,
      scimitar: 72,
      pickaxe: 73,
      axe: 73,
      helmet: 74,
      boots: 75,
      shield: 76,
      legguards: 77,
      chestplate: 78,
    },
    labelOverrides: { helmet: "Helm", chestplate: "Armor", legguards: "Greaves" },
  },
  {
    tier: 9,
    key: "skyforged",
    name: "Skyforged",
    tierXp: 45,
    durability: 18000,
    ores: [{ id: "skyshardOre", name: "Skyshard Ore", level: 80, xp: 50 }],
    bar: {
      id: "skyforgedBar",
      name: "Skyforged Bar",
      level: 80,
      oreCost: { skyshardOre: 1 },
    },
    itemLevels: {
      dagger: 80,
      sword: 81,
      scimitar: 82,
      pickaxe: 83,
      axe: 83,
      helmet: 84,
      boots: 85,
      shield: 86,
      legguards: 87,
      chestplate: 88,
    },
  },
  {
    tier: 10,
    key: "starflame",
    name: "Starflame",
    tierXp: 50,
    durability: 22000,
    ores: [
      { id: "starcoreOre", name: "Starcore Ore", level: 90, xp: 55 },
      { id: "obsidianFlameOre", name: "Obsidian Flame Ore", level: 92, xp: 60 },
    ],
    bar: {
      id: "starflameBar",
      name: "Starflame Bar",
      level: 90,
      oreCost: { starcoreOre: 1, obsidianFlameOre: 1 },
    },
    itemLevels: {
      dagger: 90,
      sword: 91,
      scimitar: 92,
      pickaxe: 93,
      axe: 93,
      helmet: 94,
      boots: 95,
      shield: 96,
      legguards: 97,
      chestplate: 98,
    },
    labelOverrides: { helmet: "Helm" },
  },
]

function toIdSegment(label) {
  return label.replace(/[^a-z0-9]/gi, "")
}

export const DURABILITY_BY_TIER = Object.fromEntries(TIER_DATA.map((tier) => [tier.tier, tier.durability]))

export const ORES = {}
export const BARS = {}
export const ITEMS = {}
export const MINING_NODES = []

for (const tier of TIER_DATA) {
  const barXp = 7 * tier.tierXp
  const bar = { ...tier.bar, tier: tier.tier, xp: barXp }
  BARS[bar.id] = bar

  for (const ore of tier.ores) {
    const entry = { ...ore, tier: tier.tier }
    ORES[entry.id] = entry
    MINING_NODES.push(entry)
  }

  for (const spec of ITEM_SPECS) {
    const smithingLevel = tier.itemLevels[spec.key]
    if (!smithingLevel) continue
    const label = tier.labelOverrides?.[spec.key] ?? spec.label
    const name = `${tier.name} ${label}`
    const id = `${tier.key}${toIdSegment(label)}`
    ITEMS[id] = {
      id,
      name,
      slot: spec.slot,
      type: spec.key,
      tier: tier.tier,
      barCost: spec.bars,
      smithingLevel,
      barId: bar.id,
      xp: 12 * tier.tierXp * spec.bars,
    }
  }
}

export const ARMOR_SLOTS = ["head", "chest", "legs", "boots", "shield"]
export const TOOL_SLOTS = ["pickaxe", "axe"]
export const EQUIPMENT_SLOTS = ["weapon", ...ARMOR_SLOTS, ...TOOL_SLOTS]

export function durabilityForTier(tier) {
  return DURABILITY_BY_TIER[tier] ?? 0
}

export function maxDurabilityForItem(itemId) {
  const tier = ITEMS[itemId]?.tier
  return durabilityForTier(tier)
}

export function toolPerksForTier(tier) {
  if (!tier) return { gatherSpeedBonus: 0, noDurabilityChance: 0, doubleResourceChance: 0 }
  const gatherSpeedBonus = tier >= 5 ? 0.1 : tier >= 3 ? 0.05 : 0
  const noDurabilityChance = tier >= 7 ? 0.05 : 0
  const doubleResourceChance = tier >= 10 ? 0.1 : tier >= 9 ? 0.05 : 0
  return { gatherSpeedBonus, noDurabilityChance, doubleResourceChance }
}
