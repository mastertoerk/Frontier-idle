import { listBuildingIds, listResourceIds, listSkillIds } from "./content.js"

export const SAVE_VERSION = 2

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
  resources.meat = 5
  resources.herbs = 5

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
      log: [],
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
      craft: { recipeId: "smelt_dullflickBar" },
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
