import { useState } from 'react'
import {
  Terminal, Server, RefreshCw, Zap, BookmarkPlus,
  AlertTriangle, Shield, CheckCircle, ChevronUp, ChevronDown, Activity
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Panel, Badge, Button, Modal, Alert } from '../components/ui/index.jsx'
import CallChip from '../components/reactbits/CallChip.jsx'

export default function OperationsPage() {
  const {
    workloads,
    rollouts,
    busy,
    operations,
    clusterLive,
    cluster,
    handleScale,
    handleInject,
    handleReset,
    handleCaptureBaseline,
  } = useApp()

  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            Cluster Operations &amp; Scaling
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Direct Kubernetes deployment controls, replica scaling, baseline snapshotting, and controlled drift injection.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            onClick={handleCaptureBaseline}
            busy={busy === 'baseline'}
          >
            <BookmarkPlus size={14} />
            Capture Baseline
          </Button>

          <Button
            variant="danger"
            onClick={() => handleInject({})}
            busy={busy === 'inject'}
          >
            <Zap size={14} />
            Inject Sample Drift
          </Button>

          <Button
            variant="ghost"
            onClick={() => setConfirmResetOpen(true)}
            busy={busy === 'reset'}
          >
            <RefreshCw size={14} />
            Reset Demo State
          </Button>
        </div>
      </div>

      {/* ── Real-time Operation Status via CallChips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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
        subtitle={clusterLive
          ? `Executing real kubectl scale against namespace '${cluster?.namespace || 'default'}'`
          : 'Operating in simulated cluster mode (safe state progression)'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workloads.map((w) => {
            const ro = rollouts[w.name]
            const busyKey = `scale:${w.name}`
            const desired = ro?.desiredReplicas ?? (w.config?.replicas ?? 1)
            const available = ro?.availableReplicas ?? desired

            return (
              <div
                key={w.name}
                className="surface"
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--honeydew)', display: 'grid', placeItems: 'center', color: 'var(--forest)' }}>
                    <Server size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>
                      {w.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Namespace: <code>{w.namespace}</code> · Rollout: {ro?.status || 'Active'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>
                      {available} / {desired} Available
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {ro?.reason || 'Replicas matching desire'}
                    </div>
                  </div>

                  {/* Stepper buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--cream)',
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleScale(w.name, -1)}
                      disabled={busy === busyKey || desired <= 0}
                      style={{ padding: '2px 8px', height: 26, minWidth: 26 }}
                      title="Scale down 1 replica"
                    >
                      -
                    </button>

                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                      width: 28,
                      textAlign: 'center',
                      color: 'var(--forest)',
                    }}>
                      {desired}
                    </span>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleScale(w.name, +1)}
                      disabled={busy === busyKey}
                      style={{ padding: '2px 8px', height: 26, minWidth: 26 }}
                      title="Scale up 1 replica"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* ── Sandbox & Chaos Testing Panel ── */}
      <Panel title="Drift Injection &amp; Baseline Management" subtitle="Controlled perturbation tools for testing detection and GitOps remediation">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="surface-cream" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Zap size={16} color="var(--danger)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Controlled Drift Injection</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
              Randomly perturbs deployment replica counts, image tags, or CPU resource limits to simulate an unauthorized manual hotfix or GitOps divergence.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleInject({})}
              busy={busy === 'inject'}
            >
              Trigger Drift Injection
            </Button>
          </div>

          <div className="surface-cream" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookmarkPlus size={16} color="var(--forest)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Snapshot Baseline</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
              Overwrites the current baseline with the active live cluster state. Future drift scans will treat the current live configurations as the canonical reference.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCaptureBaseline}
              busy={busy === 'baseline'}
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
              Confirm &amp; Reset
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {clusterLive
            ? 'This will re-apply `k8s/demo-workloads.yaml` directly to the live Kubernetes cluster and reset baseline fingerprints.'
            : 'This will reset all simulated workloads, clear pending scans, and restore the demo environment to its pristine baseline.'}
        </p>
      </Modal>
    </div>
  )
}
