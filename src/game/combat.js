import { nextLevelProgress } from "./math.js"
import { computeModifiers } from "./modifiers.js"
import { ARMOR_SLOTS, ITEMS, maxDurabilityForItem } from "./items.js"
import { potionModifiers } from "./potions.js"

function effectiveTier(item) {
  if (!item?.id) return 0
  const tier = ITEMS[item.id]?.tier ?? 0
  const maxDurability = maxDurabilityForItem(item.id)
  const durability = item.durability ?? maxDurability
  const brokenMult = durability > 0 ? 1 : 0.5
  return tier * brokenMult
}

export function computePlayerCombat(state) {
  const mods = computeModifiers(state)
  const potion = potionModifiers(state)
  const combatLevel = nextLevelProgress(state.skills.combat.xp).level
  const weapon = effectiveTier(state.equipment.weapon)
  const weaponType = state.equipment.weapon?.id ? ITEMS[state.equipment.weapon.id]?.type : null
  const armorTotal = ARMOR_SLOTS.reduce((sum, slot) => sum + effectiveTier(state.equipment[slot]), 0)
  const armorPieces = ARMOR_SLOTS.filter((slot) => state.equipment[slot]?.id).length
  const armor = armorPieces > 0 ? armorTotal / armorPieces : 0
  const power = (1 + combatLevel * 0.18 + weapon * 0.45) * mods.combatPowerMult * potion.powerMult
  const toughness = (1 + combatLevel * 0.12 + armor * 0.5) * potion.toughnessMult
  const maxHp = Math.floor(30 + combatLevel * 8 + armor * 10 + (potion.maxHpBonus ?? 0))
  const baseAttackInterval =
    weaponType === "dagger" || weaponType === "scimitar" ? 2.4 : weaponType === "sword" ? 3.0 : 3.0
  const attackInterval = baseAttackInterval
  return {
    power,
    toughness,
    combatLevel,
    maxHp,
    attackInterval,
    weaponTier: weapon,
    armorTier: armor,
    accuracyBonus: potion.accuracyBonus ?? 0,
  }
}
