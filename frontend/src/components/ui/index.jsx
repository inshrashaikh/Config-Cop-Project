/* ============================================================
   CONFIG COP — UI COMPONENT LIBRARY
   Accessible, Glassmorphic, Precision Infrastructure Tool Components
   ============================================================ */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, CheckCircle2, AlertTriangle, Info, X,
  Copy, Check, ArrowRight, PackageOpen, ChevronRight, Terminal
} from 'lucide-react'

/* ── PageHeader ── */
export function PageHeader({ title, subtitle, actions, breadcrumb, className = '' }) {
  return (
    <div className={`page-header ${className}`}>
      <div>
        {breadcrumb && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--text-caption)',
            color: 'var(--text-tertiary)',
            marginBottom: 4,
            fontWeight: 500,
          }}>
            {breadcrumb}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

/* ── Button ── */
export function Button({
  children,
  onClick,
  variant = 'primary',  // 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
  size    = 'md',       // 'sm' | 'md' | 'lg'
  disabled,
  busy,
  type    = 'button',
  className = '',
  icon: Icon,
  ...rest
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cls}
      aria-busy={busy ? 'true' : undefined}
      {...rest}
    >
      {busy ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 13 : size === 'lg' ? 18 : 15} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}

/* ── Badge ── */
export function Badge({ children, variant = 'neutral', dot = false, pulse = false, className = '' }) {
  const cls = `badge badge-${variant} ${className}`
  return (
    <span className={cls}>
      {dot && (
        <span
          className={`badge-dot ${pulse ? 'pulse-dot' : ''}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

/* ── Alert ── */
const ALERT_ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger:  AlertCircle,
  error:   AlertCircle,
  info:    Info,
  neutral: Info,
}

export function Alert({ variant = 'info', title, children, onDismiss, className = '' }) {
  const Icon = ALERT_ICONS[variant] ?? Info
  return (
    <div className={`alert alert-${variant} ${className}`} role="alert">
      <Icon className="alert-icon" size={17} aria-hidden="true" />
      <div className="alert-body">
        {title && <div className="alert-title">{title}</div>}
        {children && <div className="alert-text">{children}</div>}
      </div>
      {onDismiss && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{ padding: '2px', marginLeft: 'auto', flexShrink: 0, minHeight: 'auto' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ── Toast Container & Toast ── */
export function ToastContainer({ toasts = [] }) {
  if (!toasts.length) return null
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 440,
        width: 'calc(100% - 40px)',
        pointerEvents: 'none',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem {...t} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastItem({ variant = 'info', title, message }) {
  const Icon = ALERT_ICONS[variant] ?? Info
  const normalizedVariant = variant === 'error' ? 'danger' : variant
  const cls = `toast toast-${normalizedVariant}`

  return (
    <motion.div
      className={cls}
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      role="status"
    >
      <Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 'var(--text-sm)' }}>{title}</div>}
        {message && <div style={{ opacity: 0.92, fontSize: 'var(--text-caption)', lineHeight: 1.45 }}>{message}</div>}
      </div>
    </motion.div>
  )
}

/* ── Panel / Card ── */
export function Panel({ title, subtitle, right, icon: Icon, children, className = '', bodyStyle = {} }) {
  return (
    <div className={`panel ${className}`}>
      {(title || right) && (
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {Icon && <Icon size={16} color="var(--forest)" aria-hidden="true" />}
            <div>
              {title && <div className="panel-title">{title}</div>}
              {subtitle && <div className="panel-subtitle">{subtitle}</div>}
            </div>
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      <div className="panel-body" style={bodyStyle}>{children}</div>
    </div>
  )
}

/* ── Stat ── */
export function Stat({ label, value, hint, accent = 'forest', icon: Icon, loading = false }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div className="stat-label">{label}</div>
        {Icon && <Icon size={15} color="var(--text-tertiary)" aria-hidden="true" />}
      </div>
      <div className="stat-value tabular-nums">
        {loading ? <Skeleton width="60%" height="28px" /> : (value ?? '—')}
      </div>
      {hint && (
        <div className="stat-hint" title={typeof hint === 'string' ? hint : undefined}>
          {hint}
        </div>
      )}
    </div>
  )
}

/* ── Spinner ── */
export function Spinner({ size = 'md' }) {
  const cls = size === 'sm' ? 'spinner spinner-sm' : size === 'lg' ? 'spinner spinner-lg' : 'spinner'
  return <span className={cls} role="status" aria-label="Loading" />
}

/* ── Empty State ── */
export function EmptyState({ icon: Icon = PackageOpen, title, description, action }) {
  return (
    <div className="empty-state">
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 'var(--radius-full)',
        background: 'var(--cream)',
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--border-light)',
      }}>
        <Icon size={24} className="empty-state-icon" aria-hidden="true" />
      </div>
      {title && <div className="empty-state-title">{title}</div>}
      {description && <div className="empty-state-text">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, footer, maxWidth = 520 }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
      role="presentation"
    >
      <div
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={modalRef}
      >
        <div className="modal-header">
          <span id="modal-title" className="modal-title">{title}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: '4px', minHeight: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ── Divider ── */
export function Divider({ vertical = false, style = {} }) {
  return (
    <div
      style={{
        [vertical ? 'width' : 'height']: '1px',
        background: 'var(--border-light)',
        margin: vertical ? '0 12px' : '16px 0',
        alignSelf: vertical ? 'stretch' : 'auto',
        ...style,
      }}
      role="separator"
    />
  )
}

/* ── SegmentedControl / Tabs ── */
export function SegmentedControl({
  options = [], // [{ id, label, icon: Icon, count }]
  value,
  onChange,
  className = '',
  name = 'segmented-control'
}) {
  return (
    <div className={`segmented-control ${className}`} role="tablist">
      {options.map((opt) => {
        const isActive = value === opt.id
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            className={`segment-item ${isActive ? 'active' : ''}`}
            onClick={() => onChange(opt.id)}
            type="button"
          >
            {isActive && (
              <motion.div
                layoutId={`segment-indicator-${name}`}
                className="segment-indicator"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {opt.icon && <opt.icon size={13} aria-hidden="true" />}
              <span>{opt.label}</span>
              {typeof opt.count === 'number' && (
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  borderRadius: 9999,
                  background: isActive ? 'var(--honeydew)' : 'var(--border-light)',
                  color: isActive ? 'var(--forest)' : 'var(--text-tertiary)',
                  fontWeight: 700,
                }}>
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── DiffView Component ── */
export function DiffView({ diffs = [] }) {
  if (!diffs.length) return null

  const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))

  return (
    <div className="diff-view-root">
      {diffs.map((d) => {
        const pathSegments = d.path ? d.path.split(/[\.\[\]]/).filter(Boolean) : ['configuration']
        return (
          <div key={d.path} className="diff-card">
            <div className="diff-card-header">
              <div className="diff-breadcrumb">
                {pathSegments.map((seg, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {idx > 0 && <span className="diff-breadcrumb-sep">›</span>}
                    <span>{seg}</span>
                  </span>
                ))}
              </div>
              <Badge variant="danger" dot>DRIFTED</Badge>
            </div>

            <div className="diff-grid">
              {/* Expected Column */}
              <div className="diff-side diff-side-expected">
                <span className="diff-side-label">
                  <CheckCircle2 size={12} />
                  Expected (Baseline)
                </span>
                <span className="diff-val tabular-nums">{fmt(d.expected)}</span>
              </div>

              {/* Arrow Indicator */}
              <div className="diff-arrow-col">
                <ArrowRight size={14} />
              </div>

              {/* Actual Column */}
              <div className="diff-side diff-side-actual">
                <span className="diff-side-label">
                  <AlertCircle size={12} />
                  Actual (Live Cluster)
                </span>
                <span className="diff-val tabular-nums">{fmt(d.actual)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── AnomalyScoreBar (IsolationForest gauge) ── */
export function AnomalyScoreBar({ score = 0, isOutlier = false, threshold = 0.5 }) {
  // Normalize score to 0..1 range if negative or decimal
  const normalized = Math.max(0, Math.min(1, Math.abs(score)))
  const pct = Math.round(normalized * 100)

  return (
    <div className="anomaly-gauge-root">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-caption)' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          Anomaly Outlier Score: <strong style={{ color: isOutlier ? 'var(--danger)' : 'var(--forest)' }}>{score}</strong>
        </span>
        <Badge variant={isOutlier ? 'danger' : 'success'} dot={isOutlier}>
          {isOutlier ? 'OUTLIER DETECTED' : 'NORMAL INLIER'}
        </Badge>
      </div>

      <div className="anomaly-gauge-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`anomaly-gauge-fill ${isOutlier ? 'outlier' : 'normal'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>
        <span>0.00 (Standard)</span>
        <span>Threshold: {threshold}</span>
        <span>1.00 (High Outlier)</span>
      </div>
    </div>
  )
}

/* ── CopyButton ── */
export function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Fallback for insecure context */
    }
  }

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      aria-label={`Copy ${text} to clipboard`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}

/* ── FingerprintChip ── */
export function FingerprintChip({ value = '', length = 10 }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>

  const short = value.slice(0, length) + '…'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      type="button"
      className="fp-chip"
      onClick={handleCopy}
      title={`Click to copy full fingerprint: ${value}`}
    >
      <span>fp:{short}</span>
      {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} color="var(--text-tertiary)" />}
    </button>
  )
}

