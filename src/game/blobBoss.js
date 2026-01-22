// Screen-anchored blob boss for a "first-person" 2D encounter.
// Renders to a CanvasRenderingContext2D. No external libraries.

export class BlobBossFP {
  constructor(opts = {}) {
    this.anchor = { x: opts.x ?? 0, y: opts.y ?? 0 }
    this.baseRadius = opts.baseRadius ?? 70

    this.bobAmp = opts.bobAmp ?? 8
    this.bobFreq = opts.bobFreq ?? 1.4
    this.breatheAmp = opts.breatheAmp ?? 0.06
    this.breatheFreq = opts.breatheFreq ?? 0.5
    this.wobbleAmp = opts.wobbleAmp ?? 0.04
    this.wobbleFreq = opts.wobbleFreq ?? 2.1

    this.anticipateTime = opts.anticipateTime ?? 0.1
    this.lungeTime = opts.lungeTime ?? 0.14
    this.returnTime = opts.returnTime ?? 0.22
    this.lungePos = opts.lungePos ?? 24
    this.lungeScale = opts.lungeScale ?? 1.45

    this.hitPulseTime = opts.hitPulseTime ?? 0.12
    this.hitPulseScale = opts.hitPulseScale ?? 0.9

    this.t = 0
    this.pos = { x: this.anchor.x, y: this.anchor.y }
    this.scale = 1
    this._attack = null
    this._hit = null
    this._wobble = 0
  }

  setAnchor(x, y) {
    this.anchor.x = x
    this.anchor.y = y
  }

  setAnchorNow() {
    this.anchor.x = this.pos.x
    this.anchor.y = this.pos.y
  }

  attack() {
    this._attack = {
      phase: "anticipate",
      t: 0,
      startPos: { x: this.pos.x, y: this.pos.y },
      startScale: this.scale,
    }
  }

  hitReact() {
    this._hit = { t: 0 }
  }

  update(dt) {
    this.t += dt

    let atkOffsetY = 0
    let atkScale = 1

    if (this._attack) {
      const a = this._attack
      a.t += dt

      const pullBack = -this.lungePos * 0.25
      const lungeForward = this.lungePos

      if (a.phase === "anticipate") {
        const u = clamp01(a.t / this.anticipateTime)
        const e = easeOutCubic(u)
        atkOffsetY = lerp(0, pullBack, e)
        atkScale = lerp(1, 0.92, e)
        if (u >= 1) {
          a.phase = "lunge"
          a.t = 0
        }
      } else if (a.phase === "lunge") {
        const u = clamp01(a.t / this.lungeTime)
        const e = easeInCubic(u)
        atkOffsetY = lerp(pullBack, lungeForward, e)
        atkScale = lerp(0.92, this.lungeScale, e)
        if (u >= 1) {
          a.phase = "return"
          a.t = 0
          a.peakOffsetY = atkOffsetY
          a.peakScale = atkScale
        }
      } else if (a.phase === "return") {
        const u = clamp01(a.t / this.returnTime)
        const e = easeOutElasticSmall(u)
        atkOffsetY = lerp(a.peakOffsetY, 0, e)
        atkScale = lerp(a.peakScale, 1, e)
        if (u >= 1) {
          this._attack = null
        }
      }
    }

    let hitScale = 1
    if (this._hit) {
      this._hit.t += dt
      const u = clamp01(this._hit.t / this.hitPulseTime)
      hitScale = lerp(this.hitPulseScale, 1, easeOutCubic(u))
      if (u >= 1) this._hit = null
    }

    const bob = Math.sin(this.t * Math.PI * 2 * this.bobFreq) * this.bobAmp
    const breathe = Math.sin(this.t * Math.PI * 2 * this.breatheFreq) * this.breatheAmp
    const wobble = Math.sin(this.t * Math.PI * 2 * this.wobbleFreq) * this.wobbleAmp

    this.pos.x = this.anchor.x
    this.pos.y = this.anchor.y + bob + atkOffsetY
    this.scale = (1 + breathe) * atkScale * hitScale
    this._wobble = wobble
  }

  render(ctx) {
    const x = this.pos.x
    const y = this.pos.y
    const wob = this._wobble ?? 0
    const sx = this.scale * (1 + wob)
    const sy = this.scale * (1 - wob)

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(sx, sy)

    ctx.globalAlpha = 0.22
    ctx.beginPath()
    ctx.ellipse(0, this.baseRadius * 0.95, this.baseRadius * 1.05, this.baseRadius * 0.33, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#000"
    ctx.fill()
    ctx.globalAlpha = 1

    const g = ctx.createRadialGradient(
      -this.baseRadius * 0.3,
      -this.baseRadius * 0.35,
      this.baseRadius * 0.2,
      0,
      0,
      this.baseRadius * 1.2
    )
    g.addColorStop(0, "#7CFF7A")
    g.addColorStop(0.55, "#2DDC5A")
    g.addColorStop(1, "#0E7E3B")

    const N = 28
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2
      const dirX = Math.cos(t)
      const dirY = Math.sin(t)
      const n = Math.sin(this.t * 2.6 + i * 0.7) * 0.08 + Math.sin(this.t * 1.7 + i * 1.1) * 0.05
      const r = this.baseRadius * (1 + n)
      const px = dirX * r
      const py = dirY * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()

    ctx.fillStyle = "#0A2B16"
    ctx.beginPath()
    ctx.ellipse(-this.baseRadius * 0.28, -this.baseRadius * 0.05, this.baseRadius * 0.12, this.baseRadius * 0.18, 0, 0, Math.PI * 2)
    ctx.ellipse(this.baseRadius * 0.28, -this.baseRadius * 0.05, this.baseRadius * 0.12, this.baseRadius * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "rgba(232,255,232,0.9)"
    ctx.beginPath()
    ctx.arc(-this.baseRadius * 0.33, -this.baseRadius * 0.12, this.baseRadius * 0.04, 0, Math.PI * 2)
    ctx.arc(this.baseRadius * 0.23, -this.baseRadius * 0.12, this.baseRadius * 0.04, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "#082012"
    ctx.lineWidth = this.baseRadius * 0.1
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(-this.baseRadius * 0.35, this.baseRadius * 0.32)
    ctx.quadraticCurveTo(0, this.baseRadius * 0.52, this.baseRadius * 0.35, this.baseRadius * 0.32)
    ctx.stroke()

    ctx.restore()
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}
function easeInCubic(u) {
  return u * u * u
}
function easeOutCubic(u) {
  return 1 - Math.pow(1 - u, 3)
}
function easeOutElasticSmall(u) {
  if (u === 0) return 0
  if (u === 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -8 * u) * Math.sin((u * 10 - 0.75) * c4) + 1
}
