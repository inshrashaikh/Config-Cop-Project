import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server, Search, Filter, AlertTriangle, CheckCircle,
  ExternalLink, Wrench, Shield, ChevronDown, ChevronUp, Code
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Panel, Badge, Button, EmptyState } from '../components/ui/index.jsx'

export default function WorkloadsPage() {
  const {
    workloads,
    driftByName,
    outlierByName,
    rollouts,
    busy,
    handleFix,
    setSelectedWorkload,
  } = useApp()

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'drifted' | 'healthy' | 'outlier'
  const [expandedWorkload, setExpandedWorkload] = useState(null)

  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.namespace?.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      const isDrifted = driftByName[w.name] ? driftByName[w.name].drifted : !w.matchesBaseline
      const isOutlier = outlierByName[w.name]?.isOutlier

      if (filter === 'drifted') return isDrifted
      if (filter === 'healthy') return !isDrifted
      if (filter === 'outlier') return isOutlier
      return true
    })
  }, [workloads, search, filter, driftByName, outlierByName])

  const handleInspect = (workloadName) => {
    setSelectedWorkload(workloadName)
    navigate('/dashboard/drift')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            Workload Inventory
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Inspecting deployed Kubernetes manifests, canonical SHA-256 fingerprints, and container specifications.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search workloads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: 30, height: 36, width: 220, fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--cream)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'drifted', label: 'Drifted' },
              { id: 'healthy', label: 'Healthy' },
              { id: 'outlier', label: 'Outliers' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`btn btn-sm ${filter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 12, height: 28 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Workloads Table ── */}
      <Panel>
        {filteredWorkloads.length === 0 ? (
          <EmptyState
            title="No workloads found"
            description={search ? `No workloads match "${search}". Try clearing your filter.` : 'No workloads are currently monitored.'}
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Workload / Namespace</th>
                  <th>Image</th>
                  <th>Replicas</th>
                  <th>Limits (CPU / Mem)</th>
                  <th>Fingerprint</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkloads.map((w) => {
                  const d = driftByName[w.name]
                  const isDrifted = d ? d.drifted : !w.matchesBaseline
                  const isOutlier = outlierByName[w.name]?.isOutlier
                  const ro = rollouts[w.name]
                  const isExpanded = expandedWorkload === w.name

                  return (
                    <>
                      <tr key={w.name}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: isDrifted ? 'var(--danger-bg)' : 'var(--honeydew)', display: 'grid', placeItems: 'center', color: isDrifted ? 'var(--danger)' : 'var(--forest)' }}>
                              <Server size={16} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--forest)' }}>
                                {w.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {w.namespace} · Deployment
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                            {w.config?.image || '—'}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: 12 }}>
                            <strong>{ro ? `${ro.availableReplicas}/${ro.desiredReplicas}` : (w.config?.replicas ?? 1)}</strong>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
                              {ro?.status === 'Complete' ? 'ready' : ro?.status || 'active'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {w.config?.resources?.limits?.cpu || '—'} / {w.config?.resources?.limits?.memory || '—'}
                          </div>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--cream)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                            {w.fingerprint?.slice(0, 10)}…
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <Badge variant={isDrifted ? 'danger' : 'success'} dot>
                              {isDrifted ? 'DRIFTED' : 'HEALTHY'}
                            </Badge>
                            {isOutlier && <Badge variant="warning">outlier</Badge>}
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedWorkload(isExpanded ? null : w.name)}
                              title="Toggle configuration payload"
                            >
                              <Code size={13} />
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleInspect(w.name)}
                            >
                              <ExternalLink size={13} />
                              Inspect
                            </Button>

                            {isDrifted && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleFix(w.name)}
                                busy={busy === `fix:${w.name}`}
                              >
                                <Wrench size={13} />
                                Fix
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable JSON Config Drawer */}
                      {isExpanded && (
                        <tr key={`${w.name}-expanded`}>
                          <td colSpan={7} style={{ background: 'var(--cream)', padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>
                                Normalized Configuration Manifest: <code>{w.name}</code>
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                Fingerprint: <code>{w.fingerprint}</code> (Baseline: <code>{w.baselineFingerprint}</code>)
                              </span>
                            </div>
                            <pre style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              background: '#FFFFFF',
                              padding: 12,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)',
                              maxHeight: 240,
                              overflow: 'auto',
                              color: 'var(--text-primary)',
                            }}>
                              {JSON.stringify(w.config, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
