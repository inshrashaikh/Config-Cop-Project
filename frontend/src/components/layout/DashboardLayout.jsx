import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, Server, AlertTriangle, History,
  Settings, Terminal, ChevronRight, Menu, X, Shield,
  Activity, Database, ArrowLeft
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import './DashboardLayout.css'

const NAV_ITEMS = [
  { to: '/dashboard',            icon: LayoutDashboard, label: 'Overview',       section: 'monitor' },
  { to: '/dashboard/workloads',  icon: Server,          label: 'Workloads',      section: 'monitor' },
  { to: '/dashboard/drift',      icon: AlertTriangle,   label: 'Drift Analysis', section: 'monitor' },
  { to: '/dashboard/incidents',  icon: History,         label: 'Incidents',      section: 'monitor' },
  { to: '/dashboard/operations', icon: Terminal,        label: 'Operations',     section: 'operate' },
  { to: '/dashboard/settings',   icon: Settings,        label: 'Settings',       section: 'operate' },
]

export default function DashboardLayout({ children, appState = {} }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const appContext = useApp()

  const clusterLive = appState.clusterLive ?? appContext.clusterLive
  const clusterUnavailable = appState.clusterUnavailable ?? appContext.clusterUnavailable
  const clusterMode = appState.clusterMode ?? appContext.clusterMode
  const aiConnected = appState.aiConnected ?? appContext.aiConnected

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        <Link to="/" className="sidebar-logo" onClick={() => setSidebarOpen(false)}>
          <div className="sidebar-logo-mark" aria-hidden="true">
            <Shield size={16} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <div>
            <div className="sidebar-logo-name">Config Cop</div>
            <div className="sidebar-logo-sub">Drift Detector</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Monitor</div>
          {NAV_ITEMS.filter(i => i.section === 'monitor').map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={16} className="item-icon" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: 16 }}>Operate</div>
          {NAV_ITEMS.filter(i => i.section === 'operate').map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={16} className="item-icon" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
            <Link
              to="/"
              className="sidebar-item"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setSidebarOpen(false)}
            >
              <ArrowLeft size={15} className="item-icon" />
              Back to Home
            </Link>
          </div>
        </nav>

        <div className="sidebar-footer">
          {/* Cluster mode indicator */}
          <div className="sidebar-cluster-info">
            <div className="sidebar-status-row">
              <Activity size={12} aria-hidden="true" />
              <span>Cluster</span>
              <span className={`sidebar-mode-badge ${
                clusterLive          ? 'live'
                : clusterUnavailable ? 'unavailable'
                : 'simulated'
              }`}>
                {clusterLive ? 'LIVE' : clusterUnavailable ? 'DOWN' : 'SIM'}
              </span>
            </div>
            <div className="sidebar-status-row">
              <Database size={12} aria-hidden="true" />
              <span>AI</span>
              <span className={`sidebar-mode-badge ${aiConnected ? 'live' : 'simulated'}`}>
                {aiConnected ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="top-bar-context">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
                Config Cop Console
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Cluster mode badge in topbar */}
            {clusterUnavailable && (
              <span className="top-bar-cluster-badge unavailable">
                <AlertTriangle size={12} />
                Cluster Unavailable
              </span>
            )}
            {!clusterLive && !clusterUnavailable && (
              <span className="top-bar-cluster-badge simulated">
                Simulated Cluster
              </span>
            )}
            {clusterLive && (
              <span className="top-bar-cluster-badge live">
                <span className="pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                Live K8s
              </span>
            )}
          </div>
        </header>

        {/* Simulated mode notice */}
        {!clusterLive && !clusterUnavailable && clusterMode && (
          <div className="cluster-mode-bar simulated" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>Simulated mode</strong> — no live Kubernetes cluster detected. Running sandbox simulation.
            </span>
          </div>
        )}
        {clusterUnavailable && (
          <div className="cluster-mode-bar unavailable" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>Kubernetes unavailable</strong> — start Minikube and apply{' '}
              <code>k8s/demo-workloads.yaml</code> to enable live mode.
            </span>
          </div>
        )}

        {/* Page content */}
        <main className="page-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
