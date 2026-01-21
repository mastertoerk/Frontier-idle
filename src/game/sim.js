import { RESOURCES, SKILLS } from "./content.js"
import { ITEMS, MINING_NODES, toolPerksForTier, maxDurabilityForItem } from "./items.js"
import { FISHING_NODES, burnChanceFor } from "./fishing.js"
import { SCAVENGING_ZONES } from "./scavenging.js"
import { canAfford, payCost, nextLevelProgress } from "./math.js"
import { computeModifiers } from "./modifiers.js"
import { pushLog } from "./log.js"
import { RECIPES } from "./recipes.js"
import { tickExpedition } from "./expedition.js"

function storageCapFor(state) {
  return computeModifiers(state).storageCap
}

function resourceRoom(state, resourceId) {
  const cap = storageCapFor(state)
  const current = state.resources[resourceId] ?? 0
  return Math.max(0, cap - current)
}

function addResource(state, resourceId, amount) {
  if (amount <= 0) return 0
  const current = state.resources[resourceId] ?? 0
  const room = resourceRoom(state, resourceId)
  const added = Math.min(room, amount)
  if (added <= 0) return 0
  state.resources[resourceId] = current + added
  return added
}

function addXp(state, skillId, amount) {
  if (amount <= 0) return
  const before = nextLevelProgress(state.skills[skillId].xp).level
  state.skills[skillId].xp += amount
  const after = nextLevelProgress(state.skills[skillId].xp).level
  if (after > before) {
    const skillName = SKILLS[skillId]?.name ?? skillId
    const message = `${skillName} reached level ${after}!`
    pushLog(state, message)
    state.ui.toasts = state.ui.toasts ?? []
    const now = state.meta?.simTimeMs ?? Date.now()
    const toastId = (state.ui.toastSeq ?? 0) + 1
    state.ui.toastSeq = toastId
    state.ui.toasts.push({ id: toastId, message, endsAt: now + 4500 })
    state.ui.toasts = state.ui.toasts.slice(-4)
  }
}

function applyDurabilityLoss(state, slot, amount) {
  const eq = state.equipment[slot]
  if (!eq?.id) return
  const maxDurability = maxDurabilityForItem(eq.id)
  const before = eq.durability ?? maxDurability
  const next = Math.max(0, before - amount)
  eq.durability = next
  if (before > 0 && next <= 0) {
    pushLog(state, `Broken ${ITEMS[eq.id]?.name ?? "item"}.`)
  }
}

