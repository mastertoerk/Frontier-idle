import { BARS, ITEMS } from "./items.js"

const smithingRecipes = {}

for (const bar of Object.values(BARS)) {
  const id = `smelt_${bar.id}`
  smithingRecipes[id] = {
    id,
    name: `Smelt ${bar.name}`,
    skill: "smithing",
    durationSec: 2.5,
    in: bar.oreCost,
    out: { [bar.id]: 1 },
    xp: bar.xp,
    requiresBuilding: "forge",
    requiresLevel: bar.level,
    tier: bar.tier,
    category: "smelt",
  }
}

for (const item of Object.values(ITEMS)) {
  const id = `craft_${item.id}`
  smithingRecipes[id] = {
    id,
    name: `Forge ${item.name}`,
    skill: "smithing",
    durationSec: 2.25 + item.barCost * 0.8,
    in: { [item.barId]: item.barCost },
    out: { [item.id]: 1 },
    xp: item.xp,
    requiresBuilding: "forge",
    requiresLevel: item.smithingLevel,
    tier: item.tier,
    category: item.slot === "pickaxe" || item.slot === "axe" ? "tool" : item.slot === "weapon" ? "weapon" : "armor",
    itemId: item.id,
  }
}

export const RECIPES = /** @type {const} */ ({
  ...smithingRecipes,
  cookRations: {
    id: "cookRations",
    name: "Cook Rations",
    skill: "cooking",
    durationSec: 2.0,
    in: { meat: 2 },
    out: { rations: 1 },
    xp: 7,
    requiresBuilding: "campfire",
    requiresLevel: 1,
  },
  brewPotions: {
    id: "brewPotions",
    name: "Brew Potions",
    skill: "alchemy",
    durationSec: 3.5,
    in: { herbs: 3 },
    out: { potions: 1 },
    xp: 10,
    requiresBuilding: "alchemistHut",
    requiresLevel: 1,
  },
})

export function listRecipeIds() {
  return /** @type {Array<keyof typeof RECIPES>} */ (Object.keys(RECIPES))
}
