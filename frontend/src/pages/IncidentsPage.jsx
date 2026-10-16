import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History, Search, Filter, AlertTriangle, CheckCircle,
  Clock, Shield, ArrowRight, Sparkles, RefreshCw, Layers
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Panel, Badge, Button, EmptyState, Stat } from '../components/ui/index.jsx'

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
      const matchesSearch = (inc.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (inc.explanation || '').toLowerCase().includes(search.toLowerCase()) ||
        String(inc.id).includes(search)

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

  const handleInspectWorkload = (inc) => {
    // Extract workload name if possible from title (e.g. "Drift detected in payment-gateway")
    const words = inc.title.split(' ')
    const workloadName = words[words.length - 1]
    if (workloadName) {
      setSelectedWorkload(workloadName)
      navigate('/dashboard/drift')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            Incident Repository
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Historical configuration drift detections, root-cause analyses, and verified remediation audit trails in SQLite.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            onClick={() => loadIncidents()}
            busy={loadingIncidents}
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="stats-grid">
        <Stat
          label="Total Recorded Incidents"
          value={counts.total.toString()}
          accent="forest"
          hint="persisted in sqlite"
        />
        <Stat
          label="Open Incidents"
          value={counts.open.toString()}
          accent={counts.open > 0 ? 'danger' : 'success'}
          hint="requiring attention"
        />
        <Stat
          label="Resolved & Verified"
          value={counts.resolved.toString()}
          accent="success"
          hint="restored to baseline"
        />
        <Stat
          label="Failed Remediations"
          value={counts.failed.toString()}
          accent={counts.failed > 0 ? 'warning' : 'forest'}
          hint="verification issues"
        />
      </div>

      {/* ── Search & Filter Bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search incident title, id, or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: 30, height: 36, width: 280, fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--cream)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          {[
            { id: 'all', label: `All (${counts.total})` },
            { id: 'open', label: `Open (${counts.open})` },
            { id: 'resolved', label: `Resolved (${counts.resolved})` },
            { id: 'failed', label: `Failed (${counts.failed})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: 12, height: 28 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Incidents List ── */}
      <Panel>
        {filteredIncidents.length === 0 ? (
          <EmptyState
            icon={History}
            title="No incidents found"
            description={search ? `No incidents match "${search}". Try adjusting your filters.` : 'No configuration drift incidents recorded yet. Inject sample drift and trigger a scan.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className="surface"
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--forest-mid)', background: 'var(--cream)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                      #{inc.id}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>
                      {inc.title}
                    </span>
                    <Badge variant={inc.status === 'open' ? 'danger' : inc.status === 'resolved' ? 'success' : 'warning'} dot>
                      {inc.status}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <span>Opened: {inc.created_at}</span>
                    {inc.resolved_at && <span>· Resolved: {inc.resolved_at}</span>}
                  </div>
                </div>

                {inc.explanation && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {inc.explanation}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--border-light)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    {inc.explain_source && (
                      <Badge variant={inc.explain_source.startsWith('ai:') ? 'info' : 'neutral'}>
                        {inc.explain_source}
                      </Badge>
                    )}

                    {inc.fix_applied && (
                      <span style={{ color: inc.status === 'failed' ? 'var(--danger)' : 'var(--success)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                        🔧 {inc.fix_applied}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInspectWorkload(inc)}
                  >
                    View in Drift Analysis
                    <ArrowRight size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
