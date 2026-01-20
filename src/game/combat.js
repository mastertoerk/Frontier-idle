import { nextLevelProgress } from "./math.js"
import { computeModifiers } from "./modifiers.js"

export function computePlayerCombat(state) {
  const mods = computeModifiers(state)
  const combatLevel = nextLevelProgress(state.skills.combat.xp).level
  const weapon = state.equipment.weaponTier ?? 0
  const armor = state.equipment.armorTier ?? 0
  const power = (1 + combatLevel * 0.18 + weapon * 0.45) * mods.combatPowerMult
  const toughness = 1 + combatLevel * 0.12 + armor * 0.5
  const maxHp = Math.floor(30 + combatLevel * 8 + armor * 10)
  const attackInterval = Math.max(0.45, Math.min(1.2, 1.15 / (0.75 + power / 6)))
  return { power, toughness, combatLevel, maxHp, attackInterval }
}
