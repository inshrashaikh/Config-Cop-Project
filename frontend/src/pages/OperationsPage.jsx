import { useState } from 'react'
import {
  Terminal, Server, RefreshCw, Zap, BookmarkPlus,
  AlertTriangle, Shield, CheckCircle2, Minus, Plus,
  AlertCircle, Activity, Info
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Panel, Badge, Button, Modal, Alert
} from '../components/ui/index.jsx'
import CallChip from '../components/reactbits/CallChip.jsx'

export default function OperationsPage() {
  const {
    workloads,
    rollouts,
    busy,
    operations,
    clusterLive,
    clusterUnavailable,
    cluster,
    handleScale,
    handleInject,
    handleReset,
    handleCaptureBaseline,
  } = useApp()

  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [confirmInjectOpen, setConfirmInjectOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <PageHeader
        title="Cluster Operations &amp; Scaling"
        subtitle="Direct Kubernetes deployment controls, replica scaling, baseline snapshotting, and controlled drift perturbation."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <Button
              variant="secondary"
              onClick={handleCaptureBaseline}
              busy={busy === 'baseline'}
              icon={BookmarkPlus}
            >
              Capture Baseline
            </Button>

            <Button
              variant="danger"
              onClick={() => setConfirmInjectOpen(true)}
              busy={busy === 'inject'}
              icon={Zap}
            >
              Inject Sample Drift
            </Button>

            <Button
              variant="ghost"
              onClick={() => setConfirmResetOpen(true)}
              busy={busy === 'reset'}
              icon={RefreshCw}
            >
              Reset Demo State
            </Button>
          </div>
        }
      />

      {/* ── Real-time Operation Status via CallChips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <CallChip
          label="Baseline Capture"
          status={operations.baseline.status}
          duration={operations.baseline.duration}
          onRetry={handleCaptureBaseline}
        />
        <CallChip
          label="Drift Injection"
          status={operations.inject.status}
          duration={operations.inject.duration}
          onRetry={() => handleInject({})}
        />
        <CallChip
          label="Demo Reset"
          status={operations.reset.status}
          duration={operations.reset.duration}
          onRetry={handleReset}
        />
      </div>

      {/* ── Workload Deployment Scaling Controls ── */}
      <Panel
        title="Live Replica Management"
        subtitle={
          clusterLive
            ? `Executing real kubectl scale against namespace '${cluster?.namespace || 'default'}'`
            : 'Operating in simulated cluster mode (safe state progression)'
        }
        icon={Server}
        right={
          <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
            {clusterLive ? 'LIVE K8S CLUSTER' : 'SIMULATED ROLLOUTS'}
          </Badge>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workloads.map((w) => {
            const ro = rollouts[w.name]
            const busyKey = `scale:${w.name}`
            const desired = ro?.desiredReplicas ?? (w.config?.replicas ?? 1)
            const available = ro?.availableReplicas ?? desired
            const isScaleBusy = busy === busyKey

            return (
              <div
                key={w.name}
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  boxShadow: 'var(--elev-1)',
                  transition: 'all var(--duration-fast) var(--ease-out-quint)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--honeydew)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--forest)',
                    flexShrink: 0,
                  }}>
                    <Server size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--forest)' }}>
                        {w.name}
                      </span>
                      <Badge variant="neutral">{clusterLive ? 'kubectl scale' : 'simulated'}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Namespace: <code>{w.namespace}</code> · Rollout: {ro?.status || 'Active'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                      {available} / {desired} Available
                    </div>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>
                      {ro?.reason || 'Replicas in baseline state'}
                    </div>
                  </div>

                  {/* Accessible Replica Stepper with +/- buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--cream)',
                    padding: 4,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleScale(w.name, -1)}
                      disabled={isScaleBusy || desired <= 0}
                      style={{
                        padding: 0,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        borderRadius: 'var(--radius-sm)',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                      aria-label={`Scale down ${w.name} by 1 replica`}
                      title={`Scale down ${w.name} to ${Math.max(0, desired - 1)}`}
                    >
                      <Minus size={14} />
                    </button>

                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 800,
                      width: 36,
                      textAlign: 'center',
                      color: 'var(--forest)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {desired}
                    </span>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleScale(w.name, +1)}
                      disabled={isScaleBusy}
                      style={{
                        padding: 0,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        borderRadius: 'var(--radius-sm)',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                      aria-label={`Scale up ${w.name} by 1 replica`}
                      title={`Scale up ${w.name} to ${desired + 1}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* ── Controlled Chaos & Governance Panel ── */}
      <Panel
        title="Drift Perturbation &amp; Baseline Management"
        subtitle="Controlled engineering tools for testing detection pipelines and GitOps remediation"
        icon={Terminal}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Inject Drift Card (Danger Zone) */}
          <div style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Zap size={16} color="var(--danger-solid)" />
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                  Controlled Drift Injection
                </h3>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                Simulates an out-of-band manual modification (e.g. ad-hoc hotfix via <code>kubectl edit</code>). Modifies replica counts, container images, or CPU resource limits to trigger detection.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmInjectOpen(true)}
              busy={busy === 'inject'}
              icon={Zap}
              style={{ alignSelf: 'flex-start' }}
            >
              Trigger Drift Injection…
            </Button>
          </div>

          {/* Baseline Snapshot Card */}
          <div style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <BookmarkPlus size={16} color="var(--forest)" />
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                  Snapshot Live Baseline
                </h3>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                Overwrites the canonical reference baseline with current live cluster configurations. Subsequent scans will evaluate conformity against this new snapshot.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCaptureBaseline}
              busy={busy === 'baseline'}
              icon={BookmarkPlus}
              style={{ alignSelf: 'flex-start' }}
            >
              Capture New Baseline
            </Button>
          </div>
        </div>
      </Panel>

      {/* ── Confirmation Modal for Reset ── */}
      <Modal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Confirm Demo State Reset"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmResetOpen(false)
                await handleReset()
              }}
            >
              Confirm &amp; Reset Demo
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {clusterLive
            ? 'This will re-apply `k8s/demo-workloads.yaml` directly to the active live Kubernetes cluster and reset all baseline SHA-256 fingerprints to original specs.'
            : 'This will reset all simulated workloads, clear pending scans, and restore the demo environment to its pristine initial baseline.'}
        </p>
      </Modal>

      {/* ── Confirmation Modal for Inject Drift ── */}
      <Modal
        open={confirmInjectOpen}
        onClose={() => setConfirmInjectOpen(false)}
        title="Inject Controlled Drift"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={() => setConfirmInjectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmInjectOpen(false)
                await handleInject({})
              }}
            >
              Execute Drift Injection
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {clusterLive
            ? 'This will patch live deployments on your real Kubernetes cluster with perturbed replicas or resource limits to simulate unauthorized configuration drift.'
            : 'This will perturb simulated workload manifests in the local sandbox to test detection and IsolationForest anomaly analysis.'}
        </p>
      </Modal>
    </div>
  )
}
