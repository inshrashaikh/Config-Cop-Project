import { useState, useEffect } from 'react'
import './ThoughtLine.css'

/**
 * ThoughtLine — Shows a collapsible progress trace for async operations.
 * Props:
 *   steps      – array of { id, text, status: 'pending'|'active'|'completed' }
 *   isComplete – when true, shows success state and collapses
 *   isError    – when true, shows error state
 *   title      – label override (default: auto)
 *   startTime  – Date when the operation started (for elapsed timer)
 */
export default function ThoughtLine({
  steps      = [],
  isComplete = false,
  isError    = false,
  title      = null,
  startTime  = null,
}) {
  const [collapsed, setCollapsed]  = useState(false)
  const [elapsed,   setElapsed]    = useState(0)

  /* Auto-collapse when complete */
  useEffect(() => {
    if (isComplete || isError) {
      const t = setTimeout(() => setCollapsed(true), 1800)
      return () => clearTimeout(t)
    } else {
      setCollapsed(false)
    }
  }, [isComplete, isError])

  /* Elapsed timer */
  useEffect(() => {
    if (isComplete || isError) return
    const t = setInterval(() => {
      const base = startTime ? Date.now() - startTime.getTime() : 0
      setElapsed(Math.floor(base / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [isComplete, isError, startTime])

  const dotClass = isError ? 'error' : isComplete ? 'complete' : 'thinking'

  const defaultTitle = isError
    ? 'Operation failed'
    : isComplete
    ? 'Operation complete'
    : 'Processing…'

  const activeStep = steps.find(s => s.status === 'active')

  return (
    <div className="thought-line">
      <div className="tl-header" onClick={() => setCollapsed(v => !v)}>
        <div className="tl-left">
          <span className={`tl-status-dot ${dotClass}`} />
          <span className="tl-label">
            {title ?? (activeStep?.text ?? defaultTitle)}
          </span>
        </div>
        <div className="tl-meta">
          {!isComplete && !isError && (
            <span className="tl-clock">{elapsed}s</span>
          )}
          {steps.length > 0 && (
            <span className={`tl-chevron ${collapsed ? '' : 'open'}`}>▼</span>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <div className={`tl-steps ${collapsed ? 'collapsed' : 'expanded'}`}>
          <div className="tl-steps-inner">
            {steps.map((step, idx) => (
              <div key={step.id ?? idx} className={`tl-step ${step.status}`}>
                <span className="tl-step-indicator">
                  {step.status === 'completed' ? '✓' : step.status === 'active' ? '•' : ''}
                </span>
                <span className="tl-step-text">{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
