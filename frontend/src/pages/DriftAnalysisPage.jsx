import { useState, useMemo } from 'react'
import {
  AlertTriangle, CheckCircle2, Search, Zap, Wrench, Shield,
  Sparkles, History, Cpu, FileCode, Check, RefreshCw, Info, Lock,
  ArrowRight, AlertCircle, FileText, CheckCircle
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Panel, Badge, Button, Alert,
  DiffView, AnomalyScoreBar, CopyButton, FingerprintChip
} from '../components/ui/index.jsx'
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header & Quick Controls ── */}
      <PageHeader
        title="Drift Analysis &amp; Remediation"
        subtitle="Exact field comparisons, unsupervised anomaly scores, AI root-cause explanations, and deterministic GitOps restoration."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
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
              Inject Sample Drift
            </Button>
          </div>
        }
      />

      {/* ── Operation Status via CallChips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
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

      {/* ── Workload Selector Strip (Scrollable Chips with Status Dots) ── */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 6,
        paddingTop: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {workloads.map((w) => {
          const d = driftByName[w.name]
          const isWDrifted = d ? d.drifted : !w.matchesBaseline
          const isSelected = selectedWl?.name === w.name

          return (
            <button
              key={w.name}
              type="button"
              onClick={() => setSelectedWorkload(w.name)}
              className={isSelected ? 'surface-honeydew' : 'surface'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                border: isSelected ? '2px solid var(--forest)' : '1px solid var(--border-light)',
                background: isSelected ? 'var(--honeydew)' : '#FFFFFF',
                boxShadow: isSelected ? 'var(--elev-2)' : 'var(--elev-1)',
                flexShrink: 0,
                transition: 'all var(--duration-fast) var(--ease-out-quint)',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isWDrifted ? 'var(--danger-solid)' : 'var(--success-solid)',
                boxShadow: isWDrifted ? '0 0 0 2px rgba(168, 34, 36, 0.2)' : 'none',
              }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 'var(--text-micro)', color: isWDrifted ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                  {isWDrifted ? 'Drift detected' : 'In baseline'}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Main Workload Audit View ── */}
      {selectedWl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Workload Header & Meta */}
          <Panel
            title={`${selectedWl.name} — Configuration Audit`}
            subtitle={`Namespace: ${selectedWl.namespace} · Resource: Deployment`}
            icon={Shield}
            right={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRawConfig(v => !v)}
                  icon={FileCode}
                >
                  {showRawConfig ? 'Hide Manifest' : 'View Manifest'}
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isDrifted}
                  busy={busy === `fix:${selectedWl.name}`}
                  onClick={() => handleFix(selectedWl.name)}
                  icon={Wrench}
                >
                  Fix (Restore Baseline)
                </Button>
              </div>
            }
          >
            {/* Status overview badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Badge variant={isDrifted ? 'danger' : 'success'} dot>
                {isDrifted ? 'DRIFT DETECTED' : 'HEALTHY · MATCHES BASELINE'}
              </Badge>

              {selectedDrift && (
                <Badge variant={selectedDrift.diffCount > 0 ? 'danger' : 'neutral'}>
                  {selectedDrift.diffCount} field(s) drifted
                </Badge>
              )}

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-micro)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Live:</span>
                <FingerprintChip value={selectedWl.fingerprint} length={8} />
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-micro)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Baseline:</span>
                <FingerprintChip value={selectedWl.baselineFingerprint} length={8} />
              </div>
            </div>

            {/* Unsupervised IsolationForest Anomaly Gauge */}
            {selectedOutlier && (
              <div style={{ marginBottom: 18 }}>
                <AnomalyScoreBar
                  score={selectedOutlier.anomalyScore}
                  isOutlier={selectedOutlier.isOutlier}
                  threshold={selectedOutlier.threshold || 0.5}
                />
              </div>
            )}

            {/* If no scan run yet */}
            {!scan && (
              <div style={{
                padding: '16px 20px',
                background: 'var(--cream)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--border-light)',
              }}>
                No active scan performed in this session. Click <strong>"Scan for Drift"</strong> above to compare live manifests against GitOps baseline fingerprints.
              </div>
            )}

            {/* If healthy */}
            {scan && !isDrifted && (
              <div className="surface-honeydew" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <CheckCircle2 size={24} color="var(--success-solid)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--forest)' }}>
                    Workload is verified in sync with canonical GitOps baseline
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Live SHA-256 fingerprint matches canonical specification. Zero unauthorized drift detected.
                  </div>
                </div>
              </div>
            )}

            {/* Diffs View Component */}
            {selectedDrift && selectedDrift.drifted && selectedDrift.diffs?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: 'var(--forest)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertTriangle size={15} color="var(--danger-solid)" />
                  <span>Exact Field Discrepancies ({selectedDrift.diffs.length})</span>
                </div>
                <DiffView diffs={selectedDrift.diffs} />
              </div>
            )}

            {/* Raw JSON toggle */}
            {showRawConfig && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--forest)' }}>
                    Normalized Manifest Configuration
                  </span>
                  <CopyButton text={JSON.stringify(selectedWl.config, null, 2)} label="Copy Manifest" />
                </div>
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: 'var(--cream)',
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  maxHeight: 280,
                  overflow: 'auto',
                  lineHeight: 1.5,
                  boxShadow: 'var(--elev-1)',
                }}>
                  {JSON.stringify(selectedWl.config, null, 2)}
                </pre>
              </div>
            )}
          </Panel>

          {/* AI Root-Cause & Diagnosis Card */}
          {selectedExplanation && (
            <div className="surface" style={{
              padding: '24px',
              border: '1px solid var(--sage-mid)',
              background: 'rgba(255, 255, 255, 0.95)',
              boxShadow: 'var(--elev-2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--honeydew)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--forest)',
                  }}>
                    <Sparkles size={17} />
                  </div>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--forest)', letterSpacing: '-0.01em' }}>
                      Root-Cause Diagnosis &amp; Remediation Guidance
                    </h2>
                  </div>
                </div>

                {/* Honesty Principle: Explicit Source Labeling */}
                <Badge variant={selectedExplanation.source?.startsWith('ai:') ? 'info' : 'neutral'}>
                  {selectedExplanation.source?.startsWith('ai:')
                    ? `AI · ${selectedExplanation.source.replace('ai:', '')}`
                    : 'Rule-based, not AI'}
                </Badge>
              </div>

              {/* Informative aiError Notice Banner (Notice, not alarm) */}
              {selectedExplanation.aiError && (
                <div style={{
                  marginBottom: 14,
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--cream)',
                  border: '1px solid var(--border-mid)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-caption)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Info size={15} color="var(--forest)" />
                  <span>
                    <strong>Provider notice:</strong> {selectedExplanation.aiError} — deterministic rule-based analysis was used instead.
                  </span>
                </div>
              )}

              <p style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                marginBottom: 20,
                maxWidth: '78ch',
              }}>
                {selectedExplanation.explanation}
              </p>

              {/* 3 Info Tiles: Cause / Risk / Action with Icons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)',
                  border: '1px solid var(--border-light)'
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
                    marginBottom: 6,
                  }}>
                    <AlertTriangle size={13} color="var(--warning-solid)" />
                    <span>Likely Cause</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {selectedExplanation.likelyCause || '—'}
                  </div>
                </div>

                <div style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--text-micro)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wider)',
                    color: 'var(--danger-text)',
                    marginBottom: 6,
                  }}>
                    <AlertCircle size={13} color="var(--danger-solid)" />
                    <span>Operational Risk</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {selectedExplanation.risk || '—'}
                  </div>
                </div>

                <div style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cream)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--text-micro)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wider)',
                    color: 'var(--success-text)',
                    marginBottom: 6,
                  }}>
                    <CheckCircle2 size={13} color="var(--success-solid)" />
                    <span>Recommended Action</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {selectedExplanation.recommendedAction || '—'}
                  </div>
                </div>
              </div>

              {/* Air-gap security statement */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 18,
                fontSize: 'var(--text-micro)',
                color: 'var(--text-tertiary)',
              }}>
                <Lock size={12} />
                <span>AI generates analytical reasoning only. Remediation patches are mathematically compiled from GitOps baseline specifications.</span>
              </div>
            </div>
          )}

          {/* Similar Past Incidents Matching (with match % bar) */}
          {selectedMatches.length > 0 && (
            <Panel
              title="Historical Incident Matches (TF-IDF Similarity)"
              subtitle="Similar past drift patterns identified from the SQLite incident repository"
              icon={History}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedMatches.map((m) => {
                  const matchPct = Math.round(m.similarity * 100)
                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--elev-1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            #{m.id}
                          </span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                            {m.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                            Fix: <code>{m.suggestedFix || m.fix_applied || 'revert to baseline'}</code>
                          </span>
                          <Badge variant="success">verified</Badge>
                        </div>
                      </div>

                      {/* Match percentage gauge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--border-light)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${matchPct}%`,
                            height: '100%',
                            background: 'var(--info-solid)',
                            borderRadius: 'var(--radius-full)',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 'var(--text-micro)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--info-text)',
                        }}>
                          {matchPct}% match
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* Fix Verification Result Card with Fingerprint Comparison */}
          {fixResult && (
            <div
              className="surface"
              style={{
                padding: '18px 24px',
                border: `1.5px solid ${fixResult.verified ? 'var(--success-border)' : 'var(--danger-border)'}`,
                background: fixResult.verified ? 'var(--success-bg)' : 'var(--danger-bg)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--elev-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {fixResult.verified ? (
                  <CheckCircle2 size={22} color="var(--success-solid)" />
                ) : (
                  <AlertTriangle size={22} color="var(--danger-solid)" />
                )}
                <div>
                  <h3 style={{
                    fontWeight: 800,
                    fontSize: 'var(--text-base)',
                    color: fixResult.verified ? 'var(--success-text)' : 'var(--danger-text)'
                  }}>
                    {fixResult.verified ? 'Remediation Verified & Confirmed' : 'Verification Warning: Incomplete Resolution'}
                  </h3>
                  <div style={{ fontSize: 'var(--text-micro)', color: fixResult.verified ? 'var(--success)' : 'var(--danger)' }}>
                    SHA-256 fingerprint mathematically confirmed against baseline definition
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--text-primary)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0,0,0,0.06)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Reverted field(s):</span>{' '}
                  <strong>{(fixResult.revertedFields || []).join(', ') || 'None'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Post-apply rescan:</span>{' '}
                  <strong>{fixResult.rescan?.healthy ? 'Healthy — zero drift remaining' : 'Still drifted'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Live Fingerprint:</span>{' '}
                  <code style={{ fontSize: 11 }}>{fixResult.fingerprint?.slice(0, 14)}…</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Baseline Reference:</span>{' '}
                  <code style={{ fontSize: 11 }}>{fixResult.baselineFingerprint?.slice(0, 14)}…</code>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Panel>
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No workload selected. Select a workload from the inventory above.
          </div>
        </Panel>
      )}
    </div>
  )
}
