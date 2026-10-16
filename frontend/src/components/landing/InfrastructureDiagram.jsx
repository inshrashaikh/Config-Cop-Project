import { useState } from 'react'
import { SiDocker, SiKubernetes } from 'react-icons/si'
import { Shield, ArrowDown, Check, AlertTriangle, Cpu, RefreshCw, Sparkles, Terminal } from 'lucide-react'
import './InfrastructureDiagram.css'

export default function InfrastructureDiagram() {
  const [fixed, setFixed] = useState(false)

  return (
    <div className="infra-diagram-root" aria-label="Configuration Drift Detection Architecture Visualization">
      {/* Visual Window Header */}
      <div className="infra-diagram-header">
        <div className="infra-diagram-title">
          <Shield size={16} color="var(--forest)" />
          <span>Config Cop Engine · Drift Audit Pipeline</span>
          <span className="infra-diagram-title-badge">k8s/v1.31</span>
        </div>
        <div className="infra-diagram-dots" aria-hidden="true">
          <span className="infra-diagram-dot" />
          <span className="infra-diagram-dot" />
          <span className="infra-diagram-dot" style={{ background: 'var(--sage-deep)' }} />
        </div>
      </div>

      <div className="infra-pipeline">
        {/* Tier 1: Target Workload in Kubernetes */}
        <div className="infra-card">
          <div className="infra-card-header">
            <div className="infra-card-label">
              <SiKubernetes color="#326CE5" size={17} />
              <span>Deployment: <strong>payment-gateway</strong></span>
            </div>
            <div className="infra-card-tag">ns: production</div>
          </div>

          {/* 2-Col Split: Baseline Source vs Live Cluster State */}
          <div className="infra-split-grid">
            {/* Baseline Column */}
            <div className="infra-subcard baseline">
              <div className="infra-subcard-title">
                <span style={{ color: 'var(--success)' }}>Expected (GitOps Baseline)</span>
                <span className="badge badge-success" style={{ fontSize: 9, padding: '1px 5px' }}>sha256:7a4c</span>
              </div>
              <div className="infra-diff-list">
                <div className="infra-diff-row">
                  <span className="infra-diff-key">replicas</span>
                  <span className="infra-diff-val-ok">3</span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">cpu.limit</span>
                  <span className="infra-diff-val-ok">500m</span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">image.tag</span>
                  <span className="infra-diff-val-ok">v2.4.1</span>
                </div>
              </div>
            </div>

            {/* Live State Column */}
            <div className={`infra-subcard ${fixed ? 'baseline' : 'live-drifted'}`}>
              <div className="infra-subcard-title">
                <span style={{ color: fixed ? 'var(--success)' : 'var(--danger)' }}>
                  {fixed ? 'Live Cluster (Restored)' : 'Live Cluster (Active)'}
                </span>
                <span
                  className={`badge ${fixed ? 'badge-success' : 'badge-danger'}`}
                  style={{ fontSize: 9, padding: '1px 5px' }}
                >
                  {fixed ? 'sha256:7a4c' : 'sha256:e92b ⚠️'}
                </span>
              </div>
              <div className="infra-diff-list">
                <div className={`infra-diff-row ${!fixed ? 'drift-highlight' : ''}`}>
                  <span className="infra-diff-key">replicas</span>
                  <span className={fixed ? 'infra-diff-val-ok' : 'infra-diff-val-err'}>
                    {fixed ? '3' : '1 (differs)'}
                  </span>
                </div>
                <div className={`infra-diff-row ${!fixed ? 'drift-highlight' : ''}`}>
                  <span className="infra-diff-key">cpu.limit</span>
                  <span className={fixed ? 'infra-diff-val-ok' : 'infra-diff-val-err'}>
                    {fixed ? '500m' : '2000m (differs)'}
                  </span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">image.tag</span>
                  <span className="infra-diff-val-ok">v2.4.1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connector: Detection & Anomaly Analysis */}
        <div className="infra-flow-connector" aria-hidden="true">
          <div className="infra-flow-line" />
          <div className="infra-flow-pulse">
            <Cpu size={11} />
            <span>scikit-learn IsolationForest · Anomaly Score: {fixed ? '0.04' : '0.87'}</span>
          </div>
          <div className="infra-flow-line" />
        </div>

        {/* Tier 2: AI Root Cause Analysis & Remediation */}
        <div className="infra-analysis-box">
          <div className="infra-analysis-header">
            <span className="infra-ai-badge">
              <Sparkles size={11} />
              <span>AI Root-Cause Diagnosis</span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Deterministic SHA-256 verification
            </span>
          </div>

          <div className="infra-ai-text">
            {fixed ? (
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                ✅ Workload restored to canonical baseline specs. Fingerprint matches repository commit. Zero drift remaining.
              </span>
            ) : (
              <span>
                <strong>Diagnosis:</strong> Manual <code>kubectl scale</code> and resource override detected outside of CI/CD.
                Potential cost explosion and single-point-of-failure risk on single replica.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
              <SiDocker size={13} color="#2496ED" />
              <span>Container: payment-svc:v2.4.1</span>
            </div>
            <button
              onClick={() => setFixed(f => !f)}
              className={`btn btn-sm ${fixed ? 'btn-secondary' : 'btn-primary'}`}
              style={{ fontSize: 11, padding: '4px 10px', height: 26 }}
            >
              {fixed ? <RefreshCw size={12} /> : <Check size={12} />}
              {fixed ? 'Simulate Drift Again' : 'One-Click Baseline Restore'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer info strip */}
      <div className="infra-diagram-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: fixed ? 'var(--success)' : 'var(--danger)' }} />
          <span>Status: {fixed ? 'Healthy · In Sync' : 'Drift Detected · 2 Differs'}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          Deterministic Remediation
        </span>
      </div>
    </div>
  )
}