function tickGather(state, dtSec) {
  const skillId = state.activity.gatherSkill
  const skill = SKILLS[skillId]
  if (!skill?.yields) return

  const mods = computeModifiers(state)
  const injured = (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
  const eff = injured ? 0.6 : 1
  const stopForStorage = (resourceName) => {
    state.activity.type = "idle"
    state.activity.gatherProgressSec = 0
    pushLog(state, `Storage full for ${resourceName}. Activity stopped.`)
  }

  state.activity.gatherIntervalSec = state.activity.gatherIntervalSec ?? 1
  state.activity.gatherProgressSec = state.activity.gatherProgressSec ?? 0
  const interval = Math.max(0.2, state.activity.gatherIntervalSec)
  const elapsed = state.activity.gatherProgressSec + dtSec * eff
  const actions = Math.floor(elapsed / interval)
  state.activity.gatherProgressSec = elapsed % interval

  if (skillId === "mining") {
    const targetId = state.activity.gatherResource ?? MINING_NODES[0]?.id
    const node = MINING_NODES.find((entry) => entry.id === targetId)
    if (!node) return
    if (resourceRoom(state, node.id) <= 0) {
      stopForStorage(node.name ?? node.id)
      return
    }
    const pickaxe = state.equipment.pickaxe
    const toolTier = ITEMS[pickaxe?.id]?.tier ?? 0
    const maxDurability = pickaxe?.id ? maxDurabilityForItem(pickaxe.id) : 0
    const brokenMult = pickaxe?.id && (pickaxe.durability ?? maxDurability) <= 0 ? 0.5 : 1
    const rawPerks = toolPerksForTier(toolTier)
    const perks = {
      gatherSpeedBonus: rawPerks.gatherSpeedBonus * brokenMult,
      noDurabilityChance: rawPerks.noDurabilityChance * brokenMult,
      doubleResourceChance: rawPerks.doubleResourceChance * brokenMult,
    }
    let yieldPerSec = (skill.baseYieldPerSecond ?? 0) * mods.gatherYieldMult * eff
    yieldPerSec *= 1 + perks.gatherSpeedBonus
    const yieldMult = 1 + perks.doubleResourceChance
    const finalYield = yieldPerSec * yieldMult * dtSec
    const added = addResource(state, node.id, finalYield)
    if (added <= 0) {
      stopForStorage(node.name ?? node.id)
      return
    }
    const ratio = finalYield > 0 ? added / finalYield : 0
    const xpPerSec = node.xp * yieldPerSec * mods.gatherXpMult
    addXp(state, skillId, xpPerSec * dtSec * ratio)
    const durabilityLoss = yieldPerSec * dtSec * (1 - perks.noDurabilityChance)
    applyDurabilityLoss(state, "pickaxe", durabilityLoss)
    if (added < finalYield) stopForStorage(node.name ?? node.id)
    return
  }

  if (skillId === "fishing") {
    const targetId = state.activity.gatherResource ?? FISHING_NODES[0]?.id
    const node = FISHING_NODES.find((entry) => entry.id === targetId)
    if (!node) return
    if (resourceRoom(state, node.rawId) <= 0) {
      stopForStorage(node.name ?? node.rawId)
      return
    }
    let yieldPerSec = (skill.baseYieldPerSecond ?? 0) * mods.gatherYieldMult * eff
    const finalYield = yieldPerSec * dtSec
    const added = addResource(state, node.rawId, finalYield)
    if (added <= 0) {
      stopForStorage(node.name ?? node.rawId)
      return
    }
    const ratio = finalYield > 0 ? added / finalYield : 0
    const xpPerSec = node.fishingXp * yieldPerSec * mods.gatherXpMult
    addXp(state, skillId, xpPerSec * dtSec * ratio)
    if (added < finalYield) stopForStorage(node.name ?? node.rawId)
    return
  }

  if (skillId === "scavenging") {
    const targetId = state.activity.gatherResource ?? SCAVENGING_ZONES[0]?.id
    const zone = SCAVENGING_ZONES.find((entry) => entry.id === targetId)
    if (!zone) return
    const hasRoom = zone.reagents.some((reagent) => resourceRoom(state, reagent.id) > 0)
    if (!hasRoom) {
      stopForStorage(zone.name ?? "reagents")
      return
    }
    const totalRolls = Math.max(0, Math.round(actions * (zone.rolls ?? 1) * mods.gatherYieldMult))
    if (totalRolls > 0) {
      let gained = 0
      for (let i = 0; i < totalRolls; i++) {
        const idx = Math.floor(Math.random() * zone.reagents.length)
        const reagent = zone.reagents[idx]
        if (reagent && addResource(state, reagent.id, 1) > 0) gained += 1
      }
      if (gained > 0) addXp(state, skillId, zone.xp * gained * mods.gatherXpMult)
    }
    return
  }
  if (skillId === "woodcutting") {
    if (resourceRoom(state, "wood") <= 0) {
      stopForStorage(RESOURCES.wood?.name ?? "wood")
      return
    }
    const axe = state.equipment.axe
    const toolTier = ITEMS[axe?.id]?.tier ?? 0
    const maxDurability = axe?.id ? maxDurabilityForItem(axe.id) : 0
    const brokenMult = axe?.id && (axe.durability ?? maxDurability) <= 0 ? 0.5 : 1
    const rawPerks = toolPerksForTier(toolTier)
    const perks = {
      gatherSpeedBonus: rawPerks.gatherSpeedBonus * brokenMult,
      noDurabilityChance: rawPerks.noDurabilityChance * brokenMult,
      doubleResourceChance: rawPerks.doubleResourceChance * brokenMult,
    }
    let yieldPerSec = (skill.baseYieldPerSecond ?? 0) * mods.gatherYieldMult * eff
    yieldPerSec *= 1 + perks.gatherSpeedBonus
    const yieldMult = 1 + perks.doubleResourceChance
    const finalYield = yieldPerSec * yieldMult * dtSec
    const added = addResource(state, "wood", finalYield)
    if (added <= 0) {
      stopForStorage(RESOURCES.wood?.name ?? "wood")
      return
    }
    const ratio = finalYield > 0 ? added / finalYield : 0
    const xpPerSec = (skill.baseXpPerSecond ?? 0) * mods.gatherXpMult * eff * (1 + perks.gatherSpeedBonus)
    addXp(state, skillId, xpPerSec * dtSec * ratio)
    const durabilityLoss = yieldPerSec * dtSec * (1 - perks.noDurabilityChance)
    applyDurabilityLoss(state, "axe", durabilityLoss)
    if (added < finalYield) stopForStorage(RESOURCES.wood?.name ?? "wood")
    return
  }

  const yieldPerSec = (skill.baseYieldPerSecond ?? 0) * mods.gatherYieldMult * eff
  const xpPerSec = (skill.baseXpPerSecond ?? 0) * mods.gatherXpMult * eff

  const yieldEntries = Object.entries(skill.yields)
  let expectedTotal = 0
  let addedTotal = 0
  for (const [rid, mult] of yieldEntries) {
    const expected = yieldPerSec * mult * dtSec
    expectedTotal += expected
    addedTotal += addResource(state, rid, expected)
  }
  if (addedTotal > 0 && expectedTotal > 0) {
    addXp(state, skillId, xpPerSec * dtSec * (addedTotal / expectedTotal))
  } else if (expectedTotal > 0) {
    const name = yieldEntries.length === 1 ? RESOURCES[yieldEntries[0][0]]?.name ?? yieldEntries[0][0] : "resources"
    stopForStorage(name)
  }
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

    if (recipe.special === "cookFish") {
      const cookingLevel = SKILLS.cooking ? state.skills.cooking?.xp ?? 0 : 0
      const cookingSkillLevel = nextLevelProgress(cookingLevel).level
      const burnChance = burnChanceFor({ cookingLevel: cookingSkillLevel, fishLevel: recipe.fishLevel ?? 1 })
      const roll = Math.random() * 100
      const burnt = roll < burnChance
      const outId = burnt ? recipe.burntId : recipe.cookedId
      if (outId) addResource(state, outId, 1)
      const xpGain = (recipe.xp ?? 0) * (burnt ? 0.25 : 1)
      addXp(state, recipe.skill, xpGain * mods.globalXpMult)
    } else {
      for (const [rid, amt] of Object.entries(recipe.out ?? {})) {
        addResource(state, rid, amt)
      }
      addXp(state, recipe.skill, recipe.xp * mods.globalXpMult)
    }
  }
}

