const RAW_FISH_TABLE = [
  { key: "pebblefin", name: "Pebblefin", level: 1, fishingXp: 8, cookingLevel: 1, cookingXp: 7, heal: 2 },
  { key: "silverdart", name: "Silverdart", level: 5, fishingXp: 12, cookingLevel: 5, cookingXp: 10, heal: 3 },
  { key: "brineMinnow", name: "Brine Minnow", level: 10, fishingXp: 18, cookingLevel: 10, cookingXp: 15, heal: 4 },
  { key: "redscale", name: "Redscale", level: 15, fishingXp: 24, cookingLevel: 15, cookingXp: 20, heal: 5 },
  { key: "bluegillCrest", name: "Bluegill Crest", level: 20, fishingXp: 30, cookingLevel: 20, cookingXp: 26, heal: 6 },
  { key: "riverStriper", name: "River Striper", level: 25, fishingXp: 38, cookingLevel: 25, cookingXp: 32, heal: 8 },
  { key: "deepCodex", name: "Deep Codex", level: 30, fishingXp: 46, cookingLevel: 30, cookingXp: 39, heal: 9 },
  { key: "thornPike", name: "Thorn Pike", level: 35, fishingXp: 56, cookingLevel: 35, cookingXp: 48, heal: 11 },
  { key: "emberSalmon", name: "Ember Salmon", level: 40, fishingXp: 68, cookingLevel: 40, cookingXp: 58, heal: 13 },
  { key: "stormTuna", name: "Storm Tuna", level: 45, fishingXp: 82, cookingLevel: 45, cookingXp: 70, heal: 15 },
  { key: "shellbackCrab", name: "Shellback Crab", level: 50, fishingXp: 96, cookingLevel: 50, cookingXp: 82, heal: 17 },
  { key: "steeljaw", name: "Steeljaw", level: 55, fishingXp: 112, cookingLevel: 55, cookingXp: 95, heal: 19 },
  { key: "driftMonk", name: "Drift Monk", level: 60, fishingXp: 130, cookingLevel: 60, cookingXp: 110, heal: 21 },
  { key: "darkfin", name: "Darkfin", level: 65, fishingXp: 150, cookingLevel: 65, cookingXp: 128, heal: 23 },
  { key: "sunscaleRay", name: "Sunscale Ray", level: 70, fishingXp: 172, cookingLevel: 70, cookingXp: 146, heal: 25 },
  { key: "tideGuardian", name: "Tide Guardian", level: 75, fishingXp: 196, cookingLevel: 75, cookingXp: 166, heal: 27 },
  { key: "deepwaterAngler", name: "Deepwater Angler", level: 80, fishingXp: 222, cookingLevel: 80, cookingXp: 189, heal: 29 },
  { key: "glimmerEel", name: "Glimmer Eel", level: 85, fishingXp: 250, cookingLevel: 85, cookingXp: 213, heal: 31 },
  { key: "frostjaw", name: "Frostjaw", level: 90, fishingXp: 280, cookingLevel: 90, cookingXp: 238, heal: 34 },
  { key: "voidRay", name: "Void Ray", level: 95, fishingXp: 312, cookingLevel: 95, cookingXp: 265, heal: 37 },
  { key: "leviacore", name: "Leviacore", level: 99, fishingXp: 350, cookingLevel: 99, cookingXp: 298, heal: 40 },
]

function titleCase(key) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase())
}

export const FISHING_NODES = RAW_FISH_TABLE.map((fish) => {
  const label = fish.name || titleCase(fish.key)
  return {
    ...fish,
    id: fish.key,
    name: label,
    rawId: fish.key,
    cookedId: `cooked${fish.key[0].toUpperCase()}${fish.key.slice(1)}`,
    burntId: `burnt${fish.key[0].toUpperCase()}${fish.key.slice(1)}`,
  }
})

export const COOKED_FISH = FISHING_NODES.map((fish) => ({
  id: fish.cookedId,
  name: `Cooked ${fish.name}`,
  heal: fish.heal,
  level: fish.cookingLevel,
  fishingXp: fish.fishingXp,
  cookingXp: fish.cookingXp,
}))

export const BURNT_FISH = FISHING_NODES.map((fish) => ({
  id: fish.burntId,
  name: `Burnt ${fish.name}`,
}))

export function burnChanceFor({ cookingLevel, fishLevel }) {
  return Math.max(0, 35 - (cookingLevel - fishLevel) * 2)
}
