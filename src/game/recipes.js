export const RECIPES = /** @type {const} */ ({
  smeltBars: {
    id: "smeltBars",
    name: "Smelt Bars",
    skill: "smithing",
    durationSec: 2.5,
    in: { ore: 3 },
    out: { bars: 1 },
    xp: 8,
    requiresBuilding: "forge",
  },
  cookRations: {
    id: "cookRations",
    name: "Cook Rations",
    skill: "cooking",
    durationSec: 2.0,
    in: { meat: 2 },
    out: { rations: 1 },
    xp: 7,
    requiresBuilding: "campfire",
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
  },
  craftWeapon: {
    id: "craftWeapon",
    name: "Craft Weapon (Tier +1)",
    skill: "smithing",
    durationSec: 6.0,
    in: { bars: 12, wood: 10 },
    out: {},
    xp: 35,
    requiresBuilding: "forge",
    special: "weapon",
  },
  craftArmor: {
    id: "craftArmor",
    name: "Craft Armor (Tier +1)",
    skill: "smithing",
    durationSec: 7.0,
    in: { bars: 16 },
    out: {},
    xp: 40,
    requiresBuilding: "forge",
    special: "armor",
  },
})

export function listRecipeIds() {
  return /** @type {Array<keyof typeof RECIPES>} */ (Object.keys(RECIPES))
}

