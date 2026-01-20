export const SKILLS = /** @type {const} */ ({
  woodcutting: {
    id: "woodcutting",
    name: "Woodcutting",
    baseXpPerSecond: 3,
    baseYieldPerSecond: 1,
    yields: { wood: 1 },
  },
  mining: {
    id: "mining",
    name: "Mining",
    baseXpPerSecond: 3,
    baseYieldPerSecond: 0.8,
    yields: { ore: 1 },
  },
  smithing: {
    id: "smithing",
    name: "Smithing",
  },
  cooking: {
    id: "cooking",
    name: "Cooking",
  },
  alchemy: {
    id: "alchemy",
    name: "Alchemy",
  },
  combat: {
    id: "combat",
    name: "Combat",
  },
})

export const RESOURCES = /** @type {const} */ ({
  wood: { id: "wood", name: "Wood" },
  ore: { id: "ore", name: "Ore" },
  bars: { id: "bars", name: "Bars" },
  herbs: { id: "herbs", name: "Herbs" },
  potions: { id: "potions", name: "Potions" },
  meat: { id: "meat", name: "Raw Meat" },
  rations: { id: "rations", name: "Rations" },
  gold: { id: "gold", name: "Gold" },
})

export const BUILDINGS = /** @type {const} */ ({
  campfire: {
    id: "campfire",
    name: "Campfire",
    desc: "Improves cooking and recovery.",
    baseCost: { wood: 30, meat: 10 },
    costScale: 1.5,
  },
  workshop: {
    id: "workshop",
    name: "Workshop",
    desc: "Improves gathering efficiency.",
    baseCost: { wood: 60, ore: 20 },
    costScale: 1.6,
  },
  forge: {
    id: "forge",
    name: "Forge",
    desc: "Unlocks smelting and simple gear.",
    baseCost: { wood: 40, ore: 60 },
    costScale: 1.7,
  },
  alchemistHut: {
    id: "alchemistHut",
    name: "Alchemist Hut",
    desc: "Unlocks potions and improves expeditions.",
    baseCost: { wood: 50, herbs: 25 },
    costScale: 1.7,
  },
  barracks: {
    id: "barracks",
    name: "Barracks",
    desc: "Improves combat power.",
    baseCost: { wood: 80, bars: 20 },
    costScale: 1.8,
  },
  storehouse: {
    id: "storehouse",
    name: "Storehouse",
    desc: "Increases storage capacity.",
    baseCost: { wood: 120, ore: 30 },
    costScale: 1.65,
  },
  scoutLodge: {
    id: "scoutLodge",
    name: "Scout Lodge",
    desc: "More loot, fewer nasty surprises.",
    baseCost: { wood: 90, herbs: 15, gold: 50 },
    costScale: 1.75,
  },
  townHall: {
    id: "townHall",
    name: "Town Hall",
    desc: "Unlocks founding a new settlement (prestige).",
    baseCost: { wood: 200, bars: 50, gold: 200 },
    costScale: 2.0,
  },
})

export function listSkillIds() {
  return /** @type {Array<keyof typeof SKILLS>} */ (Object.keys(SKILLS))
}

export function listBuildingIds() {
  return /** @type {Array<keyof typeof BUILDINGS>} */ (Object.keys(BUILDINGS))
}

export function listResourceIds() {
  return /** @type {Array<keyof typeof RESOURCES>} */ (Object.keys(RESOURCES))
}

