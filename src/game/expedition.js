import { mulberry32, randomInt } from "./rng.js"
import { computeModifiers } from "./modifiers.js"
import { nextLevelProgress } from "./math.js"
import { computePlayerCombat } from "./combat.js"
import { pushLog } from "./log.js"
import { ITEMS, ARMOR_SLOTS, maxDurabilityForItem } from "./items.js"
import { COOKED_FISH } from "./fishing.js"
import { POTION_BY_ID } from "./potions.js"

const ENEMIES_BY_TIER = [
  ["Slime", "Boar", "Wolf", "Giant Rat"],
  ["Bandit", "Giant Spider", "Skeletal Scout", "Wild Stag"],
  ["Cultist", "Ogre", "Stone Golem", "Warg"],
]

const BOSSES = ["Feral Alpha", "Ruin Warden", "Ancient Stag"]

function addResourceCapped(state, resourceId, amount) {
  const cap = computeModifiers(state).storageCap
  const next = (state.resources[resourceId] ?? 0) + amount
  state.resources[resourceId] = Math.max(0, Math.min(cap, next))
}

function ensureFeed(state) {
  const e = state.expedition
  if (!Array.isArray(e.feed)) e.feed = []
}

function pushFeed(state, message) {
  ensureFeed(state)
  state.expedition.feed.unshift(message)
  state.expedition.feed.length = Math.min(state.expedition.feed.length, 40)
}

