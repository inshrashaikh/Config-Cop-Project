import { useState, useMemo } from 'react'
import {
  AlertTriangle, CheckCircle, Search, Zap, Wrench, Shield,
  Sparkles, History, Cpu, FileCode, Check, RefreshCw, Info, Lock
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Panel, Badge, Button, Alert } from '../components/ui/index.jsx'
import ThoughtLine from '../components/reactbits/ThoughtLine.jsx'
import CallChip from '../components/reactbits/CallChip.jsx'

export default function DriftAnalysisPage() {
  const {
    workloads,
    scan,
    selectedWorkload,
    setSelectedWorkload,
    driftByName,
    outlierByName,
    fixResults,
    busy,
    operations,
    thoughtState,
    handleScan,
    handleInject,
    handleFix,
  } = useApp()

  const [showRawConfig, setShowRawConfig] = useState(false)

  const selectedWl = useMemo(
    () => workloads.find((w) => w.name === selectedWorkload) || workloads[0],
    [workloads, selectedWorkload],
  )

  const selectedDrift = selectedWl ? driftByName[selectedWl.name] : null
  const selectedOutlier = selectedWl ? outlierByName[selectedWl.name] : null
  const selectedExplanation = selectedWl ? scan?.explanations?.[selectedWl.name] : null
  const selectedMatches = selectedWl ? (scan?.matchedIncidents?.[selectedWl.name] || []) : []
  const fixResult = selectedWl ? fixResults[selectedWl.name] : null

  const isDrifted = selectedDrift ? selectedDrift.drifted : (selectedWl && !selectedWl.matchesBaseline)

  const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header & Quick Controls ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            Drift Analysis &amp; Remediation
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Exact field comparisons, unsupervised anomaly scores, AI root-cause explanations, and deterministic GitOps restoration.
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
            Inject Sample Drift
          </Button>
        </div>
      </div>

      {/* ── Operation Status via CallChips ── */}
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
      </div>

      {/* ── ThoughtLine progress during scan ── */}
      {thoughtState.active && (
        <ThoughtLine
          steps={thoughtState.steps}
          title={thoughtState.title}
          startTime={thoughtState.startTime}
          isComplete={thoughtState.isComplete}
          isError={thoughtState.isError}
        />
      )}

      {/* ── Workload Selector Strip ── */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {workloads.map((w) => {
          const d = driftByName[w.name]
          const isWDrifted = d ? d.drifted : !w.matchesBaseline
          const isSelected = selectedWorkload === w.name

          return (
            <button
              key={w.name}
              onClick={() => setSelectedWorkload(w.name)}
              className="surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                border: isSelected ? '2px solid var(--forest)' : '1px solid var(--border-light)',
                background: isSelected ? 'var(--honeydew)' : '#FFFFFF',
                boxShadow: isSelected ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isWDrifted ? 'var(--danger)' : 'var(--success)',
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>{w.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {isWDrifted ? 'Drift detected' : 'In baseline'}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Main Workload Drift Detail ── */}
      {selectedWl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Workload Header & Meta */}
          <Panel
            title={`${selectedWl.name} — Configuration Audit`}
            subtitle={`Namespace: ${selectedWl.namespace} · Resource: Deployment`}
            right={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRawConfig(v => !v)}
                >
                  <FileCode size={13} />
                  {showRawConfig ? 'Hide Raw Config' : 'View Raw Config'}
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isDrifted}
                  busy={busy === `fix:${selectedWl.name}`}
                  onClick={() => handleFix(selectedWl.name)}
                >
                  <Wrench size={13} />
                  Fix (Restore Baseline)
                </Button>
              </div>
            }
          >
            {/* Status overview badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Badge variant={isDrifted ? 'danger' : 'success'} dot>
                {isDrifted ? 'DRIFT DETECTED' : 'HEALTHY · MATCHES BASELINE'}
              </Badge>

              {selectedDrift && (
                <Badge variant={selectedDrift.diffCount > 0 ? 'danger' : 'neutral'}>
                  {selectedDrift.diffCount} field(s) drifted
                </Badge>
              )}

              <Badge variant="neutral">
                Live: <code>{selectedWl.fingerprint?.slice(0, 10)}…</code>
              </Badge>

              <Badge variant="neutral">
                Baseline: <code>{selectedWl.baselineFingerprint?.slice(0, 10)}…</code>
              </Badge>

              {selectedOutlier && (
                <Badge variant={selectedOutlier.isOutlier ? 'warning' : 'neutral'}>
                  IsolationForest Score: {selectedOutlier.anomalyScore}
                  {selectedOutlier.isOutlier ? ' (OUTLIER)' : ''}
                </Badge>
              )}
            </div>

            {/* If no scan run yet */}
            {!scan && (
              <div style={{ padding: 16, background: 'var(--cream)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 13 }}>
                No active scan performed yet. Click <strong>"Scan for Drift"</strong> above to compare live manifests with baseline fingerprints.
              </div>
            )}

            {/* If healthy */}
            {scan && !isDrifted && (
              <div className="surface-honeydew" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckCircle size={20} color="var(--success)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--forest)' }}>
                    Workload is perfectly in sync
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    SHA-256 fingerprint <code>{selectedWl.fingerprint}</code> matches baseline canonical definition.
                  </div>
                </div>
              </div>
            )}

            {/* Diffs Table */}
            {selectedDrift && selectedDrift.drifted && selectedDrift.diffs?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>
                  Exact Field Discrepancies
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Configuration Field Path</th>
                        <th style={{ color: 'var(--success)' }}>Expected (Baseline)</th>
                        <th style={{ color: 'var(--danger)' }}>Actual (Live Cluster)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDrift.diffs.map((d) => (
                        <tr key={d.path}>
                          <td>
                            <code style={{ fontSize: 12, color: 'var(--forest)', fontWeight: 600 }}>{d.path}</code>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                              {fmt(d.expected)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                              {fmt(d.actual)}
                            </span>
                          </td>
                          <td>
                            <Badge variant="danger">drifted</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw JSON toggle */}
            {showRawConfig && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--forest)' }}>
                  Full Normalized Configuration Object
                </div>
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: 'var(--cream)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  maxHeight: 260,
                  overflow: 'auto',
                }}>
                  {JSON.stringify(selectedWl.config, null, 2)}
                </pre>
              </div>
            )}
          </Panel>

          {/* AI Root-Cause & Diagnosis Card */}
          {selectedExplanation && (
            <div className="surface" style={{ padding: '20px 24px', border: '1px solid var(--sage-mid)', background: 'rgba(255,255,255,0.92)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="var(--forest)" />
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--forest)', letterSpacing: '-0.01em' }}>
                    Root Cause Diagnosis &amp; Remediation Plan
                  </span>
                </div>
                <Badge variant={selectedExplanation.source?.startsWith('ai:') ? 'info' : 'neutral'}>
                  {selectedExplanation.source?.startsWith('ai:') ? selectedExplanation.source : 'Deterministic Rule-based'}
                </Badge>
              </div>

              {selectedExplanation.aiError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12 }}>
                  AI provider notice: {selectedExplanation.aiError} — deterministic rule-based analysis used.
                </div>
              )}

              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 16 }}>
                {selectedExplanation.explanation}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Likely Cause
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                    {selectedExplanation.likelyCause || '—'}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Operational Risk
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                    {selectedExplanation.risk || '—'}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--cream)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Recommended Action
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                    {selectedExplanation.recommendedAction || '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)' }}>
                <Lock size={12} />
                <span>AI generates analytical text only. Remediation patches are mathematically compiled from GitOps baseline JSON.</span>
              </div>
            </div>
          )}

          {/* Similar Past Incidents Matching */}
          {selectedMatches.length > 0 && (
            <Panel title="Historical Incident Matches (TF-IDF Cosine Similarity)" subtitle="Similar past drift patterns identified from the SQLite incident repository">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedMatches.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid var(--border-light)',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant="info">{Math.round(m.similarity * 100)}% match</Badge>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>#{m.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>{m.title}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Verified fix: <code>{m.suggestedFix || m.fix_applied || 'revert to baseline'}</code>
                      </span>
                      <Badge variant="success">verified</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Fix Verification Result */}
          {fixResult && (
            <div
              className="surface"
              style={{
                padding: '16px 20px',
                border: `1px solid ${fixResult.verified ? 'var(--success-border)' : 'var(--danger-border)'}`,
                background: fixResult.verified ? 'var(--success-bg)' : 'var(--danger-bg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {fixResult.verified ? (
                  <CheckCircle size={18} color="var(--success)" />
                ) : (
                  <AlertTriangle size={18} color="var(--danger)" />
                )}
                <span style={{ fontWeight: 800, fontSize: 14, color: fixResult.verified ? 'var(--success)' : 'var(--danger)' }}>
                  {fixResult.verified ? 'Remediation Verified & Confirmed' : 'Verification Warning'}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Reverted field(s): <strong>{(fixResult.revertedFields || []).join(', ') || 'None'}</strong></div>
                <div>Live fingerprint <code>{fixResult.fingerprint}</code> {fixResult.verified ? '==' : '!='} Baseline <code>{fixResult.baselineFingerprint}</code></div>
                <div>Post-apply scan status: <strong>{fixResult.rescan?.healthy ? 'Healthy — zero drift remaining' : 'Still drifted'}</strong></div>
                <div>Resolved incident(s): {(fixResult.resolvedIncidents || []).map(id => `#${id}`).join(', ') || 'None'}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Panel>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No workload selected.
          </div>
        </Panel>
      )}
    </div>
  )
}
