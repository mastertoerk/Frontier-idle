import { BARS, ITEMS, ORES } from "./items.js"
import { BURNT_FISH, COOKED_FISH, FISHING_NODES } from "./fishing.js"
import { FARMING_CROPS } from "./farming.js"
import { SCAVENGE_REAGENTS } from "./scavenging.js"
import { POTIONS } from "./potions.js"

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
    yields: { dullstoneOre: 1 },
  },
  fishing: {
    id: "fishing",
    name: "Fishing",
    baseXpPerSecond: 3,
    baseYieldPerSecond: 0.7,
    yields: {},
  },
  scavenging: {
    id: "scavenging",
    name: "Scavenging",
    baseXpPerSecond: 3,
    baseYieldPerSecond: 0.6,
    yields: {},
  },
  farming: {
    id: "farming",
    name: "Farming",
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

const BASE_RESOURCES = {
  wood: { id: "wood", name: "Wood", showInHud: true, category: "material" },
  gold: { id: "gold", name: "Gold", showInHud: true, category: "currency" },
}

function buildResourceCatalog() {
  const catalog = { ...BASE_RESOURCES }
  for (const ore of Object.values(ORES)) {
    catalog[ore.id] = { id: ore.id, name: ore.name, showInHud: true, category: "ore" }
  }
  for (const fish of FISHING_NODES) {
    catalog[fish.rawId] = { id: fish.rawId, name: fish.name, showInHud: false, category: "fishRaw" }
  }
  for (const fish of COOKED_FISH) {
    catalog[fish.id] = { id: fish.id, name: fish.name, showInHud: false, category: "fishCooked" }
  }
  for (const fish of BURNT_FISH) {
    catalog[fish.id] = { id: fish.id, name: fish.name, showInHud: false, category: "fishBurnt" }
  }
  for (const crop of FARMING_CROPS) {
    catalog[crop.id] = { id: crop.id, name: crop.name, showInHud: false, category: "herb" }
  }
  for (const reagent of SCAVENGE_REAGENTS) {
    catalog[reagent.id] = { id: reagent.id, name: reagent.name, showInHud: false, category: "reagent" }
  }
  for (const potion of POTIONS) {
    catalog[potion.id] = { id: potion.id, name: potion.name, showInHud: false, category: "potion" }
  }
  for (const bar of Object.values(BARS)) {
    catalog[bar.id] = { id: bar.id, name: bar.name, showInHud: true, category: "bar" }
  }
  for (const item of Object.values(ITEMS)) {
    catalog[item.id] = { id: item.id, name: item.name, showInHud: false, category: "gear" }
  }
  return catalog
}

export const RESOURCES = /** @type {const} */ (buildResourceCatalog())

export const BUILDINGS = /** @type {const} */ ({
  campfire: {
    id: "campfire",
    name: "Campfire",
    desc: "Improves cooking and recovery.",
    baseCost: { wood: 30, pebblefin: 10 },
    costScale: 1.5,
  },
  workshop: {
    id: "workshop",
    name: "Workshop",
    desc: "Improves gathering efficiency.",
    baseCost: { wood: 60, dullstoneOre: 20 },
    costScale: 1.6,
  },
  forge: {
    id: "forge",
    name: "Forge",
    desc: "Unlocks smelting and simple gear.",
    baseCost: { wood: 40, dullstoneOre: 60 },
    costScale: 1.7,
  },
  alchemistHut: {
    id: "alchemistHut",
    name: "Alchemist Hut",
    desc: "Unlocks potions and improves expeditions.",
    baseCost: { wood: 50, sunleaf: 25 },
    costScale: 1.7,
  },
  barracks: {
    id: "barracks",
    name: "Barracks",
    desc: "Improves combat power.",
    baseCost: { wood: 80, dullflickBar: 20 },
    costScale: 1.8,
  },
  storehouse: {
    id: "storehouse",
    name: "Storehouse",
    desc: "Increases storage capacity.",
    baseCost: { wood: 120, dullstoneOre: 30 },
    costScale: 1.65,
  },
  scoutLodge: {
    id: "scoutLodge",
    name: "Scout Lodge",
    desc: "More loot, fewer nasty surprises.",
    baseCost: { wood: 90, sunleaf: 15, gold: 50 },
    costScale: 1.75,
  },
  townHall: {
    id: "townHall",
    name: "Town Hall",
    desc: "Unlocks founding a new settlement (prestige).",
    baseCost: { wood: 200, dullflickBar: 50, gold: 200 },
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
