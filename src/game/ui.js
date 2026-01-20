import { BUILDINGS, RESOURCES, SKILLS } from "./content.js"
import { EQUIPMENT_SLOTS, ITEMS, MINING_NODES, TIER_DATA, maxDurabilityForItem, toolPerksForTier } from "./items.js"
import { COOKED_FISH, FISHING_NODES } from "./fishing.js"
import { nextLevelProgress } from "./math.js"
import { formatInt, formatNumber, formatSeconds } from "./format.js"
import {
  buildingNextCost,
  buyLegacyUpgrade,
  equipItem,
  foundNewSettlement,
  repairItem,
  sellEquippedItem,
  sellResource,
  setActivityIdle,
  setTab,
  startCraft,
  startGather,
  unequipItem,
  upgradeBuilding,
} from "./actions.js"
import { chooseExpeditionOption, startExpedition, stopExpedition } from "./expedition.js"
import { RECIPES } from "./recipes.js"
import { computeModifiers } from "./modifiers.js"
import { computePlayerCombat } from "./combat.js"
import { sellPriceForEquipped, sellPriceForResource } from "./economy.js"

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function renderCost(cost) {
  const parts = []
  for (const [rid, amt] of Object.entries(cost)) {
    const name = RESOURCES[rid]?.name ?? rid
    parts.push(`${escapeHtml(name)}: ${formatInt(amt)}`)
  }
  return parts.join(" | ")
}

