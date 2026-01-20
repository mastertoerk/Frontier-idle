import { SKILLS } from "./content.js"
import { canAfford, payCost } from "./math.js"
import { computeModifiers } from "./modifiers.js"
import { pushLog } from "./log.js"
import { RECIPES } from "./recipes.js"
import { tickExpedition } from "./expedition.js"

function storageCapFor(state) {
  return computeModifiers(state).storageCap
}

function addResource(state, resourceId, amount) {
  const cap = storageCapFor(state)
  const next = (state.resources[resourceId] ?? 0) + amount
  state.resources[resourceId] = Math.max(0, Math.min(cap, next))
}

function addXp(state, skillId, amount) {
  state.skills[skillId].xp += amount
}

function tickGather(state, dtSec) {
  const skillId = state.activity.gatherSkill
  const skill = SKILLS[skillId]
  if (!skill?.yields) return

  const mods = computeModifiers(state)
  const injured = (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
  const eff = injured ? 0.6 : 1

  const yieldPerSec = (skill.baseYieldPerSecond ?? 0) * mods.gatherYieldMult * eff
  const xpPerSec = (skill.baseXpPerSecond ?? 0) * mods.gatherXpMult * eff

  for (const [rid, mult] of Object.entries(skill.yields)) {
    addResource(state, rid, yieldPerSec * mult * dtSec)
  }
  addXp(state, skillId, xpPerSec * dtSec)
}

function tickCraft(state, dtSec) {
  const craft = state.activity.craft ?? {}
  const recipe = RECIPES[craft.recipeId]
  if (!recipe) return

  const buildingLevel = state.buildings[recipe.requiresBuilding]?.level ?? 0
  if (buildingLevel <= 0) return

  craft.progressSec = craft.progressSec ?? 0
  craft.inProgress = craft.inProgress ?? false
  craft.remainingSec = craft.remainingSec ?? 0

  const mods = computeModifiers(state)
  const injured = (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
  const eff = injured ? 0.6 : 1

  const speedMult =
    (recipe.skill === "smithing"
      ? mods.smithingSpeedMult
      : recipe.skill === "cooking"
        ? mods.cookingSpeedMult
        : recipe.skill === "alchemy"
          ? mods.alchemySpeedMult
          : 1) * eff

  let dt = dtSec * speedMult
  let safety = 0

  while (dt > 0 && safety++ < 100) {
    if (!craft.inProgress) {
      if (!canAfford(state.resources, recipe.in)) return
      payCost(state.resources, recipe.in)
      craft.inProgress = true
      craft.remainingSec = recipe.durationSec
    }

    const step = Math.min(dt, craft.remainingSec)
    craft.remainingSec -= step
    dt -= step

    if (craft.remainingSec > 0) continue

    craft.inProgress = false

    for (const [rid, amt] of Object.entries(recipe.out ?? {})) {
      addResource(state, rid, amt)
    }
    addXp(state, recipe.skill, recipe.xp * mods.globalXpMult)

    if (recipe.special === "weapon") {
      state.equipment.weaponTier = Math.min(10, (state.equipment.weaponTier ?? 0) + 1)
      pushLog(state, `Crafted weapon tier ${state.equipment.weaponTier}.`)
    } else if (recipe.special === "armor") {
      state.equipment.armorTier = Math.min(10, (state.equipment.armorTier ?? 0) + 1)
      pushLog(state, `Crafted armor tier ${state.equipment.armorTier}.`)
    }
  }
}

export function tickSimulation(state, dtSec) {
  // Clamp huge dt (tab inactive / sleep) to keep sim stable; offline progress handles longer spans.
  const dt = Math.max(0, Math.min(1, dtSec))

  state.meta.simTimeMs = (state.meta.simTimeMs ?? Date.now()) + dt * 1000

  // Clear injury flag if time passed (kept as sim-time timestamp).
  if ((state._injuredUntil ?? 0) <= state.meta.simTimeMs) state._injuredUntil = 0

  // Activity tick
  if (state.activity.type === "gather") tickGather(state, dt)
  if (state.activity.type === "craft") tickCraft(state, dt)
  if (state.activity.type === "expedition") tickExpedition(state, dt)

  // Passive trickle: low-value, but keeps the world feeling alive.
  const workshopLvl = state.buildings.workshop?.level ?? 0
  if (workshopLvl > 0) {
    addResource(state, "wood", dt * 0.08 * workshopLvl)
    addResource(state, "ore", dt * 0.06 * workshopLvl)
  }
}

export function runOfflineProgress(state, seconds) {
  const maxSeconds = 8 * 3600
  const total = Math.max(0, Math.min(maxSeconds, seconds))
  if (total <= 1) return 0

  let simulated = 0
  const step = 1
  while (simulated + step <= total) {
    // Stop if expedition needs a choice; don’t auto-pick offline.
    if (state.expedition?.pendingChoice) break
    tickSimulation(state, step)
    simulated += step
  }
  return simulated
}
