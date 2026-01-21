export function computeModifiers(state) {
  const b = state.buildings

  const globalXpMult =
    (state.legacy?.bonuses?.globalXpMult ?? 1) * (1 + 0.02 * (b.townHall?.level ?? 0))

  const globalYieldMult = state.legacy?.bonuses?.globalYieldMult ?? 1

  const gatherYieldMult = globalYieldMult * (1 + 0.07 * (b.workshop?.level ?? 0))
  const gatherXpMult = globalXpMult

  const smithingSpeedMult = 1 + 0.08 * (b.forge?.level ?? 0)
  const cookingSpeedMult = 1 + 0.1 * (b.campfire?.level ?? 0)
  const alchemySpeedMult = 1 + 0.08 * (b.alchemistHut?.level ?? 0)

  const combatPowerMult = 1 + 0.07 * (b.barracks?.level ?? 0)
  const lootMult = 1 + 0.05 * (b.scoutLodge?.level ?? 0) + 0.03 * (b.alchemistHut?.level ?? 0)
  const injuryChanceMult = 1 - Math.min(0.35, 0.04 * (b.scoutLodge?.level ?? 0))

  const storageCap = 200 + 250 * (b.storehouse?.level ?? 0)

  return {
    globalXpMult,
    gatherYieldMult,
    gatherXpMult,
    smithingSpeedMult,
    cookingSpeedMult,
    alchemySpeedMult,
    combatPowerMult,
    lootMult,
    injuryChanceMult,
    storageCap,
  }
}
