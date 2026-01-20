import { BUILDINGS, RESOURCES, SKILLS } from "./content.js"
import { nextLevelProgress } from "./math.js"
import { formatInt, formatNumber, formatSeconds } from "./format.js"
import {
  buildingNextCost,
  buyLegacyUpgrade,
  foundNewSettlement,
  setActivityIdle,
  setTab,
  startCraft,
  startGather,
  upgradeBuilding,
} from "./actions.js"
import { chooseExpeditionOption, startExpedition, stopExpedition } from "./expedition.js"
import { RECIPES } from "./recipes.js"
import { computeModifiers } from "./modifiers.js"
import { computePlayerCombat } from "./combat.js"

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
  return parts.join(" · ")
}

function isInjured(state) {
  return (state._injuredUntil ?? 0) > (state.meta?.simTimeMs ?? 0)
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

  function renderResources(state) {
    const cap = computeModifiers(state).storageCap
    const rows = Object.keys(RESOURCES)
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        const c = rid === "gold" ? "res res--gold" : "res"
        return `<div class="${c}"><div class="res__name">${escapeHtml(r.name)}</div><div class="res__val">${formatInt(v)} <span class="muted">/ ${formatInt(cap)}</span></div></div>`
      })
      .join("")
    return `<div class="resGrid">${rows}</div>`
  }

  function renderActions(state) {
    const forge = state.buildings.forge?.level ?? 0
    const camp = state.buildings.campfire?.level ?? 0
    const alc = state.buildings.alchemistHut?.level ?? 0

    const activity = state.activity.type
    const activeLabel =
      activity === "idle"
        ? "Idle"
        : activity === "gather"
          ? `Gathering (${SKILLS[state.activity.gatherSkill]?.name ?? state.activity.gatherSkill})`
          : activity === "craft"
            ? `Crafting (${RECIPES[state.activity.craft?.recipeId]?.name ?? "?"})`
            : activity === "expedition"
              ? "On Expedition"
              : activity

    return `
      <div class="card">
        <div class="card__title">Actions</div>
        <div class="row">
          <div class="pill">${escapeHtml(activeLabel)}${isInjured(state) ? ' <span class="bad">Injured</span>' : ""}</div>
          <button class="btn" data-action="activity-idle">Idle</button>
        </div>
        <div class="row">
          <button class="btn" data-action="activity-gather" data-skill="woodcutting">Woodcut</button>
          <button class="btn" data-action="activity-gather" data-skill="mining">Mine</button>
        </div>
        <div class="row">
          <button class="btn" data-action="activity-craft" data-recipe="smeltBars" ${forge <= 0 ? "disabled" : ""}>Smelt Bars</button>
          <button class="btn" data-action="activity-craft" data-recipe="craftWeapon" ${forge <= 0 ? "disabled" : ""}>Weapon +1</button>
          <button class="btn" data-action="activity-craft" data-recipe="craftArmor" ${forge <= 0 ? "disabled" : ""}>Armor +1</button>
        </div>
        <div class="row">
          <button class="btn" data-action="activity-craft" data-recipe="cookRations" ${camp <= 0 ? "disabled" : ""}>Cook Rations</button>
          <button class="btn" data-action="activity-craft" data-recipe="brewPotions" ${alc <= 0 ? "disabled" : ""}>Brew Potions</button>
        </div>
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
    return `<div class="stack">${renderActions(state)}${cards}</div>`
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
    return `<div class="stack">${renderActions(state)}${skills}</div>`
  }

	  function renderExpedition(state) {
	    const e = state.expedition
	    if (!e.active) {
      const canStart = (state.resources.rations ?? 0) > 0 || (state.resources.meat ?? 0) > 0
      return `
        <div class="stack">
          ${renderActions(state)}
          <div class="card">
            <div class="card__title">Expeditions</div>
            <div class="muted">Prep in town, then explore room-by-room. Boss is always the last room.</div>
            <div class="row">
              <button class="btn" data-action="expedition-start" data-risk="1" ${canStart ? "" : "disabled"}>Start (Risk 1)</button>
              <button class="btn" data-action="expedition-start" data-risk="2" ${canStart ? "" : "disabled"}>Start (Risk 2)</button>
              <button class="btn" data-action="expedition-start" data-risk="3" ${canStart ? "" : "disabled"}>Start (Risk 3)</button>
            </div>
            <div class="muted small">Tip: cook rations for safer runs.</div>
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
	          ? `${combat.enemyName}: ${formatInt(combat.enemyHp)} / ${formatInt(combat.enemyMaxHp)} HP · You: ${formatInt(combat.playerHp)} / ${formatInt(combat.playerMaxHp)} HP`
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
	        ${renderActions(state)}
	        <div class="card">
	          <div class="card__title">On Expedition <span class="muted">Risk ${e.risk}</span></div>
	          <div class="row">
	            <div class="pill">Room ${e.roomIndex + 1} / ${e.roomCount}</div>
	            <div class="pill">${roomName} · Diff ${room?.difficulty ?? "?"}</div>
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
	            <div class="pill">Rations: ${formatInt(state.resources.rations ?? 0)}</div>
	            <div class="pill">Potions: ${formatInt(state.resources.potions ?? 0)}</div>
	          </div>
	          <div class="muted small">Gear: Weapon T${state.equipment.weaponTier ?? 0} · Armor T${state.equipment.armorTier ?? 0}</div>
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
      ["town", "Town"],
      ["skills", "Skills"],
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

  function craftedResourceIds() {
    const ids = new Set()
    for (const recipe of Object.values(RECIPES)) {
      for (const rid of Object.keys(recipe.out ?? {})) ids.add(rid)
    }
    return Array.from(ids)
  }

  function renderInventory(state) {
    const ids = craftedResourceIds()
    const rows = ids
      .map((rid) => {
        const r = RESOURCES[rid]
        const v = state.resources[rid] ?? 0
        return `<div class="invItem"><div class="invItem__name">${escapeHtml(r?.name ?? rid)}</div><div class="invItem__val">${formatInt(v)}</div></div>`
      })
      .join("")

    const combat = computePlayerCombat(state)
    const avgHit = 2 + combat.power * 3
    const dps = avgHit / Math.max(0.1, combat.attackInterval)

    return `
      <div class="stack">
        <div class="card">
          <div class="card__title">Inventory</div>
          ${ids.length ? `<div class="invGrid">${rows}</div>` : `<div class="muted small">No crafted items yet.</div>`}
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
            <div class="pill">Weapon Tier ${formatInt(state.equipment.weaponTier ?? 0)}</div>
            <div class="pill">Armor Tier ${formatInt(state.equipment.armorTier ?? 0)}</div>
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
        ${renderResources(state)}
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

    if (action === "activity-gather") {
      const skillId = target.getAttribute("data-skill")
      store.update((s) => startGather(s, skillId))
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

  root.addEventListener("click", onClick)
  root.addEventListener("pointerup", onPointerUp)
  root.addEventListener("scroll", onScroll, { passive: true })
  root.addEventListener("touchstart", onTouchStart, { passive: true })
  root.addEventListener("touchmove", onTouchMove, { passive: true })
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
