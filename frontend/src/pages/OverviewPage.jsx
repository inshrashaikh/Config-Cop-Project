import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, AlertTriangle, RefreshCw, Search, Shield,
  ArrowRight, Zap, Activity, Clock, CheckCircle2,
  FileText, Database, Cpu, Layers
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Stat, Panel, Badge, Button,
  FingerprintChip, ProgressRing
} from '../components/ui/index.jsx'
import CallChip from '../components/reactbits/CallChip.jsx'
import ThoughtLine from '../components/reactbits/ThoughtLine.jsx'

export default function OverviewPage() {
  const {
    workloads,
    scan,
    drifted,
    driftByName,
    outlierByName,
    status,
    busy,
    operations,
    thoughtState,
    clusterLive,
    clusterUnavailable,
    clusterMode,
    cluster,
    aiConnected,
    aiErrored,
    aiMissingKey,
    llm,
    incidents,
    handleScan,
    handleInject,
    handleReset,
    handleTestAi,
    setSelectedWorkload,
  } = useApp()

  const openIncidents = status?.incidentsOpen || []
  const outliersList = scan?.summary?.outliers || []
  const lastScanTime = scan?.summary?.scannedAt
    ? new Date(scan.summary.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending'

  // Workload summary metrics
  const healthStats = useMemo(() => {
    let healthyCount = 0
    let driftedCount = 0
    let outlierCount = 0

    workloads.forEach(w => {
      const d = driftByName[w.name]
      const isDrifted = d ? d.drifted : !w.matchesBaseline
      const isOutlier = outlierByName[w.name]?.isOutlier

      if (isDrifted) driftedCount++
      else healthyCount++

      if (isOutlier) outlierCount++
    })

    const total = workloads.length || 1
    const healthyPct = Math.round((healthyCount / total) * 100)

    return { healthyCount, driftedCount, outlierCount, healthyPct, total: workloads.length }
  }, [workloads, driftByName, outlierByName])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Row 1: Page Header & Quick Controls ── */}
      <PageHeader
        title="Cluster Control Tower"
        subtitle="Real-time Kubernetes infrastructure health, configuration drift detection, and anomaly scoring."
        actions={
          <>
            <Button
              variant="primary"
              onClick={handleScan}
              busy={busy === 'scan'}
              icon={Search}
            >
              Scan for Drift
            </Button>

            <Button
              variant="danger"
              onClick={() => handleInject({})}
              busy={busy === 'inject'}
              icon={Zap}
            >
              Inject Drift
            </Button>

            <Button
              variant="secondary"
              onClick={handleReset}
              busy={busy === 'reset'}
              icon={RefreshCw}
            >
              Reset Demo
            </Button>

            <Button
              variant="ghost"
              onClick={handleTestAi}
              busy={busy === 'ai'}
              icon={Activity}
            >
              Test AI
            </Button>
          </>
        }
      />

      {/* ── Row 2: Consolidated Real-Time Activity Strip ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--elev-1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--text-micro)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wider)',
          color: 'var(--forest)',
          marginRight: 6,
        }}>
          <Activity size={14} />
          <span>Engine Pipeline:</span>
        </div>

        <CallChip
          label="Drift Scan"
          status={operations.scan.status}
          duration={operations.scan.duration}
          onRetry={handleScan}
        />
        <CallChip
          label="Drift Injection"
          status={operations.inject.status}
          duration={operations.inject.duration}
          onRetry={() => handleInject({})}
        />
        <CallChip
          label="AI Connectivity"
          status={operations.ai.status}
          duration={operations.ai.duration}
          onRetry={handleTestAi}
        />
        <CallChip
          label="Cluster Reset"
          status={operations.reset.status}
          duration={operations.reset.duration}
          onRetry={handleReset}
        />
      </div>

      {/* ── ThoughtLine trace if scan is active ── */}
      {thoughtState.active && (
        <ThoughtLine
          steps={thoughtState.steps}
          title={thoughtState.title}
          startTime={thoughtState.startTime}
          isComplete={thoughtState.isComplete}
          isError={thoughtState.isError}
        />
      )}

      {/* ── Row 3: 5-Metric Responsive Stats Strip ── */}
      <div className="stats-grid">
        <Stat
          label="Monitored Workloads"
          value={workloads.length.toString()}
          accent="forest"
          hint={`namespace: ${cluster?.namespace || 'default'}`}
          icon={Server}
        />
        <Stat
          label="Drifted Deployments"
          value={scan ? drifted.length.toString() : '—'}
          accent={drifted.length > 0 ? 'danger' : 'success'}
          hint={scan ? (drifted.length > 0 ? `${drifted.join(', ')}` : 'all match baseline') : 'run scan to check'}
          icon={AlertTriangle}
        />
        <Stat
          label="Outliers (IsolationForest)"
          value={scan ? outliersList.length.toString() : '—'}
          accent={outliersList.length > 0 ? 'warning' : 'forest'}
          hint={scan ? (outliersList.length > 0 ? outliersList.join(', ') : 'zero outliers') : 'unsupervised model'}
          icon={Cpu}
        />
        <Stat
          label="Open Incidents"
          value={openIncidents.length.toString()}
          accent={openIncidents.length > 0 ? 'warning' : 'forest'}
          hint="recorded in sqlite"
          icon={Layers}
        />
        <Stat
          label="Last Audit Cycle"
          value={lastScanTime}
          accent="forest"
          hint={scan ? 'fingerprint comparison' : 'pending trigger'}
          icon={Clock}
        />
      </div>

      {/* ── Row 4: Workload Health & System Provenance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Workload Health Card with mini health ring */}
        <Panel
          title="Workload Sync Status"
          subtitle="SHA-256 canonical fingerprint evaluation vs baseline"
          icon={Server}
          right={
            <Link
              to="/dashboard/workloads"
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none', gap: 4 }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          }
        >
          {/* Health Gauge Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProgressRing
                progress={healthStats.healthyPct}
                size={38}
                strokeWidth={4}
                color="var(--success-solid)"
                trackColor="var(--danger-border)"
              />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                  {healthStats.healthyCount} of {healthStats.total} Workloads in Sync
                </div>
                <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)' }}>
                  {healthStats.healthyPct}% conformity to GitOps baseline specifications
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {healthStats.driftedCount > 0 && (
                <Badge variant="danger" dot>{healthStats.driftedCount} DRIFTED</Badge>
              )}
              {healthStats.outlierCount > 0 && (
                <Badge variant="warning">{healthStats.outlierCount} OUTLIER</Badge>
              )}
            </div>
          </div>

          {/* Workload Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workloads.map((w) => {
              const d = driftByName[w.name]
              const isDrifted = d ? d.drifted : !w.matchesBaseline
              const isOutlier = outlierByName[w.name]?.isOutlier

              return (
                <div
                  key={w.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isDrifted ? 'var(--danger-bg)' : 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${isDrifted ? 'var(--danger-border)' : 'var(--border-light)'}`,
                    boxShadow: 'var(--elev-1)',
                    transition: 'all var(--duration-fast) var(--ease-out-quint)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: isDrifted ? 'rgba(168, 34, 36, 0.12)' : 'var(--honeydew)',
                      color: isDrifted ? 'var(--danger-solid)' : 'var(--forest)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <Server size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--forest)' }}>
                        {w.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{w.namespace}</span>
                        <span>·</span>
                        <FingerprintChip value={w.fingerprint} length={8} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOutlier && <Badge variant="warning">outlier</Badge>}
                    <Badge variant={isDrifted ? 'danger' : 'success'} dot>
                      {isDrifted ? 'DRIFTED' : 'HEALTHY'}
                    </Badge>
                    <Link
                      to="/dashboard/drift"
                      onClick={() => setSelectedWorkload(w.name)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12, padding: '3px 9px', minHeight: 28 }}
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* System & AI Provenance Card */}
        <Panel
          title="System &amp; Verification Environment"
          subtitle="Engine metadata, AI model provenance, and storage state"
          icon={Shield}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cluster card */}
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--cream)',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--forest)' }}>
                  Kubernetes Cluster
                </span>
                <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
                  {clusterLive ? 'LIVE' : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED'}
                </Badge>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {clusterLive
                  ? `Connected to context '${cluster?.context}' in namespace '${cluster?.namespace}'`
                  : clusterUnavailable
                  ? 'No cluster reachable. Start Minikube or configure kubeconfig context.'
                  : `Simulated engine active (${cluster?.error || 'no cluster found'}). Safe deterministic sandbox mode.`}
              </p>
            </div>

            {/* AI Provider card */}
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--cream)',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--forest)' }}>
                  AI Reasoning Provider
                </span>
                <Badge variant={aiConnected ? 'info' : aiErrored ? 'danger' : 'neutral'}>
                  {aiConnected ? `${llm?.provider}/${llm?.model}` : 'Rule-Based Fallback'}
                </Badge>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {aiConnected
                  ? `Connected to ${llm?.provider}. Explanations generated via LLM; fixes deterministically computed from baseline.`
                  : aiMissingKey
                  ? `Provider ${llm?.provider || ''} configured but API key missing. Running deterministic rule-based analysis.`
                  : 'Operating in deterministic offline mode. Zero external AI dependencies required.'}
              </p>
            </div>

            {/* Anomaly model */}
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--cream)',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--forest)' }}>
                  Anomaly Detection Engine
                </span>
                <Badge variant="info">scikit-learn</Badge>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Unsupervised IsolationForest trained on workload configuration vectors (resources, limits, replicas).
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Row 5: Recent Incidents Timeline ── */}
      <Panel
        title="Recent Configuration Incidents"
        subtitle="Historical drift detections logged to SQLite with recurring problem matches"
        icon={Layers}
        right={
          <Link
            to="/dashboard/incidents"
            className="btn btn-ghost btn-sm"
            style={{ textDecoration: 'none', gap: 4 }}
          >
            <span>Full Incident Log</span>
            <ArrowRight size={13} />
          </Link>
        }
      >
        {incidents.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No recorded incidents yet. Inject sample drift and run a scan to trigger an incident.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--elev-1)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    #{inc.id}
                  </span>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                      {inc.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)' }}>
                      {inc.created_at} {inc.resolved_at ? `→ Resolved ${inc.resolved_at}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant={inc.status === 'open' ? 'danger' : inc.status === 'resolved' ? 'success' : 'warning'}>
                    {inc.status}
                  </Badge>
                  {inc.explain_source && (
                    <Badge variant={inc.explain_source.startsWith('ai:') ? 'info' : 'neutral'}>
                      {inc.explain_source.startsWith('ai:') ? 'AI' : 'Rule'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
