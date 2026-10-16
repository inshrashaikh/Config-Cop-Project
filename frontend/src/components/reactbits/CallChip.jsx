import { useState, useEffect, useRef } from 'react'
import { Check, AlertCircle, RotateCw } from 'lucide-react'
import './CallChip.css'

/**
 * CallChip — Compact operation status indicator with a fill-wipe timer.
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
        /* Cap fill at 92% until done */
        setFillPct(Math.min(92, (ms / duration) * 100))
      }, 150)
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
          {status === 'done'    && <Check size={13} strokeWidth={2.8} color="var(--success-solid)" />}
          {status === 'error'   && <AlertCircle size={13} strokeWidth={2.5} color="var(--danger-solid)" />}
          {status === 'idle'    && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--text-tertiary)',
              display: 'inline-block'
            }} />
          )}
        </span>

        <span className="call-chip-label">{label}</span>

        {showTimer && (
          <span className="call-chip-timer">{elapsed}s</span>
        )}

        {showRetry && (
          <button className="chip-retry" onClick={onRetry} aria-label={`Retry ${label}`}>
            <RotateCw size={11} />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  )
}