export function tickSimulation(state, dtSec) {
  // Clamp huge dt (tab inactive / sleep) to keep sim stable; offline progress handles longer spans.
  const dt = Math.max(0, Math.min(1, dtSec))

  state.meta.simTimeMs = (state.meta.simTimeMs ?? Date.now()) + dt * 1000

  if (state.potion?.active?.endsAt && state.meta.simTimeMs >= state.potion.active.endsAt) {
    state.potion.active = null
  }

  // Clear injury flag if time passed (kept as sim-time timestamp).
  if ((state._injuredUntil ?? 0) <= state.meta.simTimeMs) state._injuredUntil = 0

  // Activity tick
  if (state.activity.type === "gather") tickGather(state, dt)
  if (state.activity.type === "craft") tickCraft(state, dt)
  if (state.activity.type === "expedition") tickExpedition(state, dt)

  if (state.ui?.toasts?.length) {
    state.ui.toasts = state.ui.toasts.filter((toast) => (toast.endsAt ?? 0) > state.meta.simTimeMs)
  }

  // Passive trickle: low-value, but keeps the world feeling alive.
  const workshopLvl = state.buildings.workshop?.level ?? 0
  if (workshopLvl > 0 && state.activity.type === "idle") {
    addResource(state, "wood", dt * 0.08 * workshopLvl)
    addResource(state, "dullstoneOre", dt * 0.06 * workshopLvl)
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
