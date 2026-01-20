import { mulberry32, randomInt } from "./rng.js"
import { computeModifiers } from "./modifiers.js"
import { nextLevelProgress } from "./math.js"
import { computePlayerCombat } from "./combat.js"
import { pushLog } from "./log.js"

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
  const meat = Math.random() < 0.65 ? Math.ceil((1 + difficulty * 0.6) * totalLootMult) : 0
  const herbs = Math.random() < 0.4 ? Math.ceil((1 + difficulty * 0.4) * totalLootMult) : 0
  addResourceCapped(state, "gold", gold)
  addResourceCapped(state, "meat", meat)
  addResourceCapped(state, "herbs", herbs)
  return { gold, meat, herbs }
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

  const enemyPower = 1 + room.difficulty * (1.2 + 0.35 * state.expedition.risk) + (isBoss ? 4 : 0)
  const enemyMaxHp = Math.floor(18 + room.difficulty * 14 + (isBoss ? 75 : 0))
  const playerMaxHp = maxHp

  const playerInterval = attackInterval
  const enemyInterval = Math.max(0.6, Math.min(1.5, 1.35 / (0.7 + enemyPower / 7)))

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
  }
}

function tickCombatRoom(state, room, dtSec) {
  ensureCombatRoomInitialized(state, room)
  const c = room.combat
  if (!c.started) {
    c.started = true
    pushFeed(state, `${c.enemyName} appears!`)
  }

  // Auto-potion at low HP.
  if ((state.resources.potions ?? 0) > 0 && c.playerHp / c.playerMaxHp < 0.35) {
    state.resources.potions -= 1
    const heal = Math.ceil(c.playerMaxHp * 0.35)
    c.playerHp = Math.min(c.playerMaxHp, c.playerHp + heal)
    pushFeed(state, `You drink a potion and heal ${heal}.`)
  }

  c.playerCd -= dtSec
  c.enemyCd -= dtSec

  let safety = 0
  while (safety++ < 20) {
    const next = Math.min(c.playerCd, c.enemyCd)
    if (next > 0) break

    if (c.playerCd <= c.enemyCd) {
      // Player attacks
      c.playerCd += c.playerInterval
      const r = rngNextFloat(c.rng)
      const hitChance = Math.max(0.55, Math.min(0.95, 0.72 + (c.playerPower - c.enemyPower) * 0.04))
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
        }
      }
    } else {
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
  pushFeed(state, `Loot: +${loot.gold} gold${loot.meat ? `, +${loot.meat} meat` : ""}${loot.herbs ? `, +${loot.herbs} herbs` : ""}.`)
  pushLog(state, `${isBoss ? "Boss defeated" : "Won fight"}: +${Math.floor(baseXp)} combat XP, +${loot.gold} gold.`)

  room.resolved = true
  if (isBoss) state.expedition.stats.bossesDefeated += 1
}

export function startExpedition(state, { risk = 1 }) {
  const now = Date.now()
  if ((state.resources.rations ?? 0) > 0) state.resources.rations -= 1
  else if ((state.resources.meat ?? 0) > 0) state.resources.meat -= 1
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
      const used = state.resources.rations > 0
      if (used) state.resources.rations -= 1
      if (used) pushLog(state, "Rested and used 1 ration.")
      else pushLog(state, "Rested (no rations).")
      pushFeed(state, used ? "You rest and eat a ration." : "You rest for a moment.")
      room.resolved = true
    }
  } else if (room.type === "treasure") {
    room.progressSec += dtSec * speedMult
    if (room.progressSec >= room.durationSec) {
      const loot = awardLoot(state, { difficulty: room.difficulty, isBoss: false, lootMult: room.lootMult })
      pushLog(state, `Found treasure: +${loot.gold} gold${loot.meat ? `, +${loot.meat} meat` : ""}${loot.herbs ? `, +${loot.herbs} herbs` : ""}.`)
      pushFeed(state, "You find a hidden cache.")
      pushFeed(state, `Loot: +${loot.gold} gold${loot.meat ? `, +${loot.meat} meat` : ""}${loot.herbs ? `, +${loot.herbs} herbs` : ""}.`)
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