function isInjured(state) {
  return (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
}

const SLOT_LABELS = {
  weapon: "Weapon",
  head: "Head",
  chest: "Chest",
  legs: "Legs",
  boots: "Boots",
  shield: "Shield",
  pickaxe: "Pickaxe",
  axe: "Axe",
}

export function createUI({ root, store }) {
  let scheduled = false
  let lastRenderAt = 0
  let deferTimer = null
  let interactionLockUntil = 0
  let suppressClickUntil = 0

  function noteInteraction(durationMs = 400) {
    if (durationMs <= 0) return
    interactionLockUntil = Math.max(interactionLockUntil, performance.now() + durationMs)
  }

  function scheduleRender() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      const now = performance.now()
      if (now < interactionLockUntil) {
        if (deferTimer) return
        deferTimer = setTimeout(() => {
          deferTimer = null
          scheduleRender()
        }, Math.ceil(interactionLockUntil - now))
        return
      }
      const minIntervalMs = 16
      const since = now - lastRenderAt
      if (since < minIntervalMs) {
        if (deferTimer) return
        deferTimer = setTimeout(() => {
          deferTimer = null
          scheduleRender()
        }, Math.ceil(minIntervalMs - since))
        return
      }
      lastRenderAt = now
      render()
    })
  }

  function renderActivitySummary(state) {
    const activity = state.activity.type
    const gatherTarget =
      state.activity.gatherSkill === "mining"
        ? MINING_NODES.find((node) => node.id === state.activity.gatherResource)?.name
        : state.activity.gatherSkill === "fishing"
          ? FISHING_NODES.find((node) => node.id === state.activity.gatherResource)?.name
        : null
    const activeLabel =
      activity === "idle"
        ? "Idle"
        : activity === "gather"
          ? `Gathering (${SKILLS[state.activity.gatherSkill]?.name ?? state.activity.gatherSkill}${
              gatherTarget ? `: ${gatherTarget}` : ""
            })`
          : activity === "craft"
            ? `Crafting (${RECIPES[state.activity.craft?.recipeId]?.name ?? "?"})`
            : activity === "expedition"
              ? "On Expedition"
              : activity

    const progress =
      activity === "craft"
        ? (() => {
            const craft = state.activity.craft ?? {}
            const recipe = RECIPES[craft.recipeId]
            if (!recipe || !craft.inProgress) return 0
            return 1 - Math.max(0, craft.remainingSec ?? 0) / Math.max(0.01, recipe.durationSec ?? 1)
          })()
        : activity === "gather"
          ? (() => {
              const interval = state.activity.gatherIntervalSec ?? 1
              const elapsed = state.activity.gatherProgressSec ?? 0
              return Math.min(1, Math.max(0, elapsed / Math.max(0.01, interval)))
            })()
          : 0

    const progressUi =
      progress > 0
        ? `<div class="bar"><div class="bar__fill" style="width:${Math.floor(progress * 100)}%"></div></div>`
        : ""

    return `
      <div class="card">
        <div class="card__title">Activity</div>
        <div class="row">
          <div class="pill">${escapeHtml(activeLabel)}${isInjured(state) ? ' <span class="bad">Injured</span>' : ""}</div>
          <button class="btn" data-action="activity-idle">Idle</button>
        </div>
        ${progressUi}
      </div>
    `
  }

  function renderSkillSelector(state) {
    const selected = state.ui.selectedSkill ?? "woodcutting"
    const skills = ["woodcutting", "mining", "fishing", "smithing", "cooking", "alchemy"]
    const rows = skills
      .map((sid) => {
        const active = selected === sid ? "btn btn--tier btn--tier-active" : "btn btn--tier"
        return `<button class="${active}" data-action="select-skill" data-skill="${escapeHtml(
          sid
        )}">${escapeHtml(SKILLS[sid]?.name ?? sid)}</button>`
      })
      .join("")
    return `
      <div class="card">
        <div class="card__title">Choose Skill</div>
        <div class="row">${rows}</div>
      </div>
    `
  }

  function renderMiningTargets(state) {
    const miningLevel = nextLevelProgress(state.skills.mining?.xp ?? 0).level
    const unlocked = MINING_NODES.filter((node) => node.level <= miningLevel)
    if (unlocked.length === 0) {
      return `<div class="muted small">No ores unlocked yet.</div>`
    }
    return `
      <div class="card">
        <div class="card__title">Mining Targets</div>
        <div class="row">
          ${unlocked
            .map(
              (node) =>
                `<button class="btn" data-action="activity-gather" data-skill="mining" data-resource="${escapeHtml(
                  node.id
                )}">Mine ${escapeHtml(node.name)}</button>`
            )
            .join("")}
        </div>
      </div>
    `
  }

  function renderFishingTargets(state) {
    const fishingLevel = nextLevelProgress(state.skills.fishing?.xp ?? 0).level
    const unlocked = FISHING_NODES.filter((node) => node.level <= fishingLevel)
    if (unlocked.length === 0) {
      return `<div class="muted small">No fishing spots unlocked yet.</div>`
    }
    return `
      <div class="card">
        <div class="card__title">Fishing Targets</div>
        <div class="row">
          ${unlocked
            .map(
              (node) =>
                `<button class="btn" data-action="activity-gather" data-skill="fishing" data-resource="${escapeHtml(
                  node.id
                )}">Fish ${escapeHtml(node.name)}</button>`
            )
            .join("")}
        </div>
      </div>
    `
  }

  function renderCraftingList(state, skillId) {
    const skillLevel = nextLevelProgress(state.skills[skillId]?.xp ?? 0).level
    const buildingId =
      skillId === "cooking" ? "campfire" : skillId === "alchemy" ? "alchemistHut" : null
    const buildingLevel = buildingId ? state.buildings[buildingId]?.level ?? 0 : 1
    const recipes = Object.values(RECIPES).filter((recipe) => recipe.skill === skillId)

    const rows = recipes
      .map((recipe) => {
        const canUse = buildingLevel > 0 && skillLevel >= (recipe.requiresLevel ?? 1)
        const actionLabel = skillId === "cooking" ? "Cook" : "Craft"
        return `
          <div class="recipeRow">
            <div>
              <div class="recipeRow__name">${escapeHtml(recipe.name)}</div>
              <div class="muted small">Req: ${escapeHtml(SKILLS[skillId]?.name ?? skillId)} ${
                recipe.requiresLevel ?? 1
              } | Cost: ${renderCost(recipe.in ?? {})} | XP: ${formatInt(recipe.xp ?? 0)}</div>
            </div>
            <button class="btn" data-action="activity-craft" data-recipe="${escapeHtml(recipe.id)}" ${
              canUse ? "" : "disabled"
            }>${actionLabel}</button>
          </div>
        `
      })
      .join("")

    return `
      <div class="card">
        <div class="card__title">${escapeHtml(SKILLS[skillId]?.name ?? skillId)}</div>
        ${rows || `<div class="muted small">No recipes unlocked yet.</div>`}
      </div>
    `
  }

  function renderSmithing(state) {
    const smithingLevel = nextLevelProgress(state.skills.smithing?.xp ?? 0).level
    const selectedTier = Math.min(
      Math.max(1, state.ui.smithingTier ?? 1),
      Math.max(1, Math.max(...TIER_DATA.map((t) => t.tier)))
    )
    const forge = state.buildings.forge?.level ?? 0

    const tierButtons = TIER_DATA.map((tier) => {
      const unlocked = smithingLevel >= (tier.bar?.level ?? tier.tier)
      const active = selectedTier === tier.tier
      const cls = active ? "btn btn--tier btn--tier-active" : "btn btn--tier"
      return `<button class="${cls}" data-action="smithing-tier" data-tier="${tier.tier}" ${unlocked ? "" : "disabled"}>T${tier.tier}</button>`
    }).join("")

    const recipes = Object.values(RECIPES)
      .filter((recipe) => recipe.skill === "smithing" && recipe.tier === selectedTier)
      .sort((a, b) => {
        const aCat = a.category === "smelt" ? 0 : 1
        const bCat = b.category === "smelt" ? 0 : 1
        if (aCat !== bCat) return aCat - bCat
        return (a.requiresLevel ?? 0) - (b.requiresLevel ?? 0)
      })

    const rows = recipes
      .map((recipe) => {
        const canUse = forge > 0 && smithingLevel >= (recipe.requiresLevel ?? 1)
        return `
          <div class="recipeRow">
            <div>
              <div class="recipeRow__name">${escapeHtml(recipe.name)}</div>
              <div class="muted small">Req: Smithing ${recipe.requiresLevel ?? 1} | Cost: ${renderCost(
                recipe.in ?? {}
              )} | XP: ${formatInt(recipe.xp ?? 0)}</div>
            </div>
            <button class="btn" data-action="activity-craft" data-recipe="${escapeHtml(recipe.id)}" ${
              canUse ? "" : "disabled"
            }>Forge</button>
          </div>
        `
      })
      .join("")

    return `
      <div class="card">
        <div class="card__title">Smithing</div>
        <div class="row">${tierButtons}</div>
        ${rows || `<div class="muted small">No smithing recipes unlocked for this tier.</div>`}
      </div>
    `
  }

  function renderTown(state) {
    const cards = Object.keys(BUILDINGS)
      .map((bid) => {
        const b = BUILDINGS[bid]
        const lvl = state.buildings[bid]?.level ?? 0
        const cost = buildingNextCost(state, bid)
        return `
          <div class="card">
            <div class="card__title">${escapeHtml(b.name)} <span class="muted">Lv ${lvl}</span></div>
            <div class="muted">${escapeHtml(b.desc)}</div>
            <div class="muted small">Next: ${renderCost(cost)}</div>
            <div class="row">
              <button class="btn" data-action="upgrade-building" data-building="${escapeHtml(bid)}">Upgrade</button>
            </div>
          </div>
        `
      })
      .join("")
    return `<div class="stack">${cards}</div>`
  }

  function renderSkills(state) {
    const skills = Object.keys(SKILLS)
      .map((sid) => {
        const s = SKILLS[sid]
        const xp = state.skills[sid]?.xp ?? 0
        const p = nextLevelProgress(xp)
        const pct = Math.floor(p.pct * 100)
        return `
          <div class="card">
            <div class="card__title">${escapeHtml(s.name)} <span class="muted">Lv ${p.level}</span></div>
            <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
            <div class="muted small">${formatInt(Math.floor(p.xpIntoLevel))} / ${formatInt(p.xpForNext)} XP</div>
          </div>
        `
      })
      .join("")

    const selected = state.ui.selectedSkill ?? "woodcutting"
    const activeSkillId =
      state.activity.type === "gather"
        ? state.activity.gatherSkill
        : state.activity.type === "craft"
          ? RECIPES[state.activity.craft?.recipeId]?.skill
          : null
    const activeSkill = activeSkillId ? SKILLS[activeSkillId] : null
    const activeXp = activeSkillId ? state.skills[activeSkillId]?.xp ?? 0 : 0
    const activeProgress = activeSkillId ? nextLevelProgress(activeXp) : null
    const activeProgressUi =
      activeSkill && activeProgress
        ? `
          <div class="card">
            <div class="card__title">Training: ${escapeHtml(activeSkill.name)}</div>
            <div class="bar"><div class="bar__fill" style="width:${Math.floor(activeProgress.pct * 100)}%"></div></div>
            <div class="muted small">${formatInt(Math.floor(activeProgress.xpIntoLevel))} / ${formatInt(
              activeProgress.xpForNext
            )} XP</div>
          </div>
        `
        : ""
    let skillPanel = ""
    if (selected === "woodcutting") {
      skillPanel = `<div class="card"><div class="card__title">Woodcutting</div><div class="muted small">Selecting Woodcutting starts gathering wood.</div></div>`
    } else if (selected === "mining") {
      skillPanel = renderMiningTargets(state)
    } else if (selected === "fishing") {
      skillPanel = renderFishingTargets(state)
    } else if (selected === "smithing") {
      skillPanel = renderSmithing(state)
    } else if (selected === "cooking") {
      skillPanel = renderCraftingList(state, "cooking")
    } else if (selected === "alchemy") {
      skillPanel = renderCraftingList(state, "alchemy")
    }

    return `<div class="stack">${renderActivitySummary(state)}${renderSkillSelector(state)}${activeProgressUi}${skillPanel}${skills}</div>`
  }

	  function renderExpedition(state) {
	    const e = state.expedition
	    if (!e.active) {
      const canStart = COOKED_FISH.some((fish) => (state.resources[fish.id] ?? 0) > 0)
      return `
        <div class="stack">
          ${renderActivitySummary(state)}
          <div class="card">
            <div class="card__title">Expeditions</div>
            <div class="muted">Prep in town, then explore room-by-room. Boss is always the last room.</div>
            <div class="row">
              <button class="btn" data-action="expedition-start" data-risk="1" ${canStart ? "" : "disabled"}>Start (Risk 1)</button>
              <button class="btn" data-action="expedition-start" data-risk="2" ${canStart ? "" : "disabled"}>Start (Risk 2)</button>
              <button class="btn" data-action="expedition-start" data-risk="3" ${canStart ? "" : "disabled"}>Start (Risk 3)</button>
            </div>
            <div class="muted small">Tip: cook fish for safer runs.</div>
          </div>
        </div>
      `
    }

	    const room = e.room
	    const roomName =
	      room?.type === "combat"
	        ? "Combat"
	        : room?.type === "boss"
	          ? "Boss"
          : room?.type === "rest"
            ? "Rest"
            : room?.type === "treasure"
              ? "Treasure"
              : room?.type === "event"
                ? "Event"
	                : "Unknown"

	    const combat = room?.combat
      const playerCombat = computePlayerCombat(state)
	    const pct =
	      room?.type === "combat" || room?.type === "boss"
	        ? combat?.enemyMaxHp
	          ? Math.floor((1 - combat.enemyHp / combat.enemyMaxHp) * 100)
	          : 0
	        : room?.durationSec
	          ? Math.floor((room.progressSec / room.durationSec) * 100)
	          : 0
	    const remaining =
	      room?.type === "combat" || room?.type === "boss"
	        ? 0
	        : room?.durationSec
	          ? Math.max(0, room.durationSec - room.progressSec)
	          : 0
	    const progressLabel =
	      room?.type === "combat" || room?.type === "boss"
	        ? combat
	          ? `${combat.enemyName}: ${formatInt(combat.enemyHp)} / ${formatInt(combat.enemyMaxHp)} HP | You: ${formatInt(combat.playerHp)} / ${formatInt(combat.playerMaxHp)} HP`
	          : "Engaged…"
	        : `${formatSeconds(remaining)} remaining`

	    const feed = Array.isArray(e.feed) ? e.feed : []
	    const feedUi = `
	      <div class="card">
	        <div class="card__title">Live Feed</div>
	        <div class="logBody">
	          ${
	            feed.length
	              ? feed
	                  .slice(0, 16)
	                  .map((l) => `<div class="logLine">${escapeHtml(l)}</div>`)
	                  .join("")
	              : `<div class="muted small">Nothing yet.</div>`
	          }
	        </div>
	      </div>
	    `

    const choice = e.pendingChoice
    const choiceUi = choice
      ? `
          <div class="card">
            <div class="card__title">Decision</div>
            <div class="row">
              ${choice.options
                .map(
                  (o) =>
                    `<button class="btn" data-action="expedition-choice" data-choice="${escapeHtml(o.id)}">${escapeHtml(o.name)}</button>`
                )
                .join("")}
            </div>
            <div class="muted small">Offline progress pauses at decisions.</div>
          </div>
        `
      : ""

	    return `
	      <div class="stack">
	        <div class="card">
	          <div class="card__title">On Expedition <span class="muted">Risk ${e.risk}</span></div>
	          <div class="row">
	            <div class="pill">Room ${e.roomIndex + 1} / ${e.roomCount}</div>
	            <div class="pill">${roomName} | Diff ${room?.difficulty ?? "?"}</div>
	            <button class="btn btn--warn" data-action="expedition-stop">Return</button>
	          </div>
	          <div class="bar"><div class="bar__fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>
	          <div class="muted small">${escapeHtml(progressLabel)}</div>
	        </div>
	        ${choiceUi}
	        ${feedUi}
	        <div class="card">
	          <div class="card__title">Supplies</div>
	          <div class="row">
	            <div class="pill">Cooked Fish: ${formatInt(
                COOKED_FISH.reduce((sum, fish) => sum + (state.resources[fish.id] ?? 0), 0)
              )}</div>
	            <div class="pill">Potions: ${formatInt(state.resources.potions ?? 0)}</div>
	          </div>
          <div class="muted small">Gear: Weapon T${formatNumber(playerCombat.weaponTier ?? 0, 1)} | Armor T${formatNumber(
            playerCombat.armorTier ?? 0,
            1
          )}</div>
        </div>
      </div>
    `
	  }

  function renderPrestige(state) {
    const hall = state.buildings.townHall?.level ?? 0
    const bosses = state.expedition?.stats?.bossesDefeated ?? 0
    const eligible = hall >= 1 && bosses >= 1
    const xpMult = state.legacy?.bonuses?.globalXpMult ?? 1
    const yieldMult = state.legacy?.bonuses?.globalYieldMult ?? 1

    return `
      <div class="stack">
        <div class="card">
          <div class="card__title">Legacy</div>
          <div class="row">
            <div class="pill">Points: ${formatInt(state.legacy?.points ?? 0)}</div>
            <div class="pill">XP: ${formatNumber(xpMult, 3)}×</div>
            <div class="pill">Yield: ${formatNumber(yieldMult, 3)}×</div>
          </div>
          <div class="row">
            <button class="btn" data-action="legacy-buy" data-upgrade="xp" ${(state.legacy?.points ?? 0) < 1 ? "disabled" : ""}>Buy +5% XP</button>
            <button class="btn" data-action="legacy-buy" data-upgrade="yield" ${(state.legacy?.points ?? 0) < 1 ? "disabled" : ""}>Buy +5% Yield</button>
          </div>
          <div class="muted small">Each purchase costs 1 point.</div>
        </div>
        <div class="card">
          <div class="card__title">Found New Settlement</div>
          <div class="muted">Requires Town Hall Lv 1+ and at least 1 boss defeated.</div>
          <div class="row">
            <div class="pill">Town Hall: Lv ${hall}</div>
            <div class="pill">Bosses: ${bosses}</div>
          </div>
          <div class="row">
            <button class="btn btn--warn" data-action="prestige-found" ${eligible ? "" : "disabled"}>Found New Settlement</button>
          </div>
        </div>
      </div>
    `
  }

  function renderSettings(state) {
    return `
      <div class="stack">
        <div class="card">
          <div class="card__title">Save</div>
          <div class="row">
            <button class="btn" data-action="save-export">Export</button>
            <button class="btn" data-action="save-import">Import</button>
            <button class="btn btn--warn" data-action="save-reset">Hard Reset</button>
          </div>
          <textarea id="saveBox" class="saveBox" spellcheck="false" placeholder="Exported save appears here. Paste a save here to import."></textarea>
        </div>
      </div>
    `
  }

  function renderPanel(state) {
    if (state.ui.tab === "town") return renderTown(state)
    if (state.ui.tab === "skills") return renderSkills(state)
    if (state.ui.tab === "inventory") return renderInventory(state)
    if (state.ui.tab === "expedition") return renderExpedition(state)
    if (state.ui.tab === "prestige") return renderPrestige(state)
    if (state.ui.tab === "settings") return renderSettings(state)
    return renderTown(state)
  }

  function renderTabs(state) {
    const tabs = [
      ["skills", "Skills"],
      ["town", "Town"],
      ["inventory", "Inventory"],
      ["expedition", "Expedition"],
      ["prestige", "Prestige"],
      ["settings", "Settings"],
    ]
    return tabs
      .map(([id, label]) => {
        const active = state.ui.tab === id ? "tab tab--active" : "tab"
        return `<button class="${active}" data-action="tab" data-tab="${escapeHtml(id)}">${escapeHtml(label)}</button>`
      })
      .join("")
  }

  function renderLog(state) {
    const lines = (state.ui.log ?? []).slice(0, 14)
    if (lines.length === 0) return `<div class="muted small">No log yet.</div>`
    return lines.map((l) => `<div class="logLine">${escapeHtml(l)}</div>`).join("")
  }

  function resourceIdsByCategory(category) {
    return Object.values(RESOURCES)
      .filter((r) => r.category === category)
      .map((r) => r.id)
  }

  function equippedLabel(slot, entry) {
    if (!entry?.id) return "Empty"
    const name = ITEMS[entry.id]?.name ?? entry.id
    const maxDurability = maxDurabilityForItem(entry.id)
    const durability = Math.max(0, Math.floor(entry.durability ?? maxDurability))
    const broken = durability <= 0
    return `${broken ? "Broken " : ""}${name} (${formatInt(durability)} / ${formatInt(maxDurability)})`
  }

  function renderInventory(state) {
    const oreIds = resourceIdsByCategory("ore")
    const barIds = resourceIdsByCategory("bar")
    const rawFishIds = resourceIdsByCategory("fishRaw")
    const cookedFishIds = resourceIdsByCategory("fishCooked")
    const burntFishIds = resourceIdsByCategory("fishBurnt")
    const materialIds = [...oreIds, ...barIds]
    const supplyIds = [
      ...resourceIdsByCategory("material"),
      ...resourceIdsByCategory("consumable"),
      ...resourceIdsByCategory("currency"),
    ].filter((rid) => !oreIds.includes(rid) && !barIds.includes(rid))
    const itemIds = Object.values(ITEMS)
      .map((item) => item.id)
      .filter((id) => (state.resources[id] ?? 0) > 0)
    const forge = state.buildings.forge?.level ?? 0

    const materialRows = materialIds
      .filter((rid) => (state.resources[rid] ?? 0) > 0)
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        const price = sellPriceForResource(rid)
        return `
          <div class="invItem invItem--trade">
            <div>
              <div class="invItem__name">${escapeHtml(r?.name ?? rid)}</div>
              <div class="invItem__val">${formatInt(v)}</div>
            </div>
            <button class="btn btn--tiny" data-action="sell-resource" data-resource="${escapeHtml(rid)}">Sell 1 (${formatNumber(
              price,
              2
            )}g)</button>
          </div>
        `
      })
      .join("")

    const supplyRows = supplyIds
      .filter((rid) => (state.resources[rid] ?? 0) > 0)
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        const c = rid === "gold" ? "res res--gold" : "res"
        const val = rid === "gold" ? formatNumber(v, 2) : formatInt(v)
        return `<div class="${c}"><div class="res__name">${escapeHtml(r?.name ?? rid)}</div><div class="res__val">${val}</div></div>`
      })
      .join("")

    const rawFishRows = rawFishIds
      .filter((rid) => (state.resources[rid] ?? 0) > 0)
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        return `<div class="invItem"><div class="invItem__name">${escapeHtml(r?.name ?? rid)}</div><div class="invItem__val">${formatInt(v)}</div></div>`
      })
      .join("")

    const cookedFishRows = COOKED_FISH.filter((fish) => (state.resources[fish.id] ?? 0) > 0)
      .map((fish) => {
        const v = state.resources[fish.id] ?? 0
        return `<div class="invItem"><div class="invItem__name">${escapeHtml(
          fish.name
        )}</div><div class="invItem__val">${formatInt(v)} <span class="muted">(+${fish.heal} HP)</span></div></div>`
      })
      .join("")

    const burntFishRows = burntFishIds
      .filter((rid) => (state.resources[rid] ?? 0) > 0)
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        return `<div class="invItem"><div class="invItem__name">${escapeHtml(r?.name ?? rid)}</div><div class="invItem__val">${formatInt(v)}</div></div>`
      })
      .join("")

    const itemRows = itemIds
      .map((rid) => {
        const item = ITEMS[rid]
        const v = state.resources[rid] ?? 0
        const equippedId = item?.slot ? state.equipment[item.slot]?.id : null
        const alreadyEquipped = equippedId === rid
        const price = sellPriceForResource(rid)
        return `
          <div class="invItem invItem--gear">
            <div>
              <div class="invItem__name">${escapeHtml(item?.name ?? rid)}</div>
              <div class="muted small">Tier ${item?.tier ?? "?"} | ${formatInt(v)} owned</div>
            </div>
            <div class="invItem__actions">
              <button class="btn btn--small" data-action="equip-item" data-item="${escapeHtml(rid)}" ${
                alreadyEquipped ? "disabled" : ""
              }>${alreadyEquipped ? "Equipped" : "Equip"}</button>
              <button class="btn btn--tiny" data-action="sell-resource" data-resource="${escapeHtml(rid)}">Sell 1 (${formatNumber(
                price,
                2
              )}g)</button>
            </div>
          </div>
        `
      })
      .join("")

    const combat = computePlayerCombat(state)
    const avgHit = 2 + combat.power * 3
    const dps = avgHit / Math.max(0.1, combat.attackInterval)

    const equipmentRows = EQUIPMENT_SLOTS.map((slot) => {
      const entry = state.equipment[slot]
      const maxDurability = entry?.id ? maxDurabilityForItem(entry.id) : 0
      const needsRepair = entry?.id && (entry.durability ?? maxDurability) < maxDurability
      const repairBar = entry?.id ? RESOURCES[ITEMS[entry.id]?.barId ?? ""]?.name : null
      const sellPrice = entry?.id ? sellPriceForEquipped(entry.id, entry.durability ?? 0) : 0
      const canSell = entry?.id && sellPrice > 0
      return `
        <div class="equipSlot ${entry?.id ? "" : "equipSlot--empty"}">
          <div class="equipSlot__label">${escapeHtml(SLOT_LABELS[slot] ?? slot)}</div>
          <div class="equipSlot__name">${escapeHtml(equippedLabel(slot, entry))}</div>
          <div class="equipSlot__actions">
            ${entry?.id ? `<button class="btn btn--tiny" data-action="unequip-item" data-slot="${slot}">Unequip</button>` : ""}
            ${
              canSell
                ? `<button class="btn btn--tiny" data-action="sell-equipped" data-slot="${slot}">Sell (${formatNumber(
                    sellPrice,
                    2
                  )}g)</button>`
                : ""
            }
            ${
              needsRepair
                ? `<button class="btn btn--tiny" data-action="repair-item" data-slot="${slot}" ${
                    forge > 0 ? "" : "disabled"
                  }>Repair (1 ${escapeHtml(repairBar ?? "Bar")})</button>`
                : ""
            }
          </div>
        </div>
      `
    }).join("")

    const pickaxeTier = ITEMS[state.equipment.pickaxe?.id]?.tier ?? 0
    const axeTier = ITEMS[state.equipment.axe?.id]?.tier ?? 0
    const pickaxePerks = toolPerksForTier(pickaxeTier)
    const axePerks = toolPerksForTier(axeTier)

    return `
      <div class="stack">
        <div class="card">
          <div class="card__title">Materials</div>
          ${materialRows ? `<div class="invGrid">${materialRows}</div>` : `<div class="muted small">No materials yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Raw Fish</div>
          ${rawFishRows ? `<div class="invGrid">${rawFishRows}</div>` : `<div class="muted small">No raw fish yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Cooked Fish</div>
          ${cookedFishRows ? `<div class="invGrid">${cookedFishRows}</div>` : `<div class="muted small">No cooked fish yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Burnt Fish</div>
          ${burntFishRows ? `<div class="invGrid">${burntFishRows}</div>` : `<div class="muted small">No burnt fish yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Supplies</div>
          ${supplyRows ? `<div class="invGrid">${supplyRows}</div>` : `<div class="muted small">No supplies yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Equipment Overview</div>
          <div class="equipGrid">${equipmentRows}</div>
        </div>
        <div class="card">
          <div class="card__title">Crafted Gear & Tools</div>
          ${itemRows ? `<div class="invGrid invGrid--gear">${itemRows}</div>` : `<div class="muted small">No gear crafted yet.</div>`}
        </div>
        <div class="card">
          <div class="card__title">Tool Perks</div>
          <div class="muted small">Pickaxe: Tier ${pickaxeTier || 0} | Speed +${formatInt(
            Math.round(pickaxePerks.gatherSpeedBonus * 100)
          )}% | No Durability ${formatInt(
            Math.round(pickaxePerks.noDurabilityChance * 100)
          )}% | Double Ore ${formatInt(Math.round(pickaxePerks.doubleResourceChance * 100))}%</div>
          <div class="muted small">Axe: Tier ${axeTier || 0} | Speed +${formatInt(
            Math.round(axePerks.gatherSpeedBonus * 100)
          )}% | No Durability ${formatInt(
            Math.round(axePerks.noDurabilityChance * 100)
          )}% | Double Wood ${formatInt(Math.round(axePerks.doubleResourceChance * 100))}%</div>
          <div class="muted small">Perk thresholds: Tier 3 +5% speed, Tier 5 +10% speed, Tier 7 5% no durability, Tier 9 5% double resource, Tier 10 10% double resource.</div>
        </div>
        <div class="card">
          <div class="card__title">Character Overview</div>
          <div class="row">
            <div class="pill">Combat Lv ${combat.combatLevel}</div>
            <div class="pill">HP ${formatInt(combat.maxHp)}</div>
          </div>
          <div class="statGrid">
            <div class="stat"><div class="stat__label">Power</div><div class="stat__val">${formatNumber(combat.power, 2)}</div></div>
            <div class="stat"><div class="stat__label">Toughness</div><div class="stat__val">${formatNumber(combat.toughness, 2)}</div></div>
            <div class="stat"><div class="stat__label">Avg Hit</div><div class="stat__val">${formatNumber(avgHit, 1)}</div></div>
            <div class="stat"><div class="stat__label">Attack Interval</div><div class="stat__val">${formatNumber(combat.attackInterval, 2)}s</div></div>
            <div class="stat"><div class="stat__label">DPS</div><div class="stat__val">${formatNumber(dps, 2)}</div></div>
          </div>
          <div class="row">
            <div class="pill">Weapon Tier ${formatNumber(combat.weaponTier ?? 0, 1)}</div>
            <div class="pill">Armor Tier ${formatNumber(combat.armorTier ?? 0, 1)}</div>
          </div>
        </div>
      </div>
    `
  }

  function render() {
    const state = store.getState()
    const scrollTop = root.scrollTop
    const scrollLeft = root.scrollLeft

    const active = document.activeElement
    const wasSaveFocused = active && active.id === "saveBox"
    const saveValueBefore = wasSaveFocused
      ? active.value
      : /** @type {HTMLTextAreaElement | null} */ (root.querySelector("#saveBox"))?.value ?? ""
    const saveSelStart = wasSaveFocused ? active.selectionStart : null
    const saveSelEnd = wasSaveFocused ? active.selectionEnd : null

    root.innerHTML = `
      <div class="hud">
        <div class="hudTop">
          <div class="title">Frontier Idle</div>
          <div class="hudMeta">
            <span class="pill">Storage: ${formatInt(computeModifiers(state).storageCap)}</span>
            <span class="pill">Legacy: ${formatInt(state.legacy?.points ?? 0)}</span>
          </div>
        </div>
        <div class="tabs">${renderTabs(state)}</div>
        <div class="panel">${renderPanel(state)}</div>
        <div class="log">
          <div class="logTitle">Log</div>
          <div class="logBody">${renderLog(state)}</div>
        </div>
      </div>
    `

    root.scrollTop = scrollTop
    root.scrollLeft = scrollLeft

    const saveBoxAfter = /** @type {HTMLTextAreaElement | null} */ (root.querySelector("#saveBox"))
    if (saveBoxAfter) {
      saveBoxAfter.value = saveValueBefore
      if (wasSaveFocused) {
        saveBoxAfter.focus()
        if (saveSelStart != null && saveSelEnd != null) {
          try {
            saveBoxAfter.setSelectionRange(saveSelStart, saveSelEnd)
          } catch {
            // ignore
          }
        }
      }
    }
  }

  function handleAction(target) {
    if (!target) return
    const action = target.getAttribute("data-action")

    if (action === "tab") {
      const tab = target.getAttribute("data-tab")
      store.update((s) => setTab(s, tab))
      return
    }

    if (action === "upgrade-building") {
      const buildingId = target.getAttribute("data-building")
      store.update((s) => upgradeBuilding(s, buildingId))
      return
    }

    if (action === "activity-idle") {
      store.update((s) => setActivityIdle(s))
      return
    }

    if (action === "select-skill") {
      const skillId = target.getAttribute("data-skill")
      store.update((s) => {
        s.ui.selectedSkill = skillId
      })
      return
    }

    if (action === "activity-gather") {
      const skillId = target.getAttribute("data-skill")
      const resourceId = target.getAttribute("data-resource")
      store.update((s) => startGather(s, skillId, resourceId))
      return
    }

    if (action === "activity-craft") {
      const recipeId = target.getAttribute("data-recipe")
      store.update((s) => startCraft(s, recipeId))
      return
    }

    if (action === "expedition-start") {
      const risk = Number(target.getAttribute("data-risk") || 1)
      store.update((s) => startExpedition(s, { risk }))
      store.update((s) => setTab(s, "expedition"))
      return
    }

    if (action === "expedition-stop") {
      store.update((s) => stopExpedition(s))
      return
    }

    if (action === "expedition-choice") {
      const choiceId = target.getAttribute("data-choice")
      store.update((s) => chooseExpeditionOption(s, choiceId))
      return
    }

    if (action === "prestige-found") {
      store.update((s) => foundNewSettlement(s))
      return
    }

    if (action === "legacy-buy") {
      const upgradeId = target.getAttribute("data-upgrade")
      store.update((s) => buyLegacyUpgrade(s, upgradeId))
      return
    }

    if (action === "save-export") {
      const box = root.querySelector("#saveBox")
      if (box) box.value = JSON.stringify(store.getState())
      return
    }

    if (action === "save-import") {
      const box = root.querySelector("#saveBox")
      if (!box) return
      const raw = box.value?.trim()
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        const ok = store.replace(parsed)
        if (ok) store.save()
      } catch {
        // ignore; user can correct
      }
      return
    }

    if (action === "save-reset") {
      store.hardReset()
      return
    }

    if (action === "equip-item") {
      const itemId = target.getAttribute("data-item")
      store.update((s) => equipItem(s, itemId))
      return
    }

    if (action === "unequip-item") {
      const slot = target.getAttribute("data-slot")
      store.update((s) => unequipItem(s, slot))
      return
    }

    if (action === "repair-item") {
      const slot = target.getAttribute("data-slot")
      store.update((s) => repairItem(s, slot))
      return
    }

    if (action === "sell-resource") {
      const resourceId = target.getAttribute("data-resource")
      store.update((s) => sellResource(s, resourceId, 1))
      return
    }

    if (action === "sell-equipped") {
      const slot = target.getAttribute("data-slot")
      store.update((s) => sellEquippedItem(s, slot))
      return
    }

    if (action === "smithing-tier") {
      const tier = Number(target.getAttribute("data-tier") || 1)
      store.update((s) => {
        s.ui.smithingTier = tier
      })
      return
    }
  }

  function onClick(e) {
    if (e.detail && performance.now() < suppressClickUntil) return
    const target = e.target?.closest?.("[data-action]")
    handleAction(target)
  }

  function onPointerUp(e) {
    if (e?.pointerType !== "mouse" || e.button !== 0) return
    suppressClickUntil = performance.now() + 400
    const target = e.target?.closest?.("[data-action]")
    handleAction(target)
  }

  function onScroll() {
    noteInteraction(0)
  }
  function onTouchStart() {
    noteInteraction(0)
  }
  function onTouchMove() {
    noteInteraction(0)
  }
  function onWheel() {
    noteInteraction(0)
  }
  function onPointerDown(e) {
    if (e?.pointerType === "touch") {
      noteInteraction(0)
      return
    }
    noteInteraction(0)
  }
  function onPointerMove(e) {
    if (e?.pointerType === "touch") {
      noteInteraction(0)
    }
  }

  function onTouchEnd(e) {
    const target = e.target?.closest?.("[data-action]")
    handleAction(target)
  }

  root.addEventListener("click", onClick)
  root.addEventListener("pointerup", onPointerUp)
  root.addEventListener("scroll", onScroll, { passive: true })
  root.addEventListener("touchstart", onTouchStart, { passive: true })
  root.addEventListener("touchmove", onTouchMove, { passive: true })
  root.addEventListener("touchend", onTouchEnd, { passive: true })
  root.addEventListener("pointerdown", onPointerDown, { passive: true })
  root.addEventListener("pointermove", onPointerMove, { passive: true })
  root.addEventListener("wheel", onWheel, { passive: true })
  const unsub = store.subscribe(scheduleRender)
  render()

  return {
    destroy() {
      root.removeEventListener("click", onClick)
      root.removeEventListener("pointerup", onPointerUp)
      root.removeEventListener("scroll", onScroll)
      root.removeEventListener("touchstart", onTouchStart)
      root.removeEventListener("touchmove", onTouchMove)
      root.removeEventListener("touchend", onTouchEnd)
      root.removeEventListener("pointerdown", onPointerDown)
      root.removeEventListener("pointermove", onPointerMove)
      root.removeEventListener("wheel", onWheel)
      if (deferTimer) {
        clearTimeout(deferTimer)
        deferTimer = null
      }
      unsub()
    },
  }
}
