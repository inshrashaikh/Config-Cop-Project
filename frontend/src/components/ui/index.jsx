/* Shared UI Components — Button, Badge, Alert, Toast, Modal, Panel, Stat, Spinner */

/* ── Button ── */
export function Button({
  children,
  onClick,
  variant = 'primary',  // 'primary' | 'secondary' | 'ghost' | 'danger'
  size    = 'md',       // 'sm' | 'md' | 'lg'
  disabled,
  busy,
  type    = 'button',
  className = '',
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
      {...rest}
    >
      {busy && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

/* ── Badge ── */
export function Badge({ children, variant = 'neutral', dot = false, className = '' }) {
  const cls = `badge badge-${variant} ${className}`
  return (
    <span className={cls}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/* ── Alert ── */
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

const ALERT_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger:  AlertCircle,
  error:   AlertCircle,
  info:    Info,
  neutral: Info,
}

export function Alert({ variant = 'info', title, children, onDismiss, className = '' }) {
  const Icon = ALERT_ICONS[variant] ?? Info
  return (
    <div className={`alert alert-${variant} animate-fade ${className}`} role="alert">
      <Icon className="alert-icon" size={16} aria-hidden="true" />
      <div className="alert-body">
        {title && <div className="alert-title">{title}</div>}
        {children && <div className="alert-text">{children}</div>}
      </div>
      {onDismiss && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ padding: '2px', marginLeft: 'auto', flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ── Toast (positioned) ── */
import { createPortal } from 'react-dom'

export function ToastContainer({ toasts = [] }) {
  if (!toasts.length) return null
  return createPortal(
    <div
      style={{
        position: 'fixed', top: 20, right: 20,
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
        maxWidth: 440, width: '100%',
      }}
      aria-live="polite"
    >
      {toasts.map(t => (
        <Toast key={t.id} {...t} />
      ))}
    </div>,
    document.body,
  )
}

function Toast({ variant = 'info', title, message }) {
  const Icon = ALERT_ICONS[variant] ?? Info
  const cls  = `toast toast-${variant === 'error' ? 'error' : variant}`
  return (
    <div className={cls}>
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
        {message && <div style={{ opacity: 0.9, fontSize: 13 }}>{message}</div>}
      </div>
    </div>
  )
}

/* ── Panel ── */
export function Panel({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {(title || right) && (
        <div className="panel-header">
          <div>
            {title    && <div className="panel-title">{title}</div>}
            {subtitle && <div className="panel-subtitle">{subtitle}</div>}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  )
}

/* ── Stat ── */
export function Stat({ label, value, hint, accent = 'forest' }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

/* ── Spinner ── */
export function Spinner({ size = 'md' }) {
  const cls = size === 'sm' ? 'spinner spinner-sm' : size === 'lg' ? 'spinner spinner-lg' : 'spinner'
  return <span className={cls} role="status" aria-label="Loading" />
}

/* ── Empty State ── */
import { PackageOpen } from 'lucide-react'

export function EmptyState({ icon: Icon = PackageOpen, title, description, action }) {
  return (
    <div className="empty-state">
      <Icon size={40} className="empty-state-icon" aria-hidden="true" />
      {title       && <div className="empty-state-title">{title}</div>}
      {description && <div className="empty-state-text">{description}</div>}
      {action}
    </div>
  )
}

/* ── Modal ── */
import { useEffect } from 'react'

export function Modal({ open, onClose, title, children, footer, maxWidth = 520 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal" style={{ maxWidth }} role="dialog" aria-modal="true">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
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
export function Divider({ vertical }) {
  return <div className={vertical ? 'divider-v' : 'divider'} />
}
