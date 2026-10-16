import { useState, useEffect } from 'react'
import { Check, ChevronDown, Clock, AlertTriangle } from 'lucide-react'
import './ThoughtLine.css'

/**
 * ThoughtLine — Shows a collapsible progress trace for async operations.
 * Uses smooth CSS grid-rows animation that prevents clipping at arbitrary heights.
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
      const t = setTimeout(() => setCollapsed(true), 2400)
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
    ? 'Operation encountered an issue'
    : isComplete
    ? 'Audit completed successfully'
    : 'Auditing workload specifications…'

  const activeStep = steps.find(s => s.status === 'active')

  return (
    <div className="thought-line" role="region" aria-label="Progress trace">
      <div
        className="tl-header"
        onClick={() => setCollapsed(v => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(v => !v) } }}
        aria-expanded={!collapsed}
      >
        <div className="tl-left">
          <span className={`tl-status-dot ${dotClass}`} aria-hidden="true" />
          <span className="tl-label">
            {title ?? (activeStep?.text ?? defaultTitle)}
          </span>
        </div>
        <div className="tl-meta">
          {!isComplete && !isError && (
            <span className="tl-clock" aria-label={`${elapsed} seconds elapsed`}>{elapsed}s</span>
          )}
          {steps.length > 0 && (
            <ChevronDown
              size={14}
              className={`tl-chevron ${collapsed ? '' : 'open'}`}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <div className={`tl-steps ${collapsed ? 'collapsed' : 'expanded'}`}>
          <div className="tl-steps-inner">
            {steps.map((step, idx) => (
              <div key={step.id ?? idx} className={`tl-step ${step.status}`}>
                <span className="tl-step-indicator" aria-hidden="true">
                  {step.status === 'completed' ? (
                    <Check size={11} strokeWidth={3} />
                  ) : step.status === 'active' ? (
                    '•'
                  ) : null}
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

