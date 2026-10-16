import { Link } from 'react-router-dom'
import {
  Server, AlertTriangle, Cpu, History, RefreshCw,
  Search, Shield, CheckCircle, ArrowRight, Zap, Terminal, Activity
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Stat, Panel, Badge, Button } from '../components/ui/index.jsx'
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
    ? new Date(scan.summary.scannedAt).toLocaleTimeString()
    : 'Never'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Top Header / Quick Action Bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            Cluster Overview
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Real-time infrastructure health, configuration drift detection, and anomaly scoring.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Button
            variant="primary"
            onClick={handleScan}
            busy={busy === 'scan'}
          >
            <Search size={14} />
            Scan for Drift
          </Button>

          <Button
            variant="danger"
            onClick={() => handleInject({})}
            busy={busy === 'inject'}
          >
            <Zap size={14} />
            Inject Drift
          </Button>

          <Button
            variant="secondary"
            onClick={handleReset}
            busy={busy === 'reset'}
          >
            <RefreshCw size={14} />
            Reset Demo
          </Button>

          <Button
            variant="ghost"
            onClick={handleTestAi}
            busy={busy === 'ai'}
          >
            <Activity size={14} />
            Test AI
          </Button>
        </div>
      </div>

      {/* ── Real-time Operation Status via CallChips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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

      {/* ── Key Metrics Strip ── */}
      <div className="stats-grid">
        <Stat
          label="Monitored Workloads"
          value={workloads.length.toString()}
          accent="forest"
          hint={`namespace: ${cluster?.namespace || 'default'}`}
        />
        <Stat
          label="Drifted Deployments"
          value={scan ? drifted.length.toString() : '—'}
          accent={drifted.length > 0 ? 'danger' : 'success'}
          hint={scan ? (drifted.length > 0 ? `${drifted.join(', ')}` : 'all match baseline') : 'run a scan'}
        />
        <Stat
          label="Outliers (IsolationForest)"
          value={scan ? outliersList.length.toString() : '—'}
          accent={outliersList.length > 0 ? 'warning' : 'forest'}
          hint={scan ? (outliersList.length > 0 ? outliersList.join(', ') : 'none detected') : 'unsupervised model'}
        />
        <Stat
          label="Open Incidents"
          value={openIncidents.length.toString()}
          accent={openIncidents.length > 0 ? 'warning' : 'forest'}
          hint="logged in sqlite"
        />
        <Stat
          label="Last Scan"
          value={lastScanTime}
          accent="forest"
          hint={scan ? 'automated fingerprint check' : 'pending trigger'}
        />
      </div>

      {/* ── Main Dashboard Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Workload Health Card */}
        <Panel
          title="Workload Status Breakdown"
          subtitle="SHA-256 canonical fingerprint evaluation vs baseline"
          right={
            <Link to="/dashboard/workloads" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View All <ArrowRight size={13} />
            </Link>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    background: isDrifted ? 'var(--danger-bg)' : 'rgba(255, 255, 255, 0.7)',
                    border: `1px solid ${isDrifted ? 'var(--danger-border)' : 'var(--border-light)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Server size={16} color={isDrifted ? 'var(--danger)' : 'var(--forest)'} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--forest)' }}>
                        {w.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        fp: {w.fingerprint?.slice(0, 10)}…
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
                      style={{ fontSize: 11, padding: '3px 8px' }}
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
        <Panel title="System &amp; Verification Environment" subtitle="Engine metadata, AI model provenance, and storage">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Kubernetes Cluster</span>
                <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
                  {clusterLive ? 'LIVE' : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED'}
                </Badge>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {clusterLive
                  ? `Connected to context: ${cluster?.context} in namespace ${cluster?.namespace}`
                  : clusterUnavailable
                  ? 'No cluster reachable. Start Minikube or configure kubeconfig.'
                  : `Simulated engine active (${cluster?.error || 'no cluster found'}). Safe sandbox mode.`}
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>AI Reasoning Provider</span>
                <Badge variant={aiConnected ? 'info' : aiErrored ? 'danger' : 'neutral'}>
                  {aiConnected ? `${llm?.provider}/${llm?.model}` : 'Rule-Based Fallback'}
                </Badge>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {aiConnected
                  ? `Connected to ${llm?.provider}. Explanations generated via LLM; fixes deterministically computed from baseline.`
                  : aiMissingKey
                  ? `Provider ${llm?.provider || ''} configured but API key missing. Running deterministic rule-based analysis.`
                  : 'Operating in deterministic offline mode. No external AI dependencies needed.'}
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Anomaly Model</span>
                <Badge variant="info">scikit-learn</Badge>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Unsupervised IsolationForest trained on workload configuration vectors (resources, limits, replicas).
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Recent Incidents Strip ── */}
      <Panel
        title="Recent Configuration Incidents"
        subtitle="Historical drift detections logged to SQLite with recurring problem matches"
        right={
          <Link to="/dashboard/incidents" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            Full Incident Log <ArrowRight size={13} />
          </Link>
        }
      >
        {incidents.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No recorded incidents yet. Inject sample drift and run a scan to trigger an incident.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    #{inc.id}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>
                      {inc.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
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