function rngNextFloat(rng) {
  // Serializable RNG step (mulberry32 variant)
  let t = (rng.t ?? 0) >>> 0
  t = (t + 0x6d2b79f5) >>> 0
  let x = Math.imul(t ^ (t >>> 15), 1 | t)
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
  rng.t = t
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

function pickEnemyName(seed, difficulty, isBoss) {
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  if (isBoss) return BOSSES[randomInt(rand, 0, BOSSES.length)]
  const tier = Math.max(0, Math.min(ENEMIES_BY_TIER.length - 1, Math.floor((difficulty - 1) / 2)))
  const list = ENEMIES_BY_TIER[tier]
  return list[randomInt(rand, 0, list.length)]
}

function rollRoomType(rand, roomIndex, roomCount) {
  if (roomIndex === roomCount - 1) return "boss"
  const r = rand()
  if (r < 0.55) return "combat"
  if (r < 0.7) return "event"
  if (r < 0.85) return "rest"
  return "treasure"
}

function makeRoom(state) {
  const e = state.expedition
  const rand = mulberry32(e.seed + e.roomIndex * 1337)
  const type = rollRoomType(rand, e.roomIndex, e.roomCount)
  const risk = e.risk
  const baseDifficulty = 1 + Math.floor((e.roomIndex / Math.max(1, e.roomCount - 1)) * (2 + risk))
  const difficulty = baseDifficulty + randomInt(rand, 0, 2)

  const choiceMod = e._nextRoomMod ?? { lootMult: 1, difficultyAdd: 0 }
  e._nextRoomMod = null

  const finalDifficulty = Math.max(1, difficulty + (choiceMod.difficultyAdd ?? 0))

  const durationSec =
    type === "rest"
      ? 6
      : type === "treasure"
        ? 3
        : type === "event"
          ? 0
          : 1 // combat handled by discrete simulation; duration is derived from HP

  const seed = (e.seed + e.roomIndex * 1337 + (finalDifficulty << 8)) >>> 0

  return {
    type,
    difficulty: finalDifficulty,
    durationSec,
    progressSec: 0,
    lootMult: choiceMod.lootMult ?? 1,
    resolved: false,
    seed,
  }
}

function awardLoot(state, { difficulty, isBoss, lootMult }) {
  const mods = computeModifiers(state)
  const totalLootMult = mods.lootMult * lootMult
  const gold = Math.ceil((6 + 5 * difficulty + (isBoss ? 20 : 0)) * totalLootMult)
  const fish = Math.random() < 0.25 ? Math.ceil((1 + difficulty * 0.3) * totalLootMult) : 0
  addResourceCapped(state, "gold", gold)
  addResourceCapped(state, "pebblefin", fish)
  return { gold, fish }
}

function applyInjuryIfAny(state, baseChance) {
  const mods = computeModifiers(state)
  const chance = baseChance * mods.injuryChanceMult
  if (Math.random() > chance) return false
  const now = state.meta?.simTimeMs ?? Date.now()
  state._injuredUntil = Math.max(state._injuredUntil ?? 0, now + 60_000)
  pushLog(state, "Injury! Efficiency reduced for 60s.")
  return true
}

function ensureCombatRoomInitialized(state, room) {
  if (room.combat) return
  const isBoss = room.type === "boss"
  const { power, toughness, combatLevel, maxHp, attackInterval } = computePlayerCombat(state)
  const activePotion = state.potion?.active

  const enemyPower = 1 + room.difficulty * (1.2 + 0.35 * state.expedition.risk) + (isBoss ? 4 : 0)
  const enemyMaxHp = Math.floor(18 + room.difficulty * 14 + (isBoss ? 75 : 0))
  const playerMaxHp = maxHp

  const playerInterval = attackInterval
  const enemyInterval = 2.4

  room.combat = {
    enemyName: pickEnemyName(room.seed, room.difficulty, isBoss),
    enemyPower,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    playerHp: playerMaxHp,
    playerMaxHp,
    playerPower: power,
    playerToughness: toughness,
    playerInterval,
    enemyInterval,
    playerCd: 0.1,
    enemyCd: 0.7,
    rng: { t: (room.seed ^ 0xdeadbeef) >>> 0 },
    damageTaken: 0,
    started: false,
    autoFight: state.ui?.combatAuto ?? true,
    playerQueued: 0,
    lastAutoEatAt: 0,
    buffPotionUsed: !!(activePotion && activePotion.kind !== "heal"),
    hitSeq: 0,
    lastEnemyHit: null,
    lastPlayerHit: null,
  }
}

function findCookedFish(state, preferHighest = false) {
  const list = [...COOKED_FISH].sort((a, b) => (preferHighest ? b.heal - a.heal : a.heal - b.heal))
  for (const fish of list) {
    if ((state.resources[fish.id] ?? 0) > 0) return fish
  }
  return null
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

function recordHit(combat, target, amount, crit, now) {
  combat.hitSeq = (combat.hitSeq ?? 0) + 1
  const entry = { amount, crit, at: now, seq: combat.hitSeq }
  if (target === "enemy") {
    combat.lastEnemyHit = entry
  } else {
    combat.lastPlayerHit = entry
  }
}

function tickCombatRoom(state, room, dtSec) {
  ensureCombatRoomInitialized(state, room)
  const c = room.combat
  const now = state.meta?.simTimeMs ?? Date.now()
  const speed = c.autoFight ? 1.2 : 1
  const dt = dtSec * speed
  const live = computePlayerCombat(state)
  c.playerPower = live.power
  c.playerToughness = live.toughness
  c.playerInterval = live.attackInterval
  c.playerMaxHp = live.maxHp
  const accuracyBonus = live.accuracyBonus ?? 0
  if (c.playerHp > c.playerMaxHp) c.playerHp = c.playerMaxHp

  const activePotion = state.potion?.active
  if (activePotion?.kind === "regen" && c.playerHp < c.playerMaxHp) {
    const now = state.meta?.simTimeMs ?? Date.now()
    const interval = (activePotion.intervalSec ?? 10) * 1000
    let tickAt = activePotion.nextTickAt ?? now
    while (tickAt <= now && c.playerHp < c.playerMaxHp) {
      c.playerHp = Math.min(c.playerMaxHp, c.playerHp + (activePotion.amount ?? 1))
      tickAt += interval
    }
    activePotion.nextTickAt = tickAt
  }

  if (!c.started) {
    c.started = true
    pushFeed(state, `${c.enemyName} appears!`)
  }

  if (c.autoFight && c.playerHp / c.playerMaxHp < 0.55 && now - (c.lastAutoEatAt ?? 0) >= 6000) {
    const fish = findCookedFish(state, true)
    if (fish) {
      state.resources[fish.id] -= 1
      c.playerHp = Math.min(c.playerMaxHp, c.playerHp + fish.heal)
      pushFeed(state, `You eat ${fish.name} and heal ${fish.heal}.`)
      c.lastAutoEatAt = now
    }
  }

  c.playerCd -= dt
  c.enemyCd -= dt

  let safety = 0
  const maxActions = c.autoFight ? 10 : 1
  while (safety++ < maxActions) {
    const playerReady = c.playerCd <= 0
    const enemyReady = c.enemyCd <= 0
    const playerCanAct = playerReady && (c.autoFight || (c.playerQueued ?? 0) > 0)
    if (!playerCanAct && !enemyReady) break

    if (playerCanAct && (!enemyReady || c.playerCd <= c.enemyCd)) {
      // Player attacks
      c.playerCd += c.playerInterval
      if (!c.autoFight) c.playerQueued = Math.max(0, (c.playerQueued ?? 0) - 1)
      const r = rngNextFloat(c.rng)
      const hitChance = Math.max(
        0.55,
        Math.min(0.95, 0.72 + (c.playerPower - c.enemyPower) * 0.04 + accuracyBonus)
      )
      if (r > hitChance) {
        pushFeed(state, `You miss.`)
      } else {
        const dodgeChance = Math.max(0.03, Math.min(0.22, 0.06 + (c.enemyPower - c.playerPower) * 0.02))
        const r2 = rngNextFloat(c.rng)
        if (r2 < dodgeChance) {
          pushFeed(state, `${c.enemyName} dodges.`)
        } else {
          const critChance = Math.max(0.04, Math.min(0.18, 0.06 + (c.playerPower - c.enemyPower) * 0.02))
          const r3 = rngNextFloat(c.rng)
          const crit = r3 < critChance
          const base = (0.75 + rngNextFloat(c.rng) * 0.5) * (2 + c.playerPower * 3.0)
          const dmg = Math.max(1, Math.floor(base * (crit ? 1.6 : 1)))
          c.enemyHp = Math.max(0, c.enemyHp - dmg)
          pushFeed(state, `You hit ${c.enemyName} for ${dmg}${crit ? " (crit)" : ""}.`)
          recordHit(c, "enemy", dmg, crit, now)
          applyDurabilityLoss(state, "weapon", 1)
        }
      }
    } else if (enemyReady) {
      // Enemy attacks
      c.enemyCd += c.enemyInterval
      const r = rngNextFloat(c.rng)
      const dodgeChance = Math.max(0.05, Math.min(0.25, 0.08 + nextLevelProgress(state.skills.combat.xp).level * 0.002))
      if (r < dodgeChance) {
        pushFeed(state, `You dodge.`)
      } else {
        const base = (0.8 + rngNextFloat(c.rng) * 0.45) * (1 + c.enemyPower * 2.2)
        const reduced = Math.max(0, Math.floor(base - c.playerToughness * 1.2))
        const dmg = Math.max(0, reduced)
        if (dmg <= 0) {
          pushFeed(state, `${c.enemyName} strikes, but you block it.`)
        } else {
          c.playerHp = Math.max(0, c.playerHp - dmg)
          c.damageTaken += dmg
          pushFeed(state, `${c.enemyName} hits you for ${dmg}.`)
          recordHit(c, "player", dmg, false, now)
          for (const slot of ARMOR_SLOTS) {
            applyDurabilityLoss(state, slot, 1)
          }
        }
      }
    }

    if (c.enemyHp <= 0 || c.playerHp <= 0) break
  }

  if (c.playerHp <= 0) {
    pushFeed(state, "You are forced to retreat!")
    applyInjuryIfAny(state, 0.25 + 0.05 * state.expedition.risk)
    stopExpedition(state)
    pushLog(state, "You retreated from the expedition.")
    return
  }

  if (c.enemyHp > 0) return

  const isBoss = room.type === "boss"
  const baseXp = (12 + 7 * room.difficulty + (isBoss ? 35 : 0)) * (0.9 + 0.1 * state.expedition.risk)
  state.skills.combat.xp += baseXp * computeModifiers(state).globalXpMult
  const loot = awardLoot(state, { difficulty: room.difficulty, isBoss, lootMult: room.lootMult })

  const danger = Math.max(0.1, c.enemyPower / Math.max(0.5, c.playerToughness))
  const took = c.damageTaken / Math.max(1, c.playerMaxHp)
  const injuryChance = Math.min(0.42, 0.06 * danger + 0.18 * took + 0.03 * state.expedition.risk + (isBoss ? 0.04 : 0))
  applyInjuryIfAny(state, injuryChance)

  pushFeed(state, `Defeated ${c.enemyName}.`)
  pushFeed(state, `Loot: +${loot.gold} gold${loot.fish ? `, +${loot.fish} Pebblefin` : ""}.`)
  pushLog(state, `${isBoss ? "Boss defeated" : "Won fight"}: +${Math.floor(baseXp)} combat XP, +${loot.gold} gold.`)

  room.resolved = true
  if (isBoss) state.expedition.stats.bossesDefeated += 1
}

export function startExpedition(state, { risk = 1 }) {
  const now = Date.now()
  const fish = findCookedFish(state, false)
  if (fish) state.resources[fish.id] -= 1
  state.activity.type = "expedition"
  state.expedition.active = true
  state.expedition.risk = Math.max(1, Math.min(3, risk))
  state.expedition.seed = Math.floor(Math.random() * 2 ** 31)
  state.expedition.roomIndex = 0
  state.expedition.roomCount = 8 + 2 * state.expedition.risk
  state.expedition.room = makeRoom(state)
  state.expedition.pendingChoice = null
  state.expedition.feed = []
  state.meta.lastTickAt = now
  pushLog(state, `Expedition started (Risk ${state.expedition.risk}).`)
  pushFeed(state, `You head out (Risk ${state.expedition.risk}).`)
}

export function toggleCombatAuto(state) {
  const room = state.expedition?.room
  if (!room?.combat) return
  room.combat.autoFight = !room.combat.autoFight
  state.ui.combatAuto = room.combat.autoFight
  pushFeed(state, room.combat.autoFight ? "Auto fight engaged." : "Manual combat engaged.")
}

export function queueCombatAttack(state) {
  const room = state.expedition?.room
  if (!room?.combat) return
  if ((room.combat.playerCd ?? 0) > 0) return
  room.combat.playerQueued = Math.min(1, (room.combat.playerQueued ?? 0) + 1)
}

export function useCombatFood(state, fishId = null) {
  const room = state.expedition?.room
  const combat = room?.combat
  if (!combat) return
  const fish =
    (fishId ? COOKED_FISH.find((entry) => entry.id === fishId && (state.resources[entry.id] ?? 0) > 0) : null) ??
    findCookedFish(state, true)
  if (!fish) return
  state.resources[fish.id] -= 1
  combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + fish.heal)
  pushFeed(state, `You eat ${fish.name} and heal ${fish.heal}.`)
}

export function useCombatPotion(state, potionId) {
  const room = state.expedition?.room
  const combat = room?.combat
  if (!combat) return
  const potion = POTION_BY_ID[potionId]
  if (!potion) return
  if (potion.kind !== "heal" && combat.buffPotionUsed) {
    pushFeed(state, "Only one combat buff potion can be used per fight.")
    return
  }
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

  if (potion.kind === "heal") {
    cooldowns.healingUntil = now + (potion.cooldownSec ?? 30) * 1000
    combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + potion.amount)
    pushFeed(state, `You drink ${potion.name} and heal ${potion.amount}.`)
  } else if (potion.kind === "regen") {
    cooldowns.regenUntil = now + (potion.cooldownSec ?? 60) * 1000
    state.potion.active = active
    combat.buffPotionUsed = true
    pushFeed(state, `You drink ${potion.name}.`)
  } else {
    state.potion.active = active
    combat.buffPotionUsed = true
    pushFeed(state, `You drink ${potion.name}.`)
  }

  state.potion.cooldowns = cooldowns
  if (potion.kind === "heal") return
  state.potion.active = active
}

