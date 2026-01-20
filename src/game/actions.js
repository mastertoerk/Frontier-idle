import { BUILDINGS, SKILLS } from "./content.js"
import { scaleCost, canAfford, payCost, nextLevelProgress } from "./math.js"
import { pushLog } from "./log.js"
import { RECIPES } from "./recipes.js"
import { createDefaultState } from "./state.js"

export function setTab(state, tab) {
  state.ui.tab = tab
}

export function setActivityIdle(state) {
  state.activity.type = "idle"
  pushLog(state, "Now idle.")
}

export function startGather(state, skillId) {
  state.activity.type = "gather"
  state.activity.gatherSkill = skillId
  pushLog(state, `Gathering: ${(SKILLS[skillId]?.name ?? skillId)}.`)
}

export function startCraft(state, recipeId) {
  const recipe = RECIPES[recipeId]
  if (!recipe) return
  const lvl = state.buildings[recipe.requiresBuilding]?.level ?? 0
  if (lvl <= 0) return
  state.activity.type = "craft"
  state.activity.craft = { recipeId, inProgress: false, remainingSec: 0 }
  pushLog(state, `Crafting: ${recipe.name}.`)
}

export function buildingNextCost(state, buildingId) {
  const b = BUILDINGS[buildingId]
  const current = state.buildings[buildingId]?.level ?? 0
  return scaleCost(b.baseCost, b.costScale, current + 1)
}

export function upgradeBuilding(state, buildingId) {
  const b = BUILDINGS[buildingId]
  if (!b) return
  const current = state.buildings[buildingId]?.level ?? 0
  const cost = buildingNextCost(state, buildingId)
  if (!canAfford(state.resources, cost)) return
  payCost(state.resources, cost)
  state.buildings[buildingId].level = current + 1
  pushLog(state, `Upgraded ${b.name} to level ${current + 1}.`)
}

function canPrestige(state) {
  const hall = state.buildings.townHall?.level ?? 0
  const bosses = state.expedition?.stats?.bossesDefeated ?? 0
  return hall >= 1 && bosses >= 1
}

function computePrestigeGain(state) {
  const hall = state.buildings.townHall?.level ?? 0
  const bosses = state.expedition?.stats?.bossesDefeated ?? 0
  let totalLevels = 0
  for (const [id, s] of Object.entries(state.skills)) {
    totalLevels += nextLevelProgress(s.xp).level
  }
  const gain = Math.floor(bosses * 2 + hall + totalLevels / 25)
  return Math.max(1, gain)
}

export function foundNewSettlement(state) {
  if (!canPrestige(state)) return false
  const gain = computePrestigeGain(state)
  const legacy = state.legacy
  const next = createDefaultState()
  next.legacy = {
    ...legacy,
    points: (legacy?.points ?? 0) + gain,
    bonuses: legacy?.bonuses ?? { globalXpMult: 1, globalYieldMult: 1 },
  }
  next.ui.tab = "prestige"
  Object.assign(state, next)
  pushLog(state, `Founded a new settlement. Gained ${gain} legacy point${gain === 1 ? "" : "s"}.`)
  return true
}

export function buyLegacyUpgrade(state, upgradeId) {
  if ((state.legacy?.points ?? 0) < 1) return false
  state.legacy.points -= 1
  if (upgradeId === "xp") {
    state.legacy.bonuses.globalXpMult = (state.legacy.bonuses.globalXpMult ?? 1) * 1.05
    pushLog(state, "Legacy: +5% global XP.")
    return true
  }
  if (upgradeId === "yield") {
    state.legacy.bonuses.globalYieldMult = (state.legacy.bonuses.globalYieldMult ?? 1) * 1.05
    pushLog(state, "Legacy: +5% global yield.")
    return true
  }
  // Refund if unknown
  state.legacy.points += 1
  return false
}