/* ── CodeBlock ── */
export function CodeBlock({ code, language = 'bash', title, copyable = true }) {
  return (
    <div className="codeblock-wrap">
      {(title || copyable) && (
        <div className="codeblock-header">
          <span>{title || language}</span>
          {copyable && <CopyButton text={code} />}
        </div>
      )}
      <pre className="codeblock-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* ── Skeleton ── */
export function Skeleton({ width = '100%', height = '16px', circle = false, style = {} }) {
  return (
    <span
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : 'var(--radius-xs)',
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/* ── Tooltip ── */
export function Tooltip({ content, children }) {
  return (
    <div className="tooltip-wrap">
      {children}
      <span className="tooltip-tip" role="tooltip">{content}</span>
    </div>
  )
}

/* ── KeyValue ── */
export function KeyValue({ label, value, mono = false }) {
  return (
    <div className="key-value-row">
      <span className="key-value-key">{label}</span>
      <span className={`key-value-val ${mono ? 'tabular-nums' : ''}`} style={mono ? { fontFamily: 'var(--font-mono)', fontSize: 13 } : {}}>
        {value}
      </span>
    </div>
  )
}

/* ── ProgressRing ── */
export function ProgressRing({
  progress = 0,
  size = 40,
  strokeWidth = 4,
  color = 'var(--forest)',
  trackColor = 'var(--sage)'
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        stroke={trackColor}
        fill="transparent"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  )
}
