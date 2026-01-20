import { BARS, ITEMS } from "./items.js"
import { FISHING_NODES } from "./fishing.js"
import { POTIONS } from "./potions.js"

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
  ...Object.fromEntries(
    FISHING_NODES.map((fish) => {
      const id = `cook_${fish.rawId}`
      return [
        id,
        {
          id,
          name: `Cook ${fish.name}`,
          skill: "cooking",
          durationSec: 2.0,
          in: { [fish.rawId]: 1 },
          out: {},
          xp: fish.cookingXp,
          requiresBuilding: "campfire",
          requiresLevel: fish.cookingLevel,
          special: "cookFish",
          cookedId: fish.cookedId,
          burntId: fish.burntId,
          fishLevel: fish.level,
        },
      ]
    })
  ),
  ...Object.fromEntries(
    POTIONS.map((potion) => [
      `brew_${potion.id}`,
      {
        id: `brew_${potion.id}`,
        name: `Brew ${potion.name}`,
        skill: "alchemy",
        durationSec: 3.0,
        in: potion.ingredients,
        out: { [potion.id]: 1 },
        xp: Math.max(6, Math.floor((potion.level ?? 1) * 2.4)),
        requiresBuilding: "alchemistHut",
        requiresLevel: potion.level,
      },
    ])
  ),
})

export function listRecipeIds() {
  return /** @type {Array<keyof typeof RECIPES>} */ (Object.keys(RECIPES))
}
