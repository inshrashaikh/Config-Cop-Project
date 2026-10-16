import { useState, useEffect, useRef } from 'react'
import './CallChip.css'

/**
 * CallChip — Compact operation status indicator with a fill-wipe timer.
 * Props:
 *   label    – operation name string
 *   status   – 'idle' | 'running' | 'done' | 'error'
 *   duration – estimated duration in ms for fill animation (default: 8000)
 *   onRetry  – callback for retry on error state
 *   className
 */
export default function CallChip({
  label     = 'Operation',
  status    = 'idle',
  duration  = 8000,
  onRetry   = null,
  className = '',
}) {
  const [elapsed,  setElapsed]  = useState(0)
  const [fillPct,  setFillPct]  = useState(0)
  const startRef = useRef(null)
  const timerRef = useRef(null)

  /* Start/stop timer based on status */
  useEffect(() => {
    clearInterval(timerRef.current)
    if (status === 'running') {
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startRef.current
        setElapsed(Math.floor(ms / 1000))
        /* Cap fill at 90% until done */
        setFillPct(Math.min(90, (ms / duration) * 100))
      }, 200)
    } else if (status === 'done') {
      setFillPct(100)
    } else if (status === 'idle') {
      setElapsed(0)
      setFillPct(0)
    }
    return () => clearInterval(timerRef.current)
  }, [status, duration])

  const showTimer = status === 'running' && elapsed > 0
  const showRetry = status === 'error' && typeof onRetry === 'function'

  return (
    <div
      className={`call-chip ${status} ${className}`}
      style={{ '--chip-fill-pct': `${fillPct}%` }}
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${status}`}
    >
      <div className="call-chip-fill" aria-hidden="true" />

      <div className="call-chip-content">
        <span className="call-chip-icon" aria-hidden="true">
          {status === 'running' && <span className="chip-spinner" />}
          {status === 'done'    && <span style={{ fontSize: 12, color: '#1F7A4D' }}>✓</span>}
          {status === 'error'   && <span style={{ fontSize: 12, color: '#B0292A' }}>✕</span>}
          {status === 'idle'    && <span style={{ fontSize: 12, color: '#8FA494' }}>◦</span>}
        </span>

        <span className="call-chip-label">{label}</span>

        {showTimer && (
          <span className="call-chip-timer">{elapsed}s</span>
        )}

        {showRetry && (
          <button className="chip-retry" onClick={onRetry} aria-label="Retry operation">
            ↺ retry
          </button>
        )}
      </div>
    </div>
  )
}