export function stopExpedition(state) {
  if (!state.expedition.active) return
  state.expedition.active = false
  state.expedition.room = null
  state.expedition.pendingChoice = null
  state.activity.type = "idle"
  pushLog(state, "Expedition ended.")
}

export function chooseExpeditionOption(state, optionId) {
  const choice = state.expedition.pendingChoice
  if (!choice) return
  const opt = choice.options.find((o) => o.id === optionId)
  if (!opt) return
  state.expedition._nextRoomMod = { lootMult: opt.lootMult, difficultyAdd: opt.difficultyAdd }
  state.expedition.pendingChoice = null
  pushLog(state, `Chose: ${opt.name}.`)
  pushFeed(state, `You choose: ${opt.name}.`)

  // Resolve the current event room and move on.
  if (state.expedition.room?.type === "event") {
    state.expedition.stats.roomsCleared += 1
    state.expedition.roomIndex += 1
    if (state.expedition.roomIndex >= state.expedition.roomCount) {
      stopExpedition(state)
      pushLog(state, "Expedition complete. Back to town.")
      return
    }
    state.expedition.room = makeRoom(state)
    return
  }

  if (!state.expedition.room) state.expedition.room = makeRoom(state)
}

export function tickExpedition(state, dtSec) {
  const e = state.expedition
  if (!e.active) return
  if (e.pendingChoice) return

  if (!e.room) e.room = makeRoom(state)
  const room = e.room

  if (room.type === "event") {
    if (!room._prompted) {
      room._prompted = true
      pushFeed(state, "A fork in the path… choose your route.")
    }
    e.pendingChoice = {
      kind: "route",
      options: [
        { id: "safe", name: "Safe path", lootMult: 0.9, difficultyAdd: -1 },
        { id: "risky", name: "Risky path", lootMult: 1.35, difficultyAdd: +1 },
      ],
    }
    return
  }

  const injured = (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
  const speedMult = injured ? 0.6 : 1

  if (room.type === "rest") {
    room.progressSec += dtSec * speedMult
    if (room.progressSec >= room.durationSec) {
      const fish = findCookedFish(state, false)
      if (fish) {
        state.resources[fish.id] -= 1
        pushLog(state, `Rested and ate ${fish.name}.`)
        pushFeed(state, `You rest and eat ${fish.name}.`)
      } else {
        pushLog(state, "Rested (no cooked fish).")
        pushFeed(state, "You rest for a moment.")
      }
      room.resolved = true
    }
  } else if (room.type === "treasure") {
    room.progressSec += dtSec * speedMult
    if (room.progressSec >= room.durationSec) {
      const loot = awardLoot(state, { difficulty: room.difficulty, isBoss: false, lootMult: room.lootMult })
      pushLog(state, `Found treasure: +${loot.gold} gold${loot.fish ? `, +${loot.fish} Pebblefin` : ""}.`)
      pushFeed(state, "You find a hidden cache.")
      pushFeed(state, `Loot: +${loot.gold} gold${loot.fish ? `, +${loot.fish} Pebblefin` : ""}.`)
      room.resolved = true
    }
  } else if (room.type === "combat" || room.type === "boss") {
    tickCombatRoom(state, room, dtSec * speedMult)
    if (!e.active) return // player may have retreated
  }

  if (!room.resolved) return

  e.stats.roomsCleared += 1
  e.roomIndex += 1
  if (e.roomIndex >= e.roomCount) {
    stopExpedition(state)
    pushLog(state, "Expedition complete. Back to town.")
    pushFeed(state, "Expedition complete. Back to town.")
    return
  }
  e.room = makeRoom(state)
}
