import { computePlayerCombat } from "./combat.js"
import { COOKED_FISH } from "./fishing.js"
import { POTION_BY_ID } from "./potions.js"
import { pushLog } from "./log.js"

const ENEMY_NAMES = ["Slime", "Cave Rat", "Goblin", "Sporeling", "Rock Beetle"]
const BOSS_NAME = "Green Slime"

function createGrid(width, height, fill = "wall") {
  const grid = []
  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) row.push(fill)
    grid.push(row)
  }
  return grid
}

function carveRoom(grid, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[y][x] = "floor"
    }
  }
}

function carveCorridor(grid, x1, y1, x2, y2) {
  let x = x1
  let y = y1
  while (x !== x2) {
    grid[y][x] = "floor"
    x += x2 > x ? 1 : -1
  }
  while (y !== y2) {
    grid[y][x] = "floor"
    y += y2 > y ? 1 : -1
  }
  grid[y][x] = "floor"
}

function centerOf(room) {
  return { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) }
}

function roomsOverlap(a, b) {
  return (
    a.x - 1 < b.x + b.w &&
    a.x + a.w + 1 > b.x &&
    a.y - 1 < b.y + b.h &&
    a.y + a.h + 1 > b.y
  )
}

function generateDungeon(seed = Date.now(), width = 25, height = 17) {
  const rand = mulberry32(seed)
  const grid = createGrid(width, height, "wall")
  const rooms = []
  const maxRooms = 8
  const minSize = 4
  const maxSize = 7

  let tries = 0
  while (rooms.length < maxRooms && tries++ < 120) {
    const w = randomInt(rand, minSize, maxSize + 1)
    const h = randomInt(rand, minSize, maxSize + 1)
    const x = randomInt(rand, 1, width - w - 1)
    const y = randomInt(rand, 1, height - h - 1)
    const room = { x, y, w, h }
    if (rooms.some((r) => roomsOverlap(r, room))) continue
    carveRoom(grid, room)
    if (rooms.length > 0) {
      const prev = centerOf(rooms[rooms.length - 1])
      const next = centerOf(room)
      carveCorridor(grid, prev.x, prev.y, next.x, next.y)
    }
    rooms.push(room)
  }

  if (rooms.length === 0) {
    const fallback = { x: 2, y: 2, w: width - 4, h: height - 4 }
    carveRoom(grid, fallback)
    rooms.push(fallback)
  }

  const start = centerOf(rooms[0])
  const bossRoom = centerOf(rooms[rooms.length - 1])
  grid[bossRoom.y][bossRoom.x] = "boss"

  return { grid, start, boss: bossRoom, width, height }
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(rand, min, max) {
  return Math.floor(rand() * (max - min)) + min
}

function ensureDungeonState(state) {
  if (!state.dungeon) {
    state.dungeon = {
      active: false,
      mode: "idle",
      width: 0,
      height: 0,
      grid: [],
      discovered: [],
      player: { x: 0, y: 0 },
      steps: 0,
      encounterCooldown: 0,
      encounter: null,
      boss: null,
      completed: false,
      seed: 0,
      feed: [],
    }
  }
}

function ensureFeed(state) {
  ensureDungeonState(state)
  if (!Array.isArray(state.dungeon.feed)) state.dungeon.feed = []
}

function pushFeed(state, message) {
  ensureFeed(state)
  state.dungeon.feed.unshift(message)
  state.dungeon.feed.length = Math.min(state.dungeon.feed.length, 40)
}

function discoverTile(state, x, y) {
  const { width } = state.dungeon
  const idx = y * width + x
  state.dungeon.discovered[idx] = true
}

function isWalkable(tile) {
  return tile === "floor" || tile === "boss"
}

function createEncounterCombat(state, difficulty = 1) {
  const combat = computePlayerCombat(state)
  const enemyPower = 1 + difficulty * 1.4
  const enemyMaxHp = Math.floor(16 + difficulty * 12)
  return {
    enemyName: ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)],
    enemyPower,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    playerHp: combat.maxHp,
    playerMaxHp: combat.maxHp,
    playerPower: combat.power,
    playerToughness: combat.toughness,
    playerInterval: combat.attackInterval,
    enemyInterval: 2.4,
    playerCd: 0,
    enemyCd: 0.8,
    rng: { t: (Date.now() ^ 0xbeef) >>> 0 },
    damageTaken: 0,
    started: false,
    autoFight: true,
    playerQueued: 0,
    lastAutoEatAt: 0,
    buffPotionUsed: !!(state.potion?.active && state.potion.active.kind !== "heal"),
    hitSeq: 0,
    lastEnemyHit: null,
    lastPlayerHit: null,
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

function tickEncounterCombat(state, combat, dtSec) {
  const now = state.meta?.simTimeMs ?? Date.now()
  const live = computePlayerCombat(state)
  combat.playerPower = live.power
  combat.playerToughness = live.toughness
  combat.playerInterval = live.attackInterval
  combat.playerMaxHp = live.maxHp
  if (combat.playerHp > combat.playerMaxHp) combat.playerHp = combat.playerMaxHp

  combat.playerCd -= dtSec
  combat.enemyCd -= dtSec

  let safety = 0
  const maxActions = combat.autoFight ? 8 : 1
  while (safety++ < maxActions) {
    const playerReady = combat.playerCd <= 0
    const enemyReady = combat.enemyCd <= 0
    const playerCanAct = playerReady && (combat.autoFight || (combat.playerQueued ?? 0) > 0)
    if (!playerCanAct && !enemyReady) break

    if (playerCanAct && (!enemyReady || combat.playerCd <= combat.enemyCd)) {
      combat.playerCd += combat.playerInterval
      if (!combat.autoFight) combat.playerQueued = Math.max(0, (combat.playerQueued ?? 0) - 1)
      const r = Math.random()
      const hitChance = Math.max(0.6, Math.min(0.95, 0.72 + (combat.playerPower - combat.enemyPower) * 0.04))
      if (r <= hitChance) {
        const crit = Math.random() < 0.1
        const base = (0.8 + Math.random() * 0.5) * (2 + combat.playerPower * 3.0)
        const dmg = Math.max(1, Math.floor(base * (crit ? 1.5 : 1)))
        combat.enemyHp = Math.max(0, combat.enemyHp - dmg)
        recordHit(combat, "enemy", dmg, crit, now)
      }
    } else if (enemyReady) {
      combat.enemyCd += combat.enemyInterval
      const base = (0.85 + Math.random() * 0.45) * (1 + combat.enemyPower * 2.2)
      const reduced = Math.max(0, Math.floor(base - combat.playerToughness * 1.1))
      const dmg = Math.max(0, reduced)
      if (dmg > 0) {
        combat.playerHp = Math.max(0, combat.playerHp - dmg)
        combat.damageTaken += dmg
        recordHit(combat, "player", dmg, false, now)
      }
    }

    if (combat.enemyHp <= 0 || combat.playerHp <= 0) break
  }
}

function createBossCombat(state) {
  const live = computePlayerCombat(state)
  return {
    bossName: BOSS_NAME,
    bossHp: 120,
    bossMaxHp: 120,
    bossPower: 3.2,
    playerHp: live.maxHp,
    playerMaxHp: live.maxHp,
    playerPower: live.power,
    playerToughness: live.toughness,
    playerInterval: live.attackInterval,
    bossInterval: 2.4,
    playerCd: 0,
    bossCd: 1.2,
    started: false,
    buffPotionUsed: !!(state.potion?.active && state.potion.active.kind !== "heal"),
  }
}

function tickBossCombat(state, combat, dtSec) {
  const live = computePlayerCombat(state)
  combat.playerPower = live.power
  combat.playerToughness = live.toughness
  combat.playerInterval = live.attackInterval
  combat.playerMaxHp = live.maxHp
  if (combat.playerHp > combat.playerMaxHp) combat.playerHp = combat.playerMaxHp

  combat.playerCd = Math.max(0, combat.playerCd - dtSec)
  combat.bossCd = Math.max(0, combat.bossCd - dtSec)

  if (combat.bossCd <= 0 && combat.bossHp > 0 && combat.playerHp > 0) {
    combat.bossCd += combat.bossInterval
    const base = (0.9 + Math.random() * 0.4) * (1 + combat.bossPower * 2.1)
    const reduced = Math.max(0, Math.floor(base - combat.playerToughness * 1.1))
    const dmg = Math.max(0, reduced)
    combat.playerHp = Math.max(0, combat.playerHp - dmg)
  }
}

export function startDungeon(state) {
  ensureDungeonState(state)
  const seed = Math.floor(Math.random() * 2 ** 31)
  const { grid, start, width, height } = generateDungeon(seed)
  state.dungeon.active = true
  state.dungeon.mode = "explore"
  state.dungeon.grid = grid
  state.dungeon.width = width
  state.dungeon.height = height
  state.dungeon.discovered = Array.from({ length: width * height }, () => false)
  state.dungeon.player = { x: start.x, y: start.y }
  state.dungeon.steps = 0
  state.dungeon.encounterCooldown = 0
  state.dungeon.encounter = null
  state.dungeon.boss = null
  state.dungeon.completed = false
  state.dungeon.seed = seed
  state.dungeon.feed = []
  discoverTile(state, start.x, start.y)
  state.activity.type = "dungeon"
  pushLog(state, "Entered the dungeon.")
}

export function exitDungeon(state) {
  if (!state.dungeon?.active) return
  state.dungeon.active = false
  state.dungeon.mode = "idle"
  state.activity.type = "idle"
  state.ui.tab = "town"
  pushLog(state, "Left the dungeon.")
}

export function moveDungeon(state, dx, dy) {
  const d = state.dungeon
  if (!d?.active || d.mode !== "explore") return
  const nx = d.player.x + dx
  const ny = d.player.y + dy
  if (nx < 0 || ny < 0 || nx >= d.width || ny >= d.height) return
  const tile = d.grid[ny][nx]
  if (!isWalkable(tile)) return
  const idx = ny * d.width + nx
  const wasDiscovered = !!d.discovered?.[idx]
  d.player.x = nx
  d.player.y = ny
  discoverTile(state, nx, ny)
  d.steps += 1
  if (d.encounterCooldown > 0) d.encounterCooldown -= 1

  if (tile === "boss") {
    d.mode = "boss"
    d.boss = createBossCombat(state)
    pushFeed(state, `${BOSS_NAME} emerges from the shadows.`)
    return
  }

  const encounterChance = 0.18
  if (!wasDiscovered && d.encounterCooldown <= 0 && Math.random() < encounterChance) {
    d.mode = "encounter"
    const difficulty = 1 + Math.floor(d.steps / 8)
    d.encounter = { combat: createEncounterCombat(state, difficulty) }
    d.encounterCooldown = 2
    pushFeed(state, "An enemy blocks your path.")
  }
}

export function tickDungeon(state, dtSec) {
  const d = state.dungeon
  if (!d?.active) return
  if (d.mode === "encounter" && d.encounter?.combat) {
    tickEncounterCombat(state, d.encounter.combat, dtSec)
    if (d.encounter.combat.enemyHp <= 0) {
      d.mode = "explore"
      d.encounter = null
      pushFeed(state, "Enemy defeated.")
    } else if (d.encounter.combat.playerHp <= 0) {
      exitDungeon(state)
    }
  }
  if (d.mode === "boss" && d.boss) {
    tickBossCombat(state, d.boss, dtSec)
    if (d.boss.bossHp <= 0) {
      d.completed = true
      d.mode = "idle"
      d.active = false
      state.activity.type = "idle"
      state.ui.tab = "town"
      pushLog(state, "Dungeon completed.")
    } else if (d.boss.playerHp <= 0) {
      exitDungeon(state)
    }
  }
}

export function queueDungeonAttack(state) {
  const d = state.dungeon
  if (!d?.active || d.mode !== "encounter") return
  const combat = d.encounter?.combat
  if (!combat || combat.playerCd > 0) return
  combat.playerQueued = Math.min(1, (combat.playerQueued ?? 0) + 1)
}

export function toggleDungeonAuto(state) {
  const d = state.dungeon
  if (!d?.active || d.mode !== "encounter") return
  const combat = d.encounter?.combat
  if (!combat) return
  combat.autoFight = !combat.autoFight
}

export function useDungeonFood(state, fishId = null) {
  const d = state.dungeon
  if (!d?.active) return
  const combat = d.mode === "boss" ? d.boss : d.encounter?.combat
  if (!combat) return
  const fish =
    (fishId ? COOKED_FISH.find((entry) => entry.id === fishId && (state.resources[entry.id] ?? 0) > 0) : null) ??
    [...COOKED_FISH].sort((a, b) => b.heal - a.heal).find((f) => (state.resources[f.id] ?? 0) > 0)
  if (!fish) return
  state.resources[fish.id] -= 1
  combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + fish.heal)
}

