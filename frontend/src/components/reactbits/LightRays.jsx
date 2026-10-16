import { useEffect, useRef, useCallback } from 'react'
import './LightRays.css'

/**
 * LightRays — canvas-based volumetric light rays for the hero section.
 * lightMode=true adapts rendering for light backgrounds.
 * Respects prefers-reduced-motion.
 */
export default function LightRays({
  raysOrigin   = 'top-center',
  raysColor    = '#537B60',
  raysSpeed    = 0.4,
  lightSpread  = 2.2,
  raysAngle    = 0,
  noiseAmount  = 0.08,
  saturation   = 0.85,
  followMouse  = false,
  mouseInfluence = 0.15,
  lightMode    = true,
  paused       = false,
  className    = '',
  style        = {},
}) {
  const canvasRef    = useRef(null)
  const rafRef       = useRef(null)
  const mouseRef     = useRef({ x: 0.5, y: 0 })
  const timeRef      = useRef(0)
  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  /* Convert hex color to [r,g,b] 0–1 floats */
  const hexToRgb = useCallback((hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return [r, g, b]
  }, [])

  /* Determine origin coordinates */
  const getOrigin = useCallback((w, h) => {
    switch (raysOrigin) {
      case 'top-left':   return { x: w * 0.1,  y: 0 }
      case 'top-right':  return { x: w * 0.9,  y: 0 }
      case 'left':       return { x: 0,         y: h * 0.4 }
      case 'right':      return { x: w,          y: h * 0.4 }
      default:           return { x: w * 0.5,   y: 0 }  /* top-center */
    }
  }, [raysOrigin])

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    /* Resize handler */
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    /* Mouse tracking */
    const onMouseMove = (e) => {
      if (!followMouse) return
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top)  / rect.height,
      }
    }
    canvas.parentElement?.addEventListener('mousemove', onMouseMove)

    const [rr, rg, rb] = hexToRgb(raysColor)

    /* Noise helpers */
    const noise = (x, y, t) => {
      return (Math.sin(x * 3.7 + t * 1.1) * Math.cos(y * 2.9 + t * 0.7) + 1) * 0.5
    }

    let prev = performance.now()

    const draw = (now) => {
      if (paused) { rafRef.current = requestAnimationFrame(draw); return }
      const dt = Math.min((now - prev) / 1000, 0.1)
      prev = now
      timeRef.current += dt * raysSpeed

      const t  = timeRef.current
      const w  = canvas.width
      const h  = canvas.height
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, w, h)

      const origin = getOrigin(w, h)
      /* Mouse influence shifts the origin slightly */
      const ox = origin.x + (followMouse ? (mouseRef.current.x - 0.5) * w * mouseInfluence : 0)
      const oy = origin.y + (followMouse ? (mouseRef.current.y - 0.3) * h * mouseInfluence * 0.3 : 0)

      /* Ray count: 14 */
      const RAY_COUNT = 14
      const BASE_SPREAD = (Math.PI / 2) * lightSpread

      for (let i = 0; i < RAY_COUNT; i++) {
        const frac = i / (RAY_COUNT - 1)
        const baseAngle = -BASE_SPREAD / 2 + frac * BASE_SPREAD + (raysAngle * Math.PI / 180)
        const angleNoise = noise(frac, 0, t * 0.7) * 0.12 - 0.06
        const angle = baseAngle + angleNoise

        /* Ray length with pulsing */
        const lenFactor = 0.9 + noise(frac, 0.5, t * 1.2) * 0.25
        const rayLen = Math.max(w, h) * 1.5 * lenFactor

        const ex = ox + Math.sin(angle) * rayLen
        const ey = oy + Math.cos(angle) * rayLen

        /* Opacity: brighter in center, fade at edges */
        const centerFrac = 1 - Math.abs(frac - 0.5) * 2
        const opNoise = noise(frac, 1, t * 1.5) * noiseAmount
        const opacity = (0.03 + centerFrac * 0.08 + opNoise) * saturation

        /* Width varies per ray */
        const rayWidth = (10 + centerFrac * 40) * (1 + noise(frac, 2, t) * 0.4)

        const grad = ctx.createLinearGradient(ox, oy, ex, ey)
        if (lightMode) {
          /* For light backgrounds: draw semi-transparent colored beams */
          grad.addColorStop(0, `rgba(${Math.round(rr*255)},${Math.round(rg*255)},${Math.round(rb*255)},${opacity * 1.2})`)
          grad.addColorStop(0.5, `rgba(${Math.round(rr*255)},${Math.round(rg*255)},${Math.round(rb*255)},${opacity * 0.6})`)
          grad.addColorStop(1, `rgba(${Math.round(rr*255)},${Math.round(rg*255)},${Math.round(rb*255)},0)`)
        } else {
          grad.addColorStop(0, `rgba(${Math.round(rr*255)},${Math.round(rg*255)},${Math.round(rb*255)},${opacity * 2})`)
          grad.addColorStop(1, `rgba(${Math.round(rr*255)},${Math.round(rg*255)},${Math.round(rb*255)},0)`)
        }

        ctx.save()
        ctx.globalCompositeOperation = lightMode ? 'multiply' : 'screen'
        ctx.strokeStyle = grad
        ctx.lineWidth = rayWidth
        ctx.lineCap = 'round'
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.parentElement?.removeEventListener('mousemove', onMouseMove)
    }
  }, [raysColor, raysSpeed, lightSpread, raysAngle, noiseAmount, saturation,
      followMouse, mouseInfluence, lightMode, paused, getOrigin, hexToRgb, reducedMotion])

  if (reducedMotion) return null

  return (
    <div className={`light-rays-root ${className}`} style={style} aria-hidden="true">
      <canvas ref={canvasRef} className="light-rays-canvas" />
    </div>
  )
}
