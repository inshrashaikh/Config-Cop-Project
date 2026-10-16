import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History, Search, Filter, AlertTriangle, CheckCircle2,
  Clock, Shield, ArrowRight, Sparkles, RefreshCw, Layers,
  AlertCircle, Check, Wrench, ExternalLink
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Panel, Badge, Button, EmptyState, Stat,
  SegmentedControl
} from '../components/ui/index.jsx'

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function IncidentsPage() {
  const {
    incidents,
    loadingIncidents,
    loadIncidents,
    setSelectedWorkload,
  } = useApp()

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'open' | 'resolved' | 'failed'

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const q = search.toLowerCase()
      const matchesSearch =
        (inc.title || '').toLowerCase().includes(q) ||
        (inc.explanation || '').toLowerCase().includes(q) ||
        (inc.workload || '').toLowerCase().includes(q) ||
        String(inc.id).includes(q)

      if (!matchesSearch) return false
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false
      return true
    })
  }, [incidents, search, statusFilter])

  const counts = useMemo(() => {
    return {
      total: incidents.length,
      open: incidents.filter(i => i.status === 'open').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
      failed: incidents.filter(i => i.status === 'failed').length,
    }
  }, [incidents])

  // Issue 4 Fix: Use inc.workload directly instead of title.split(' ')
  const handleInspectWorkload = (inc) => {
    const workloadName = inc.workload || inc.title?.split(' ').pop()
    if (workloadName) {
      setSelectedWorkload(workloadName)
      navigate('/dashboard/drift')
    }
  }

  const filterTabs = [
    { id: 'all',      label: 'All Incidents', count: counts.total },
    { id: 'open',     label: 'Open',          count: counts.open },
    { id: 'resolved', label: 'Resolved',      count: counts.resolved },
    { id: 'failed',   label: 'Failed',        count: counts.failed },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <PageHeader
        title="Incident Repository"
        subtitle="Historical configuration drift detections, root-cause analyses, and verified remediation audit trails in SQLite."
        actions={
          <Button
            variant="secondary"
            onClick={() => loadIncidents()}
            busy={loadingIncidents}
            icon={RefreshCw}
          >
            Refresh Log
          </Button>
        }
      />

      {/* ── Summary Stats Grid ── */}
      <div className="stats-grid">
        <Stat
          label="Total Incidents"
          value={counts.total.toString()}
          accent="forest"
          hint="recorded in sqlite database"
          icon={History}
        />
        <Stat
          label="Open Issues"
          value={counts.open.toString()}
          accent={counts.open > 0 ? 'danger' : 'success'}
          hint="requiring attention or fix"
          icon={AlertTriangle}
        />
        <Stat
          label="Resolved &amp; Verified"
          value={counts.resolved.toString()}
          accent="success"
          hint="restored to canonical baseline"
          icon={CheckCircle2}
        />
        <Stat
          label="Failed Remediations"
          value={counts.failed.toString()}
          accent={counts.failed > 0 ? 'danger' : 'forest'}
          hint="hash mismatch post-fix"
          icon={AlertCircle}
        />
      </div>

      {/* ── Search & Filter Bar ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--elev-1)',
      }}>
        <div className="input-wrapper" style={{ width: 260 }}>
          <Search size={14} className="input-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by title, explanation, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            aria-label="Search incident repository"
          />
        </div>

        <SegmentedControl
          options={filterTabs}
          value={statusFilter}
          onChange={setStatusFilter}
          name="incident-status-filter"
        />
      </div>

      {/* ── Incidents Timeline Card List ── */}
      <Panel
        title={`Incident Entries (${filteredIncidents.length})`}
        subtitle="Chronological audit trail with source provenance"
        icon={Layers}
      >
        {filteredIncidents.length === 0 ? (
          <EmptyState
            icon={History}
            title="No incidents matching criteria"
            description={
              search
                ? `No incidents matched "${search}".`
                : statusFilter !== 'all'
                ? `No incidents currently in '${statusFilter}' status.`
                : 'No incidents recorded yet. Inject sample drift and execute a scan.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredIncidents.map((inc) => {
              const isResolved = inc.status === 'resolved'
              const isOpen = inc.status === 'open'
              const statusRailColor = isOpen
                ? 'var(--danger-solid)'
                : isResolved
                ? 'var(--success-solid)'
                : 'var(--warning-solid)'

              return (
                <div
                  key={inc.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: '#FFFFFF',
                    border: '1px solid var(--border-light)',
                    borderLeft: `4px solid ${statusRailColor}`,
                    boxShadow: 'var(--elev-1)',
                    transition: 'all var(--duration-fast) var(--ease-out-quint)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-micro)',
                        color: 'var(--text-tertiary)',
                        fontWeight: 700,
                      }}>
                        #{inc.id}
                      </span>
                      <h3 style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--forest)',
                      }}>
                        {inc.title}
                      </h3>
                      {inc.workload && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-micro)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--cream)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--forest)',
                        }}>
                          {inc.workload}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Honesty Source Badge */}
                      {inc.explain_source && (
                        <Badge variant={inc.explain_source.startsWith('ai:') ? 'info' : 'neutral'}>
                          {inc.explain_source.startsWith('ai:') ? 'AI' : 'Rule-based'}
                        </Badge>
                      )}

                      <Badge variant={isOpen ? 'danger' : isResolved ? 'success' : 'warning'} dot>
                        {inc.status?.toUpperCase()}
                      </Badge>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInspectWorkload(inc)}
                        icon={ExternalLink}
                        title={`View drift analysis for ${inc.workload || 'workload'}`}
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>

                  {/* Incident Explanation narrative */}
                  {inc.explanation && (
                    <p style={{
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                      margin: 0,
                    }}>
                      {inc.explanation}
                    </p>
                  )}

                  {/* Metadata footer strip: relative time with absolute title */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-micro)',
                    color: 'var(--text-tertiary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span title={inc.created_at ? new Date(inc.created_at).toLocaleString() : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>Detected: {formatRelativeTime(inc.created_at)}</span>
                      </span>

                      {inc.resolved_at && (
                        <span title={new Date(inc.resolved_at).toLocaleString()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-text)' }}>
                          <CheckCircle2 size={12} color="var(--success-solid)" />
                          <span>Resolved: {formatRelativeTime(inc.resolved_at)}</span>
                        </span>
                      )}
                    </div>

                    {inc.fix_applied && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Fix Applied:</span>
                        <code style={{ fontSize: 11 }}>{inc.fix_applied}</code>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
