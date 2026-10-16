import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server, Search, Filter, AlertTriangle, CheckCircle,
  ExternalLink, Wrench, Shield, ChevronDown, ChevronUp, Code,
  Layers, Check
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Panel, Badge, Button, EmptyState,
  SegmentedControl, FingerprintChip, CopyButton
} from '../components/ui/index.jsx'

// Simple safe JSON syntax highlighter tokenizer (zero new dependencies)
function renderJsonWithSyntax(obj) {
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
  const highlighted = jsonStr.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let color = 'var(--text-primary)'
      let weight = '400'
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          color = 'var(--forest)'
          weight = '700'
        } else {
          color = 'var(--green-2)'
        }
      } else if (/true|false/.test(match)) {
        color = 'var(--info-solid)'
        weight = '600'
      } else if (/null/.test(match)) {
        color = 'var(--text-tertiary)'
      } else {
        color = 'var(--warning-solid)'
      }
      return `<span style="color: ${color}; font-weight: ${weight};">${match}</span>`
    }
  )

  return <code dangerouslySetInnerHTML={{ __html: highlighted }} />
}

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
  const searchInputRef = useRef(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'drifted' | 'healthy' | 'outlier'
  const [expandedWorkload, setExpandedWorkload] = useState(null)

  // Keyboard shortcut: '/' focuses the search field
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filter & search computation
  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      const q = search.toLowerCase()
      const matchesSearch = w.name.toLowerCase().includes(q) ||
        (w.namespace || '').toLowerCase().includes(q) ||
        (w.config?.image || '').toLowerCase().includes(q) ||
        (w.fingerprint || '').toLowerCase().includes(q)

      if (!matchesSearch) return false

      const isDrifted = driftByName[w.name] ? driftByName[w.name].drifted : !w.matchesBaseline
      const isOutlier = outlierByName[w.name]?.isOutlier

      if (filter === 'drifted') return isDrifted
      if (filter === 'healthy') return !isDrifted
      if (filter === 'outlier') return isOutlier
      return true
    })
  }, [workloads, search, filter, driftByName, outlierByName])

  // Workload counts for SegmentedControl
  const filterCounts = useMemo(() => {
    let driftedCount = 0
    let healthyCount = 0
    let outlierCount = 0

    workloads.forEach(w => {
      const isDrifted = driftByName[w.name] ? driftByName[w.name].drifted : !w.matchesBaseline
      const isOutlier = outlierByName[w.name]?.isOutlier
      if (isDrifted) driftedCount++
      else healthyCount++
      if (isOutlier) outlierCount++
    })

    return {
      all: workloads.length,
      drifted: driftedCount,
      healthy: healthyCount,
      outlier: outlierCount,
    }
  }, [workloads, driftByName, outlierByName])

  const handleInspect = (workloadName) => {
    setSelectedWorkload(workloadName)
    navigate('/dashboard/drift')
  }

  const filterOptions = [
    { id: 'all',     label: 'All',      count: filterCounts.all },
    { id: 'drifted', label: 'Drifted',  count: filterCounts.drifted },
    { id: 'healthy', label: 'Healthy',  count: filterCounts.healthy },
    { id: 'outlier', label: 'Outliers', count: filterCounts.outlier },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <PageHeader
        title="Workload Inventory"
        subtitle="Auditing deployed Kubernetes manifests, canonical SHA-256 fingerprints, and container specifications."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            {/* Search Input with '/' hotkey affordance */}
            <div className="input-wrapper" style={{ width: 240 }}>
              <Search size={14} className="input-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search (press '/' to focus)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                aria-label="Search workloads by name, image, or fingerprint"
              />
            </div>

            {/* Segmented Control Filter */}
            <SegmentedControl
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              name="workload-filter"
            />
          </div>
        }
      />

      {/* ── Workloads Table ── */}
      <Panel>
        {filteredWorkloads.length === 0 ? (
          <EmptyState
            title="No workloads found"
            description={
              search
                ? `No workloads match "${search}". Try clearing your filter or adjusting the query.`
                : 'No workloads are currently monitored in this cluster namespace.'
            }
            action={
              search ? (
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" aria-label="Kubernetes Workloads Table">
              <thead>
                <tr>
                  <th>Workload / Namespace</th>
                  <th>Image</th>
                  <th>Replicas</th>
                  <th>Limits (CPU / Mem)</th>
                  <th>Canonical Fingerprint</th>
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
                    <Fragment key={w.name}>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: 'var(--radius-sm)',
                              background: isDrifted ? 'rgba(168, 34, 36, 0.12)' : 'var(--honeydew)',
                              display: 'grid',
                              placeItems: 'center',
                              color: isDrifted ? 'var(--danger-solid)' : 'var(--forest)',
                              flexShrink: 0,
                            }}>
                              <Server size={17} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--forest)' }}>
                                {w.name}
                              </div>
                              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)' }}>
                                {w.namespace} · Deployment
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: 'var(--text-primary)' }}>
                            {w.config?.image || '—'}
                          </span>
                        </td>

                        <td className="tabular-nums">
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                            {ro ? `${ro.availableReplicas} / ${ro.desiredReplicas}` : (w.config?.replicas ?? 1)}
                            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 500 }}>
                              {ro?.status === 'Complete' ? 'ready' : ro?.status || 'active'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                            {w.config?.resources?.limits?.cpu || '—'} / {w.config?.resources?.limits?.memory || '—'}
                          </div>
                        </td>

                        <td>
                          <FingerprintChip value={w.fingerprint} length={10} />
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                              title={isExpanded ? 'Collapse configuration manifest' : 'Expand configuration manifest'}
                              aria-expanded={isExpanded}
                            >
                              <Code size={13} />
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleInspect(w.name)}
                              title={`Inspect drift analysis for ${w.name}`}
                            >
                              <ExternalLink size={13} />
                              <span>Inspect</span>
                            </Button>

                            {isDrifted && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleFix(w.name)}
                                busy={busy === `fix:${w.name}`}
                                title={`Restore baseline for ${w.name}`}
                              >
                                <Wrench size={13} />
                                <span>Fix</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable JSON Config Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: 'var(--cream)', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--forest)' }}>
                                  Normalized Configuration Object: <code>{w.name}</code>
                                </span>
                                <CopyButton text={JSON.stringify(w.config, null, 2)} label="Copy JSON" />
                              </div>
                              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)', display: 'flex', gap: 12, fontFamily: 'var(--font-mono)' }}>
                                <span>Live: {w.fingerprint?.slice(0, 16)}…</span>
                                <span>Baseline: {w.baselineFingerprint?.slice(0, 16)}…</span>
                              </div>
                            </div>
                            <pre style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              background: '#FFFFFF',
                              padding: 14,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)',
                              maxHeight: 260,
                              overflow: 'auto',
                              lineHeight: 1.5,
                              boxShadow: 'var(--elev-1)',
                            }}>
                              {renderJsonWithSyntax(w.config)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
