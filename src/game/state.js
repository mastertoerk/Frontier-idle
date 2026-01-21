import { listBuildingIds, listResourceIds, listSkillIds } from "./content.js"

export const SAVE_VERSION = 5

export function createDefaultState(now = Date.now()) {
  const skills = {}
  for (const id of listSkillIds()) {
    skills[id] = { xp: 0 }
  }

  const resources = {}
  for (const id of listResourceIds()) {
    resources[id] = 0
  }

  const buildings = {}
  for (const id of listBuildingIds()) {
    buildings[id] = { level: 0 }
  }

  // Some starting scraps so you can click around immediately.
  resources.wood = 20
  resources.dullstoneOre = 8
  resources.flickerOre = 6

  return {
    version: SAVE_VERSION,
    meta: {
      createdAt: now,
      updatedAt: now,
      lastTickAt: now,
      simTimeMs: now,
    },
    ui: {
      tab: "town", // town | skills | expedition | prestige | settings
      smithingTier: 1,
      selectedSkill: "woodcutting",
      selectedCrop: null,
      sell: null,
      log: [],
      toasts: [],
      toastSeq: 0,
      combatAuto: false,
    },
    legacy: {
      points: 0,
      bonuses: {
        globalXpMult: 1,
        globalYieldMult: 1,
      },
    },
    skills,
    resources,
    buildings,
    equipment: {
      weapon: null,
      head: null,
      chest: null,
      legs: null,
      boots: null,
      shield: null,
      pickaxe: null,
      axe: null,
    },
    activity: {
      type: "idle", // idle | gather | craft | expedition
      gatherSkill: "woodcutting",
      gatherResource: "wood",
      gatherProgressSec: 0,
      gatherIntervalSec: 1,
      craft: { recipeId: "smelt_dullflickBar" },
    },
    potion: {
      active: null,
      cooldowns: {
        healingUntil: 0,
        regenUntil: 0,
      },
    },
    farming: {
      patches: [
        { id: 1, cropId: null, plantedAt: 0, readyAt: 0 },
        { id: 2, cropId: null, plantedAt: 0, readyAt: 0 },
        { id: 3, cropId: null, plantedAt: 0, readyAt: 0 },
      ],
    },
    expedition: {
      active: false,
      seed: 0,
      risk: 1, // 1..3
      roomIndex: 0,
      roomCount: 0,
      room: null,
      pendingChoice: null, // { kind, options: [...] }
      feed: [],
      stats: {
        roomsCleared: 0,
        bossesDefeated: 0,
      },
    },
  }
}
