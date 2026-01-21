import { BUILDINGS, RESOURCES, SKILLS } from "./content.js"
import { ITEMS, MINING_NODES, maxDurabilityForItem } from "./items.js"
import { FISHING_NODES } from "./fishing.js"
import { FARMING_CROPS, cropYield } from "./farming.js"
import { SCAVENGING_ZONES } from "./scavenging.js"
import { POTION_BY_ID } from "./potions.js"
import { sellPriceForEquipped, sellPriceForResource } from "./economy.js"
import { scaleCost, canAfford, payCost, nextLevelProgress, levelFromXp } from "./math.js"
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

export function startGather(state, skillId, resourceId = null) {
  const skillLevel = levelFromXp(state.skills[skillId]?.xp ?? 0)
  let gatherResource = skillId === "woodcutting" ? "wood" : null
  if (skillId === "mining") {
    const targetId = resourceId ?? state.activity.gatherResource
    const node = MINING_NODES.find((entry) => entry.id === targetId) ?? MINING_NODES[0]
    if (!node) return
    if (skillLevel < node.level) return
    gatherResource = node.id
  }
  if (skillId === "fishing") {
    const targetId = resourceId ?? state.activity.gatherResource
    const node = FISHING_NODES.find((entry) => entry.id === targetId) ?? FISHING_NODES[0]
    if (!node) return
    if (skillLevel < node.level) return
    gatherResource = node.id
  }
  if (skillId === "scavenging") {
    const targetId = resourceId ?? state.activity.gatherResource
    const zone = SCAVENGING_ZONES.find((entry) => entry.id === targetId) ?? SCAVENGING_ZONES[0]
    if (!zone) return
    if (skillLevel < zone.level) return
    gatherResource = zone.id
  }
  state.activity.type = "gather"
  state.activity.gatherSkill = skillId
  state.activity.gatherResource = gatherResource
  state.activity.gatherProgressSec = 0
  state.activity.gatherIntervalSec = skillId === "scavenging" ? 2 : 1
  const targetLabel =
    (skillId === "mining" || skillId === "fishing" || skillId === "scavenging") && gatherResource
      ? ` (${(MINING_NODES.find((entry) => entry.id === gatherResource)?.name ??
          FISHING_NODES.find((entry) => entry.id === gatherResource)?.name ??
          SCAVENGING_ZONES.find((entry) => entry.id === gatherResource)?.name) ?? "Target"})`
      : ""
  pushLog(state, `Gathering: ${(SKILLS[skillId]?.name ?? skillId)}${targetLabel}.`)
}

export function plantCrop(state, cropId, patchId) {
  const crop = FARMING_CROPS.find((c) => c.id === cropId)
  if (!crop) return
  const patch = state.farming?.patches?.find((p) => p.id === patchId)
  if (!patch || patch.cropId) return
  const level = levelFromXp(state.skills.farming?.xp ?? 0)
  if (level < crop.level) return
  const now = state.meta?.simTimeMs ?? Date.now()
  patch.cropId = crop.id
  patch.plantedAt = now
  patch.readyAt = now + crop.growSec * 1000
  pushLog(state, `Planted ${crop.name}.`)
}

export function harvestCrop(state, patchId) {
  const patch = state.farming?.patches?.find((p) => p.id === patchId)
  if (!patch || !patch.cropId) return
  const crop = FARMING_CROPS.find((c) => c.id === patch.cropId)
  if (!crop) return
  const now = state.meta?.simTimeMs ?? Date.now()
  if (now < patch.readyAt) return
  const level = levelFromXp(state.skills.farming?.xp ?? 0)
  const amount = cropYield({ crop, farmingLevel: level })
  state.resources[crop.id] = (state.resources[crop.id] ?? 0) + amount
  state.skills.farming.xp += crop.tier * 12
  patch.cropId = null
  patch.plantedAt = 0
  patch.readyAt = 0
  pushLog(state, `Harvested ${amount} ${crop.name}.`)
}

