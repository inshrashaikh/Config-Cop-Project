import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Server, AlertTriangle, History,
  Settings, Terminal, Menu, X, Shield, Activity,
  Database, ArrowLeft, Search, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, Zap
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Tooltip } from '../ui/index.jsx'
import './DashboardLayout.css'

const NAV_ITEMS = [
  { to: '/dashboard',            icon: LayoutDashboard, label: 'Overview',       section: 'monitor' },
  { to: '/dashboard/workloads',  icon: Server,          label: 'Workloads',      section: 'monitor' },
  { to: '/dashboard/drift',      icon: AlertTriangle,   label: 'Drift Analysis', section: 'monitor' },
  { to: '/dashboard/incidents',  icon: History,         label: 'Incidents',      section: 'monitor' },
  { to: '/dashboard/operations', icon: Terminal,        label: 'Operations',     section: 'operate' },
  { to: '/dashboard/settings',   icon: Settings,        label: 'Settings',       section: 'operate' },
]

const ROUTE_TITLES = {
  '/dashboard':            'Cluster Overview',
  '/dashboard/workloads':  'Workloads & Manifests',
  '/dashboard/drift':      'Drift Analysis & Remediation',
  '/dashboard/incidents':  'Incident Repository',
  '/dashboard/operations': 'Cluster Operations & Scaling',
  '/dashboard/settings':   'System Settings & Connectivity',
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('config_cop_sidebar_compact') === 'true'
    } catch {
      return false
    }
  })

  const location = useLocation()
  const sidebarRef = useRef(null)

  const {
    clusterLive,
    clusterUnavailable,
    clusterMode,
    cluster,
    aiConnected,
    aiMissingKey,
    llm,
    scan,
    handleScan,
    busy,
  } = useApp()

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Mobile sidebar keyboard trap and Escape dismiss
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  // Persist compact state
  const toggleCompact = () => {
    setCompact(prev => {
      const next = !prev
      try {
        localStorage.setItem('config_cop_sidebar_compact', String(next))
      } catch {}
      return next
    })
  }

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Dashboard'
  const lastScan = scan?.summary?.scannedAt
    ? new Date(scan.summary.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="app-shell">
      {/* Accessible Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Living Ambient Mesh Background */}
      <div className="app-living-bg" aria-hidden="true" />

      {/* Mobile Backdrop Scrim */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Rail */}
      <aside
        ref={sidebarRef}
        className={`sidebar ${sidebarOpen ? 'open' : ''} ${compact ? 'compact' : ''}`}
        role="navigation"
        aria-label="Main Dashboard Navigation"
      >
        <Link
          to="/"
          className="sidebar-logo"
          onClick={() => setSidebarOpen(false)}
          title="Return to Config Cop Home"
        >
          <div className="sidebar-logo-mark" aria-hidden="true">
            <Shield size={17} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          {!compact && (
            <div>
              <div className="sidebar-logo-name">Config Cop</div>
              <div className="sidebar-logo-sub">Drift Detector</div>
            </div>
          )}
        </Link>

        <nav className="sidebar-nav">
          {!compact && <div className="sidebar-section-label">Monitor</div>}
          {NAV_ITEMS.filter(i => i.section === 'monitor').map(item => {
            const isItemActive = item.to === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.to)

            const navLink = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                aria-current={isItemActive ? 'page' : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={16} className="item-icon" aria-hidden="true" />
                {!compact && <span>{item.label}</span>}
              </NavLink>
            )

            return compact ? (
              <Tooltip key={item.to} content={item.label}>
                {navLink}
              </Tooltip>
            ) : navLink
          })}

          {!compact && (
            <div className="sidebar-section-label" style={{ marginTop: 14 }}>
              Operate
            </div>
          )}
          {NAV_ITEMS.filter(i => i.section === 'operate').map(item => {
            const isItemActive = location.pathname.startsWith(item.to)
            const navLink = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                aria-current={isItemActive ? 'page' : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={16} className="item-icon" aria-hidden="true" />
                {!compact && <span>{item.label}</span>}
              </NavLink>
            )

            return compact ? (
              <Tooltip key={item.to} content={item.label}>
                {navLink}
              </Tooltip>
            ) : navLink
          })}

          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            <Link
              to="/"
              className="sidebar-item"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setSidebarOpen(false)}
              title="Return to Home Landing"
            >
              <ArrowLeft size={15} className="item-icon" aria-hidden="true" />
              {!compact && <span>Home Landing</span>}
            </Link>
          </div>
        </nav>

        {/* Compact Toggle Button (Desktop only) */}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCompact}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {compact ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Status Footer Pill Block */}
        {!compact && (
          <div className="sidebar-footer">
            <div className="sidebar-cluster-info">
              <div className="sidebar-status-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={12} aria-hidden="true" />
                  <span>Cluster</span>
                </div>
                <span className={`sidebar-mode-badge ${
                  clusterLive          ? 'live'
                  : clusterUnavailable ? 'unavailable'
                  : 'simulated'
                }`}>
                  {clusterLive ? 'LIVE' : clusterUnavailable ? 'DOWN' : 'SIMULATED'}
                </span>
              </div>

              <div className="sidebar-status-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={12} aria-hidden="true" />
                  <span>Reasoning</span>
                </div>
                <span className={`sidebar-mode-badge ${aiConnected ? 'live' : 'simulated'}`}>
                  {aiConnected ? 'AI ACTIVE' : 'RULE-BASED'}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={`main-area ${compact ? 'sidebar-compact' : ''}`}>
        {/* Sticky Top Bar (Glass-1) */}
        <header className="top-bar" role="banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Breadcrumb */}
            <nav className="top-bar-breadcrumb" aria-label="Breadcrumb">
              <span className="top-bar-breadcrumb-root">Console</span>
              <span className="top-bar-breadcrumb-sep">/</span>
              <span className="top-bar-breadcrumb-current">{currentTitle}</span>
            </nav>
          </div>

          {/* Global Status Cluster & Primary Action */}
          <div className="top-bar-actions">
            {lastScan && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 'var(--text-micro)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}>
                <Clock size={12} />
                <span>Last scan: {lastScan}</span>
              </span>
            )}

            {/* Cluster mode badge */}
            <span className={`top-bar-cluster-badge ${
              clusterLive          ? 'live'
              : clusterUnavailable ? 'unavailable'
              : 'simulated'
            }`}>
              {clusterLive && (
                <span
                  className="pulse-dot"
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'currentColor',
                  }}
                  aria-hidden="true"
                />
              )}
              {clusterLive ? 'Live K8s Cluster' : clusterUnavailable ? 'Cluster Down' : 'Simulated Sandbox'}
            </span>

            {/* Quick scan button */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleScan}
              busy={busy === 'scan'}
              icon={Search}
            >
              Scan Drift
            </Button>
          </div>
        </header>

        {/* Clear Notice Banners for Cluster Modes (Honesty Principle) */}
        {!clusterLive && !clusterUnavailable && (
          <div className="cluster-mode-bar simulated" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>Simulated sandbox mode</strong> — no live Kubernetes cluster detected. Workloads and drift calculations are executed against deterministic mock manifests.
            </span>
          </div>
        )}
        {clusterUnavailable && (
          <div className="cluster-mode-bar unavailable" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>Kubernetes cluster unavailable</strong> — verify Minikube/kind is running and execute <code>kubectl apply -f k8s/demo-workloads.yaml</code> to enable live reconciliation.
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="page-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