export function useDungeonPotion(state, potionId = null) {
  const d = state.dungeon
  if (!d?.active) return
  const combat = d.mode === "boss" ? d.boss : d.encounter?.combat
  if (!combat) return
  let potion = potionId ? POTION_BY_ID[potionId] : null
  if (!potion) {
    const list = Object.values(POTION_BY_ID)
    const healing = list.filter((p) => p.kind === "heal" && (state.resources[p.id] ?? 0) > 0)
    const buffs = list.filter((p) => p.kind !== "heal" && (state.resources[p.id] ?? 0) > 0)
    const pickHeal = combat.playerHp < combat.playerMaxHp
    if (pickHeal && healing.length) {
      potion = healing.sort((a, b) => b.amount - a.amount)[0]
    } else if (buffs.length) {
      potion = buffs[0]
    } else if (healing.length) {
      potion = healing.sort((a, b) => b.amount - a.amount)[0]
    }
  }
  if (!potion) return
  if (potion.kind !== "heal" && combat.buffPotionUsed) return
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
  } else if (potion.kind === "regen") {
    cooldowns.regenUntil = now + (potion.cooldownSec ?? 60) * 1000
    state.potion.active = active
    combat.buffPotionUsed = true
  } else {
    state.potion.active = active
    combat.buffPotionUsed = true
  }

  state.potion.cooldowns = cooldowns
}

export function bossAttack(state) {
  const d = state.dungeon
  if (!d?.active || d.mode !== "boss" || !d.boss) return
  if (d.boss.playerCd > 0) return
  d.boss.playerCd = d.boss.playerInterval
  const base = (0.85 + Math.random() * 0.5) * (2 + d.boss.playerPower * 3.0)
  const dmg = Math.max(1, Math.floor(base))
  d.boss.bossHp = Math.max(0, d.boss.bossHp - dmg)
}