export function drinkPotion(state, potionId) {
  const potion = POTION_BY_ID[potionId]
  if (!potion) return
  const combat = state.expedition?.room?.combat
  if (combat && potion.kind !== "heal" && combat.buffPotionUsed) return
  const now = state.meta?.simTimeMs ?? Date.now()
  const cooldowns = state.potion?.cooldowns ?? { healingUntil: 0, regenUntil: 0 }
  if (potion.kind === "heal" && now < (cooldowns.healingUntil ?? 0)) return
  if (potion.kind === "regen" && now < (cooldowns.regenUntil ?? 0)) return
  if ((state.resources[potionId] ?? 0) <= 0) return

  state.resources[potionId] -= 1
  const active = {
    ...potion,
    startedAt: now,
    endsAt: potion.durationSec ? now + potion.durationSec * 1000 : now,
    nextTickAt: now + (potion.intervalSec ?? 0) * 1000,
  }
  state.potion.active = active

  if (potion.kind === "heal") {
    cooldowns.healingUntil = now + (potion.cooldownSec ?? 30) * 1000
    const combat = state.expedition?.room?.combat
    if (combat) {
      combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + potion.amount)
    }
  } else if (potion.kind === "regen") {
    cooldowns.regenUntil = now + (potion.cooldownSec ?? 60) * 1000
    if (combat) combat.buffPotionUsed = true
  }

  state.potion.cooldowns = cooldowns
  pushLog(state, `Drank ${potion.name}.`)
  if (combat && potion.kind !== "heal") combat.buffPotionUsed = true
}

export function startCraft(state, recipeId) {
  const recipe = RECIPES[recipeId]
  if (!recipe) return
  const lvl = state.buildings[recipe.requiresBuilding]?.level ?? 0
  if (lvl <= 0) return
  const skillLevel = levelFromXp(state.skills[recipe.skill]?.xp ?? 0)
  if (skillLevel < (recipe.requiresLevel ?? 1)) return
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

export function selectMiningTarget(state, resourceId) {
  const node = MINING_NODES.find((entry) => entry.id === resourceId)
  if (!node) return
  const level = levelFromXp(state.skills.mining?.xp ?? 0)
  if (level < node.level) return
  state.activity.gatherResource = resourceId
  if (state.activity.type === "gather" && state.activity.gatherSkill === "mining") {
    pushLog(state, `Mining: ${node.name}.`)
  }
}

export function equipItem(state, itemId) {
  const item = ITEMS[itemId]
  if (!item) return
  if ((state.resources[itemId] ?? 0) <= 0) return

  const slot = item.slot
  const current = state.equipment[slot]
  if (current?.id === itemId) return

  state.resources[itemId] -= 1
  if (current?.id) {
    state.resources[current.id] = (state.resources[current.id] ?? 0) + 1
  }
  state.equipment[slot] = {
    id: itemId,
    durability: maxDurabilityForItem(itemId),
  }
  pushLog(state, `Equipped ${item.name}.`)
}

export function unequipItem(state, slot) {
  const current = state.equipment[slot]
  if (!current?.id) return
  state.resources[current.id] = (state.resources[current.id] ?? 0) + 1
  state.equipment[slot] = null
  pushLog(state, `Unequipped ${ITEMS[current.id]?.name ?? "item"}.`)
}

export function repairItem(state, slot) {
  const current = state.equipment[slot]
  if (!current?.id) return
  const item = ITEMS[current.id]
  if (!item) return
  const forge = state.buildings.forge?.level ?? 0
  if (forge <= 0) return
  const cost = { [item.barId]: 1 }
  if (!canAfford(state.resources, cost)) return
  if (current.durability >= maxDurabilityForItem(item.id)) return
  payCost(state.resources, cost)
  current.durability = maxDurabilityForItem(item.id)
  state.skills.smithing.xp += item.xp * 0.25
  pushLog(state, `Repaired ${item.name}.`)
}

export function sellResource(state, resourceId, amount = 1) {
  if (!resourceId || amount <= 0) return
  const owned = state.resources[resourceId] ?? 0
  if (owned < amount) return
  const price = sellPriceForResource(resourceId)
  if (price <= 0) return
  state.resources[resourceId] = owned - amount
  state.resources.gold = (state.resources.gold ?? 0) + price * amount
  const name = RESOURCES[resourceId]?.name ?? resourceId
  pushLog(state, `Sold ${amount} ${name} for ${price * amount} gold.`)
}

export function sellEquippedItem(state, slot) {
  const current = state.equipment[slot]
  if (!current?.id) return
  const price = sellPriceForEquipped(current.id, current.durability ?? 0)
  if (price <= 0) return
  state.resources.gold = (state.resources.gold ?? 0) + price
  state.equipment[slot] = null
  pushLog(state, `Sold equipped ${ITEMS[current.id]?.name ?? "item"} for ${price} gold.`)
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
